# Production SKU Expansion — 7 October 2026

Production now stores **9,826 canonical supplier SKU codes** across the existing 14 products and 12 supplier countries. **1,867 are available**, and **7,959 are empty** at verification time. Added 9,083 SKU rows; existing historical/replacement rows remain separate. There are zero duplicate canonical product/country/SKU keys and zero unsupported active supplier code formats.

| Product | Total SKU | Available |
|---|---:|---:|
| Binance Gift Card | 764 | 260 |
| Call of Duty Mobile | 164 | 48 |
| Free Fire | 1,511 | 237 |
| Honor of Kings | 824 | 18 |
| League of Legends PC | 157 | 45 |
| Mobile Legends | 4,255 | 544 |
| Mobile Legends Global | 493 | 254 |
| Nintendo eShop | 37 | 11 |
| PlayStation Store | 381 | 169 |
| Riot Points Gift Card | 12 | 12 |
| Roblox Gift Card | 315 | 57 |
| Steam | 333 | 122 |
| Valorant | 527 | 64 |
| Xbox & PC Game Pass | 53 | 26 |
| **Total** | **9,826** | **1,867** |

Countries: br, de, gb, id, mx, my, ph, sa, sg, th, us, vn. Country selection and existing market exclusions still govern which available variants an individual customer sees.

## Implementation and verification

- Initial import uses exact category codes from the complete supplier catalog. Recurring sync uses category/product endpoints and retains rows omitted by those subset responses.
- Existing per-SKU margins stay intact. New SKU margins inherit the most common pair for the same product/country, falling back to that product's most common pair.
- All 25 unavailable SKUs with INT_MAX sentinel supplier cost are retained. Their unavailable display price is zero until valid stock/pricing returns; stock gating keeps them off the storefront. Available prices outside the database range fail validation before writes.
- Six legitimate supplier codes contain internal ASCII spaces. Supplier lookup confirmed an example; the web validator now accepts those exact codes while rejecting tabs/newlines and unsafe punctuation.
- 20 related catalog tests, database/web TypeScript checks, changed web-file lint, shell syntax, and production build passed.
- Production database query verified 9,826 canonical rows / 1,867 available / zero duplicates. The public homepage payload independently exposes exactly 14 products / 1,867 available variants.
- A live crypto quote for newly imported `ML2342 _320-S1-my` returned HTTP 200 with fresh supplier pricing. No test order or payment was created.
- The existing hourly supplier cron now includes `--expand`. Other scheduled jobs were preserved; no supplier balance notification job was added.

Source deployment: `30a46d7` plus import-price fix `0863df8`. The web build/restart completed before the import-price-only fix; the later CLI fix did not require another web rebuild.

## Production backup and commands

Catalog backup: `/var/www/eztu/apps/web/.data/catalog-backups/before-expansion-2026-10-07T09-07-23-317Z.json`.
Applied report: `/var/www/eztu/apps/web/.data/catalog-backups/expansion-applied-2026-10-07T09-07-23-317Z.json`.

As `deploy` in `/var/www/eztu`, preview a complete import with:

```bash
pnpm products:sync:supplier --expand --full-import
```

Apply a complete import (backs up before adding new SKUs):

```bash
flock -w 30 /var/www/eztu/.supplier-sync.lock pnpm products:sync:supplier --expand --full-import --apply
```

Regular sync is the existing hourly job:

```bash
flock -n /var/www/eztu/.supplier-sync.lock pnpm products:sync:supplier --expand --apply
```

Supplier reference: https://documenter.getpostman.com/view/31010436/2sBYAuRqce#intro . The 104,810 rows across all supplier categories from the initial audit are outside this task's product scope; the counts above only cover the 14 existing EZTopup products.
