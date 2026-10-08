# Phase 4b — B2B quote, order, direct payment, provisional fulfillment

## Status

Phase 4b code is implemented behind the `B2B_ORDERING_ORG_IDS` rollout flag. An empty or missing value keeps wholesale ordering disabled for every organization. The portal shows the cart and Orders UI only for enabled organizations, and the server re-checks the flag on every quote/order call.

## Flow

1. `POST /api/reseller/orders/quote` — active membership required; every line is re-priced from live supplier cost plus the effective reseller rule (organization override wins, disabled override blocks, no retail fallback). The signed quote binds organization, user, lines, quantities, rule IDs/revisions and a 15-minute expiry. Responses exclude supplier cost, margin, tier and rule internals.
2. `POST /api/reseller/orders` — requires same-origin, fresh quote, and a client idempotency key. Same key with the same fingerprint returns the existing order; the same key with different items returns `IDEMPOTENCY_CONFLICT`. Rule revisions are re-checked (`QUOTE_STALE`). The order plus immutable lines plus payment intent are created in a serializable transaction; provider invoices are created afterwards so a failure leaves a healable `DRAFT` instead of a lost order.
3. Payment: Crypto (Cryptomus) and Pakasir only. Wallet/deposit remain hidden and rejected.
4. Webhooks: `/api/payment/b2b/webhook` (signature-verified) and `/api/payment/b2b/pakasir/webhook` (secret + provider transaction re-verification with exact amount/order checks). Events land in the unique `B2BPaymentEvent` inbox; statuses only move forward (`PENDING → PAID/FAILED/EXPIRED`), and duplicates/stale events are acknowledged without effect.
5. Confirmed payment moves the order to `PAID`, then a provisional inline fulfillment submits each line with a deterministic supplier reference (`<orderNumber>-<line>`), persists the supplier `tid`, reads the supplier snapshot once, and marks the line `FULFILLED` or `REVIEW`. All lines fulfilled → `COMPLETED`; anything else → `MANUAL_REVIEW` with a reason. Nothing is auto-retried or auto-refunded in this phase.

## Caps (provisional)

`MAX_B2B_ORDER_LINES = 10` and `MAX_B2B_LINE_QUANTITY = 20` in `b2b-order-rules.ts` are controlled-rollout safety caps, not the final bulk policy. Raise them only after supplier-safe bulk validation (Phase 4c).

## Consumer isolation

Consumer `Order`, consumer webhooks, consumer checkout, cooldown and fulfillment are untouched. B2B never writes `ProductVariant` retail prices, never uses `TreasuryLedgerEntry`, and never calls `applyPaymentEventToOrder` or `fulfillPaidOrder`.

## Known limitations for Phase 4c+

- Inline fulfillment is not durable: a process crash between supplier acceptance and DB update needs admin reconciliation (admin reseller-order UI is not built yet).
- Paid orders stay `PAID` only briefly; `MANUAL_REVIEW` has no admin action UI yet.
- Pakasir redirect returns to the consumer origin because the provider adapter validates the redirect origin; the reseller then checks status in the Orders modal.
- No email/notification on order status changes yet.

## Tests

- `b2b-order-rules.test.ts`: token round-trip + tamper/expiry/channel rejection, line caps/duplicates, fingerprint stability, monotonic intent transitions (5 tests passing).
- Existing DB tests (29) and consumer pricing/market tests remain green; run `pnpm test:db` and the web test files alongside.
