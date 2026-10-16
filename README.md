# DSA Sheet — Backend API

The backend for a **DSA Sheet** web app. Students log in, work through a list of
data-structures-and-algorithms problems (Chapters → Topics → Problems), tick off the ones
they've solved, and schedule problems on a calendar.

This repo is **only the API**. The frontend (Next.js) is a separate repo. It calls this API with
relative `/api/...` URLs, so in the browser both run on the same site, and the login cookie just works.

```mermaid
flowchart LR
  Browser -->|"/api/*"| Proxy["Next.js dev rewrite<br/>or Nginx in production"]
  Browser -->|pages| Frontend["Frontend (Next.js)"]
  Proxy --> API["This API (Express, port 4000)"]
  API --> DB[(PostgreSQL)]
```

## What it does

| Feature                | What the user gets                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| **Accounts**           | Sign up, log in, log out (here or on every device). Stay logged in for 7 days with refresh tokens. |
| **The sheet**          | 8 chapters → 22 topics → 98 real LeetCode problems, each with a difficulty and practice link.      |
| **Solved problems**    | Tick / untick problems. Get progress stats: overall, per difficulty, per chapter.                  |
| **Scheduled problems** | Put problems on a calendar date, mark them Done or Skipped, move them, add a note, delete them.    |
| **Done → solved**      | Marking a scheduled problem `DONE` also ticks it as solved (both saved together, or neither).      |

## Tech stack

| Part       | Tool                                                                 |
| ---------- | -------------------------------------------------------------------- |
| Language   | TypeScript (strict mode), Node.js 20+                                |
| Web server | Express 5                                                            |
| Database   | PostgreSQL, through Prisma 7                                         |
| Validation | Zod (every request body, query, and URL param; also the `.env` file) |
| Login      | bcrypt (password hashing), JSON Web Token in an httpOnly cookie      |
| Security   | helmet (safe HTTP headers), express-rate-limit                       |
| Logs       | pino (secrets are hidden automatically)                              |
| Tests      | Vitest + Supertest, against a real test database                     |
| Code style | ESLint + Prettier                                                    |

## Getting started

You need **Node.js 20+** and **PostgreSQL** running locally.

```bash
# 1. Install packages
npm install

# 2. Create two databases: one for the app, one for tests
createdb dsa_sheet
createdb dsa_sheet_test

# 3. Settings: copy the example, then fill in DATABASE_URL and a real JWT_SECRET
cp .env.example .env
cp .env.example .env.test     # point DATABASE_URL at dsa_sheet_test, set NODE_ENV=test

# 4. Build the tables, the Prisma client, and the starter data
npm run db:deploy
npm run db:generate
npm run db:seed

# 5. Start the server (restarts when you change a file)
npm run dev                   # → http://localhost:4000/api/health
```

**Demo login:** `demo@dsasheet.dev` / `Demo@1234`

### Settings (`.env`)

| Name                     | Example                                 | What it's for                                     |
| ------------------------ | --------------------------------------- | ------------------------------------------------- |
| `NODE_ENV`               | `development`                           | `development`, `test`, or `production`            |
| `PORT`                   | `4000`                                  | Port the server listens on                        |
| `DATABASE_URL`           | `postgresql://USER:PASSWORD@localhost…` | Where the database is                             |
| `JWT_SECRET`             | 48 random characters                    | Signs login tokens. Must be 32+ characters.       |
| `ACCESS_TOKEN_TTL`       | `15m`                                   | How long an access token lasts (number + s/m/h/d) |
| `REFRESH_TOKEN_TTL_DAYS` | `7`                                     | How long a refresh token lasts, in days           |
| `COOKIE_NAME`            | `dsa_token`                             | Name of the access token cookie                   |
| `REFRESH_COOKIE_NAME`    | `dsa_refresh`                           | Name of the refresh token cookie                  |

The app checks these on start and **stops with a clear message** if one is missing or wrong.

## Commands

| Command                | What it does                                               |
| ---------------------- | ---------------------------------------------------------- |
| `npm run dev`          | Start the server, restart on file changes                  |
| `npm test`             | Run all tests once (uses the test database)                |
| `npm run test:watch`   | Re-run tests as you edit                                   |
| `npm run typecheck`    | Check types                                                |
| `npm run lint`         | Check code with ESLint                                     |
| `npm run format`       | Format code with Prettier                                  |
| `npm run format:check` | Check formatting without changing files                    |
| `npm run build`        | Compile to `dist/`                                         |
| `npm start`            | Run the compiled server                                    |
| `npm run db:migrate`   | After changing `schema.prisma`, make and apply a migration |
| `npm run db:deploy`    | Apply existing migrations (fresh database, or a server)    |
| `npm run db:generate`  | Rebuild the Prisma client (run after every `db:migrate`)   |
| `npm run db:seed`      | Add the sheet + demo user. Safe to run many times.         |
| `npm run db:studio`    | Open a web page to browse the database                     |

## How the code is organised

