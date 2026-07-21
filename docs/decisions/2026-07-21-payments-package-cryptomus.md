# Cryptomus Payment Provider

Date: 2026-07-21

## Decision

Replace NOWPayments with **Cryptomus** as the sole crypto payment provider in `packages/payments`.

## Why

Merchant account is live on Cryptomus. Checkout positioning is USDT/USDC stablecoins. The monorepo already isolates provider logic in `@kupon/payments` with provider-neutral order fields.

## API

- Base: `https://api.cryptomus.com/v1`
- Auth headers: `merchant` (UUID) + `sign` = `md5(base64(jsonBody) + paymentApiKey)`
- Create invoice: `POST /payment`
- Payment info: `POST /payment/info`
- Webhook: POST to `url_callback`; signature is body field `sign` (not HTTP header)

## Env

```env
CRYPTOMUS_MERCHANT_ID=""
CRYPTOMUS_PAYMENT_API_KEY=""
CRYPTOMUS_API_URL="https://api.cryptomus.com/v1"
CRYPTOMUS_TO_CURRENCY=""          # optional force e.g. USDT
CRYPTOMUS_CURRENCIES="USDT,USDC"  # used when TO_CURRENCY empty
PAYMENT_INVOICE_EXPIRY_MINUTES="60"
NEXT_PUBLIC_APP_URL="https://eztopup.io"
```

## Order mapping

| Cryptomus | Order field |
|-----------|-------------|
| `uuid` | `paymentProviderPaymentId` / `paymentProviderInvoiceId` |
| `url` | `paymentUrl` |
| `order_id` | our Order `id` (cuid) |
| `paymentProvider` | `"cryptomus"` |

Webhook `order_id` must resolve via `prisma.order.findUnique({ where: { id } })`.

## Status map

| Cryptomus | Normalized |
|-----------|------------|
| paid, paid_over | paid |
| confirm_check, process, check, wrong_amount_waiting | processing |
| fail, system_fail, wrong_amount | failed |
| cancel (final) | expired |
| refund_paid | refunded |

## Guardrails

- Verify webhook signature with payment API key.
- Prefer HTTPS-only API URL.
- Optional IP allowlist for callbacks: Cryptomus documents `91.227.144.54`.
- Do not log full API keys.

## UI

Storefront checkout copy: "Powered by Cryptomus · USDT / USDC checkout".
