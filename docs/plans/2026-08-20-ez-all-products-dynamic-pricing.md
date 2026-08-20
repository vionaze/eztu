# EZ All Products Dynamic Pricing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish only the workbook catalog with country-scoped availability, live supplier costs, 10%/12% payment pricing, six-hour refresh, checkout repricing, admin product-funnel analytics, and Indonesian product blog prompts.

**Architecture:** Normalize the supplied workbook into a deterministic catalog consumed by an idempotent Prisma importer. Store country, supplier price state, and analytics events in PostgreSQL; centralize supplier fetch and markup calculations in server-only modules; require a fresh supplier quote before signed pricing and again before payment creation.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma/PostgreSQL, pnpm, Vitest-compatible Node tests, Lapakgaming Reseller API, Pakasir, Cryptomus.

---

### Task 1: Normalize and validate the workbook catalog

**Files:**
- Create: `packages/db/src/eztopup-catalog.ts`
- Create: `packages/db/src/eztopup-catalog.test.ts`
- Modify: `packages/db/src/import-eztopup-products.ts`
- Modify: `packages/db/package.json`

1. Add failing parser tests for representative workbook header variants, duplicate supplier SKUs, blank rows, country normalization, fulfillment mapping, and exact public-image mapping.
2. Run the focused tests and verify they fail.
3. Implement a deterministic parser and normalized catalog generator for all workbook sheets.
4. Make the importer upsert workbook products/variants and unpublish every product absent from the normalized set.
5. Run parser/importer dry-run tests and verify Roblox/Riot Games are excluded.

### Task 2: Add country, supplier-price, and funnel schema

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260820090000_ez_catalog_dynamic_pricing/migration.sql`

1. Add variant fields for supplier country, status, cost refresh timestamp, and configured markup basis points.
2. Add immutable order/item price snapshot fields needed to audit the selected payment tier.
3. Add indexed `ProductAnalyticsEvent` and event-type enum.
4. Add relations without deleting or rewriting historical data.
5. Run `pnpm prisma:validate` and `pnpm prisma:generate`.

### Task 3: Centralize supplier catalog and live SKU pricing

**Files:**
- Modify: `apps/web/src/lib/supplier.ts`
- Create: `apps/web/src/lib/supplier-pricing.ts`
- Create: `apps/web/src/lib/supplier-pricing.test.ts`
- Modify: `packages/db/src/sync-supplier-products.ts`

1. Write failing tests for response validation, SKU/country lookup, status handling, 10%/12% rounding, and stale-data behavior.
2. Implement `/api/product` live lookup and country-aware `/api/all-products` refresh helpers.
3. Replace fuzzy supplier SKU remapping with exact workbook SKU/country matching.
4. Persist successful refreshes and structured warnings for failures.
5. Run focused tests.

### Task 4: Add protected six-hour price refresh

**Files:**
- Create: `apps/web/src/app/api/cron/product-prices/route.ts`
- Create: `apps/web/src/app/api/cron/product-prices/route.test.ts`
- Modify: `apps/web/.env.example`
- Modify: `README.md`

1. Write authorization and refresh-result tests.
2. Implement Bearer-secret authorization using the existing constant-time helper.
3. Refresh exact catalog SKUs grouped by country and return compact counts.
4. Document the six-hour crontab invocation.
5. Run route tests.

### Task 5: Make quotes and checkout payment-method aware

**Files:**
- Modify: `apps/web/src/app/api/pricing/quote/route.ts`
- Modify: `apps/web/src/app/api/payment/create/route.ts`
- Modify: `apps/web/src/lib/fx.ts`
- Modify: `apps/web/src/lib/supplier.ts`
- Create/modify focused tests beside these modules.

1. Add failing tests for Pakasir 10%, Cryptomus 12%, stale quote rejection, live price refresh, unavailable SKU, and supplier `price` validation.
2. Sign quotes with variant, country, payment method, supplier cost, unit sell price, and expiry.
3. Re-fetch the selected SKU at payment creation and return a 409 price-change payload when the quote no longer matches.
4. Create orders/invoices only from the freshly verified server amount.
5. Pass variant country and reseller cost into supplier fulfillment.
6. Run focused pricing/payment tests.

### Task 6: Add country-scoped storefront data and currencies

**Files:**
- Modify: `apps/web/src/lib/currencies.ts`
- Modify: `apps/web/src/context/CurrencyContext.tsx`
- Create: `apps/web/src/app/api/location/route.ts`
- Modify: `apps/web/src/lib/product-data.ts`
- Modify: `apps/web/src/types/product.ts`
- Modify: `apps/web/src/app/(storefront)/products/ProductsPageClient.tsx`
- Modify: `apps/web/src/app/(storefront)/products/[slug]/ProductDetailClient.tsx`

1. Add tests for supported workbook countries and language/country separation.
2. Add every workbook country and currency to the selector.
3. Detect initial country from trusted proxy headers with locale fallback and preserve manual selection.
4. Filter products/variants by active country and update pricing quote requests when payment method changes.
5. Handle 409 price changes by displaying the new amount and requiring another confirmation.
6. Visually verify product list and checkout in ID, SG, MY, and US.

### Task 7: Add consent-aware product funnel analytics

**Files:**
- Create: `apps/web/src/lib/product-analytics.ts`
- Create: `apps/web/src/lib/product-analytics.test.ts`
- Create: `apps/web/src/app/api/products/analytics/route.ts`
- Create: `apps/web/src/components/storefront/ProductAnalyticsTracker.tsx`
- Modify: `apps/web/src/components/storefront/ProductCard.tsx`
- Modify: `apps/web/src/app/(storefront)/products/[slug]/ProductDetailClient.tsx`
- Modify: `apps/web/src/app/(admin)/admin/products/page.tsx`

1. Add failing tests for consent enforcement, event validation, unique visitor hashing, funnel aggregation, and conclusion thresholds.
2. Record validated anonymous events only when analytics consent is present.
3. Derive views, selections, checkout starts, payment creations, paid conversions, and observable drop-off conclusions.
4. Show counters and conclusions only on admin pages.
5. Run analytics tests and verify admin rendering.

### Task 8: Add Indonesian product blog topic rotation

**Files:**
- Modify: `apps/web/src/lib/blog-ai-publish.ts`
- Create: `apps/web/src/lib/blog-product-topics.ts`
- Create: `apps/web/src/lib/blog-product-topics.test.ts`

1. Add failing tests ensuring product topics are used only for `ID`, rotate across all requested products, and avoid recent titles.
2. Add Indonesian topic seeds for the nine requested product families.
3. Integrate deterministic rotation into `buildTopicForCountry` while preserving other market behavior.
4. Run blog topic tests.

### Task 9: Full verification and production handoff

**Files:**
- Modify only files needed to fix verification defects.

1. Run all focused unit tests.
2. Run Prisma validation/generation and migration checks.
3. Run `pnpm typecheck`, `pnpm lint`, and `pnpm build`.
4. Start the app and inspect ID/SG catalog, payment pricing states, price-change response, and admin analytics UI.
5. Review `git diff --check` and ensure unrelated user files remain untouched.
6. Document the required production migration, catalog import, six-hour cron, and deploy sequence.
