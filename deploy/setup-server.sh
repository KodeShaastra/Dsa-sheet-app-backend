#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 EC2 server for the DSA Sheet app.
# Run on the server as the "ubuntu" user:
#   curl -fsSL https://raw.githubusercontent.com/KodeShaastra/Dsa-sheet-app-backend/main/deploy/setup-server.sh | bash
# Safe to run again: it skips steps that are already done.
#
# Secrets (database password, JWT_SECRET) are made here with openssl, written only to the backend's
# .env (readable by "ubuntu" only), and never printed.
set -euo pipefail

APPS="$HOME/apps"
BACKEND="$APPS/Dsa-sheet-app-backend"
FRONTEND="$APPS/Dsa-sheet-app-frontend"
REPO="https://github.com/KodeShaastra"

step() { printf '\n== %s\n' "$1"; }

step "1. Swap file (2 GB), so building Next.js doesn't run out of memory"
if ! swapon --show | grep -q .; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

step "2. System packages: Nginx, PostgreSQL, Git, Node.js 22, PM2"
sudo apt-get update -y
sudo apt-get install -y nginx postgresql git curl ca-certificates
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
command -v pm2 >/dev/null || sudo npm install -g pm2

step "3. Get the code"
mkdir -p "$APPS"
for repo in Dsa-sheet-app-backend Dsa-sheet-app-frontend; do
  if [ -d "$APPS/$repo/.git" ]; then
    git -C "$APPS/$repo" pull --ff-only
  else
    git clone "$REPO/$repo.git" "$APPS/$repo"
  fi
done

step "4. Database and backend settings (.env)"
if [ ! -f "$BACKEND/.env" ]; then
  DB_PASSWORD="$(openssl rand -hex 24)"
  JWT_SECRET="$(openssl rand -base64 48 | tr '+/' '-_' | tr -d '=\n')"
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = 'dsa'" | grep -q 1; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 -q -c "CREATE ROLE dsa LOGIN PASSWORD '$DB_PASSWORD';"
  else
    sudo -u postgres psql -v ON_ERROR_STOP=1 -q -c "ALTER ROLE dsa PASSWORD '$DB_PASSWORD';"
  fi
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'dsa_sheet'" | grep -q 1; then
    sudo -u postgres createdb -O dsa dsa_sheet
  fi
  umask 077
  cat > "$BACKEND/.env" <<EOF
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://dsa:$DB_PASSWORD@localhost:5432/dsa_sheet
JWT_SECRET=$JWT_SECRET
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=7
COOKIE_NAME=dsa_token
REFRESH_COOKIE_NAME=dsa_refresh
TRUST_PROXY_HOPS=2
EOF
  umask 022
  unset DB_PASSWORD JWT_SECRET
  echo "Wrote $BACKEND/.env (only you can read it)."
else
  echo "$BACKEND/.env already exists, keeping it."
fi

step "5. Build the backend, create the tables, add the sheet + demo user"
cd "$BACKEND"
npm ci
npx prisma migrate deploy
npm run build
npm run db:seed

step "6. Build the frontend (no BACKEND_URL: Nginx routes /api)"
cd "$FRONTEND"
npm ci
npm run build

step "7. Start both apps with PM2, and start them again after a reboot"
cd "$BACKEND"
pm2 startOrReload deploy/ecosystem.config.cjs
# App logs grow forever by default: start a new file at 10 MB and keep the last 5 (~100 MB at most).
pm2 describe pm2-logrotate >/dev/null 2>&1 || pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M >/dev/null
pm2 set pm2-logrotate:retain 5 >/dev/null
pm2 save
sudo env PATH="$PATH" "$(command -v pm2)" startup systemd -u "$USER" --hp "$HOME" >/dev/null

step "8. Nginx"
sudo cp "$BACKEND/deploy/nginx.conf" /etc/nginx/sites-available/dsa-sheet
sudo ln -sf /etc/nginx/sites-available/dsa-sheet /etc/nginx/sites-enabled/dsa-sheet
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

step "9. Check"
sleep 3
curl -fsS http://127.0.0.1/api/health && echo
curl -fsS -o /dev/null -w "website: %{http_code}\n" http://127.0.0.1/login
echo "Done. Open the CloudFront address in your browser."
