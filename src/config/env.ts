import 'dotenv/config';
import { z } from 'zod';

const UNIT_MS = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 } as const;

/** "15m" → 900000. Units: s, m, h, d. */
const durationMs = z
  .string()
  .regex(/^\d+[smhd]$/, 'Use a number and a unit, like 15m, 1h, or 7d')
  .transform((s) => Number(s.slice(0, -1)) * UNIT_MS[s.slice(-1) as keyof typeof UNIT_MS]);

const cookieName = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/, 'Cookie names may only use letters, numbers, _ and -');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(0).max(65535).default(4000),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z
      .string()
      .min(32, 'JWT_SECRET must be at least 32 characters')
      .refine((s) => !s.startsWith('change-me'), 'JWT_SECRET is still the example value'),
    ACCESS_TOKEN_TTL: durationMs.prefault('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    COOKIE_NAME: cookieName.default('dsa_token'),
    REFRESH_COOKIE_NAME: cookieName.default('dsa_refresh'),
    // How many proxies sit in front of Express: 1 = Nginx, 2 = CloudFront → Nginx. Used for real client IPs.
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
  })
  .refine((e) => e.COOKIE_NAME !== e.REFRESH_COOKIE_NAME, {
    path: ['REFRESH_COOKIE_NAME'],
    message: 'REFRESH_COOKIE_NAME must be different from COOKIE_NAME',
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Zod messages name the bad setting but never print its value.
  console.error('Invalid environment variables:');
  console.error(z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
