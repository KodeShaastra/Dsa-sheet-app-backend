import type { Express } from 'express';
import request from 'supertest';
import { prisma } from '../src/lib/prisma.js';

/** Empty every table. Order matters: chapters → topics → problems are RESTRICT. */
export async function resetDb() {
  await prisma.user.deleteMany();
  await prisma.problem.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.chapter.deleteMany();
}

/**
 * A tiny sheet. Rows are inserted out of order on purpose,
 * so tests can check that the API sorts by displayOrder.
 */
export async function seedSmallSheet() {
  const graphs = await prisma.chapter.create({
    data: { title: 'Graphs', slug: 'graphs', displayOrder: 2 },
  });
  const arrays = await prisma.chapter.create({
    data: { title: 'Arrays', slug: 'arrays', displayOrder: 1 },
  });

  const twoPointers = await prisma.topic.create({
    data: { chapterId: arrays.id, title: 'Two Pointers', displayOrder: 2 },
  });
  const hashing = await prisma.topic.create({
    data: { chapterId: arrays.id, title: 'Hashing', displayOrder: 1 },
  });
  const bfs = await prisma.topic.create({
    data: { chapterId: graphs.id, title: 'BFS', displayOrder: 1 },
  });

  const p = (
    topicId: number,
    title: string,
    difficulty: 'EASY' | 'MEDIUM' | 'HARD',
    displayOrder: number,
  ) =>
    prisma.problem.create({
      data: {
        topicId,
        title,
        difficulty,
        displayOrder,
        practiceUrl: `https://example.test/${displayOrder}`,
      },
    });

  const containsDuplicate = await p(hashing.id, 'Contains Duplicate', 'EASY', 2);
  const twoSum = await p(hashing.id, 'Two Sum', 'EASY', 1);
  const threeSum = await p(twoPointers.id, '3Sum', 'MEDIUM', 1);
  const trappingRain = await p(twoPointers.id, 'Trapping Rain Water', 'HARD', 2);
  const islands = await p(bfs.id, 'Number of Islands', 'MEDIUM', 1);

  // API ids are strings.
  const id = (row: { id: number }) => String(row.id);
  return {
    chapters: { arrays: id(arrays), graphs: id(graphs) },
    problems: {
      twoSum: id(twoSum),
      containsDuplicate: id(containsDuplicate),
      threeSum: id(threeSum),
      trappingRain: id(trappingRain),
      islands: id(islands),
    },
  };
}

/** Sign up a new user and return an agent that sends their login cookie. */
export async function loggedInAgent(app: Express, email: string) {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/signup')
    .send({ email, name: 'Test', password: 'password123' });
  if (res.status !== 201)
    throw new Error(`Signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

/** Paths from an error's details array, e.g. ["email", "password"]. */
export function detailPaths(body: { error: { details: { path: string }[] } }): string[] {
  return body.error.details.map((d) => d.path);
}

/** The full Set-Cookie header for `name`, e.g. "dsa_token=abc; Max-Age=900; Path=/; HttpOnly". */
export function setCookie(res: { headers: Record<string, unknown> }, name: string): string {
  const cookies = res.headers['set-cookie'] as string[] | undefined;
  const cookie = cookies?.find((c) => c.startsWith(`${name}=`));
  if (!cookie) throw new Error(`No ${name} cookie set`);
  return cookie;
}

/** Just the value from a Set-Cookie header. */
export function cookieValue(setCookieHeader: string): string {
  return setCookieHeader.split(';')[0]!.split('=').slice(1).join('=');
}
