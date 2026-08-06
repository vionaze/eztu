# Pakasir Payment Design

## Goal

Offer exactly two checkout choices: Cryptomus for USDT/USDC and Pakasir for Indonesian payment methods. Remove the unfinished ClinkBill integration. Prefer Pakasir's hosted checkout so payment credentials and payment-instrument rendering remain outside the storefront.

## Configuration

- Keep `PAKASIR_PROJECT_SLUG` and `PAKASIR_API_KEY` server-only.
- `PAKASIR_ENABLED=false` is the fail-safe environment default.
- Use the server environment as the only availability control. Pakasir is available only when `PAKASIR_ENABLED=true`, the project slug is present, and the API key is present. Do not expose or persist a second payment switch in admin settings.
- Never expose the API key through public endpoints, client props, logs, URLs, or webhook responses.

## Checkout Flow

The authenticated checkout route validates the signed server pricing quote and uses `Order.totalIDR` as the authoritative Pakasir amount. It creates a pending order with provider `pakasir`, constructs a hosted URL using the configured project slug, integer IDR amount, internal order ID, and an allowlisted return URL, then redirects the browser to Pakasir. The browser cannot choose the charged amount or provider identifiers.

## Payment Confirmation

Pakasir posts to `/api/payment/pakasir/webhook`. Treat the callback body as an untrusted notification because Pakasir does not document a webhook signature. Parse a small JSON body, require `completed`, validate project, order ID, provider, and exact IDR amount, then call Pakasir's Transaction Detail API with the server-side API key. Only a matching `completed` detail response may transition the order to paid and trigger idempotent fulfillment.

The customer return page is never proof of payment. Authenticated status polling may perform the same Pakasir detail verification for the customer's own order, providing recovery when webhook delivery is delayed.

## Failure Handling and Tests

Fail closed when configuration is incomplete, the API is unavailable, fields mismatch, or status is not completed. Keep pending orders pending on ambiguous failures and record suspicious mismatches through the existing security event system. Tests cover hosted URL validation, provider response parsing, status normalization, project/order/amount mismatches, and disabled configuration. Run package tests, typecheck, lint, and production build before handoff.
