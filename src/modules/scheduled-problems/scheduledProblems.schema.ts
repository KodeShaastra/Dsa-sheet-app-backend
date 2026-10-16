import { z } from 'zod';
import { dateSchema, earliestToday } from '../../utils/date.js';
import { numericIdSchema } from '../../utils/ids.js';

/** A date you can plan for: today or later. ("YYYY-MM-DD" strings sort like dates.) */
const upcomingDateSchema = dateSchema.refine((date) => date >= earliestToday(), {
  message: "Can't schedule on a past date",
});

// Blank notes are stored as null.
const noteSchema = z
  .string()
  .trim()
  .max(500)
  .transform((s) => (s === '' ? null : s));

export const scheduleProblemsSchema = z.object({
  scheduledFor: upcomingDateSchema,
  problemIds: z
    .array(numericIdSchema)
    .min(1)
    .max(50)
    .transform((ids) => [...new Set(ids)]),
  note: noteSchema.optional(),
});

export const updateScheduledProblemSchema = z
  .object({
    scheduledFor: upcomingDateSchema.optional(),
    status: z.enum(['PENDING', 'DONE', 'SKIPPED']).optional(),
    note: noteSchema.nullable().optional(), // null clears the note
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined), {
    message: 'Send at least one of scheduledFor, status, note',
  });

export const scheduledProblemIdParamsSchema = z.object({ scheduledProblemId: z.uuid() });

export type ScheduleProblemsInput = z.infer<typeof scheduleProblemsSchema>;
export type UpdateScheduledProblemInput = z.infer<typeof updateScheduledProblemSchema>;
export type ScheduledProblemIdParams = z.infer<typeof scheduledProblemIdParamsSchema>;
