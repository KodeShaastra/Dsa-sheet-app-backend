import { loadTestEnv } from './test-env.js';

// Load test settings (and check they point at a test database) before the app reads its env.
loadTestEnv();
