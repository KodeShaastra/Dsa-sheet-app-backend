import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { clearSheetCache } from '../src/modules/sheet/sheet.service.js';
import { loggedInAgent, resetDb, seedSmallSheet } from './helpers.js';

const app = createApp();
let ids: Awaited<ReturnType<typeof seedSmallSheet>>;

beforeEach(async () => {
  await resetDb();
  clearSheetCache();
  ids = await seedSmallSheet();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/solved-problems', () => {
  it('needs login', async () => {
    expect((await request(app).get('/api/solved-problems')).status).toBe(401);
  });

  it('starts empty, with totals for the whole sheet', async () => {
    const agent = await loggedInAgent(app, 'a@test.dev');
    const res = await agent.get('/api/solved-problems');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      solvedProblemIds: [],
      stats: {
        total: 5,
        solved: 0,
        byDifficulty: {
          EASY: { total: 2, solved: 0 },
          MEDIUM: { total: 2, solved: 0 },
          HARD: { total: 1, solved: 0 },
        },
        byChapter: [
          { id: ids.chapters.arrays, title: 'Arrays', slug: 'arrays', total: 4, solved: 0 },
          { id: ids.chapters.graphs, title: 'Graphs', slug: 'graphs', total: 1, solved: 0 },
        ],
      },
    });
  });

  it('counts solved problems by difficulty and chapter', async () => {
    const agent = await loggedInAgent(app, 'a@test.dev');
    await agent.put(`/api/solved-problems/${ids.problems.twoSum}`);
    await agent.put(`/api/solved-problems/${ids.problems.islands}`);

    const { body } = await agent.get('/api/solved-problems');
    expect(body.solvedProblemIds).toEqual([ids.problems.twoSum, ids.problems.islands]);
    expect(body.stats.total).toBe(5);
    expect(body.stats.solved).toBe(2);
    expect(body.stats.byDifficulty).toEqual({
      EASY: { total: 2, solved: 1 },
      MEDIUM: { total: 2, solved: 1 },
      HARD: { total: 1, solved: 0 },
    });
    expect(body.stats.byChapter.map((c: { solved: number }) => c.solved)).toEqual([1, 1]);
  });
});

describe('PUT /api/solved-problems/:problemId', () => {
  it('ticks a problem (204), and doing it again changes nothing', async () => {
    const agent = await loggedInAgent(app, 'a@test.dev');
    const url = `/api/solved-problems/${ids.problems.twoSum}`;

    expect((await agent.put(url)).status).toBe(204);
    const first = await prisma.solvedProblem.findFirstOrThrow();

    expect((await agent.put(url)).status).toBe(204);
    const rows = await prisma.solvedProblem.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.solvedAt).toEqual(first.solvedAt); // original time kept
  });

  it('returns 404 for a problem that does not exist', async () => {
    const agent = await loggedInAgent(app, 'a@test.dev');
    const res = await agent.put('/api/solved-problems/999999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for an id that is not a number', async () => {
    const agent = await loggedInAgent(app, 'a@test.dev');
    const res = await agent.put('/api/solved-problems/abc');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('handles two requests at the same time', async () => {
    const agent = await loggedInAgent(app, 'a@test.dev');
    const url = `/api/solved-problems/${ids.problems.twoSum}`;
    const results = await Promise.all([agent.put(url), agent.put(url), agent.put(url)]);
    expect(results.map((r) => r.status)).toEqual([204, 204, 204]);
    expect(await prisma.solvedProblem.count()).toBe(1);
  });
});

describe('DELETE /api/solved-problems/:problemId', () => {
  it('unticks a problem (204), and doing it again is still 204', async () => {
    const agent = await loggedInAgent(app, 'a@test.dev');
    const url = `/api/solved-problems/${ids.problems.twoSum}`;
    await agent.put(url);

    expect((await agent.delete(url)).status).toBe(204);
    expect((await agent.delete(url)).status).toBe(204);
    expect((await agent.get('/api/solved-problems')).body.solvedProblemIds).toEqual([]);
  });
});

describe('each user sees only their own solved problems', () => {
  it('keeps users separate', async () => {
    const alice = await loggedInAgent(app, 'alice@test.dev');
    const bob = await loggedInAgent(app, 'bob@test.dev');
    await alice.put(`/api/solved-problems/${ids.problems.twoSum}`);

    expect((await bob.get('/api/solved-problems')).body.solvedProblemIds).toEqual([]);

    // Bob unticking it must not touch Alice's solved problems.
    await bob.delete(`/api/solved-problems/${ids.problems.twoSum}`);
    expect((await alice.get('/api/solved-problems')).body.solvedProblemIds).toEqual([
      ids.problems.twoSum,
    ]);
  });
});
