import { spawnSync } from 'node:child_process';
import { Writable } from 'node:stream';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { redactPaths } from '../src/lib/logger.js';

function captureLog(obj: object): string {
  let out = '';
  const stream = new Writable({
    write(chunk: Buffer, _enc, cb) {
      out += chunk.toString();
      cb();
    },
  });
  pino({ redact: redactPaths }, stream).info(obj, 'test');
  return out;
}

describe('never log secrets', () => {
  it('hides cookies, auth headers, and set-cookie', () => {
    const out = captureLog({
      req: { headers: { cookie: 'dsa_token=SECRET1', authorization: 'Bearer SECRET2' } },
      res: { headers: { 'set-cookie': 'dsa_token=SECRET3' } },
    });
    expect(out).not.toMatch(/SECRET/);
    expect(out).toMatch(/\[Redacted\]/);
  });

  it('hides passwords, hashes, and tokens', () => {
    const out = captureLog({
      password: 'SECRET1',
      user: { passwordHash: 'SECRET2' },
      data: { token: 'SECRET3' },
    });
    expect(out).not.toMatch(/SECRET/);
  });
});

describe('env checks', () => {
  function startWith(overrides: Record<string, string>) {
    return spawnSync('npx', ['tsx', '-e', "import('./src/config/env.ts')"], {
      env: {
        ...process.env,
        DOTENV_CONFIG_PATH: '/dev/null',
        DATABASE_URL: 'postgresql://x@localhost/x',
        ...overrides,
      },
      encoding: 'utf8',
    });
  }

  it('refuses the example JWT secret without printing it', () => {
    const secret = 'change-me-min-32-chars-padded-to-be-long-enough';
    const run = startWith({ JWT_SECRET: secret });
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/JWT_SECRET/);
    expect(run.stderr).not.toContain(secret);
  });

  it('refuses a short JWT secret', () => {
    const run = startWith({ JWT_SECRET: 'too-short' });
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/at least 32/);
  });
});
