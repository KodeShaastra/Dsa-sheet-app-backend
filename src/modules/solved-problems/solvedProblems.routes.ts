import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './solvedProblems.controller.js';
import { problemIdParamsSchema } from './solvedProblems.schema.js';

export const solvedProblemsRouter = Router();

solvedProblemsRouter.use(requireAuth);

solvedProblemsRouter.get('/', controller.getSolvedProblems);
solvedProblemsRouter.put(
  '/:problemId',
  validate('params', problemIdParamsSchema),
  controller.markProblemSolved,
);
solvedProblemsRouter.delete(
  '/:problemId',
  validate('params', problemIdParamsSchema),
  controller.unmarkProblemSolved,
);
