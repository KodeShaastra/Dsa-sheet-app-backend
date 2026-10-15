import { z } from 'zod';
import { numericIdSchema } from '../../utils/ids.js';

export const problemIdParamsSchema = z.object({ problemId: numericIdSchema });

export type ProblemIdParams = z.infer<typeof problemIdParamsSchema>;
