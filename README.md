# Kupon Monorepo

Kupon is managed as a pnpm workspace.

## Apps

- `apps/web` - Next.js storefront, admin, Clerk auth, Prisma, Cryptomus crypto checkout.

## Packages

- `packages/db` - Prisma schema, migrations, generated client workflow, and shared Prisma singleton.
- `packages/ui` - Shared low-level UI primitives used by the web app.
- `packages/payments` - Cryptomus invoice creation and webhook signature verification.

## Common Commands

Run from the monorepo root:

```bash
pnpm dev:webpack
pnpm lint
pnpm typecheck
pnpm build
pnpm prisma:generate
pnpm prisma:validate
pnpm db:migrate
```

The local web app runs on:

```txt
http://localhost:3456
```

## Environment

The web app reads environment variables from:

```txt
apps/web/.env
```

Use `apps/web/.env.example` as the reference for required variables.

The database package also loads `apps/web/.env` for local Prisma CLI commands. In production, provide the same variables through the process environment.

## Monorepo Direction

The current monorepo keeps the web app, database package, shared UI primitives, and payment provider integration separate. Future low-risk extractions can add:

- `packages/notifications` for Telegram and other outbound notifications.
