import { existsSync } from 'node:fs';
import { config } from 'dotenv';

/** The database name in a Postgres URL, e.g. "dsa_sheet_test". */
function databaseName(url: string): string {
  return new URL(url).pathname.replace(/^\//, '');
}

/**
 * Tests empty every table, so they must never run against the real database.
 * Loads .env.test and stops unless its database name ends in "_test".
 */
export function loadTestEnv(): Record<string, string> {
  if (!existsSync('.env.test')) {
    throw new Error('Missing .env.test: tests need their own database (see README).');
  }
  const { parsed = {} } = config({ path: '.env.test', override: true, quiet: true });
  const url = parsed.DATABASE_URL ?? '';
  if (!databaseName(url).endsWith('_test')) {
    throw new Error(
      `Refusing to run tests: DATABASE_URL in .env.test must point to a database ending in "_test" ` +
        `(got "${databaseName(url) || 'nothing'}"). Tests delete all data.`,
    );
  }
  return parsed;
}
