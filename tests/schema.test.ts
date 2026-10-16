import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';

async function makeFixtures() {
  const user = await prisma.user.create({
    data: { email: 'schema@test.dev', name: 'Schema', passwordHash: 'x' },
  });
  const chapter = await prisma.chapter.create({
    data: { title: 'Test Chapter', slug: 'test-chapter', displayOrder: 1 },
  });
  const topic = await prisma.topic.create({
    data: { chapterId: chapter.id, title: 'Test Topic', displayOrder: 1 },
  });
  const problem = await prisma.problem.create({
    data: { topicId: topic.id, title: 'Test Problem', difficulty: 'EASY', displayOrder: 1 },
  });
  return { user, chapter, topic, problem };
}

beforeEach(async () => {
  // Order matters: problems → topics → chapters are RESTRICT, not CASCADE.
  await prisma.user.deleteMany();
  await prisma.problem.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.chapter.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('database schema', () => {
  it('gives users a UUID id', async () => {
    const { user } = await makeFixtures();
    expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('rejects an email with capital letters at the database level', async () => {
    await expect(
      prisma.user.create({ data: { email: 'Caps@Test.dev', name: 'X', passwordHash: 'x' } }),
    ).rejects.toThrow();
  });

  it('stores scheduledFor as a date only, with PENDING as the default status', async () => {
    const { user, problem } = await makeFixtures();
    const item = await prisma.scheduledProblem.create({
      data: {
        userId: user.id,
        problemId: problem.id,
        scheduledFor: new Date('2026-10-20T23:45:00Z'),
      },
    });
    expect(item.scheduledFor.toISOString()).toBe('2026-10-20T00:00:00.000Z');
    expect(item.status).toBe('PENDING');
  });

  it('allows a problem on only one date per user', async () => {
    const { user, problem } = await makeFixtures();
    const base = { userId: user.id, problemId: problem.id };
    await prisma.scheduledProblem.create({
      data: { ...base, scheduledFor: new Date('2026-10-20') },
    });
    for (const date of ['2026-10-20', '2026-10-21']) {
      await expect(
        prisma.scheduledProblem.create({ data: { ...base, scheduledFor: new Date(date) } }),
      ).rejects.toThrow();
    }
  });

  it('allows one solved row per user and problem', async () => {
    const { user, problem } = await makeFixtures();
    await prisma.solvedProblem.create({ data: { userId: user.id, problemId: problem.id } });
    await expect(
      prisma.solvedProblem.create({ data: { userId: user.id, problemId: problem.id } }),
    ).rejects.toThrow();
  });

  it('deleting a user removes their solved and scheduled problems', async () => {
    const { user, problem } = await makeFixtures();
    await prisma.solvedProblem.create({ data: { userId: user.id, problemId: problem.id } });
    await prisma.scheduledProblem.create({
      data: { userId: user.id, problemId: problem.id, scheduledFor: new Date('2026-10-20') },
    });

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.solvedProblem.count()).toBe(0);
    expect(await prisma.scheduledProblem.count()).toBe(0);
  });

  it('deleting a problem removes its solved and scheduled problems', async () => {
    const { user, problem } = await makeFixtures();
    await prisma.solvedProblem.create({ data: { userId: user.id, problemId: problem.id } });
    await prisma.scheduledProblem.create({
      data: { userId: user.id, problemId: problem.id, scheduledFor: new Date('2026-10-20') },
    });

    await prisma.problem.delete({ where: { id: problem.id } });

    expect(await prisma.solvedProblem.count()).toBe(0);
    expect(await prisma.scheduledProblem.count()).toBe(0);
  });

  it('will not delete a chapter that still has topics', async () => {
    const { chapter } = await makeFixtures();
    await expect(prisma.chapter.delete({ where: { id: chapter.id } })).rejects.toThrow();
  });
});
