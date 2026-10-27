# GymPulse monorepo (basic setup)

```
apps/api          NestJS + Drizzle + PostgreSQL   -> http://localhost:3000/v1
apps/web          React + Vite + Tailwind          -> http://localhost:5173
packages/shared   Zod schemas, types, constants    -> imported as @gympulse/shared
```

Requirements: Node.js 20 or 22 LTS, and pnpm (`npm install -g pnpm`).

## First run

1. `pnpm install`
2. Copy `apps/api/.env.example` to `apps/api/.env` and set `DATABASE_URL` to your hosted PostgreSQL URL.
   Keep `?sslmode=require` at the end. URL-encode special characters in the password.
3. Create the tables:
   `pnpm --filter api db:generate`
   `pnpm --filter api db:migrate`
4. `pnpm dev` (builds the shared package, then runs shared, api and web together)
5. Open http://localhost:5173
   - API card OK means the NestJS server runs.
   - Database card OK means the database connection works.
   The API starts even before the database is configured, so card 1 can be OK while card 2 fails.

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run shared (watch), api (watch) and web |
| `pnpm dev:api` / `pnpm dev:web` | Run one app (builds shared first) |
| `pnpm build` | Build everything in the right order |
| `pnpm typecheck` | Type check every package |
| `pnpm add <pkg> --filter api` | Add a dependency to one app |

## How the shared package works

`packages/shared` is built with tsup into both CommonJS (for the API) and ESM (for the web app).
Both apps import it as `@gympulse/shared`. After you change it, `pnpm dev` rebuilds it automatically.
Restart the API if it does not pick up a shared change.

## Troubleshooting

- **"Ignored build scripts" from pnpm:** run `pnpm approve-builds` and allow esbuild, then `pnpm install`.
- **Nest CLI error about the TypeScript compiler API:** TypeScript 7 is installed. Use `typescript@^6`.
- **PowerShell says running scripts is disabled:** run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (no admin rights needed) or use Command Prompt.
- **Cannot find module '@gympulse/shared':** the shared package is not built yet. Run `pnpm --filter @gympulse/shared build`.
- **Database card fails:** read the message on the card. Typical causes are a missing `?sslmode=require`, a wrong password, or an unencoded special character in the password.
- **Port already in use:** change `PORT` in `apps/api/.env` and the proxy target in `apps/web/vite.config.ts`.
- Do not run `nest new` or `npm create vite` inside this repo, and do not run `npm install` inside an app folder. Always use pnpm from the repo root.
