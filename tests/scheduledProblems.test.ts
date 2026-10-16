import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { clearSheetCache } from '../src/modules/sheet/sheet.service.js';
import { toDateString, toDbDate } from '../src/utils/date.js';
import { detailPaths, loggedInAgent, resetDb, seedSmallSheet } from './helpers.js';

const app = createApp();
let ids: Awaited<ReturnType<typeof seedSmallSheet>>;
let alice: Awaited<ReturnType<typeof loggedInAgent>>;

/** "YYYY-MM-DD", `n` days from today (UTC). Scheduling needs dates that aren't in the past. */
const day = (n: number) => toDateString(new Date(Date.now() + n * 24 * 60 * 60 * 1000));

beforeEach(async () => {
  await resetDb();
  clearSheetCache();
  ids = await seedSmallSheet();
  alice = await loggedInAgent(app, 'alice@test.dev');
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function scheduleProblems(problemIds: string[], scheduledFor = day(10), note?: string) {
  const res = await alice.post('/api/scheduled-problems').send({ scheduledFor, problemIds, note });
  expect(res.status).toBe(201);
  return res.body.scheduledProblems;
}

describe('auth', () => {
  it('needs login on every scheduled-problems route', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    const results = await Promise.all([
      request(app).get('/api/scheduled-problems'),
      request(app).post('/api/scheduled-problems').send({}),
      request(app).patch(`/api/scheduled-problems/${id}`).send({ status: 'DONE' }),
      request(app).delete(`/api/scheduled-problems/${id}`),
    ]);
    expect(results.map((r) => r.status)).toEqual([401, 401, 401, 401]);
  });
});

describe('POST /api/scheduled-problems', () => {
  it('schedules each problem, in the order sent', async () => {
    const res = await alice.post('/api/scheduled-problems').send({
      scheduledFor: day(10),
      problemIds: [ids.problems.threeSum, ids.problems.twoSum],
      note: '  warm-up  ',
    });

    expect(res.status).toBe(201);
    expect(res.body.scheduledProblems).toHaveLength(2);
    expect(res.body.scheduledProblems[0]).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      scheduledFor: day(10),
      status: 'PENDING',
      note: 'warm-up',
      problem: { id: ids.problems.threeSum, title: '3Sum', difficulty: 'MEDIUM' },
    });
    expect(res.body.scheduledProblems[1].problem.id).toBe(ids.problems.twoSum);
  });

  it('schedules a repeated id once', async () => {
    const items = await scheduleProblems([ids.problems.islands, ids.problems.islands]);
    expect(items).toHaveLength(1);
  });

  it('returns 409 if a problem is already scheduled on any date, and creates nothing', async () => {
    await scheduleProblems([ids.problems.twoSum], day(10));
    for (const scheduledFor of [day(10), day(11)]) {
      const res = await alice.post('/api/scheduled-problems').send({
        scheduledFor,
        problemIds: [ids.problems.islands, ids.problems.twoSum],
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.details).toEqual([
        {
          path: 'problemIds',
          message: `Problem ${ids.problems.twoSum} is already scheduled for ${day(10)}`,
        },
      ]);
    }
    expect(await prisma.scheduledProblem.count()).toBe(1);
  });

  it('allows today and later, but not past dates', async () => {
    await scheduleProblems([ids.problems.twoSum], day(0));
    // Yesterday in UTC can still be "today" for someone west of UTC.
    await scheduleProblems([ids.problems.islands], day(-1));

    const res = await alice
      .post('/api/scheduled-problems')
      .send({ scheduledFor: day(-2), problemIds: [ids.problems.threeSum] });
    expect(res.status).toBe(400);
    expect(detailPaths(res.body)).toEqual(['scheduledFor']);
  });

  it('returns 404 if any problem does not exist, and creates nothing', async () => {
    const res = await alice
      .post('/api/scheduled-problems')
      .send({ scheduledFor: day(10), problemIds: [ids.problems.twoSum, '999999'] });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.details).toEqual([
      { path: 'problemIds', message: 'Problem 999999 not found' },
    ]);
    expect(await prisma.scheduledProblem.count()).toBe(0);
  });

  it('rejects bad input', async () => {
    const bad = [
      { scheduledFor: day(10), problemIds: [] },
      { scheduledFor: '2026-02-30', problemIds: [ids.problems.twoSum] },
      { scheduledFor: '05/11/2026', problemIds: [ids.problems.twoSum] },
      { scheduledFor: day(10), problemIds: ['abc'] },
      { scheduledFor: day(10), problemIds: [ids.problems.twoSum], note: 'x'.repeat(501) },
    ];
    for (const body of bad) {
      const res = await alice.post('/api/scheduled-problems').send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('GET /api/scheduled-problems', () => {
  it('returns the whole calendar, sorted by date, with YYYY-MM-DD dates', async () => {
    await scheduleProblems([ids.problems.islands], day(90));
    await scheduleProblems([ids.problems.threeSum], day(20));
    await scheduleProblems([ids.problems.twoSum], day(1));

    const res = await alice.get('/api/scheduled-problems');
    expect(res.status).toBe(200);
    expect(
      res.body.scheduledProblems.map((p: { problem: { id: string }; scheduledFor: string }) => [
        p.problem.id,
        p.scheduledFor,
      ]),
    ).toEqual([
      [ids.problems.twoSum, day(1)],
      [ids.problems.threeSum, day(20)],
      [ids.problems.islands, day(90)],
    ]);
  });

  it('includes past (missed) items', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'alice@test.dev' } });
    await prisma.scheduledProblem.create({
      data: {
        userId: user.id,
        problemId: Number(ids.problems.twoSum),
        scheduledFor: toDbDate(day(-30)),
      },
    });
    const res = await alice.get('/api/scheduled-problems');
    expect(res.body.scheduledProblems).toHaveLength(1);
    expect(res.body.scheduledProblems[0]).toMatchObject({
      scheduledFor: day(-30),
      status: 'PENDING',
    });
  });
});

