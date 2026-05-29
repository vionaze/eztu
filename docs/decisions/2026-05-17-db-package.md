# Database Package Extraction

Date: 2026-05-17

## Decision

Move Prisma ownership from `apps/web` into `packages/db`.

## Why

Database schema, migrations, generated client workflow, and Prisma client initialization are shared infrastructure. Keeping them in an app folder makes the next integrations harder to reuse and reason about.

## Current Structure

```txt
packages/db
  prisma
  prisma.config.ts
  src/index.ts
```

The web app imports `prisma` and Prisma model types from `@kupon/db`.

## Local Environment

For local development, Prisma CLI commands in `packages/db` load `apps/web/.env` as a compatibility bridge. Production should inject `DATABASE_URL` through the runtime environment.

## Guardrails

Root commands now validate the package boundary:

```bash
pnpm prisma:validate
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm build
```

## Follow-Up

Next extractions should be `packages/payments`, then `packages/notifications`.
