import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { clearSheetCache } from '../src/modules/sheet/sheet.service.js';
import { loggedInAgent, resetDb, seedSmallSheet } from './helpers.js';

const app = createApp();

beforeEach(async () => {
  await resetDb();
  clearSheetCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/sheet', () => {
  it('needs login', async () => {
    const res = await request(app).get('/api/sheet');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns chapters, topics, and problems ordered by displayOrder, with string ids', async () => {
    const { problems } = await seedSmallSheet();
    const agent = await loggedInAgent(app, 'a@test.dev');

    const res = await agent.get('/api/sheet');
    expect(res.status).toBe(200);

    const { chapters } = res.body;
    expect(chapters.map((c: { slug: string }) => c.slug)).toEqual(['arrays', 'graphs']);
    expect(chapters[0].topics.map((t: { title: string }) => t.title)).toEqual([
      'Hashing',
      'Two Pointers',
    ]);
    expect(chapters[0].topics[0].problems.map((p: { title: string }) => p.title)).toEqual([
      'Two Sum',
      'Contains Duplicate',
    ]);

    expect(Object.keys(chapters[0]).sort()).toEqual(['id', 'slug', 'title', 'topics']);
    expect(Object.keys(chapters[0].topics[0]).sort()).toEqual(['id', 'problems', 'title']);
    expect(chapters[0].topics[0].problems[0]).toEqual({
      id: problems.twoSum,
      title: 'Two Sum',
      difficulty: 'EASY',
      youtubeUrl: null,
      practiceUrl: 'https://example.test/1',
      articleUrl: null,
    });
    expect(typeof chapters[0].id).toBe('string');
    expect(typeof chapters[0].topics[0].id).toBe('string');
  });

  it('sends Cache-Control: private, max-age=300', async () => {
    await seedSmallSheet();
    const agent = await loggedInAgent(app, 'a@test.dev');
    const res = await agent.get('/api/sheet');
    expect(res.headers['cache-control']).toBe('private, max-age=300');
  });

  it('is the same for every user', async () => {
    await seedSmallSheet();
    const a = await (await loggedInAgent(app, 'a@test.dev')).get('/api/sheet');
    const b = await (await loggedInAgent(app, 'b@test.dev')).get('/api/sheet');
    expect(a.body).toEqual(b.body);
  });

  it('is cached in memory and refreshed after 10 minutes', async () => {
    await seedSmallSheet();
    const agent = await loggedInAgent(app, 'a@test.dev');
    const countProblems = (body: { chapters: { topics: { problems: unknown[] }[] }[] }) =>
      body.chapters.flatMap((c) => c.topics.flatMap((t) => t.problems)).length;

    const beforeLoad = Date.now();
    expect(countProblems((await agent.get('/api/sheet')).body)).toBe(5);
    const afterLoad = Date.now(); // the cache was filled somewhere between these two

    // Add a problem straight into the database.
    const topic = await prisma.topic.findFirstOrThrow({ where: { title: 'BFS' } });
    await prisma.problem.create({
      data: { topicId: topic.id, title: 'Rotting Oranges', difficulty: 'MEDIUM', displayOrder: 2 },
    });

    vi.spyOn(Date, 'now').mockReturnValue(beforeLoad + 10 * 60 * 1000 - 1);
    expect(countProblems((await agent.get('/api/sheet')).body)).toBe(5); // still cached

    vi.spyOn(Date, 'now').mockReturnValue(afterLoad + 10 * 60 * 1000 + 1);
    expect(countProblems((await agent.get('/api/sheet')).body)).toBe(6); // reloaded
  });
});
