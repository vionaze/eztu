# Package display and stock fallback

Goal: display one card per exact package name and IDR display price within
the eligible market. Global products combine supplier countries; regional
products keep supplier regions separate.
Other equivalent supplier SKUs remain available as stock fallbacks.

Acceptance:
- Repeated SKUs at the same price share a card; different prices stay separate.
- The cheapest available price for each exact package in the eligible market has Best value.
- Empty groups are hidden from product details, following the existing storefront behavior.
- Live quote checks advance to an equivalent SKU only for confirmed stock failure.
- Checkout submits the exact SKU attached to the signed quote. If it becomes
  empty before checkout, refresh availability and ask the buyer to confirm again.

Untouched: margins, payment gateways, historical orders, paid-order fulfillment,
Telegram bot, and homepage stock filtering. No database schema changes.

Verification: package/stock/pricing tests, web TypeScript, changed-file lint,
and production build. Local browser preview requires existing database migrations
(`ProductVariant.replacementForId` is missing locally); no schema repair is in scope.

Verified grouping against public production Mobile Legends Global data:
14 Diamonds at Rp4,406 has five available supplier SKUs but one card;
Rp4,752 has four available supplier SKUs and one separate card, without Best value.
