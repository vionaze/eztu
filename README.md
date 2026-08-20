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

## Production deploy (VPS)

**User:** `deploy` · **Path:** `/var/www/eztu` · **PM2:** `eztu`  
Jangan pull/build sebagai `root` (akan `EACCES` di `node_modules`).

### One-liner (recommended)

```bash
sudo -iu deploy
cd /var/www/eztu
pnpm deploy:vps
# or: bash scripts/deploy-vps.sh
```

### Manual (sama urutannya)

```bash
sudo -iu deploy
cd /var/www/eztu

git pull --ff-only origin main
pnpm install
pnpm db:migrate          # WAJIB — schema DB (categories, blog, logs, dll.)
pnpm prisma:generate
pnpm products:import:eztopup # jadikan workbook EZ All Products katalog aktif
pnpm build
pm2 restart eztu --update-env
pm2 save
pm2 logs eztu --lines 40
```

### After deploy checklist

| Check | Command / URL |
|--------|----------------|
| App up | `pm2 status` |
| Site | https://eztopup.io |
| Admin | https://eztopup.io/admin/dashboard |
| Categories | https://eztopup.io/admin/categories |
| Cron blog (if used) | needs `CRON_SECRET` + crontab Bearer header |
| Supplier price cron | call `/api/cron/product-prices` every 6 hours with `PRODUCT_PRICE_CRON_SECRET` (or `CRON_SECRET`) |

### If permission errors

```bash
# as root once
chown -R deploy:deploy /var/www/eztu
```

Then run deploy again as `deploy`.

## Monorepo Direction

The current monorepo keeps the web app, database package, shared UI primitives, and payment provider integration separate. Future low-risk extractions can add:

- `packages/notifications` for Telegram and other outbound notifications.
