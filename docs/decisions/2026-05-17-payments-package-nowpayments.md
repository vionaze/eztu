# NOWPayments Package

Date: 2026-05-17

## Decision

Use NOWPayments as the crypto payment provider and keep the integration in `packages/payments`.

## Why

The checkout should not depend directly on provider-specific code inside route handlers. A payment package gives us one place for invoice creation, IPN signature verification, and provider status mapping.

## Current Scope

```txt
packages/payments
  src/index.ts
```

The web app calls `createPaymentInvoice` when creating an order and verifies IPN callbacks with `verifyPaymentWebhook`.

## Provider

NOWPayments is configured with:

```txt
NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET
NOWPAYMENTS_PAY_CURRENCY
```

The default pay currency is `usdttrc20`.

## Data Model

Order payment fields are provider-neutral:

```txt
paymentProvider
paymentProviderPaymentId
paymentProviderInvoiceId
paymentProviderTxHash
paymentCurrency
paymentUrl
paidAt
expiresAt
```

## Guardrails

The webhook route reads the raw request body and verifies `x-nowpayments-sig` before updating an order.

Root validation should pass before deployment:

```bash
pnpm prisma:validate
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm build
```
