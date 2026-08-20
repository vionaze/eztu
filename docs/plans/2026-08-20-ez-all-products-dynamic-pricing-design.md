# EZ All Products Dynamic Pricing Design

## Scope and source of truth

`EZ ALL PRODUCTS.xlsx` defines the products, supplier SKUs, countries, fulfillment types, and which catalog entries may be published. The supplier API is the source of truth for current reseller cost and availability. Products absent from the workbook are unpublished, not deleted, so historical orders and relations remain intact. This explicitly hides Roblox, Riot Games, and every other legacy product not represented in the workbook.

The workbook contains country-specific rows across Mobile Legends, Mobile Legends Global, Honor of Kings, Call of Duty Mobile, Steam, Free Fire, Valorant, Nintendo eShop, PlayStation, and Xbox. These become storefront products with country-scoped variants. Rows that cannot provide a valid supplier product code, product name, country, and fulfillment type are rejected by the importer and reported rather than silently guessed.

Two storefront categories are used: `game-top-up` for direct game-account delivery and `game-vouchers` for redeemable voucher codes. Existing products are updated in place where possible. Product images are resolved to the supplied files in `apps/web/public`; no remote placeholders are used for the Excel catalog.

## Pricing and supplier refresh

Each variant stores its supplier SKU, supplier country code, current supplier cost in IDR, availability, and last successful refresh time. The visible default price is the non-crypto price: `ceil(modal × 1.10)`. Cryptomus uses `ceil(modal × 1.12)`. These global rules supersede the workbook's inconsistent per-row margin columns.

A protected cron endpoint refreshes the complete catalog every six hours. It groups requests by country and uses the supplier all-products endpoint within the documented rate limit. Failures are isolated: successful SKU updates commit, while stale or missing SKUs retain their prior price with a logged warning and are not automatically remapped to a different SKU.

The pricing quote endpoint refreshes the selected SKU before returning a signed quote. Checkout refreshes the same SKU again server-side. If the supplier cost changed after the user saw the quote, checkout returns a price-changed response with the new amount and requires confirmation. The customer is never silently charged a different amount. Supplier fulfillment receives the refreshed reseller cost as the `price` validation field and the variant's country code.

## Country localization and checkout

Language continues to follow the visitor's browser/device locale. Country selection only controls product availability and currency, preserving the existing project rule. The initial country is detected from trusted proxy headers when available, then falls back to browser locale. A user's explicit country choice is persisted and takes precedence.

The country selector contains every country represented by the workbook. Product lists and product detail variants are filtered to the active country. Displayed prices are converted from the authoritative IDR amount using the existing live FX subsystem rather than static hard-coded rates. Indonesia displays exact IDR. Countries without eligible variants do not see the product.

Pakasir uses the non-crypto total. Cryptomus uses the crypto total. Both totals are generated and verified only on the server. Orders snapshot supplier cost, markup tier, country, and refresh timestamp so later cost changes cannot alter historical accounting.

## Product funnel analytics

Product analytics are admin-only and consent-aware. Anonymous events capture product view, variant selection, payment-method selection, quote failure, checkout submission, checkout rejection, and payment creation. Completed/paid orders remain the authoritative conversion source.

The admin products page shows views, unique visitors, checkout starts, paid orders, conversion rate, and the most likely observable drop-off stage. Conclusions are explicitly labeled as funnel evidence, not claims about user intent. Examples include “many views, few SKU selections,” “payment method selected but checkout not created,” and “payment created but not paid.” Old events are aggregated by indexed dimensions so the report does not require scanning the full event table.

## Indonesian product blog prompts

The automatic blog topic builder gets an Indonesia-only rotating queue covering Mobile Legends, Honor of Kings, Call of Duty Mobile, Steam, Free Fire, Valorant, Nintendo eShop, PlayStation Store, and Xbox/PC Game Pass. Recent titles are excluded to reduce repetition. Product-topic prompts are used only for the `ID` market and require Indonesian article fields; image prompts remain English as required by the existing image generation pipeline.

## Error handling and verification

Supplier errors fail closed during checkout: no payment invoice is created when a fresh SKU price cannot be verified. Cron refresh failures leave last-known prices intact and emit structured app logs. Unknown country codes, duplicated SKU/country pairs, malformed workbook rows, unsupported fulfillment types, and missing images fail importer validation.

Verification includes parser fixtures, pricing unit tests, supplier response tests, quote/checkout tests for both payment methods, country filtering tests, analytics aggregation tests, blog topic rotation tests, Prisma validation, TypeScript checks, lint, production build, and visual checks of storefront product grids, product detail checkout states, country switching, and the admin analytics counters.
