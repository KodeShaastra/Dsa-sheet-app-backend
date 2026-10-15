import cookieParser from 'cookie-parser';
import express from 'express';
import { rateLimit as rateLimiter } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { isTest } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFound } from './middleware/error.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';

interface AppOptions {
  /** Turn rate limits on or off. Off by default in tests. */
  rateLimit?: boolean;
}

/** Builds the Express app without starting it, so tests can use it directly. */
export function createApp({ rateLimit = !isTest }: AppOptions = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(pinoHttp({ logger }));
  if (rateLimit) {
    app.use(
      rateLimiter({
        windowMs: 60 * 1000,
        limit: 300,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
      }),
    );
  }
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', createAuthRouter({ rateLimit }));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
