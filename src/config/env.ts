import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters')
    .refine((s) => !s.startsWith('change-me'), 'JWT_SECRET is still the example value'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_NAME: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/, 'COOKIE_NAME may only use letters, numbers, _ and -')
    .default('dsa_token'),
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
