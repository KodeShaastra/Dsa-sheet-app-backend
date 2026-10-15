import type { Difficulty } from '../../generated/prisma/enums.js';
import { prisma } from '../../lib/prisma.js';
import { toApiId } from '../../utils/ids.js';

export interface SheetProblem {
  id: string;
  title: string;
  difficulty: Difficulty;
  youtubeUrl: string | null;
  practiceUrl: string | null;
  articleUrl: string | null;
}

export interface SheetChapter {
  id: string;
  title: string;
  slug: string;
  topics: { id: string; title: string; problems: SheetProblem[] }[];
}

export interface Sheet {
  chapters: SheetChapter[];
}

// The sheet is the same for every user, so it's kept in memory.
const CACHE_TTL_MS = 10 * 60 * 1000;
let cache: { sheet: Sheet; expiresAt: number } | null = null;
let loading: Promise<Sheet> | null = null;

async function loadSheet(): Promise<Sheet> {
  const byDisplayOrder = { displayOrder: 'asc' } as const;
  const rows = await prisma.chapter.findMany({
    orderBy: byDisplayOrder,
    select: {
      id: true,
      title: true,
      slug: true,
      topics: {
        orderBy: byDisplayOrder,
        select: {
          id: true,
          title: true,
          problems: {
            orderBy: byDisplayOrder,
            select: {
              id: true,
              title: true,
              difficulty: true,
              youtubeUrl: true,
              practiceUrl: true,
              articleUrl: true,
            },
          },
        },
      },
    },
  });

  return {
    chapters: rows.map((c) => ({
      ...c,
      id: toApiId(c.id),
      topics: c.topics.map((t) => ({
        ...t,
        id: toApiId(t.id),
        problems: t.problems.map((p) => ({ ...p, id: toApiId(p.id) })),
      })),
    })),
  };
}

/** Returns the cached sheet, reloading it from the database every 10 minutes. */
export async function getSheet(): Promise<Sheet> {
  if (cache && cache.expiresAt > Date.now()) return cache.sheet;

  // If many requests arrive while loading, they all wait for the same query.
  loading ??= loadSheet()
    .then((sheet) => {
      cache = { sheet, expiresAt: Date.now() + CACHE_TTL_MS };
      return sheet;
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Forget the cached sheet (used by tests). */
export function clearSheetCache() {
  cache = null;
}
