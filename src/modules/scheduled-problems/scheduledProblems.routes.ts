import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './scheduled-problems.controller.js';
import {
  createScheduledProblemsSchema,
  listScheduledProblemsQuerySchema,
  scheduledProblemIdParamsSchema,
  updateScheduledProblemSchema,
} from './scheduled-problems.schema.js';

export const scheduledProblemsRouter = Router();

scheduledProblemsRouter.use(requireAuth);

scheduledProblemsRouter.get(
  '/',
  validate('query', listScheduledProblemsQuerySchema),
  controller.listScheduledProblems,
);
scheduledProblemsRouter.post(
  '/',
  validate('body', createScheduledProblemsSchema),
  controller.createScheduledProblems,
);
scheduledProblemsRouter.patch(
  '/:scheduledProblemId',
  validate('params', scheduledProblemIdParamsSchema),
  validate('body', updateScheduledProblemSchema),
  controller.updateScheduledProblem,
);
scheduledProblemsRouter.delete(
  '/:scheduledProblemId',
  validate('params', scheduledProblemIdParamsSchema),
  controller.deleteScheduledProblem,
);
