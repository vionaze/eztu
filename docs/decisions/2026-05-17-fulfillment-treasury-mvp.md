# Fulfillment and Treasury MVP

## Context

The business goal is a semi-autopilot voucher shop:

1. Customer pays with crypto through NOWPayments.
2. Backend verifies final payment status.
3. Backend purchases/issues the voucher through a supplier API.
4. Backend records revenue, supplier cost, profit estimate, and FlexaGift balance.
5. Backend alerts when FlexaGift balance needs manual IDR replenishment.

## Decision

The MVP implements the automation boundary as:

- NOWPayments remains the payment provider.
- A FlexaGift adapter exists, defaulting to `FLEXAGIFT_MODE=mock` until the official purchase API contract is available.
- Paid orders are fulfilled idempotently through `SupplierOrder`.
- Fulfilled orders create treasury ledger entries.
- Internal FlexaGift balance is tracked through the `Setting` table.
- Replenishment requests are created when balance falls below threshold.
- Manual IDR off-ramp remains outside the app for now.

## Operational Defaults

```env
FLEXAGIFT_MODE="mock"
FLEXAGIFT_BALANCE_IDR="1000000"
FLEXAGIFT_REPLENISH_THRESHOLD_IDR="250000"
FLEXAGIFT_REPLENISH_TARGET_IDR="1000000"
TREASURY_SUPPLIER_COST_RATE="0.95"
```

## Production Notes

- Switch `FLEXAGIFT_MODE` to `live` only after the official FlexaGift API endpoint, authentication, payload shape, and response shape are confirmed.
- Webhook processing must remain the production source of truth for payments.
- Fulfillment must stay idempotent to avoid duplicate voucher purchases.
- Discord alerts are operational notifications, not the financial ledger source of truth.
