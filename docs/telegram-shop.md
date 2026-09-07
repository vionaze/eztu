# Telegram shop

Private-chat storefront: `/shop` → region → game/voucher → SKU → destination ID/server (top-ups) → email → quantity → payment → confirm. `/orders` retrieves the last five orders and delivered vouchers; `/support` shows support details. `/cancel` resets the selection, not an existing invoice.

Uses the website supplier pricing, signed expiring quotes, crypto minimum quantity, payment verification and fulfillment. Telegram users have separate local identities; entering an email does not link an existing website account. Paid/completed order notifications are best-effort; `/orders` remains available if delivery failed. Existing admin notification bot settings are separate.

## Activate

1. Apply the included `20260907100000_telegram_shop` migration during deployment: `pnpm --filter @kupon/db db:migrate`, then regenerate the client with `pnpm --filter @kupon/db prisma:generate` and build/deploy the web app.
2. In the server secret configuration set `TELEGRAM_SHOP_BOT_TOKEN` from BotFather, `TELEGRAM_SHOP_BOT_USERNAME` (without @), and a random `TELEGRAM_SHOP_WEBHOOK_SECRET` (for example, 32 random bytes encoded as hex). Set `TELEGRAM_SHOP_ENABLED=true`. Keep the existing payment/supplier/quote-secret/database settings and HTTPS `NEXT_PUBLIC_APP_URL`.
3. From a server shell with those environment variables loaded, register the webhook using Node 22. No token needs to be pasted into shell history:

```sh
node --input-type=module <<'JS'
const { TELEGRAM_SHOP_BOT_TOKEN: token, TELEGRAM_SHOP_WEBHOOK_SECRET: secret, NEXT_PUBLIC_APP_URL: origin } = process.env;
if (!token || !secret || !origin || !/^[A-Za-z0-9_-]{1,256}$/.test(secret)) throw new Error('Missing or invalid shop configuration');
const url = new URL('/api/telegram/shop', origin);
if (url.protocol !== 'https:') throw new Error('HTTPS required');
try {
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url.href, secret_token: secret, allowed_updates: ['message', 'callback_query'], max_connections: 1 }),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error('Registration failed');
  console.log('Shop webhook registered');
} catch { throw new Error('Webhook registration failed; check server connectivity and bot configuration'); }
JS
```

`max_connections: 1` keeps incoming messages ordered; the database lease guards concurrent processing and retries. Do not run getUpdates polling for the same bot while its webhook is installed. Reference: https://core.telegram.org/bots/api#setwebhook

## Verify after activation

Open the bot in a private chat and run `/shop`. Confirm a low-price crypto order shows the adjusted quantity and total before invoice creation. Check Pakasir returns to the bot. Repeated confirmation must reuse the order; another chat must not retrieve it. Complete one controlled payment and verify the provider webhook drives fulfillment before voucher delivery. No live payment was performed by local tests.

Set `TELEGRAM_SHOP_ENABLED=false` to disable checkout and customer notifications. Keep the added database fields so existing orders are preserved. Live deployment, migration and bot registration must be performed against the intended server; local implementation alone does not activate the bot.