```
src/
  server.ts             starts the server, shuts down cleanly on Ctrl+C
  app.ts                builds the Express app (tests use this directly)
  config/env.ts         reads and checks the .env settings
  lib/
    prisma.ts           the one database connection
    logger.ts           logging, with secrets hidden
  middleware/
    auth.ts             requireAuth: checks the login cookie, sets req.user
    validate.ts         validate('body' | 'query' | 'params', zodSchema)
    error.ts            404 handler + the one place that sends error responses
  modules/              one folder per feature (see below)
    auth/               signup, login, refresh, logout, logout-all, me
                        (+ refreshTokens.service.ts: rotation, reuse detection, cleanup)
    sheet/              the chapters → topics → problems list
    solved-problems/    tick, untick, progress stats
    scheduled-problems/ the calendar
  utils/
    AppError.ts         throw new AppError(404, 'NOT_FOUND', 'Problem not found')
    jwt.ts              make and check access tokens
    cookies.ts          read a cookie safely
    date.ts             "YYYY-MM-DD" ⇄ database dates
    ids.ts              number ids in the database ⇄ string ids in the API
prisma/
  schema.prisma         the database tables
  migrations/           SQL that builds the tables
  seed.ts               loads the starter data
  seed-data.ts          the 98 problems (checked against LeetCode)
tests/                  one test file per feature, plus helpers.ts
```

### Inside each feature: four layers

Every module has the same four files. A request passes through them in this order:

```mermaid
flowchart LR
  R["routes<br/>which URL, which checks"] --> C["controller<br/>read request, send response"]
  C --> S["service<br/>the logic + database"]
  S --> DB[(Database)]
  Z["schema<br/>Zod rules"] -.used by.-> R
```

1. **routes**: wiring only. URL → `requireAuth` → `validate(...)` → controller.
2. **controller**: reads the request, calls the service, sends the response. No logic.
3. **service**: all the logic and all database calls. Never touches the request or response.
4. **schema**: the Zod rules for the input, and the types that come from them.

Controllers never call Prisma directly. Services throw `AppError` when something is wrong.

### What happens to every request

`helmet` → read JSON (max 100kb) → read cookies → log → rate limit → **your route** → 404 if no route
matched → error handler (turns every error into the standard error shape).

## The database

```mermaid
erDiagram
  users ||--o{ solved_problems : ticks
  users ||--o{ scheduled_problems : schedules
  users ||--o{ refresh_tokens : "stays logged in with"
  chapters ||--o{ topics : has
  topics ||--o{ problems : has
  problems ||--o{ solved_problems : "is ticked in"
  problems ||--o{ scheduled_problems : "is scheduled in"
```

| Table                | What one row means                          | Notes                                                            |
| -------------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| `users`              | One student                                 | UUID id. Email unique and always lowercase.                      |
| `chapters`           | A chapter, e.g. "Arrays"                    | Unique `slug`. Sorted by `displayOrder`.                         |
| `topics`             | A topic in a chapter, e.g. "Two Pointers"   | Sorted by `displayOrder`.                                        |
| `problems`           | One problem                                 | `EASY` / `MEDIUM` / `HARD`, practice/YouTube/article links       |
| `solved_problems`    | "This user solved this problem"             | One row per user + problem.                                      |
| `scheduled_problems` | "This user will solve this problem on date" | Status `PENDING` / `DONE` / `SKIPPED`. Date only, no time.       |
| `refresh_tokens`     | One login on one device                     | Only a SHA-256 hash is stored. `familyId` links one login chain. |

Deleting a user also deletes their solved, scheduled, and refresh-token rows. Deleting a problem deletes its solved and scheduled rows. Chapters and topics
can't be deleted while they still have topics or problems.

## API

