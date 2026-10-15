import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { deleteOldRefreshTokens } from './modules/auth/refreshTokens.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

async function cleanUpRefreshTokens() {
  try {
    const count = await deleteOldRefreshTokens();
    logger.info({ count }, 'Deleted old refresh tokens');
  } catch (err) {
    logger.error({ err }, 'Could not delete old refresh tokens');
  }
}

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
});

// On start, then once a day.
void cleanUpRefreshTokens();
const cleanupTimer = setInterval(() => void cleanUpRefreshTokens(), DAY_MS);
cleanupTimer.unref();

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  clearInterval(cleanupTimer);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  // Force exit if something hangs.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
