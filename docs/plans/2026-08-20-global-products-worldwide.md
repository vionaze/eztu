# Global Products Worldwide Availability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show Mobile Legends Global to visitors in every country while retaining the supplier country attached to each SKU for price verification and fulfillment.

**Architecture:** Add a `globalAvailability` boolean to `Product`. Storefront availability uses a shared helper: global products return their supplier variants for every visitor, while regional products still require an exact visitor-country match. Supplier quote and checkout code continues reading `ProductVariant.countryCode`, so worldwide visibility cannot send a fake `global` market to the supplier API.

**Tech Stack:** Prisma/PostgreSQL, Next.js 16, React, TypeScript, Node test runner.

---

### Task 1: Database and importer

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260820120000_global_product_availability/migration.sql`
- Modify: `packages/db/src/eztopup-catalog.ts`
- Modify: `packages/db/src/eztopup-catalog.test.ts`
- Modify: `packages/db/src/import-eztopup-products.ts`

**Steps:**
1. Add a failing parser assertion that Mobile Legends Global is marked global while Mobile Legends regional is not.
2. Add `globalAvailability Boolean @default(false)` to `Product` and its SQL migration.
3. Add `globalAvailability` to catalog product definitions and normalized catalog rows.
4. Set Mobile Legends Global to true and every other workbook product to false.
5. Persist the flag during catalog upsert.

### Task 2: Storefront availability helper

**Files:**
- Create: `apps/web/src/lib/product-availability.ts`
- Create: `apps/web/src/lib/product-availability.test.ts`
- Modify: `apps/web/src/types/product.ts`
- Modify: `apps/web/src/lib/product-data.ts`

**Steps:**
1. Write tests proving regional variants require an exact market and global products remain available in another market.
2. Implement `getProductVariantsForMarket()` and `isProductAvailableInMarket()`.
3. Include `globalAvailability` in the storefront product payload and client type.

### Task 3: Storefront integration

**Files:**
- Modify: `apps/web/src/app/(storefront)/products/ProductsPageClient.tsx`
- Modify: `apps/web/src/components/storefront/ProductCard.tsx`
- Modify: `apps/web/src/components/storefront/VoucherCarousel.tsx`
- Modify: `apps/web/src/app/(storefront)/products/[slug]/ProductDetailClient.tsx`

**Steps:**
1. Replace duplicated country filters with the shared helper.
2. Keep visitor country in analytics while selecting the real supplier variant for checkout.
3. Verify global product pricing formats in the visitor's selected currency.

### Task 4: Verification and delivery

**Steps:**
1. Apply the local migration and rerun the Excel importer.
2. Verify Mobile Legends Global is global and all other products remain regional in PostgreSQL.
3. Run all tests, focused lint, typecheck, and production build.
4. Commit only scoped files, leave `docs/history/` untouched, and push `main`.
