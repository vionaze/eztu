# Roblox and Riot Catalog Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add complete Roblox, League of Legends PC, and Riot gift-card rows from the supplemental workbook without removing the existing EZ All Products catalog.

**Architecture:** Import the existing catalog and a tracked supplemental workbook into one deduplicated catalog. Rows with textual supplier cost are allowed only when their SKU and pricing margins are complete; the production importer resolves their latest cost and status from the supplier API before opening the database transaction. Storefront display, six-hour refresh, and checkout continue to use the existing per-SKU pricing fields.

**Tech Stack:** TypeScript, Node.js, xlsx, Prisma, Next.js, Node test runner.

---

### Task 1: Validate workbook mappings

**Files:**
- Modify: `packages/db/src/eztopup-catalog.test.ts`
- Modify: `packages/db/src/eztopup-catalog.ts`

1. Add failing tests for Roblox, League of Legends PC, Riot gift cards, Mexico, `MARGIN` header aliases, and duplicated crypto headers.
2. Run the catalog tests and confirm the new cases fail.
3. Add product definitions and parse per-SKU margins while preserving incomplete rows as skipped.
4. Run the tests and confirm they pass.

### Task 2: Merge supplemental workbook and live supplier costs

**Files:**
- Create: `data/roblox riot lol.xlsx`
- Create: `packages/db/src/supplier-catalog.ts`
- Create: `packages/db/src/supplier-catalog.test.ts`
- Modify: `packages/db/src/import-eztopup-products.ts`
- Modify: `packages/db/src/sync-supplier-products.ts`

1. Track the supplied workbook as a second catalog source.
2. Add tests for exact country/SKU matching and safe failure when a required SKU is missing.
3. Load and deduplicate both workbooks.
4. Resolve missing supplier costs before the import transaction; abort safely on API errors or missing SKUs.
5. Reuse the supplier catalog client for scheduled refresh.

### Task 3: Add Mexico storefront localization

**Files:**
- Modify: `apps/web/src/lib/currencies.ts`
- Modify: `apps/web/src/lib/blog-ai-defaults.ts`

1. Add Mexico/MXN to the country selector and supplier-code mapping.
2. Add Mexico to the configurable blog-country defaults.
3. Verify TypeScript accepts the new country code.

### Task 4: Verify and deliver

1. Run the catalog and supplier-pricing tests.
2. Run the combined catalog dry-run and confirm existing products remain active.
3. Run workspace typecheck and production build.
4. Review the staged diff, leaving unrelated `docs/history/` untouched.
5. Commit, push to `origin/main`, and provide the VPS pull/deploy command.
