import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { clearSheetCache } from '../src/modules/sheet/sheet.service.js';
import { detailPaths, loggedInAgent, resetDb, seedSmallSheet } from './helpers.js';

const app = createApp();
let ids: Awaited<ReturnType<typeof seedSmallSheet>>;
let alice: Awaited<ReturnType<typeof loggedInAgent>>;

const range = '?from=2026-11-01&to=2026-11-30';

beforeEach(async () => {
  await resetDb();
  clearSheetCache();
  ids = await seedSmallSheet();
  alice = await loggedInAgent(app, 'alice@test.dev');
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function scheduleProblems(problemIds: string[], scheduledFor = '2026-11-05', note?: string) {
  const res = await alice.post('/api/scheduled-problems').send({ scheduledFor, problemIds, note });
  expect(res.status).toBe(201);
  return res.body.scheduledProblems;
}

describe('auth', () => {
  it('needs login on every scheduled-problems route', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    const results = await Promise.all([
      request(app).get(`/api/scheduled-problems${range}`),
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
      scheduledFor: '2026-11-05',
      problemIds: [ids.problems.threeSum, ids.problems.twoSum],
      note: '  warm-up  ',
    });

    expect(res.status).toBe(201);
    expect(res.body.scheduledProblems).toHaveLength(2);
    expect(res.body.scheduledProblems[0]).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      scheduledFor: '2026-11-05',
      status: 'PENDING',
      note: 'warm-up',
      problem: { id: ids.problems.threeSum, title: '3Sum', difficulty: 'MEDIUM' },
    });
    expect(res.body.scheduledProblems[1].problem.id).toBe(ids.problems.twoSum);
  });

  it('skips problems already scheduled for that date, and repeated ids', async () => {
    await scheduleProblems([ids.problems.twoSum]);
    const res = await alice.post('/api/scheduled-problems').send({
      scheduledFor: '2026-11-05',
      problemIds: [ids.problems.twoSum, ids.problems.islands, ids.problems.islands],
    });

    expect(res.status).toBe(201);
    expect(
      res.body.scheduledProblems.map((p: { problem: { id: string } }) => p.problem.id),
    ).toEqual([ids.problems.islands]);
    expect(await prisma.scheduledProblem.count()).toBe(2);
  });

  it('allows the same problem on a different date', async () => {
    await scheduleProblems([ids.problems.twoSum], '2026-11-05');
    const items = await scheduleProblems([ids.problems.twoSum], '2026-11-06');
    expect(items).toHaveLength(1);
  });

  it('returns 404 if any problem does not exist, and creates nothing', async () => {
    const res = await alice
      .post('/api/scheduled-problems')
      .send({ scheduledFor: '2026-11-05', problemIds: [ids.problems.twoSum, '999999'] });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.details).toEqual([
      { path: 'problemIds', message: 'Problem 999999 not found' },
    ]);
    expect(await prisma.scheduledProblem.count()).toBe(0);
  });

  it('rejects bad input', async () => {
    const bad = [
      { scheduledFor: '2026-11-05', problemIds: [] },
      { scheduledFor: '2026-02-30', problemIds: [ids.problems.twoSum] },
      { scheduledFor: '05/11/2026', problemIds: [ids.problems.twoSum] },
      { scheduledFor: '2026-11-05', problemIds: ['abc'] },
      { scheduledFor: '2026-11-05', problemIds: [ids.problems.twoSum], note: 'x'.repeat(501) },
    ];
    for (const body of bad) {
      const res = await alice.post('/api/scheduled-problems').send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('GET /api/scheduled-problems', () => {
  it('returns scheduled problems in the range, sorted by date, with YYYY-MM-DD dates', async () => {
    await scheduleProblems([ids.problems.islands], '2026-11-20');
    await scheduleProblems([ids.problems.twoSum], '2026-11-01');
    await scheduleProblems([ids.problems.threeSum], '2026-12-01'); // outside the range

    const res = await alice.get(`/api/scheduled-problems${range}`);
    expect(res.status).toBe(200);
    expect(res.body.scheduledProblems.map((p: { scheduledFor: string }) => p.scheduledFor)).toEqual(
      ['2026-11-01', '2026-11-20'],
    );
  });

  it('includes both ends of the range', async () => {
    await scheduleProblems([ids.problems.twoSum], '2026-11-01');
    await scheduleProblems([ids.problems.islands], '2026-11-30');
    expect(
      (await alice.get(`/api/scheduled-problems${range}`)).body.scheduledProblems,
    ).toHaveLength(2);
  });

  it('allows up to 62 days', async () => {
    const ok = await alice.get('/api/scheduled-problems?from=2026-07-01&to=2026-08-31'); // 62 days
    expect(ok.status).toBe(200);

    const tooLong = await alice.get('/api/scheduled-problems?from=2026-07-01&to=2026-09-01'); // 63 days
    expect(tooLong.status).toBe(400);
    expect(detailPaths(tooLong.body)).toEqual(['to']);
  });

  it('rejects a missing, invalid, or backwards range', async () => {
    for (const query of [
      '',
      '?from=2026-11-01',
      '?from=2026-11-31&to=2026-12-01',
      '?from=2026-11-10&to=2026-11-01',
    ]) {
      const res = await alice.get(`/api/scheduled-problems${query}`);
      expect(res.status, query).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('PATCH /api/scheduled-problems/:id', () => {
  it('updates date, status, and note', async () => {
    const [item] = await scheduleProblems([ids.problems.twoSum], '2026-11-05', 'first');

    const res = await alice
      .patch(`/api/scheduled-problems/${item.id}`)
      .send({ scheduledFor: '2026-11-07', status: 'SKIPPED', note: 'later' });

    expect(res.status).toBe(200);
    expect(res.body.scheduledProblem).toMatchObject({
      id: item.id,
      scheduledFor: '2026-11-07',
      status: 'SKIPPED',
      note: 'later',
    });
  });

  it('clears the note with null', async () => {
    const [item] = await scheduleProblems([ids.problems.twoSum], '2026-11-05', 'first');
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

  it('returns 409 when moving onto a date that already has this problem, and changes nothing', async () => {
    await scheduleProblems([ids.problems.twoSum], '2026-11-05');
    const [other] = await scheduleProblems([ids.problems.twoSum], '2026-11-06');

    const res = await alice
      .patch(`/api/scheduled-problems/${other.id}`)
      .send({ scheduledFor: '2026-11-05', status: 'DONE' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    // The transaction rolled back: nothing marked solved, item unchanged.
    expect(await prisma.solvedProblem.count()).toBe(0);
    const row = await prisma.scheduledProblem.findUniqueOrThrow({ where: { id: other.id } });
    expect(row.status).toBe('PENDING');
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
    const [item] = await scheduleProblems([ids.problems.twoSum], '2026-11-05', 'mine');
    const bob = await loggedInAgent(app, 'bob@test.dev');

    expect((await bob.get(`/api/scheduled-problems${range}`)).body.scheduledProblems).toEqual([]);

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
