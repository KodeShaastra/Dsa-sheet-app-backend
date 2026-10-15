import { config } from 'dotenv';

// Load test settings before the app reads its env.
config({ path: '.env.test', override: true, quiet: true });
