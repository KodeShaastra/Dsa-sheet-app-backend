import type { Request, Response } from 'express';
import type {
  ScheduleProblemsInput,
  ScheduledProblemIdParams,
  UpdateScheduledProblemInput,
} from './scheduledProblems.schema.js';
import * as scheduledProblemsService from './scheduledProblems.service.js';

export async function listScheduledProblems(req: Request, res: Response) {
  const scheduledProblems = await scheduledProblemsService.listScheduledProblems(req.user!.id);
  res.json({ scheduledProblems });
}

export async function scheduleProblems(req: Request, res: Response) {
  const scheduledProblems = await scheduledProblemsService.scheduleProblems(
    req.user!.id,
    req.body as ScheduleProblemsInput,
  );
  res.status(201).json({ scheduledProblems });
}

export async function updateScheduledProblem(req: Request, res: Response) {
  const { scheduledProblemId } = req.params as unknown as ScheduledProblemIdParams;
  const scheduledProblem = await scheduledProblemsService.updateScheduledProblem(
    req.user!.id,
    scheduledProblemId,
    req.body as UpdateScheduledProblemInput,
  );
  res.json({ scheduledProblem });
}

export async function deleteScheduledProblem(req: Request, res: Response) {
  const { scheduledProblemId } = req.params as unknown as ScheduledProblemIdParams;
  await scheduledProblemsService.deleteScheduledProblem(req.user!.id, scheduledProblemId);
  res.status(204).end();
}
