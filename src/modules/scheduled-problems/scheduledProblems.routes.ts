import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './scheduledProblems.controller.js';
import {
  scheduleProblemsSchema,
  listScheduledProblemsQuerySchema,
  scheduledProblemIdParamsSchema,
  updateScheduledProblemSchema,
} from './scheduledProblems.schema.js';

export const scheduledProblemsRouter = Router();

scheduledProblemsRouter.use(requireAuth);

scheduledProblemsRouter.get(
  '/',
  validate('query', listScheduledProblemsQuerySchema),
  controller.listScheduledProblems,
);
scheduledProblemsRouter.post(
  '/',
  validate('body', scheduleProblemsSchema),
  controller.scheduleProblems,
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
