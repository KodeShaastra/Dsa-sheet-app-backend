import { Prisma } from '../../generated/prisma/client.js';
import type { Difficulty, ScheduledProblemStatus } from '../../generated/prisma/enums.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { toDateString, toDbDate } from '../../utils/date.js';
import { toApiId } from '../../utils/ids.js';
import type {
  CreateScheduledProblemsInput,
  ListScheduledProblemsQuery,
  UpdateScheduledProblemInput,
} from './scheduled-problems.schema.js';

const scheduledProblemSelect = {
  id: true,
  scheduledFor: true,
  status: true,
  note: true,
  problem: { select: { id: true, title: true, difficulty: true } },
} as const;

interface ScheduledProblemRow {
  id: string;
  scheduledFor: Date;
  status: ScheduledProblemStatus;
  note: string | null;
  problem: { id: number; title: string; difficulty: Difficulty };
}

function toApiScheduledProblem(row: ScheduledProblemRow) {
  return {
    id: row.id,
    scheduledFor: toDateString(row.scheduledFor),
    status: row.status,
    note: row.note,
    problem: { ...row.problem, id: toApiId(row.problem.id) },
  };
}

const notFound = () => new AppError(404, 'NOT_FOUND', 'Scheduled problem not found');

function isPrismaError(err: unknown, code: string) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;
}

export async function listScheduledProblems(
  userId: string,
  { from, to }: ListScheduledProblemsQuery,
) {
  const rows = await prisma.scheduledProblem.findMany({
    where: { userId, scheduledFor: { gte: toDbDate(from), lte: toDbDate(to) } },
    orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
    select: scheduledProblemSelect,
  });
  return rows.map(toApiScheduledProblem);
}

/** Throws 404 listing every id in `problemIds` that has no problem. */
async function ensureProblemsExist(problemIds: number[]): Promise<void> {
  const found = await prisma.problem.findMany({
    where: { id: { in: problemIds } },
    select: { id: true },
  });
  const foundIds = new Set(found.map((p) => p.id));
  const missing = problemIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new AppError(
      404,
      'NOT_FOUND',
      'Problem not found',
      missing.map((id) => ({ path: 'problemIds', message: `Problem ${id} not found` })),
    );
  }
}

/** Inserts one row per problem, skipping ones already scheduled for that date. */
async function insertSkippingDuplicates(
  userId: string,
  input: CreateScheduledProblemsInput,
): Promise<ScheduledProblemRow[]> {
  const scheduledFor = toDbDate(input.scheduledFor);
  try {
    return await prisma.scheduledProblem.createManyAndReturn({
      data: input.problemIds.map((problemId) => ({
        userId,
        problemId,
        scheduledFor,
        note: input.note ?? null,
      })),
      skipDuplicates: true,
      select: scheduledProblemSelect,
    });
  } catch (err) {
    // A problem was deleted between the existence check and the insert.
    if (isPrismaError(err, 'P2003')) throw new AppError(404, 'NOT_FOUND', 'Problem not found');
    throw err;
  }
}

function sortByIdOrder(rows: ScheduledProblemRow[], problemIds: number[]): ScheduledProblemRow[] {
  const order = new Map(problemIds.map((id, i) => [id, i]));
  return rows.toSorted((a, b) => (order.get(a.problem.id) ?? 0) - (order.get(b.problem.id) ?? 0));
}

/** Schedules each problem for the date. Problems already scheduled for that date are skipped. */
export async function createScheduledProblems(userId: string, input: CreateScheduledProblemsInput) {
  await ensureProblemsExist(input.problemIds);
  const created = await insertSkippingDuplicates(userId, input);
  return sortByIdOrder(created, input.problemIds).map(toApiScheduledProblem);
}

/** Setting status to DONE also marks the problem solved, in the same transaction. */
export async function updateScheduledProblem(
  userId: string,
  id: string,
  input: UpdateScheduledProblemInput,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const owned = await tx.scheduledProblem.findFirst({
        where: { id, userId },
        select: { problemId: true },
      });
      if (!owned) throw notFound();

      const row = await tx.scheduledProblem.update({
        where: { id },
        data: {
          ...(input.scheduledFor !== undefined && { scheduledFor: toDbDate(input.scheduledFor) }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.note !== undefined && { note: input.note }),
        },
        select: scheduledProblemSelect,
      });

      if (input.status === 'DONE') {
        const key = { userId, problemId: owned.problemId };
        await tx.solvedProblem.upsert({
          where: { userId_problemId: key },
          create: key,
          update: {},
        });
      }

      return toApiScheduledProblem(row);
    });
  } catch (err) {
    if (isPrismaError(err, 'P2002')) {
      throw new AppError(409, 'CONFLICT', 'This problem is already scheduled for that date');
    }
    throw err;
  }
}

export async function deleteScheduledProblem(userId: string, id: string) {
  const { count } = await prisma.scheduledProblem.deleteMany({ where: { id, userId } });
  if (count === 0) throw notFound();
}
