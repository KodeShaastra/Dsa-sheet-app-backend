import type { Request, Response } from 'express';
import type { ProblemIdParams } from './solvedProblems.schema.js';
import * as solvedProblemsService from './solvedProblems.service.js';

export async function getSolvedProblems(req: Request, res: Response) {
  res.json(await solvedProblemsService.getSolvedProblems(req.user!.id));
}

export async function markProblemSolved(req: Request, res: Response) {
  const { problemId } = req.params as unknown as ProblemIdParams;
  await solvedProblemsService.markProblemSolved(req.user!.id, problemId);
  res.status(204).end();
}

export async function unmarkProblemSolved(req: Request, res: Response) {
  const { problemId } = req.params as unknown as ProblemIdParams;
  await solvedProblemsService.unmarkProblemSolved(req.user!.id, problemId);
  res.status(204).end();
}
