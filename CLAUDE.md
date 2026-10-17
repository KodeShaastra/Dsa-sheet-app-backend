# DSA Sheet — Backend (Express + PostgreSQL)

Backend API for a DSA Sheet web app (Apna College Technical Lead assignment).
Students log in, work through Chapters → Topics → Problems, tick off solved problems,
and schedule problems on a calendar. Target: 10,000–50,000 active users.

The frontend is a **separate Next.js repo**. It calls this API under `/api/*`.

- Local dev: Next.js (port 3000) rewrites `/api/*` → this server (port 4000), so the browser sees one origin.
- Production: CloudFront → EC2 → Nginx routes `/api/*` → this server on port 4000.
- **Do not add CORS.** Same origin is the design. If you think CORS is needed, stop and ask.

## Stack

- Node.js 20+ and TypeScript (strict mode)
- Express 5 (async errors reach the error handler without wrappers)
- PostgreSQL + Prisma ORM (local Postgres is already installed)
- Zod for input validation and env parsing
- bcrypt for passwords, jsonwebtoken for JWT, cookie-parser
- helmet, express-rate-limit, morgan (or pino-http) for logs
- Vitest + Supertest for tests
- tsx for dev (`tsx watch`), tsc for build
- ESLint + Prettier

## Folder structure

```
src/
  app.ts              # builds the express app (no listen) — used by tests
  server.ts           # loads env, calls app.listen
  config/env.ts       # Zod-validated env; crash on bad config
  lib/prisma.ts       # single PrismaClient instance
  middleware/
    auth.ts           # requireAuth: verify JWT cookie → req.user
    validate.ts       # validate(body|query|params, zodSchema)
    error.ts          # notFound + central error handler
  modules/
    auth/       auth.routes.ts  auth.controller.ts  auth.service.ts  auth.schema.ts
    sheet/      ...
    solved-problems/    ...
    scheduled-problems/ ...
  utils/
    AppError.ts       # class AppError(status, code, message)
prisma/
  schema.prisma
  seed.ts
  migrations/
tests/
```

Each module has four layers: routes (wiring) → controller (req/res only) → service (logic + Prisma) → schema (Zod).
Controllers never call Prisma directly.

## Environment (.env, and keep .env.example in sync)

```
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/dsa_sheet
JWT_SECRET=change-me-min-32-chars
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=7
COOKIE_NAME=dsa_token
REFRESH_COOKIE_NAME=dsa_refresh
TRUST_PROXY_HOPS=1          # proxies in front of Express: 1 = Nginx, 2 = CloudFront → Nginx (production)
```

Never commit `.env`. Never log secrets.

## Naming at a glance

| Thing | Name | Meaning |
| --- | --- | --- |
| Sheet content | `chapters` → `topics` → `problems` | Same for every student |
| Ticked problems | `solved_problems` | "User X solved problem Y" |
| Calendar items | `scheduled_problems` | "User X will solve problem Y on date Z" |
| Calendar item state | `PENDING` / `DONE` / `SKIPPED` | Missed = PENDING with a past date (computed, not stored) |
| Sort field | `displayOrder` | Order shown on screen |

Rules:
- Tables plural snake_case (`solved_problems`), models singular PascalCase (`SolvedProblem`), fields camelCase (`solvedAt`).
- Routes = the table name in kebab-case (`/api/solved-problems`, `/api/scheduled-problems`).
- Route params say what they are: `:problemId`, `:scheduledProblemId` — never a bare `:id`.
- Module folders, files and handlers use the same words (`scheduled-problems/scheduledProblems.service.ts`, `markProblemSolved`, `unmarkProblemSolved`, `scheduleProblems`, `updateScheduledProblem`).

## Database schema (Prisma)

Use snake_case table names via `@@map`, camelCase fields in code, `@map` for columns.

