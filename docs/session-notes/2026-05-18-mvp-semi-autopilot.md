# Session Note: MVP Semi-Autopilot

Date: 2026-05-18 00:16 WIB

## Current State

- Dev server was stopped.
- Monorepo root is `/Users/iskavonalia/Documents/kupon/app`.
- Start dev server with:

```bash
pnpm dev:webpack
```

## Payment

- NOWPayments is configured for sandbox:

```env
NOWPAYMENTS_API_URL="https://api-sandbox.nowpayments.io/v1"
NOWPAYMENTS_PAY_CURRENCY="all"
```

- Sandbox invoice creation was tested successfully.
- Payment sync endpoint exists for local development:

```text
POST /api/payment/sync
```

## Discord

- Discord webhook is configured in `apps/web/.env`.
- Paid order and fulfillment notifications were tested successfully in `#sales`.
- Voucher codes are intentionally not shown in Discord.

## Fulfillment / Treasury MVP

- FlexaGift adapter exists in mock mode:

```env
FLEXAGIFT_MODE="mock"
```

- Paid orders now trigger:
  - supplier fulfillment,
  - mock voucher creation,
  - order transition to `COMPLETED`,
  - treasury ledger entries,
  - internal FlexaGift balance debit,
  - optional replenishment alert when threshold is crossed.

- Live FlexaGift is not implemented yet because the official API contract is still needed.

## Last Verified

- Prisma migration applied: `20260517010000_fulfillment_treasury`.
- `pnpm typecheck` passed.
- Dev server port `3456` confirmed stopped.

## Next Useful Steps

1. Add live FlexaGift API contract and implement `FLEXAGIFT_MODE="live"`.
2. Add email delivery after domain email is ready.
3. Add admin view for supplier orders, treasury ledger, and replenishment requests.
