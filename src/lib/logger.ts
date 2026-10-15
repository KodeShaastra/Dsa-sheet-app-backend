import { pino } from 'pino';
import { env, isProd, isTest } from '../config/env.js';

/** Never log secrets: these fields are replaced with "[Redacted]". */
export const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  'passwordHash',
  'token',
  '*.password',
  '*.passwordHash',
  '*.token',
];

export const logger = pino({
  level: isTest ? 'silent' : isProd ? 'info' : 'debug',
  redact: redactPaths,
  ...(env.NODE_ENV === 'development' && {
    transport: { target: 'pino-pretty', options: { colorize: true } },
  }),
});
