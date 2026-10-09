# Pakasir v2

API v1 stops on 20 October 2026. Reference: https://pakasir.com/p/create-transaction

Checkout now calls `POST /api/v2/create-transaction/{slug}/{order_id}` with
`X-Api-Key` and `{ "method": "payment_link", "amount": <integer IDR> }`.
The returned `txn_id` is stored in the existing provider payment/invoice ID
columns. The customer opens the returned `/pay-v2/{txn_id}` link with the
existing merchant redirect. Consumer, reseller and Telegram checkout share this flow.

Status verification calls `GET /api/v2/transaction-status/{slug}/{txn_id}`.
The existing five-second verification cooldown respects the four-second API
limit. Only a matching transaction ID, order ID, exact IDR amount and live
(`is_sandbox: false`) completed transaction can trigger fulfillment.
Both `/api/payment/pakasir/webhook` and `/api/payment/b2b/pakasir/webhook`
dispatch to the consumer or reseller payment flow using the stored order and
transaction IDs. A verification cooldown or an API status still pending returns
503 to the webhook instead of acknowledging an unverified payment.

Before rollout:

1. Optionally copy the project's webhook secret from Pakasir into the server
   environment as `PAKASIR_WEBHOOK_SECRET`. Retain `PAKASIR_ENABLED`,
   `PAKASIR_PROJECT_SLUG`, and `PAKASIR_API_KEY`.
2. Keep the project's webhook URL set to
   `https://eztopup.io/api/payment/pakasir/webhook` for both consumer and reseller
   orders. When the secret is configured, callbacks must include the matching
   `X-Secret`; an invalid or missing header returns 401. Without a configured
   secret, callback data alone cannot approve a payment: authenticated API status
   verification and matching against the stored order remain required.
3. Reconcile pending v1 orders before switching. Existing v1 links and IDs
   are not converted to v2, and this integration no longer calls the v1 API.
4. After deploying, check one controlled live payment through checkout,
   webhook/status verification and voucher delivery. Local tests mock the
   provider and do not create or pay live transactions.

## Recover a blocked v2 callback

After deploying, use Pakasir's resend webhook action if available, or replay the
original completed callback to the shared URL with its original `txn_id`,
`order_id`, `amount`, `is_sandbox` and `status`. Include `X-Secret` if configured.
The application rechecks the live API and routes reseller orders to their existing
payment intent and fulfillment flow. Already confirmed orders are acknowledged
without a second fulfillment; an expired reseller payment goes to manual review
under the existing late-payment policy. Replaying can submit a supplier purchase,
so confirm the production order before doing it. This fix does not automatically
replay callbacks that were blocked before deployment.
