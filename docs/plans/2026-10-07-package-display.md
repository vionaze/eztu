# Package display and stock fallback

Goal: display one card per exact package name, region, and IDR display price.
Other equivalent supplier SKUs remain available as stock fallbacks.

Acceptance:
- Repeated SKUs at the same price share a card; different prices stay separate.
- The cheapest available price for each exact package/region has Best value.
- Empty groups are hidden from product details, following the existing storefront behavior.
- Live quote checks advance to an equivalent SKU only for confirmed stock failure.
- Checkout submits the exact SKU attached to the signed quote. If it becomes
  empty before checkout, refresh availability and ask the buyer to confirm again.

Untouched: margins, payment gateways, historical orders, paid-order fulfillment,
Telegram bot, and homepage stock filtering. No database schema changes.

Verification: package/stock/pricing tests, web TypeScript, changed-file lint,
and production build. Local browser preview requires existing database migrations
(`ProductVariant.replacementForId` is missing locally); no schema repair is in scope.
