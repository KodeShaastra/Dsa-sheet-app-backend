import { Prisma } from '../../generated/prisma/client.js';
import type { Difficulty } from '../../generated/prisma/enums.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { toApiId } from '../../utils/ids.js';
import { getSheet, type Sheet } from '../sheet/sheet.service.js';

interface Count {
  total: number;
  solved: number;
}

export interface SolvedProblemsSummary {
  solvedProblemIds: string[];
  stats: Count & {
    byDifficulty: Record<Difficulty, Count>;
    byChapter: (Count & { id: string; title: string; slug: string })[];
  };
}

type Stats = SolvedProblemsSummary['stats'];

const emptyCount = (): Count => ({ total: 0, solved: 0 });

/** Counts totals and solved problems from the cached sheet: overall, per difficulty, per chapter. */
function buildStats(sheet: Sheet, solved: Set<string>): Stats {
  const stats: Stats = {
    ...emptyCount(),
    byDifficulty: { EASY: emptyCount(), MEDIUM: emptyCount(), HARD: emptyCount() },
    byChapter: [],
  };

  for (const chapter of sheet.chapters) {
    const chapterCount = {
      id: chapter.id,
      title: chapter.title,
      slug: chapter.slug,
      ...emptyCount(),
    };
    for (const problem of chapter.topics.flatMap((t) => t.problems)) {
      const isSolved = solved.has(problem.id) ? 1 : 0;
      for (const count of [stats, stats.byDifficulty[problem.difficulty], chapterCount]) {
        count.total += 1;
        count.solved += isSolved;
      }
    }
    stats.byChapter.push(chapterCount);
  }

  return stats;
}

export async function getSolvedProblems(userId: string): Promise<SolvedProblemsSummary> {
  const [sheet, rows] = await Promise.all([
    getSheet(),
    prisma.solvedProblem.findMany({
      where: { userId },
      select: { problemId: true },
      orderBy: { solvedAt: 'asc' },
    }),
  ]);

  const solvedProblemIds = rows.map((r) => toApiId(r.problemId));
  return { solvedProblemIds, stats: buildStats(sheet, new Set(solvedProblemIds)) };
}

/** Tick a problem. Doing it twice is fine; the first solvedAt is kept. */
export async function markProblemSolved(userId: string, problemId: number): Promise<void> {
  try {
    await prisma.solvedProblem.upsert({
      where: { userId_problemId: { userId, problemId } },
      create: { userId, problemId },
      update: {},
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      // P2003: the problem doesn't exist.
      if (err.code === 'P2003') throw new AppError(404, 'NOT_FOUND', 'Problem not found');
      // P2002: a second request for the same problem won the race. Already solved, so fine.
      if (err.code === 'P2002') return;
    }
    throw err;
  }
}

/** Untick a problem. Doing it twice (or on a never-solved problem) is fine. */
export async function unmarkProblemSolved(userId: string, problemId: number): Promise<void> {
  await prisma.solvedProblem.deleteMany({ where: { userId, problemId } });
}
