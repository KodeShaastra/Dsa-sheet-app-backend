import { z } from 'zod';
import { dateSchema, daysInclusive } from '../../utils/date.js';
import { numericIdSchema } from '../../utils/ids.js';

export const MAX_RANGE_DAYS = 62;

export const listScheduledProblemsQuerySchema = z
  .object({ from: dateSchema, to: dateSchema })
  .superRefine(({ from, to }, ctx) => {
    const days = daysInclusive(from, to);
    if (days < 1) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: '"to" must be on or after "from"' });
    } else if (days > MAX_RANGE_DAYS) {
      ctx.addIssue({
        code: 'custom',
        path: ['to'],
        message: `Date range can be at most ${MAX_RANGE_DAYS} days`,
      });
    }
  });

// Blank notes are stored as null.
const noteSchema = z
  .string()
  .trim()
  .max(500)
  .transform((s) => (s === '' ? null : s));

export const createScheduledProblemsSchema = z.object({
  scheduledFor: dateSchema,
  problemIds: z
    .array(numericIdSchema)
    .min(1)
    .max(50)
    .transform((ids) => [...new Set(ids)]),
  note: noteSchema.optional(),
});

export const updateScheduledProblemSchema = z
  .object({
    scheduledFor: dateSchema.optional(),
    status: z.enum(['PENDING', 'DONE', 'SKIPPED']).optional(),
    note: noteSchema.nullable().optional(), // null clears the note
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined), {
    message: 'Send at least one of scheduledFor, status, note',
  });

export const scheduledProblemIdParamsSchema = z.object({ scheduledProblemId: z.uuid() });

export type ListScheduledProblemsQuery = z.infer<typeof listScheduledProblemsQuerySchema>;
export type CreateScheduledProblemsInput = z.infer<typeof createScheduledProblemsSchema>;
export type UpdateScheduledProblemInput = z.infer<typeof updateScheduledProblemSchema>;
export type ScheduledProblemIdParams = z.infer<typeof scheduledProblemIdParamsSchema>;