All responses are JSON. Ids are strings. Dates are `YYYY-MM-DD`. Errors always look like:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Human readable", "details": [] } }
```

`details` is always a list, like `[{ "path": "email", "message": "Invalid email address" }]`.

| Code               | HTTP | When                                         |
| ------------------ | ---- | -------------------------------------------- |
| `VALIDATION_ERROR` | 400  | Bad input (wrong field, bad date, bad JSON)  |
| `UNAUTHORIZED`     | 401  | Not logged in, or wrong email/password       |
| `FORBIDDEN`        | 403  | Reserved for later                           |
| `NOT_FOUND`        | 404  | No such route, problem, or scheduled problem |
| `CONFLICT`         | 409  | Already exists (e.g. email taken)            |
| `RATE_LIMITED`     | 429  | Too many requests                            |
| `INTERNAL`         | 500  | Something broke on the server                |

| Method | Path                                          | Login          | Body / Query                               | Returns                                             |
| ------ | --------------------------------------------- | -------------- | ------------------------------------------ | --------------------------------------------------- |
| GET    | `/api/health`                                 | no             |                                            | `{ status: "ok" }`                                  |
| POST   | `/api/auth/signup`                            | no             | `{ name, email, password }` (5/min per IP) | `{ user }` + 2 cookies, 201                         |
| POST   | `/api/auth/login`                             | no             | `{ email, password }` (5/min per IP)       | `{ user }` + 2 cookies                              |
| POST   | `/api/auth/refresh`                           | refresh cookie | (30/min per IP)                            | `{ user }` + new cookies                            |
| POST   | `/api/auth/logout`                            | no             |                                            | 204, refresh token revoked, cookies cleared         |
| POST   | `/api/auth/logout-all`                        | yes            |                                            | 204, logged out on every device                     |
| GET    | `/api/auth/me`                                | yes            |                                            | `{ user: { id, name, email } }`                     |
| GET    | `/api/sheet`                                  | yes            |                                            | `{ chapters }` (cached 10 min in memory)            |
| GET    | `/api/solved-problems`                        | yes            |                                            | `{ solvedProblemIds, stats }`                       |
| PUT    | `/api/solved-problems/:problemId`             | yes            |                                            | 204 tick (safe to repeat; 404 if no such problem)   |
| DELETE | `/api/solved-problems/:problemId`             | yes            |                                            | 204 untick (safe to repeat)                         |
| GET    | `/api/scheduled-problems`                     | yes            |                                            | `{ scheduledProblems }` (whole calendar)            |
| POST   | `/api/scheduled-problems`                     | yes            | `{ scheduledFor, problemIds, note? }`      | `{ scheduledProblems }` 201 (409 if any is planned) |
| PATCH  | `/api/scheduled-problems/:scheduledProblemId` | yes            | `{ scheduledFor?, status?, note? }`        | `{ scheduledProblem }` (DONE also marks it solved)  |
| DELETE | `/api/scheduled-problems/:scheduledProblemId` | yes            |                                            | 204                                                 |

Scheduled problem `status`: `PENDING | DONE | SKIPPED`. A "missed" problem is `PENDING` with a past date.

A problem can be on the calendar on only one date at a time. You can't schedule or move a problem onto a past date.

### Example

```bash
curl -c jar -H 'Content-Type: application/json' \
  -d '{"email":"demo@dsasheet.dev","password":"Demo@1234"}' localhost:4000/api/auth/login
curl -b jar -X PUT localhost:4000/api/solved-problems/1        # tick "Two Sum"
curl -b jar localhost:4000/api/solved-problems                 # see your progress
```

## Security

- **Passwords** are hashed with bcrypt (cost 12). They're never stored or returned in plain text.
- **Two tokens, two cookies:** a short **access token** (JWT, 15 min) sent with every call, and a long
  **refresh token** (random, 7 days) used only at `/api/auth/refresh` to get a new access token.
  Both cookies are `httpOnly` (page scripts can't read them), `sameSite=lax`, and `secure` in production.
  Tokens never appear in a response body.
- **Refresh tokens rotate:** each use gives a new one and retires the old one. If a retired token is used
  again (after a 30-second grace period for two open tabs), it looks stolen, so that whole login chain is killed.
  Only a SHA-256 hash of each refresh token is stored. Old tokens are deleted on start and daily.
- **Login errors** are always "Invalid email or password", so nobody can tell which emails have accounts.
- **Rate limits:** 5 per minute per IP on login and signup, 30 on refresh, 300 overall.
- **Your data is yours:** every solved/scheduled query is filtered by the logged-in user.
  Another user's scheduled problem id gives 404.
- **Secrets:** `.env` files are never committed (only `.env.example`). Logs hide cookies,
  passwords, and tokens. The app won't start with a short or example `JWT_SECRET`.

## Tests

`npm test` runs **83 tests** in 9 files against the real `dsa_sheet_test` database
(its tables are created automatically on each run).

**Safety guard:** tests empty every table, so they refuse to start unless `.env.test` exists and its
database name ends in `_test` (`tests/test-env.ts`). Your real database can't be wiped by a test run.

| File                        | Checks                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `auth.test.ts`              | Signup, login, logout, `/me`, both cookies' flags, generic errors, rate limits                   |
| `refreshTokens.test.ts`     | Rotation, reuse kills the family, two-tab grace, expiry, logout, logout-all, cleanup, rate limit |
| `sheet.test.ts`             | Order by displayOrder, string ids, `Cache-Control`, 10-minute cache                              |
| `solvedProblems.test.ts`    | Tick/untick, safe to repeat, stats, users kept separate                                          |
| `scheduledProblems.test.ts` | Create, one date per problem, no past dates, list, update, delete, DONE → solved, ownership      |
| `schema.test.ts`            | Database rules: UUIDs, lowercase email, date-only, cascades                                      |
| `validate.test.ts`          | The `validate()` middleware                                                                      |
| `secrets.test.ts`           | Logs hide secrets; app refuses bad `JWT_SECRET`                                                  |
| `health.test.ts`            | `/api/health`, security headers, 404 shape                                                       |

## More

- **`CLAUDE.md`**: the full rules for working on this code (naming, code rules, migrations, definition of done).
