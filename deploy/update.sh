#!/usr/bin/env bash
# Deploy the latest code from GitHub. Run on the server:  bash ~/apps/Dsa-sheet-app-backend/deploy/update.sh
set -euo pipefail

APPS="$HOME/apps"

echo "== Backend"
cd "$APPS/Dsa-sheet-app-backend"
git pull --ff-only
npm ci
npx prisma migrate deploy
npm run build
npm run db:seed # adds new problems or links; safe to repeat

echo "== Frontend"
cd "$APPS/Dsa-sheet-app-frontend"
git pull --ff-only
npm ci
npm run build

echo "== Restart"
cd "$APPS/Dsa-sheet-app-backend"
sudo cp deploy/nginx.conf /etc/nginx/sites-available/dsa-sheet
sudo nginx -t && sudo systemctl reload nginx
pm2 reload deploy/ecosystem.config.cjs
sleep 3
curl -fsS http://127.0.0.1/api/health && echo
