import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPakasirTransactionMatches,
  createPakasirPayment,
  getPakasirTransactionStatus,
  isPakasirCheckoutEnabled,
  isPakasirConfigured,
  isPakasirEnvironmentEnabled,
  parsePakasirWebhook,
  verifyPakasirWebhookSecret,
} from "./pakasir.ts";

function restoreEnv(name: string, previous: string | undefined) {
  if (previous === undefined) delete process.env[name];
  else process.env[name] = previous;
}

test("enables checkout only from the server environment and credentials", () => {
  const previousEnabled = process.env.PAKASIR_ENABLED;
  const previousSlug = process.env.PAKASIR_PROJECT_SLUG;
  const previousKey = process.env.PAKASIR_API_KEY;

  try {
    process.env.PAKASIR_ENABLED = "false";
    process.env.PAKASIR_PROJECT_SLUG = "eztopup";
    process.env.PAKASIR_API_KEY = "server-secret";
    assert.equal(isPakasirConfigured(), true);
    assert.equal(isPakasirEnvironmentEnabled(), false);
    assert.equal(isPakasirCheckoutEnabled(), false);

    process.env.PAKASIR_ENABLED = "true";
    assert.equal(isPakasirEnvironmentEnabled(), true);
    assert.equal(isPakasirCheckoutEnabled(), true);

    delete process.env.PAKASIR_API_KEY;
    assert.equal(isPakasirConfigured(), false);
    assert.equal(isPakasirCheckoutEnabled(), false);
  } finally {
    restoreEnv("PAKASIR_ENABLED", previousEnabled);
    restoreEnv("PAKASIR_PROJECT_SLUG", previousSlug);
    restoreEnv("PAKASIR_API_KEY", previousKey);
  }
});

test("creates a v2 payment link with server-side credentials and an allowlisted redirect", async () => {
  const previousSlug = process.env.PAKASIR_PROJECT_SLUG;
  const previousKey = process.env.PAKASIR_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.PAKASIR_PROJECT_SLUG = "eztopup";
  process.env.PAKASIR_API_KEY = "server-secret";
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://app.pakasir.com");
    assert.equal(url.pathname, "/api/v2/create-transaction/eztopup/cm-order_123");
    assert.equal(url.search, "");
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("X-Api-Key"), "server-secret");
    assert.deepEqual(JSON.parse(String(init?.body)), { method: "payment_link", amount: 25_000 });
    return Response.json({ txn_id: "txn_123", payment_link: "https://app.pakasir.com/pay-v2/txn_123" });
  };
  try {
    const payment = await createPakasirPayment({
      orderId: "cm-order_123",
      amountIDR: 25_000,
      redirectUrl: "https://eztopup.io/order/success?orderId=cm-order_123",
      appUrl: "https://eztopup.io",
    });
    const url = new URL(payment.paymentUrl);
    assert.equal(payment.txnId, "txn_123");
    assert.equal(url.origin, "https://app.pakasir.com");
    assert.equal(url.pathname, "/pay-v2/txn_123");
    assert.equal(url.searchParams.get("redirect"), "https://eztopup.io/order/success?orderId=cm-order_123");
    assert.equal(url.searchParams.has("api_key"), false);
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv("PAKASIR_PROJECT_SLUG", previousSlug);
    restoreEnv("PAKASIR_API_KEY", previousKey);
  }
});

test("rejects off-origin redirect URLs", async () => {
  const previous = process.env.PAKASIR_PROJECT_SLUG;
  process.env.PAKASIR_PROJECT_SLUG = "eztopup";
  await assert.rejects(
    () =>
      createPakasirPayment({
        orderId: "order_123",
        amountIDR: 25_000,
        redirectUrl: "https://attacker.example/steal",
        appUrl: "https://eztopup.io",
      }),
    /application origin/
  );
  restoreEnv("PAKASIR_PROJECT_SLUG", previous);
});

test("parses a completed Pakasir webhook", () => {
  const event = parsePakasirWebhook(
    JSON.stringify({
      amount: 22_000,
      order_id: "order_123",
      txn_id: "txn_123",
      is_sandbox: false,
      status: "completed",
      completed_at: "2026-08-05T10:00:00+07:00",
    })
  );
  assert.equal(event.amount, 22_000);
  assert.equal(event.orderId, "order_123");
  assert.equal(event.status, "completed");
  assert.equal(event.txnId, "txn_123");
  assert.equal(event.isSandbox, false);
  assertPakasirTransactionMatches({
    transaction: event,
    txnId: "txn_123",
    orderId: "order_123",
    amountIDR: 22_000,
    requireCompleted: true,
  });
});

test("fails closed on transaction, order, amount, sandbox, or status mismatch", () => {
  const transaction = parsePakasirWebhook(
    JSON.stringify({
      amount: 22_001,
      order_id: "different_order",
      txn_id: "different_txn",
      is_sandbox: true,
      status: "pending",
    })
  );
  assert.throws(
    () =>
      assertPakasirTransactionMatches({
        transaction,
        txnId: "txn_123",
        orderId: "order_123",
        amountIDR: 22_000,
        requireCompleted: true,
      }),
    /txn_id, order_id, amount, is_sandbox, status/
  );
});

test("verifies status through Pakasir's v2 status API", async () => {
  const previousSlug = process.env.PAKASIR_PROJECT_SLUG;
  const previousKey = process.env.PAKASIR_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.PAKASIR_PROJECT_SLUG = "eztopup";
  process.env.PAKASIR_API_KEY = "server-secret";
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://app.pakasir.com");
    assert.equal(url.pathname, "/api/v2/transaction-status/eztopup/txn_123");
    assert.equal(url.search, "");
    assert.equal(init?.method, "GET");
    assert.equal(new Headers(init?.headers).get("X-Api-Key"), "server-secret");
    return Response.json({
      txn_id: "txn_123",
      order_id: "order_123",
      amount: 22_000,
      status: "completed",
      is_sandbox: false,
    });
  };
  try {
    const transaction = await getPakasirTransactionStatus({ txnId: "txn_123" });
    assert.equal(transaction.status, "completed");
    assert.equal(transaction.txnId, "txn_123");
    assert.equal(transaction.amount, 22_000);
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv("PAKASIR_PROJECT_SLUG", previousSlug);
    restoreEnv("PAKASIR_API_KEY", previousKey);
  }
});

test("authenticates the v2 webhook secret and fails closed when unconfigured", () => {
  const previous = process.env.PAKASIR_WEBHOOK_SECRET;
  try {
    process.env.PAKASIR_WEBHOOK_SECRET = "webhook-secret";
    assert.equal(verifyPakasirWebhookSecret("webhook-secret"), true);
    assert.equal(verifyPakasirWebhookSecret("invalid-secret"), false);
    assert.equal(verifyPakasirWebhookSecret(null), false);
    delete process.env.PAKASIR_WEBHOOK_SECRET;
    assert.throws(() => verifyPakasirWebhookSecret("webhook-secret"), /PAKASIR_WEBHOOK_SECRET is required/);
  } finally {
    restoreEnv("PAKASIR_WEBHOOK_SECRET", previous);
  }
});
