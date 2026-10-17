// PM2 keeps both apps running, restarts them if they crash, and starts them again after a reboot.
// Start:   pm2 start deploy/ecosystem.config.cjs   (from the backend folder)
// Status:  pm2 status      Logs: pm2 logs      Restart: pm2 restart all
const path = require('node:path');

const apps = path.resolve(__dirname, '..', '..');

module.exports = {
  apps: [
    {
      name: 'dsa-backend',
      cwd: path.join(apps, 'Dsa-sheet-app-backend'),
      script: 'dist/server.js', // reads settings from .env in this folder
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
    },
    {
      name: 'dsa-frontend',
      cwd: path.join(apps, 'Dsa-sheet-app-frontend'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000 -H 127.0.0.1',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '600M',
    },
  ],
};
