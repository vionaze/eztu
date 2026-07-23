# Session notes — Admin production (24 Jul 2026)

## Scope delivered

### Admin shell & UX
- Dense console layout: `.admin-page`, `.admin-tile`, `.admin-bento`, tighter main/header padding.
- SUPERADMIN/ADMIN badge + email in header; allowlist note if DB role still USER.
- Times: dashboard recent orders + activity logs use **Asia/Jakarta (WIB, GMT+7)**.

### Products
- List: click to edit, quick publish toggle, fulfillment type badge.
- Create/edit: Top-up vs Voucher, labels, variants (SKU, prices, cost), featured, image URL.
- Schema: `ProductFulfillmentType`, `requiresServerId`, `gameIdLabel`, `serverIdLabel`.
- Migration: `20260724120000_product_fulfillment_type` (MLBB backfill TOP_UP).

### Categories
- Full CRUD UI + API.
- Delete requires typing exact category name.
- `Product.categoryId` nullable; `ON DELETE SET NULL` → Uncategorized.
- Migration: `20260724130000_category_nullable_product`.

### Orders
- Clickable rows → compact detail panel (no scroll): customer inputs, payment, fulfillment.
- Order already stores `email`, `gameId`, `serverId` from checkout.

### Blog / AI
- Manual blog CRUD; AI generate/publish optional.
- Settings: enable, base URL, API key, model, countries chips, schedule, articles/run, auto-publish, system prompt.
- Cron: `/api/cron/blog-ai` Bearer `CRON_SECRET` (no query secret in production).
- Scope lock: AI blog content only.

### Activity logs
- `AppLog` model + colored categories.
- Wired: sales/payment, blog, admin product/category/settings, throttled AUTH admin session.

### Security / auth fixes
- CSP must allow `https://clerk.eztopup.io` (custom Clerk domain) or SignIn blank.
- Admin products crash: Server Component cannot use `onClick` (fixed).
- Clerk email unique: dual User rows — skip conflicting email update; promote SUPERADMIN by role first.

### Deploy
```bash
# as user deploy
cd /var/www/eztu
git pull --ff-only origin main
pnpm deploy:vps
```

Script: `scripts/deploy-vps.sh` · package script `pnpm deploy:vps`  
PM2 name default: `eztu` · path: `/var/www/eztu`

**Always migrate** after schema changes. Skipping migrate breaks `/admin/products` queries.

## Env (production)

| Key | Notes |
|-----|--------|
| `ADMIN_EMAILS` | Superadmin allowlist |
| `DATABASE_URL` | Postgres |
| `CRYPTOMUS_*` | Payments |
| `SUPPLIER_SECRET_KEY` / `SUPPLIER_API_URL` | Fulfillment — empty → order error “SUPPLIER_SECRET_KEY is required” |
| `ORDER_STATUS_CALLBACK_TOKEN` | Required in production (fail-closed) |
| `CRON_SECRET` | Blog AI cron |
| `DISCORD_WEBHOOK_URL` | Sales only |
| `BLOG_AI_*` | Optional defaults; prefer Admin Settings |
| Clerk keys + `clerk.eztopup.io` DNS | Login |

## Known ops issues

1. **Duplicate User email** — fix in SQL if promote logs spam.
2. **Supplier key missing** — set env + `pm2 restart eztu --update-env`.
3. **Blog AI OFF** — cron returns `Blog AI is disabled` until Settings ON + Save.
4. **metadataBase** warning — optional Next metadata base URL for OG (non-blocking).

## Related docs

- `docs/reports/2026-07-24-admin-production-wa.md` — WA copy
- `README.md` — production deploy section
- `docs/session-notes/2026-07-16-test-skus-production-deploy.md` — PM2 / SKU history
