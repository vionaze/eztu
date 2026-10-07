# Deploy reseller Phase 2

## Boundaries

This deploy adds tables and pricing/catalog code. Tier prices are applied separately using a reviewed private rules artifact. Never commit supplier workbooks, raw costs, pricing snapshots, or generated rules JSON to the public repository. Main-domain consumer pricing remains unchanged. B2B checkout/order/wallet is not included in Phase 2.

## 1. Deploy code as deploy

Do not run while another deployment/build is in progress. Use the `deploy` user, not root.

```bash
cd /var/www/eztu
git pull --ff-only origin main
pnpm deploy:vps
```

The existing deploy workflow applies additive migrations, generates Prisma and builds/restarts the app. It does NOT apply reseller prices automatically. Confirm deploy completion before continuing.

## 2. Transfer the private rules artifact

Use Termius SFTP to copy the reviewed local artifact:

```text
/Users/iskavonalia/Documents/ChatGPT/voucher/outputs/reseller-pricing-preview-2026-10-08/reseller-pricing-phase2-rules.json
```

to a private location on VPS, outside `/var/www/eztu`, for example:

```text
/home/deploy/reseller-pricing/reseller-pricing-phase2-rules.json
```

Create the destination privately before upload:

```bash
install -d -m 700 /home/deploy/reseller-pricing
```

After upload:

```bash
chmod 600 /home/deploy/reseller-pricing/reseller-pricing-phase2-rules.json
```

Do not paste its contents into logs/chat or upload it to GitHub.

## 3. Confirm database and validate

The importer loads database configuration by itself with the same file order as Prisma (`packages/db/.env`, repo `.env`, `apps/web/.env`). It does not print or accept credentials on the command line. Never paste `.env` contents into logs or chat.

```bash
cd /var/www/eztu
node --experimental-strip-types \
  packages/db/src/import-reseller-pricing.ts \
  --rules-file /home/deploy/reseller-pricing/reseller-pricing-phase2-rules.json \
  --output /home/deploy/reseller-pricing/validated.json
```

No database writes occur in this validation command. If the schema hash differs or a report has blocking issues, stop and regenerate/review the artifact using the same deployed schema. Do not edit hashes to bypass validation.

## 4. Explicit apply

Keep a production backup according to the existing DB backup procedure before first apply. Once validation passed and the database target is confirmed:

```bash
cd /var/www/eztu
node --experimental-strip-types \
  packages/db/src/import-reseller-pricing.ts \
  --rules-file /home/deploy/reseller-pricing/reseller-pricing-phase2-rules.json \
  --output /home/deploy/reseller-pricing/applied.json \
  --apply
```

The importer rechecks published catalog identity and applies tier rules in a transaction. It writes no consumer prices and does not overwrite manual organization overrides. Repeating an unchanged import is idempotent. An apply error means investigate; never ignore blocking identity mismatches.

## 5. Smoke tests

- Anonymous reseller catalog/quote request: 401.
- Pending/suspended/no membership: 403.
- Active reseller: catalog only configured, stock/market-eligible SKUs, prices in IDR.
- Tier/role/modal/markup not visible to reseller.
- Roblox Tier 1 vs Tier 2 use their distinct approved formulas.
- Refresh quote verifies fresh supplier data and can report stock/price unavailable.
- No B2B Buy/Checkout until Phase 4.
- Admin Resellers → Pricing → exact SKU → Edit → Save; verify only that organization's price changes.
- Reset to tier restores tier default; disabled override hides SKU without retail fallback.
- Main-domain products/pricing/checkout still use their original consumer rules.

The current private artifact contains 712 tier rules (356 per tier): Steam 332, PlayStation 18, formula-verified Nintendo 3, Roblox 3 distinct variants. Other Nintendo rows have no verified B2B rule and are not enabled; Xbox has no supplied source workbook.
