import type { Request, Response } from 'express';
import type { ProblemIdParams } from './solved-problems.schema.js';
import * as solvedProblemsService from './solved-problems.service.js';

export async function getSolvedProblems(req: Request, res: Response) {
  res.json(await solvedProblemsService.getSolvedProblems(req.user!.id));
}

export async function markSolved(req: Request, res: Response) {
  const { problemId } = req.params as unknown as ProblemIdParams;
  await solvedProblemsService.markSolved(req.user!.id, problemId);
  res.status(204).end();
}

export async function unmarkSolved(req: Request, res: Response) {
  const { problemId } = req.params as unknown as ProblemIdParams;
  await solvedProblemsService.unmarkSolved(req.user!.id, problemId);
  res.status(204).end();
}
