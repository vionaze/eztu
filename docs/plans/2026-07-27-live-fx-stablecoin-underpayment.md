# Live FX Stablecoin Underpayment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Quote IDR-priced products in USD using a fresh server-side rate, store money as integer cents, disclose chain gas fees, and hold underpaid Cryptomus orders for customer-service resolution.

**Architecture:** IDR remains the catalog source of truth. A server-only FX module fetches USD/IDR from configured providers, caches fresh results, rejects stale/unavailable rates, and creates signed short-lived quote tokens used by both storefront display and checkout. Orders snapshot the quote in integer cents and payment webhooks compare the actual USD paid against those cents before fulfillment.

**Tech Stack:** Next.js 16 Route Handlers, React 19, TypeScript, Prisma/PostgreSQL, Cryptomus Merchant API, Node crypto.

---

### Task 1: Add integer-money and FX quote primitives

**Files:**
- Create: `apps/web/src/lib/money.ts`
- Create: `apps/web/src/lib/fx.ts`
- Create: `apps/web/src/lib/money.test.ts`
- Create: `apps/web/src/lib/fx.test.ts`

1. Write unit tests for ceiling IDR/USD conversion, cents conversion, quote expiry, and signature tampering.
2. Run the tests and verify they fail because the modules do not exist.
3. Implement integer-cent helpers, provider parsing, bounded caching, freshness checks, and HMAC-signed quote tokens.
4. Run the tests and verify they pass.

### Task 2: Persist quote snapshots and an underpayment state

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260727193000_live_fx_money_underpaid/migration.sql`

1. Add `UNDERPAID` to `OrderStatus`.
2. Add integer-cent totals and FX quote metadata to `Order`.
3. Add integer-cent unit price to `OrderItem`.
4. Keep legacy float columns for backward-compatible reads while all new payment decisions use cents.
5. Validate the Prisma schema and generate the client.

### Task 3: Serve and consume a signed storefront quote

**Files:**
- Create: `apps/web/src/app/api/pricing/quote/route.ts`
- Modify: `apps/web/src/app/(storefront)/products/[slug]/ProductDetailClient.tsx`
- Modify: `apps/web/src/app/api/payment/create/route.ts`

1. Add a public read-only quote endpoint accepting variant and quantity.
2. Fetch a signed quote when the selected variant or quantity changes.
3. Show exact USD/stablecoin total, rate source, expiry, and “gas fee paid by user” disclosure.
4. Disable checkout while a quote is missing, stale, or failed.
5. Verify the quote token server-side before creating the order and Cryptomus invoice.
6. Persist the same quote snapshot and send the exact cents-derived amount to Cryptomus.

### Task 4: Hold underpayments before fulfillment

**Files:**
- Modify: `packages/payments/src/index.ts`
- Modify: `apps/web/src/lib/payment-orders.ts`
- Modify: `apps/web/src/app/(storefront)/account/purchases/page.tsx`
- Modify: `apps/web/src/app/(storefront)/account/purchases/PurchaseHistoryClient.tsx`

1. Normalize Cryptomus wrong-amount states as processing so the webhook reaches the amount check.
2. Read actual USD paid from `payment_amount_usd`.
3. Compare integer paid cents with expected order cents.
4. Set the order to `UNDERPAID`, log it, notify operations, and never call fulfillment.
5. Show the held status and `cs@eztopup.io` instructions in purchase history.

### Task 5: Remove static USD pricing from admin/import paths

**Files:**
- Modify: `apps/web/src/app/api/admin/products/route.ts`
- Modify: `apps/web/src/app/api/admin/products/[id]/route.ts`
- Modify: `apps/web/src/app/(admin)/admin/products/new/NewProductForm.tsx`
- Modify: `apps/web/src/app/(admin)/admin/products/[id]/ProductEditForm.tsx`
- Modify: `packages/db/src/import-eztopup-products.ts`
- Modify: `packages/db/src/seed-test-skus.ts`
- Modify: `apps/web/.env.example`

1. Stop accepting an operator-controlled USD checkout price.
2. Retain a compatibility USD estimate only for legacy UI until all catalog surfaces consume live quotes.
3. Document FX provider keys, quote secret, cache duration, and maximum staleness.

### Task 6: Verify

1. Run the focused Node tests.
2. Run Prisma validation and generation.
3. Run monorepo typecheck.
4. Run lint.
5. Run the production build.
6. Inspect the final diff for accidental unrelated changes.
