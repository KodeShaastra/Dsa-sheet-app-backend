import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';

async function makeFixtures() {
  const user = await prisma.user.create({
    data: { email: 'schema@test.dev', name: 'Schema', passwordHash: 'x' },
  });
  const chapter = await prisma.chapter.create({
    data: { title: 'Test Chapter', slug: 'test-chapter', position: 1 },
  });
  const topic = await prisma.topic.create({
    data: { chapterId: chapter.id, title: 'Test Topic', position: 1 },
  });
  const problem = await prisma.problem.create({
    data: { topicId: topic.id, title: 'Test Problem', difficulty: 'EASY', position: 1 },
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

  it('stores plannedDate as a date only, with PLANNED as the default status', async () => {
    const { user, problem } = await makeFixtures();
    const plan = await prisma.studyPlan.create({
      data: {
        userId: user.id,
        problemId: problem.id,
        plannedDate: new Date('2026-10-20T23:45:00Z'),
      },
    });
    expect(plan.plannedDate.toISOString()).toBe('2026-10-20T00:00:00.000Z');
    expect(plan.status).toBe('PLANNED');
  });

  it('allows the same problem on different days but not twice on one day', async () => {
    const { user, problem } = await makeFixtures();
    const base = { userId: user.id, problemId: problem.id };
    await prisma.studyPlan.create({ data: { ...base, plannedDate: new Date('2026-10-20') } });
    await prisma.studyPlan.create({ data: { ...base, plannedDate: new Date('2026-10-21') } });
    await expect(
      prisma.studyPlan.create({ data: { ...base, plannedDate: new Date('2026-10-20') } }),
    ).rejects.toThrow();
  });

  it('allows one progress row per user and problem', async () => {
    const { user, problem } = await makeFixtures();
    await prisma.userProgress.create({ data: { userId: user.id, problemId: problem.id } });
    await expect(
      prisma.userProgress.create({ data: { userId: user.id, problemId: problem.id } }),
    ).rejects.toThrow();
  });

  it('deleting a user removes their progress and plans', async () => {
    const { user, problem } = await makeFixtures();
    await prisma.userProgress.create({ data: { userId: user.id, problemId: problem.id } });
    await prisma.studyPlan.create({
      data: { userId: user.id, problemId: problem.id, plannedDate: new Date('2026-10-20') },
    });

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.userProgress.count()).toBe(0);
    expect(await prisma.studyPlan.count()).toBe(0);
  });

  it('deleting a problem removes its progress and plans', async () => {
    const { user, problem } = await makeFixtures();
    await prisma.userProgress.create({ data: { userId: user.id, problemId: problem.id } });
    await prisma.studyPlan.create({
      data: { userId: user.id, problemId: problem.id, plannedDate: new Date('2026-10-20') },
    });

    await prisma.problem.delete({ where: { id: problem.id } });

    expect(await prisma.userProgress.count()).toBe(0);
    expect(await prisma.studyPlan.count()).toBe(0);
  });

  it('will not delete a chapter that still has topics', async () => {
    const { chapter } = await makeFixtures();
    await expect(prisma.chapter.delete({ where: { id: chapter.id } })).rejects.toThrow();
  });
});
