# UI Package Extraction

Date: 2026-05-17

## Decision

Move shared low-level UI primitives from `apps/web` into `packages/ui`.

## Why

The app already reuses a small set of primitives across storefront and admin surfaces. Keeping those primitives in a package gives future apps, workers with dashboards, or admin surfaces one import path and one implementation.

## Current Scope

```txt
packages/ui
  src/Badge.tsx
  src/Button.tsx
  src/Card.tsx
  src/Input.tsx
  src/Skeleton.tsx
```

The web app imports these from `@kupon/ui`.

## Deliberate Non-Scope

`RichEditor` stays in `apps/web` because it depends on Tiptap and is currently an admin feature, not a primitive.

`CountrySelector` stays in `apps/web` because it depends on the app currency context.

## Guardrails

Root validation covers this package:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Next.js transpiles `@kupon/ui` through `transpilePackages`.
