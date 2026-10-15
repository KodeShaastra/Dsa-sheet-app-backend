# DSA Sheet API

Node + TypeScript + Express 5 + Prisma (PostgreSQL).

## First-time setup

```bash
npm install
cp .env.example .env        # then fill in DATABASE_URL and JWT_SECRET
npm run db:deploy           # create tables
npm run db:generate         # build the Prisma client
```

For tests, also create `.env.test` pointing at a separate database.

## Commands

| Command              | What it does                                               |
| -------------------- | ---------------------------------------------------------- |
| `npm run dev`        | Start the server, restart on file changes                  |
| `npm test`           | Run tests (uses the test database)                         |
| `npm run typecheck`  | Check types                                                |
| `npm run lint`       | Check code with ESLint                                     |
| `npm run format`     | Format code with Prettier                                  |
| `npm run build`      | Compile to `dist/`                                         |
| `npm start`          | Run the compiled server                                    |
| `npm run db:migrate` | After changing `schema.prisma`, make a migration           |
| `npm run db:seed`    | Add sheet data + demo user (demo@dsasheet.dev / Demo@1234) |
| `npm run db:studio`  | Open a web view of the database                            |

## Folder structure

```
src/
  app.ts            builds the Express app (no listen), used by tests
  server.ts         starts the server
  config/env.ts     checks env settings with Zod, stops on bad config
  lib/prisma.ts     the one shared Prisma client
  lib/logger.ts     the shared pino logger
  middleware/
    auth.ts         requireAuth: checks the login cookie, sets req.user
    validate.ts     validate('body' | 'query' | 'params', zodSchema)
    error.ts        404 handler + central error handler
  modules/<name>/   <name>.routes.ts .controller.ts .service.ts .schema.ts
  utils/
    AppError.ts     throw new AppError(status, code, message)
    jwt.ts          make and check login tokens
prisma/
  schema.prisma  seed.ts  migrations/
tests/
```

### Module rules

Each module has four layers:

1. **routes**: wiring only. URL → middleware (`validate`, `requireAuth`) → controller.
2. **controller**: reads `req`, calls the service, writes `res`. No business logic.
3. **service**: all logic and all Prisma calls. Knows nothing about `req`/`res`.
4. **schema**: Zod schemas and their inferred types.

Controllers never call Prisma directly. Services throw `AppError` for expected failures.

Errors always look like `{ "error": { "code": "...", "message": "...", "details"?: ... } }`.

## Secrets

- **Never commit `.env`.** `.gitignore` blocks every `.env*` file except `.env.example`.
- **Never log secrets.** The logger hides cookies, auth headers, `password`, `passwordHash`
  and `token` fields (see `redactPaths` in `src/lib/logger.ts`). Add new secret fields there.
- The app refuses to start if `JWT_SECRET` is shorter than 32 characters or is still the
  example value. Its error message names the bad setting but never prints the value.

## API

- `GET /health`
- `POST /api/auth/signup` `{ email, name, password }` (5/min per IP)
- `POST /api/auth/login` `{ email, password }` (5/min per IP)
- `POST /api/auth/logout`
- `GET /api/auth/me` (needs login cookie)
