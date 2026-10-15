import { Prisma } from '../../generated/prisma/client.js';
import type { Difficulty } from '../../generated/prisma/enums.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { toApiId } from '../../utils/ids.js';
import { getSheet } from '../sheet/sheet.service.js';

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
  const solved = new Set(solvedProblemIds);

  // Totals come from the cached sheet, so this needs only one small query.
  const stats: SolvedProblemsSummary['stats'] = {
    total: 0,
    solved: 0,
    byDifficulty: {
      EASY: { total: 0, solved: 0 },
      MEDIUM: { total: 0, solved: 0 },
      HARD: { total: 0, solved: 0 },
    },
    byChapter: [],
  };

  for (const chapter of sheet.chapters) {
    const chapterCount = {
      id: chapter.id,
      title: chapter.title,
      slug: chapter.slug,
      total: 0,
      solved: 0,
    };
    for (const topic of chapter.topics) {
      for (const problem of topic.problems) {
        const isSolved = solved.has(problem.id) ? 1 : 0;
        for (const count of [stats, stats.byDifficulty[problem.difficulty], chapterCount]) {
          count.total += 1;
          count.solved += isSolved;
        }
      }
    }
    stats.byChapter.push(chapterCount);
  }

  return { solvedProblemIds, stats };
}

/** Tick a problem. Doing it twice is fine; the first solvedAt is kept. */
export async function markSolved(userId: string, problemId: number): Promise<void> {
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
export async function unmarkSolved(userId: string, problemId: number): Promise<void> {
  await prisma.solvedProblem.deleteMany({ where: { userId, problemId } });
}
