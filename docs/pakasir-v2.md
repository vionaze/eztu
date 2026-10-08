# Pakasir v2

API v1 stops on 20 October 2026. Reference: https://pakasir.com/p/create-transaction

Checkout now calls `POST /api/v2/create-transaction/{slug}/{order_id}` with
`X-Api-Key` and `{ "method": "payment_link", "amount": <integer IDR> }`.
The returned `txn_id` is stored in the existing provider payment/invoice ID
columns. The customer opens the returned `/pay-v2/{txn_id}` link with the
existing merchant redirect. Website and Telegram checkout share this flow.

Status verification calls `GET /api/v2/transaction-status/{slug}/{txn_id}`.
The existing five-second verification cooldown respects the four-second API
limit. Only a matching transaction ID, order ID, exact IDR amount and live
(`is_sandbox: false`) completed transaction can trigger fulfillment.

Before rollout:

1. Copy the project's webhook secret from Pakasir into the server environment
   as `PAKASIR_WEBHOOK_SECRET`. Retain `PAKASIR_ENABLED`,
   `PAKASIR_PROJECT_SLUG`, and `PAKASIR_API_KEY`.
2. Keep the project's webhook URL set to
   `https://eztopup.io/api/payment/pakasir/webhook`. V2 callbacks must include
   the matching `X-Secret`; missing configuration returns 503 and an invalid
   or missing header returns 401. API status verification remains required.
3. Reconcile pending v1 orders before switching. Existing v1 links and IDs
   are not converted to v2, and this integration no longer calls the v1 API.
4. After deploying, check one controlled live payment through checkout,
   webhook/status verification and voucher delivery. Local tests mock the
   provider and do not create or pay live transactions.
