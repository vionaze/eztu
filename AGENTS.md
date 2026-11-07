<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Repo Layout

This is a pnpm monorepo. The web app lives in `apps/web`; run root commands through pnpm filters or the root package scripts.

`packages/db` owns Prisma schema, migrations, Prisma CLI config, and the shared Prisma client singleton. App code should import database access from `@kupon/db`, not from app-local Prisma helpers.

`packages/ui` owns shared low-level UI primitives such as `Button`, `Card`, `Input`, `Badge`, and `Skeleton`. App-specific UI that depends on app context or heavy feature libraries should stay in `apps/web` until it has a clear reuse case.

# Session Continuity (mandatory)

Docs are the source of truth, not chat history. Any model or harness picking up this repo must do this:

1. **Before work:** read `docs/README.md`, then the newest 1–2 files in `docs/session-notes/` that match the task. Also read the relevant plan in `docs/plans/` if one exists.
2. **During work:** record decisions and business rules in the repo as they are made, not from memory later.
3. **Before ending any work session:** create or update `docs/session-notes/YYYY-MM-DD-<short-slug>.md` using `docs/session-notes/_template.md`. Include: what changed, decisions and why, files touched, verification results, deploy status, and remaining work.
4. **Update `docs/README.md`** if you add a new note/plan that future sessions should find first.
5. Never claim work is deployed or live unless it was verified on production. State blockers (SSH access, credentials, approvals) explicitly.

If a session is cut short, write a partial note with the current state instead of leaving only chat context.

