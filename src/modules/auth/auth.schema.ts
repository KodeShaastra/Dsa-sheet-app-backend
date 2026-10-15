import { z } from 'zod';

// Trim and lowercase first, then check it's a valid email.
const email = z.string().trim().toLowerCase().pipe(z.email().max(255));

export const signupSchema = z.object({
  email,
  name: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(72), // bcrypt only uses the first 72 bytes
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