| Model | Fields | Notes |
| --- | --- | --- |
| User (`users`) | id (uuid), name, email (unique, lowercase), passwordHash, createdAt | |
| Chapter (`chapters`) | id, title, slug (unique), displayOrder | has many Topic |
| Topic (`topics`) | id, chapterId → Chapter, title, displayOrder | index (chapterId, displayOrder) |
| Problem (`problems`) | id, topicId → Topic, title, difficulty (enum Difficulty: EASY/MEDIUM/HARD), youtubeUrl?, practiceUrl? (LeetCode/Codeforces), articleUrl?, displayOrder | index (topicId, displayOrder), index (difficulty) |
| SolvedProblem (`solved_problems`) | userId → User, problemId → Problem, solvedAt | **composite PK (userId, problemId)** — one row = "this user solved this problem" |
| ScheduledProblem (`scheduled_problems`) | id, userId → User, problemId → Problem, scheduledFor (Date only), status (enum ScheduleStatus: PENDING/DONE/SKIPPED, default PENDING), note?, createdAt | index (userId, scheduledFor); unique (userId, problemId) — one row = "this user plans to solve this problem on this date"; a problem sits on one date at a time |

- Deleting a User cascades to SolvedProblem and ScheduledProblem.
- Deleting a Problem cascades to SolvedProblem and ScheduledProblem.
- `scheduledFor` is `@db.Date` (no time, no timezone issues).

### Seed (`prisma/seed.ts`)

- Idempotent: use `upsert` by slug/title so it can run many times.
- ~8 chapters (Arrays, Strings, Linked List, Stack & Queue, Binary Search, Trees, Graphs, Dynamic Programming), 2–3 topics each, 60–100 problems total.
- Use real, well-known problems with real LeetCode URLs. Mix of difficulties.
- YouTube/article links: use real ones only if sure; otherwise leave null. **Never invent URLs.**
- Also create one demo user: `demo@dsasheet.dev` / `Demo@1234`.

## Auth

- Signup/login hash with bcrypt, cost 12. Emails trimmed + lowercased.
- On success, issue an access token (JWT `{ sub: userId }`, 15 min) and a refresh token (7 days), each in its own cookie:
  `httpOnly: true, secure: NODE_ENV === 'production', sameSite: 'lax', path: '/'`. See "Refresh tokens" below.
