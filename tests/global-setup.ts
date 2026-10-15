import { execSync } from 'node:child_process';
import { loadTestEnv } from './test-env.js';

// Runs once before all tests: check we're on the test database, then bring it up to date.
export default function setup() {
  const testEnv = loadTestEnv();
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, ...testEnv },
  });
}
