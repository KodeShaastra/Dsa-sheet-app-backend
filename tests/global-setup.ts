import { execSync } from 'node:child_process';
import { config } from 'dotenv';

// Runs once before all tests: bring the test database up to date.
export default function setup() {
  const { parsed } = config({ path: '.env.test', override: true, quiet: true });
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, ...parsed },
  });
}
