import { z } from 'zod';

const MAX_INT = 2_147_483_647; // Postgres INTEGER limit

/**
 * Chapter, topic, and problem ids are numbers in the database but strings in the API.
 * This accepts "12" and gives back 12.
 */
export const numericIdSchema = z
  .string()
  .regex(/^[1-9]\d{0,9}$/, 'Invalid id')
  .transform(Number)
  .refine((n) => n <= MAX_INT, 'Invalid id');

/** Number id from the database → string id for the API. */
export const toApiId = (id: number): string => String(id);