describe('PATCH /api/scheduled-problems/:id', () => {
  it('updates date, status, and note', async () => {
    const [item] = await scheduleProblems([ids.problems.twoSum], day(10), 'first');

    const res = await alice
      .patch(`/api/scheduled-problems/${item.id}`)
      .send({ scheduledFor: day(12), status: 'SKIPPED', note: 'later' });

    expect(res.status).toBe(200);
    expect(res.body.scheduledProblem).toMatchObject({
      id: item.id,
      scheduledFor: day(12),
      status: 'SKIPPED',
      note: 'later',
    });
  });

  it('clears the note with null', async () => {
    const [item] = await scheduleProblems([ids.problems.twoSum], day(10), 'first');
    const res = await alice.patch(`/api/scheduled-problems/${item.id}`).send({ note: null });
    expect(res.body.scheduledProblem.note).toBeNull();
  });

  it('status DONE also marks the problem solved', async () => {
    const [item] = await scheduleProblems([ids.problems.twoSum]);
    const res = await alice.patch(`/api/scheduled-problems/${item.id}`).send({ status: 'DONE' });

    expect(res.status).toBe(200);
    const solved = await alice.get('/api/solved-problems');
    expect(solved.body.solvedProblemIds).toEqual([ids.problems.twoSum]);

    // Doing it again is fine.
    expect(
      (await alice.patch(`/api/scheduled-problems/${item.id}`).send({ status: 'DONE' })).status,
    ).toBe(200);
    expect(await prisma.solvedProblem.count()).toBe(1);
  });

  it('a missed (past) item can be marked done or moved to today, but not moved into the past', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'alice@test.dev' } });
    const missed = await prisma.scheduledProblem.create({
      data: {
        userId: user.id,
        problemId: Number(ids.problems.twoSum),
        scheduledFor: toDbDate(day(-5)),
      },
    });
    const url = `/api/scheduled-problems/${missed.id}`;

    expect((await alice.patch(url).send({ scheduledFor: day(-3) })).status).toBe(400);
    expect((await alice.patch(url).send({ note: 'still to do' })).status).toBe(200);

    const moved = await alice.patch(url).send({ scheduledFor: day(0) });
    expect(moved.status).toBe(200);
    expect(moved.body.scheduledProblem.scheduledFor).toBe(day(0));
  });

  it('rejects an empty body and bad values', async () => {
    const [item] = await scheduleProblems([ids.problems.twoSum]);
    for (const body of [{}, { status: 'FINISHED' }, { scheduledFor: '2026-13-01' }]) {
      const res = await alice.patch(`/api/scheduled-problems/${item.id}`).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it('returns 400 for an id that is not a UUID', async () => {
    const res = await alice.patch('/api/scheduled-problems/not-a-uuid').send({ status: 'DONE' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/scheduled-problems/:id', () => {
  it('deletes the scheduled problem (204), then 404 the second time', async () => {
    const [item] = await scheduleProblems([ids.problems.twoSum]);
    expect((await alice.delete(`/api/scheduled-problems/${item.id}`)).status).toBe(204);
    expect((await alice.delete(`/api/scheduled-problems/${item.id}`)).status).toBe(404);
    expect(await prisma.scheduledProblem.count()).toBe(0);
  });
});

describe('each user sees only their own scheduled problems', () => {
  it("another user's scheduled problem id gives 404 and is left untouched", async () => {
    const [item] = await scheduleProblems([ids.problems.twoSum], day(10), 'mine');
    const bob = await loggedInAgent(app, 'bob@test.dev');

    expect((await bob.get('/api/scheduled-problems')).body.scheduledProblems).toEqual([]);

    const patch = await bob
      .patch(`/api/scheduled-problems/${item.id}`)
      .send({ status: 'DONE', note: 'hacked' });
    expect(patch.status).toBe(404);
    expect(patch.body.error.code).toBe('NOT_FOUND');

    expect((await bob.delete(`/api/scheduled-problems/${item.id}`)).status).toBe(404);

    const row = await prisma.scheduledProblem.findUniqueOrThrow({ where: { id: item.id } });
    expect(row).toMatchObject({ status: 'PENDING', note: 'mine' });
    expect(await prisma.solvedProblem.count()).toBe(0); // Bob's DONE did not mark anything solved
  });
});
