# Session Note: Test SKUs + Production Deploy

Date: 2026-07-16 → 2026-07-17

## Current State

- Monorepo root (local): `/Users/iskavonalia/Documents/kupon/app`
- Production VPS path: `/var/www/eztu`
- Production domain: `https://eztopup.io`
- Git remote: `github.com:vionaze/eztu.git` (branch `main`)
- Relevant commit: `8aaac2e` — *Add test SKU seed and mobile-friendly product storefront*

### Local dev

```bash
cd /Users/iskavonalia/Documents/kupon/app
pnpm dev
# → http://localhost:3456  (Turbopack; monorepo root fixed in next.config.ts)
```

Prefer `pnpm dev` over `pnpm dev:webpack` on low-RAM machines (webpack first compile can hang).

### Production process

- App runs as user **`deploy`** under PM2 name **`eztu`**
- Next listens on **port 3000**; nginx terminates TLS on 80/443 and proxies to Next
- Always operate as `deploy` for `pnpm` / `pm2` (running as `root` caused `EACCES` on `node_modules`)

```bash
sudo -iu deploy
cd /var/www/eztu
# Recommended (includes migrate + generate + build + pm2):
pnpm deploy:vps

# Or manual:
git pull --ff-only origin main
pnpm install
pnpm db:migrate          # required — never skip after schema changes
pnpm prisma:generate
pnpm build
pm2 restart eztu --update-env
pm2 save
```

## Test products (supplier SKUs)

Source CSV: local `Product_Reseller` export (not committed).

| Product slug        | Supplier SKU     | CSV type | Sell (Recommended) | Cost (Reseller) |
|---------------------|------------------|----------|--------------------|------------------|
| `mobile-legends`    | `ML15_2-S121`    | DIGITAL  | Rp 4.800           | Rp 4.488         |
| `steam-wallet`      | `STEAM45-S22`    | VOUCHER  | Rp 45.150          | Rp 44.843        |
| `roblox`            | `ROB50IDR-S122`  | VOUCHER  | Rp 48.800          | Rp 47.614        |

### Type behavior

- **DIGITAL (ML):** checkout requires **User ID + Zone/Server ID**; fulfillment sends `user_id` / `additional_id` to supplier. Not a redeemable voucher code.
- **VOUCHER (Steam / Roblox):** email + quantity; delivery is voucher code / delivery link.

### Seed script

```bash
# Local or VPS (uses DATABASE_URL from env load order in packages/db)
pnpm --filter @kupon/db products:seed:test-skus
```

Script: `packages/db/src/seed-test-skus.ts`

Behavior:

1. Upserts the three products + single test variant each (correct `supplierSku`, sell price, cost).
2. Sets images: `/mlbb.webp`, `/steam.webp`, `/roblox.png`.
3. **Unpublishes** other currently published products (rows kept; not deleted).
4. Does not wipe orders/users.

Production seed was run successfully on 2026-07-16:

- Env injected from VPS `/var/www/eztu/.env`
- DB: `127.0.0.1:5432/eztopup` (Postgres on the VPS)
- Unpublished 5 other products
- Storefront should list only ML / Steam / Roblox after hard refresh

## Code changes (session)

- Storefront: sell price labels, compact mobile product images (card, grid, carousel, detail).
- Product detail: ML account fields (`gameId` / `serverId`) when product requires game account.
- Assets: `apps/web/public/mlbb.webp`, `apps/web/public/steam.webp`.
- Dev: Turbopack `root` = monorepo workspace root; `pnpm dev` on port 3456 + `prisma:generate`.
- Package script: `products:seed:test-skus` on `@kupon/db`.

Not committed: `Audit-Kupon-EZTopUp-ID.pdf` (left untracked).

## Production / PM2 notes

- `pm2 restart all` fails if no processes — use `pm2 start` once, then `pm2 restart eztu`.
- Avoid duplicate PM2 apps with the same name (port 3000 conflict / restart loops). Keep **one** `eztu`.
- `pm2 save` works without sudo. `pm2 startup` needs root/sudo once for reboot persistence; deploy sudo password may be unknown — use Contabo root/VNC to `passwd deploy` or run startup as root.
- After root-owned `pnpm install`: `chown -R deploy:deploy /var/www/eztu`.

## Cryptomus domain verification (2026-07-17)

Dashboard required meta:

```html
<meta name="cryptomus" content="27a0a62c" />
```

Downloaded file content (local): `cryptomus=27a0a62c`  
Path if using HTML file method on VPS:

```text
/var/www/eztu/apps/web/public/cryptomus_27a0a62c.html
```

User confirmed verification done and **removed** the HTML file afterward.

Meta tag approach (if still needed later) in `apps/web/src/app/layout.tsx`:

```ts
other: { cryptomus: "27a0a62c" },
```

then `pnpm build` + `pm2 restart eztu`.

## Important reminders

1. **Git pull does not change product catalog** — run seed (or admin) against the target DB.
2. **Local DB ≠ production DB** — seed was applied separately on each environment as needed.
3. Supplier branding in code/paths should stay generic (no public “LapakGaming” naming) per earlier product decision.
4. Fulfillment live path needs production `SUPPLIER_*` env; local may not have supplier keys.

## Next useful steps

1. End-to-end test order on production for one voucher SKU (Steam or Roblox), then ML digital top-up with real User ID / Zone.
2. Confirm supplier API + callback token on production after test purchases.
3. Complete `pm2 startup` as root if not done (auto-start after reboot).
4. When leaving test mode: re-publish old catalog and/or map more supplier SKUs without mass-importing all CSV rows.
5. Optional: keep this note updated after first live fulfillment success/failure.

## Quick verify

```bash
# Production
curl -sI https://eztopup.io/products/mobile-legends | head -3
curl -sI https://eztopup.io/products/steam-wallet | head -3
curl -sI https://eztopup.io/products/roblox | head -3
pm2 list
pm2 logs eztu --lines 30
```