- `requireAuth` reads the access token cookie, verifies, sets `req.user = { id }`. Missing/invalid/expired → 401.
- Login errors are generic: "Invalid email or password" (don't reveal which one).
- Rate-limit `/api/auth/login` and `/api/auth/signup`: 5 requests/min per IP.
- Never return `passwordHash` in any response.

## API contract

All responses are JSON. Success = the data itself. Error shape, always:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Human readable", "details": [] } }
```

Codes: `VALIDATION_ERROR` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `RATE_LIMITED` 429, `INTERNAL` 500.

| Method | Path | Auth | Body / Query | Returns |
| --- | --- | --- | --- | --- |
| GET | /api/health | no | — | `{ status: "ok" }` |
| POST | /api/auth/signup | no | `{ name, email, password }` (password ≥ 8) | `{ user }` + cookie, 201 |
| POST | /api/auth/login | no | `{ email, password }` | `{ user }` + cookie |
| POST | /api/auth/refresh | no (refresh cookie) | — | `{ user }` + new cookies; 401 + both cookies cleared if invalid |
| POST | /api/auth/logout | no | — | 204, refresh token revoked, both cookies cleared |
| POST | /api/auth/logout-all | yes | — | 204, every refresh token of this user revoked, cookies cleared |
| GET | /api/auth/me | yes | — | `{ user }` |
| GET | /api/sheet | yes | — | `{ chapters: [{ id, title, slug, topics: [{ id, title, problems: [...] }] }] }` ordered by displayOrder |
| GET | /api/solved-problems | yes | — | `{ solvedProblemIds: string[], stats: { total, solved, byDifficulty, byChapter } }` |
| PUT | /api/solved-problems/:problemId | yes | — | 204 — tick (idempotent; 404 if problem doesn't exist) |
| DELETE | /api/solved-problems/:problemId | yes | — | 204 — untick (idempotent) |
| GET | /api/scheduled-problems | yes | — | `{ scheduledProblems: [{ id, scheduledFor, status, note, problem: { id, title, difficulty } }] }` — the whole calendar, sorted by date |
| POST | /api/scheduled-problems | yes | `{ scheduledFor, problemIds: string[], note? }` | `{ scheduledProblems }` 201; 409 (creates nothing) if any is already scheduled on any date |
| PATCH | /api/scheduled-problems/:scheduledProblemId | yes | `{ scheduledFor?, status?, note? }` | `{ scheduledProblem }` |
| DELETE | /api/scheduled-problems/:scheduledProblemId | yes | — | 204 |

Rules:
- A user can only read/change **their own** solved problems and schedule. Always filter by `req.user.id`; another user's scheduledProblemId → 404.
- GET returns the user's **whole** calendar in one go (no date range). It stays small because a problem sits on one
  date at a time: at most one row per problem. The frontend loads it once and builds the month, week and "already
  planned" views from it.
- PATCH a scheduled problem to `status: DONE` also upserts SolvedProblem for that problem (same transaction).
- `scheduledFor` in POST/PATCH can't be in the past → 400. The server doesn't know the user's time zone, so "past" means
  before UTC-yesterday (`earliestToday()` in `utils/date.ts`). Missed items can still be marked done or moved to today.
- `/api/sheet` is the same for every user: cache it in memory (refresh every 10 min) and send `Cache-Control: private, max-age=300`.
- Dates are `YYYY-MM-DD` strings in and out.

## Scripts (package.json)

```
dev            tsx watch src/server.ts
build          prisma generate && tsc -p tsconfig.build.json   (tsconfig.build.json leaves tests out of dist/)
start          node dist/server.js
typecheck      tsc --noEmit
lint           eslint .
format         prettier --write .
format:check   prettier --check .
test           vitest run
test:watch     vitest
db:generate    prisma generate   (Prisma 7: run after every db:migrate)
db:migrate     prisma migrate dev
db:deploy      prisma migrate deploy
db:seed        prisma db seed
db:studio      prisma studio
```

## Code rules

- TypeScript strict. No `any` (use `unknown` + narrowing).
- Validate every body, query and params with Zod before the controller runs.
- Throw `AppError`; never `res.status(...).json` errors by hand outside the error handler.
- Prisma known errors map to clean errors (P2002 → 409 CONFLICT, P2025 → 404 NOT_FOUND).
- Use transactions where two writes must succeed together.
- Middleware order: helmet → json (limit 100kb) → cookie-parser → logger → routes → notFound → error.
- `app.set('trust proxy', TRUST_PROXY_HOPS)` — 2 in production (CloudFront → Nginx), so rate limits see each visitor's
  real IP, not CloudFront's. Port 80 on the server must only accept CloudFront, or the header could be faked.
- Small functions, clear names, no commented-out code.

## Tests (minimum)

Supertest against `app` using a separate test database (`DATABASE_URL` from `.env.test`):
- signup → me → logout flow; wrong password → 401
- solved-problems PUT twice stays one row; DELETE works
- schedule: create, list, PATCH to DONE marks problem solved, can't touch another user's item

## Definition of done for any change

1. `npm run lint` and `npm run build` pass
2. `npm test` passes
3. `.env.example` and this file updated if config or API changed

## Refresh tokens (built)

Code: `src/modules/auth/refreshTokens.service.ts`. Tests: `tests/refreshTokens.test.ts`.

### Idea

| Token | Cookie | Lives for | What it is |
| --- | --- | --- | --- |
| Access token | `dsa_token` | 15 min | JWT `{ sub: userId }`, sent with every API call |
| Refresh token | `dsa_refresh` | 7 days | Random 64-byte string (not a JWT), used only to get a new access token |

Both cookies: `httpOnly`, `secure` in production, `sameSite: 'lax'`, `path: '/'`.

### New table: `refresh_tokens` (model `RefreshToken`)

| Field | Notes |
| --- | --- |
| id | uuid |
| userId → User | cascade on delete; index (userId) |
| tokenHash | SHA-256 of the token, unique. **Never store the raw token.** |
| familyId | Same for every token in one login chain (used to detect theft) |
| expiresAt | now + 7 days |
| revokedAt? | set when used, logged out, or killed |
| replacedById? | the token that replaced this one |
| createdAt, userAgent? | for debugging / "your devices" later |

### Flows

- **Signup / login:** issue access + refresh token (new `familyId`), set both cookies.
- **`POST /api/auth/refresh`** (no access token needed):
  1. Read `dsa_refresh`, hash it, look it up.
  2. Not found or expired → clear both cookies, 401.
  3. Found but already revoked → **reuse detected**: revoke every token in that `familyId`, clear cookies, 401.
  4. Otherwise, in one transaction: revoke it, create a new one (same `familyId`, set `replacedById`), set both cookies, return `{ user }`.
- **`POST /api/auth/logout`:** revoke the current refresh token, clear both cookies.
- **`POST /api/auth/logout-all`** (auth required): revoke all of this user's refresh tokens, clear cookies.
- Rate-limit `/api/auth/refresh`: 30 requests/min per IP.
- Delete expired/revoked tokens older than 7 days on server start, and daily.
- **Two-tab grace period (30 s):** if a token that was rotated less than 30 s ago comes back and its replacement
  is still active, it's two tabs refreshing at once, not theft: send a new access cookie only (the browser
  already has the new refresh cookie). After 30 s it counts as reuse.
- Rotation is race-safe: the old token is revoked with `WHERE revoked_at IS NULL` inside the transaction,
  so two simultaneous refreshes rotate only once.

### Frontend must handle

- Route guard: check the **`dsa_refresh`** cookie, not `dsa_token` (the access cookie disappears after 15 min).
- On a 401 from any API call: call `POST /api/auth/refresh` once, then retry. Only if refresh fails → `/login`.

### Extra env

```
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=7
REFRESH_COOKIE_NAME=dsa_refresh
```

### Extra tests

- refresh rotates the token; the old one no longer works (after the grace period)
- reusing an old refresh token kills the whole family
- logout-all → every device's refresh fails
- also: two tabs / simultaneous refresh, expiry, logout, cleanup, 30/min rate limit

## Don't

- Don't add CORS, sessions, or a different ORM.
- Don't return the JWT in any response body. It goes only in the httpOnly cookie.
- Don't change the API contract without updating this file (the frontend repo mirrors it).
- Don't invent problem links in the seed.

## Working notes

- **Prisma 7:** `db:migrate` no longer rebuilds the client. Always run `npm run db:generate` after it.
- **Migrations, development phase (nothing deployed yet): keep exactly one `init` migration.** For any schema change:
  delete `prisma/migrations/2026*`, reset both databases (needs the user's explicit OK), run
  `npx prisma migrate dev --name init --create-only`, re-add the hand-written `users_email_lowercase` CHECK at the end,
  apply, then `db:generate` and `db:seed`. Reset the test DB with `DATABASE_URL` from `.env.test`.
  **After the first deploy:** never edit an applied migration; add new ones (renames by hand with `ALTER … RENAME`).
- Check the DB matches the schema: `npx prisma migrate dev --create-only` must produce an empty migration (delete it after).
- **Local Postgres** connects over the Unix socket, no password: `?host=/var/run/postgresql` in `DATABASE_URL`.
- **Ids are strings in the API.** Users, scheduled problems, refresh tokens: UUIDs. Chapters/topics/problems: integers in the
  DB, converted in `utils/ids.ts`. Bad id format → 400; valid but missing or not yours → 404.
- **Errors:** `details` is always an array of `{ path, message }` (empty when there's nothing to add).
- **No `any`** is enforced by ESLint in `src/` (`no-explicit-any` + type-aware `no-unsafe-*`).
- **Test DB guard:** tests empty every table, so `tests/test-env.ts` refuses to run unless `.env.test` exists and its
  database name ends in `_test`.
- **Requests rejected by `express.json()`** (bad JSON, >100kb) never reach the logger (it comes after json in the order).
- **Prettier:** `CLAUDE.md` is in `.prettierignore` so `npm run format` keeps this file as written.
- **Git:** commit only when asked, as **KodeShaastra** <prashubisht07@gmail.com>.
