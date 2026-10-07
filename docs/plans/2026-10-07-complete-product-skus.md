# Complete Product SKUs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Import every exact supplier SKU for the 14 existing EZTopup products across the 12 supported supplier countries and report total versus available counts.

**Architecture:** Extend the existing supplier catalog reader and sync command. Use exact supplier category codes to attach SKUs to existing products, retain existing SKU-country rows and markup, and create missing rows with deterministic IDs. Use `--full-import` once to fetch all-products for complete expansion; fetch categories/products for recurring sync; keep out-of-stock rows in the database and let existing storefront availability rules decide visibility.

**Tech Stack:** Node.js 22, TypeScript, Prisma/PostgreSQL, supplier REST API, existing node:test.

---

## Scope and acceptance

- Include categories BNGC, CODM, FF/FFGLOBAL, HOK, LOLPC, ML, MLGLO, NTD, VPSN, RPGC, ROB, VSTEAM, VAL, VXBOX, under their existing product slugs.
- Fetch countries br, de, gb, id, mx, my, ph, sa, sg, th, us, vn; preserve returned supplier country and fail on fallback to a different country.
- Existing SKU markup pairs remain unchanged. New SKUs inherit the most common markup pair for the same product/country, falling back to the product's most common pair; report the chosen pairs.
- Repeat sync creates no duplicate canonical product/country/SKU rows. Keep old order relations, missing SKU records, and inactive supplier rows.
- Report total fetched, new rows, available, unavailable, and per-product counts. Any failed country must be visible and must prevent the full expansion apply.
- Non-goals: Telegram bot, new game titles, new regions, payment changes, changing exact-SKU fulfillment to group-product fulfillment.
- Untouched: historical orders, unit margins on existing SKUs, auth, checkout, delivery, site design, unrelated local/server files.

## Evidence before implementation

Production storefront currently exposes 658 distinct supplier SKU-country rows under 14 products. Production database has 839 rows including replacement/history rows, of which 763 are published. A read-only full supplier snapshot returned 104,810 rows across all categories/countries; filtering the categories belonging to the existing products yielded 9,826 SKU-country rows, 1,867 currently available, and 9,083 absent from canonical catalog rows. These are preliminary until category endpoint and returned-country checks complete.

Documentation: https://documenter.getpostman.com/view/31010436/2sBYAuRqce#intro . Full all-products requests are for initial import; recurring category refresh should use category/product endpoints. Keep exact `product_code` ordering as already implemented.

### Task 1: Read exact category catalogs

**Files:**
- Modify: `packages/db/src/supplier-catalog.ts`
- Test: `packages/db/src/supplier-catalog.test.ts`

1. Add an exported category catalog reader with explicit country and category parameters. Reuse the existing response normalizer and bearer authentication.
2. Fetch `/api/category?country_code=<country>`, retain only requested category codes, then `/api/product?country_code=<country>&category_code=<category>` sequentially.
3. Reject wrong returned country and invalid SKU price/status; attach the exact queried category to normalized rows where the product response omits category metadata. Never infer a category from a product name or short SKU prefix.
4. Run existing supplier reader tests and the small acceptance tests from Task 2.

### Task 2: Build the expansion rows

**Files:**
- Create: `packages/db/src/supplier-expansion.ts`
- Test: `packages/db/src/supplier-expansion.test.ts`

1. Define the explicit supplier category-to-existing-product slug mapping above.
2. Generate one canonical row per product/country/SKU. Reuse an existing non-replacement row when present; otherwise generate `supplier-<sha256(productId:country:sku)>`.
3. Preserve existing per-SKU markup; select the dominant country/product pair for new rows; apply `calculateSellPriceIDR` and preserve the existing USD ratio or configured import fallback.
4. Add at most two tests: main path proves additions/idempotent IDs/markup preservation; failure path proves foreign-category/country or duplicate contradictory rows cannot enter a product.
5. Run `node --experimental-strip-types --test packages/db/src/supplier-expansion.test.ts packages/db/src/supplier-catalog.test.ts packages/db/src/supplier-replacements.test.ts packages/db/src/eztopup-catalog.test.ts`.

### Task 3: Extend sync and maintain expansion

**Files:**
- Modify: `packages/db/src/sync-supplier-products.ts`
- Modify: `scripts/deploy-vps.sh`
- Modify: `scripts/install-supplier-sync-cron.sh`
- Modify: `apps/web/src/lib/supplier.ts` (accept exact supplier SKU codes containing internal ASCII spaces; keep tabs/newlines and other punctuation rejected)

1. Add `--expand` and one-time `--full-import` to the existing sync command, with dry run as default and `--apply` as its explicit mutation switch.
2. Fetch/validate every targeted country before any database mutation. Output aggregate/per-product statistics and a JSON report with no credentials.
3. On apply, back up the affected catalog rows to a server-only file before transactionally upserting canonical rows. Retain missing originals; mark their supplier status missing only when a full import proves absence. Category API responses are subsets. Retire redundant replacement rows for SKUs now represented canonically.
4. Make deploy pass `--expand --full-import` and hourly sync pass `--expand` so Excel reimport does not permanently hide supplier additions. Existing price-only callers remain compatible.
5. Run the related existing tests, database TypeScript check, shell syntax checks, and inspect the diff.

### Task 4: Apply and verify production

**Files:**
- Create report: `docs/reports/2026-10-07-product-sku-expansion.md`

1. Run the new command as deploy against production in dry-run mode; verify categories, country, markup choices, and counts against the earlier snapshot.
2. Apply only validated SKU changes under the existing supplier sync flock. Keep a backup path and command output.
3. Query production counts by product/country and compare available, unique visible keys against the imported snapshot. Do not create customer orders as a test.
4. Confirm the public catalog reflects new available variants. Document counts, backup location, commands and any partial limitation.
5. Commit only files for this task after checks; publication to Git remote requires the user's push instruction.

## Execution

The user explicitly requested fetching and updating the catalog. Continue single-threaded in the dedicated worktree; do not stop at a plan handoff or spawn agents. The unavailable `superpowers:*` references in this skill's header are not dependencies for the existing Node/Prisma implementation. User's minimal-scope/test instructions override generic TDD matrices and per-step commits.


## Validated supplier-code exception

Six `available` ML SKUs include an internal ASCII space (e.g. `ML2342 _320-S1-my`). An authenticated read-only `/api/product` lookup confirmed this exact code is valid. Update the existing validator to `^[a-z0-9][a-z0-9._-]*(?: [a-z0-9._-]+)*$` so quote and fulfillment retain the exact supplier code. Verify the actual TypeScript module after transpilation under Node, covering the observed code and tab/newline rejection; strip only the Next.js `server-only` marker for this isolated check. This requires a web rebuild before those six SKUs can checkout.
