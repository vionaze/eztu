# Blog Product-Market Matrix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate automatic product articles only for product-market combinations enabled by an administrator, with Valorant defaulting to Indonesian/Indonesia only.

**Architecture:** Keep the existing global Blog AI market controls as the first gate. Add a JSON product-market matrix in the existing `Setting` key-value table as the second gate, so no Prisma migration is required. Auto-generation selects an eligible product for each scheduled market and passes that market's configured language to the article generator.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Prisma `Setting`, Node test runner.

---

### Task 1: Product-market rules

**Files:**
- Modify: `apps/web/src/lib/blog-product-topics.ts`
- Modify: `apps/web/src/lib/blog-product-topics.test.ts`

**Steps:**
1. Write tests for the 11 Excel markets, supported markets per product, Valorant restricted to `ID`, saved empty selections, and eligible-product selection.
2. Run the focused test and confirm the new assertions fail.
3. Define ten catalog product records with market availability derived from `EZ ALL PRODUCTS.xlsx`.
4. Add strict normalization for a saved product-market JSON object; ignore unknown products and unsupported markets while preserving explicit empty arrays.
5. Add deterministic selection that avoids recently used product names where possible.
6. Run the focused test and confirm it passes.

### Task 2: Persist settings

**Files:**
- Modify: `apps/web/src/lib/settings.ts`
- Modify: `apps/web/src/app/api/admin/settings/blog-ai/route.ts`
- Modify: `apps/web/src/app/(admin)/admin/settings/page.tsx`

**Steps:**
1. Add `blog.ai.productMarkets` to `SETTING_KEYS`.
2. Load and normalize the JSON matrix in `getBlogAiSettings()`.
3. Expose the matrix through the authenticated admin settings response.
4. Accept and sanitize matrix updates in the PUT route before storing JSON.
5. Include only non-secret matrix metadata in the admin audit log.

### Task 3: Product-aware article rotation

**Files:**
- Modify: `apps/web/src/lib/blog-ai-publish.ts`
- Modify: `apps/web/src/lib/blog-market.test.ts`

**Steps:**
1. Restrict scheduled catalog articles to the eleven workbook markets.
2. Intersect global auto-markets with markets that still have at least one enabled product.
3. Select an eligible product for every scheduled market using recent article titles to reduce repetition.
4. Build a product-specific prompt while continuing to obtain the output language from `getBlogLanguageForCountry()`.
5. Include the selected product key in auto-run results and structured logs.

### Task 4: Admin matrix UI

**Files:**
- Modify: `apps/web/src/app/(admin)/admin/settings/BlogAiSettingsForm.tsx`

**Steps:**
1. Add product-market matrix state initialized from server settings.
2. Include the matrix in Save and Run Now payloads.
3. Render one compact row per catalog product with toggles only for markets where that product exists.
4. Explain that a combination is effective only when its global auto-market is also active.
5. Visually distinguish enabled, disabled, and globally inactive combinations.

### Task 5: Verification and delivery

**Steps:**
1. Run all Node tests, focused ESLint, monorepo typecheck, and production build.
2. Run `git diff --check` and review that `docs/history/` remains untouched.
3. Commit the implementation and push `main` to `origin`.
