# Monorepo Phase 1

Date: 2026-05-17

## Decision

Move the existing Next.js app into `apps/web` and make the repository root a pnpm workspace.

## Why

The app is still early enough that a monorepo migration is cheap. Keeping this first phase small avoids mixing structural movement with package extraction and makes verification straightforward.

## Current Structure

```txt
apps/web
```

Root scripts delegate to `@kupon/web` through pnpm filters.

## Later Extractions

- Move reusable UI components into `packages/ui`.
- Move crypto payment provider code into `packages/payments`.
- Move Telegram notification code into `packages/notifications`.

Each extraction should keep `pnpm lint`, `pnpm build`, and Prisma validation passing from the repo root.
