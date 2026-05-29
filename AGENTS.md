<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Repo Layout

This is a pnpm monorepo. The web app lives in `apps/web`; run root commands through pnpm filters or the root package scripts.

`packages/db` owns Prisma schema, migrations, Prisma CLI config, and the shared Prisma client singleton. App code should import database access from `@kupon/db`, not from app-local Prisma helpers.

`packages/ui` owns shared low-level UI primitives such as `Button`, `Card`, `Input`, `Badge`, and `Skeleton`. App-specific UI that depends on app context or heavy feature libraries should stay in `apps/web` until it has a clear reuse case.
