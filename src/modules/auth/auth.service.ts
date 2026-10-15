import bcrypt from 'bcrypt';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';
import type { LoginInput, SignupInput } from './auth.schema.js';

const BCRYPT_COST = 12;

// Compared against when the email doesn't exist, so a wrong email takes as long
// as a wrong password and the response time doesn't reveal which one it was.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_COST);

// Never send passwordHash back to the client.
const publicUser = { id: true, name: true, email: true } as const;

export async function signup(input: SignupInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError(409, 'CONFLICT', 'Email is already registered');

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  return prisma.user.create({
    data: { email: input.email, name: input.name, passwordHash },
    select: publicUser,
  });
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');
  }

  return { id: user.id, name: user.name, email: user.email };
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: publicUser });
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Not logged in');
  return user;
}
