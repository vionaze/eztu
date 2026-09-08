# Supplier stock and purchase cooldown

Unavailable or missing supplier SKUs are excluded from website and bot catalogs. Originals stay published internally so the normal supplier refresh keeps checking them. When an original diamond SKU is unavailable, select the cheapest available equal-amount package, or otherwise the cheapest among the nearest lower and nearest higher diamond amounts. Matching requires the same supplier category in the same country catalog and an unambiguous regular diamond package name. Passes, bundles and unknown names are not substituted.

Alternatives are separate variants displaying their actual supplier name, diamond amount and selling price using the original slot's markup. Existing orders retain their original SKU. When original stock returns, the next sync hides the temporary alternative and shows the original again. Duplicate supplier SKU/country options are shown once. Unknown stock (not yet verified) remains visible until verified; a failed live quote refreshes the website catalog.

The existing `/api/cron/product-prices` endpoint now reconciles replacements as well as prices. Keep the existing six-hour scheduler running; restoration happens at the next successful sync, not instantly. `pnpm products:sync:supplier --apply` performs the same reconciliation from the CLI. Deployment now runs this sync after the workbook import so it does not leave workbook stock statuses in production.

A successfully fulfilled order containing at least 15 units blocks new checkout for that same user for eight hours from `SupplierOrder.fulfilledAt`. Orders below 15 and failed/unpaid orders do not trigger the rule. Website checkout returns a cooldown popup including the local retry time; the Telegram bot returns an English message. The check runs on the server, shared by both checkout channels. Existing invoices are not revoked. Telegram and website identities are separate unless linked by existing account infrastructure; email alone does not link them.

## VPS

Run as `deploy`:

```sh
cd /var/www/eztu
git pull --ff-only origin main
pnpm deploy:vps
```

The deploy applies migration `20260908010000_supplier_replacements`, generates Prisma, imports the catalog, refreshes supplier stock/replacements, builds, and restarts PM2. No new environment variables are needed; existing supplier credentials must be configured. The scheduled price-refresh endpoint still requires the existing `PRODUCT_PRICE_CRON_SECRET` or `CRON_SECRET`.

Supplier credentials are absent in the local workspace; the actual replacement SKU and price must be established by the live server sync. Local checks use supplier fixtures and do not place real orders.
