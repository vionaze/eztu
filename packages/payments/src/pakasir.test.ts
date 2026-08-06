import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPakasirTransactionMatches,
  createPakasirPaymentUrl,
  getPakasirTransactionDetail,
  isPakasirCheckoutEnabled,
  isPakasirConfigured,
  isPakasirEnvironmentEnabled,
  parsePakasirWebhook,
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

test("creates an HTTPS hosted checkout URL without an API key", () => {
  const previous = process.env.PAKASIR_PROJECT_SLUG;
  process.env.PAKASIR_PROJECT_SLUG = "eztopup";
  const url = new URL(
    createPakasirPaymentUrl({
      orderId: "cm-order_123",
      amountIDR: 25_000,
      redirectUrl: "https://eztopup.io/order/success?orderId=cm-order_123",
      appUrl: "https://eztopup.io",
    })
  );
  assert.equal(url.origin, "https://app.pakasir.com");
  assert.equal(url.pathname, "/pay/eztopup/25000");
  assert.equal(url.searchParams.get("order_id"), "cm-order_123");
  assert.equal(
    url.searchParams.get("redirect"),
    "https://eztopup.io/order/success?orderId=cm-order_123"
  );
  assert.equal(url.searchParams.has("api_key"), false);
  restoreEnv("PAKASIR_PROJECT_SLUG", previous);
});

test("rejects off-origin redirect URLs", () => {
  const previous = process.env.PAKASIR_PROJECT_SLUG;
  process.env.PAKASIR_PROJECT_SLUG = "eztopup";
  assert.throws(
    () =>
      createPakasirPaymentUrl({
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
      project: "eztopup",
      status: "completed",
      payment_method: "qris",
      completed_at: "2026-08-05T10:00:00+07:00",
    })
  );
  assert.equal(event.amount, 22_000);
  assert.equal(event.orderId, "order_123");
  assert.equal(event.status, "completed");
  assert.equal(event.paymentMethod, "qris");
});

test("fails closed on project, order, amount, or status mismatch", () => {
  const transaction = parsePakasirWebhook(
    JSON.stringify({
      amount: 22_001,
      order_id: "different_order",
      project: "different_project",
      status: "pending",
      payment_method: "qris",
    })
  );
  assert.throws(
    () =>
      assertPakasirTransactionMatches({
        transaction,
        project: "eztopup",
        orderId: "order_123",
        amountIDR: 22_000,
        requireCompleted: true,
      }),
    /project, order_id, amount, status/
  );
});

test("verifies status through Pakasir's server-side detail API", async () => {
  const previousSlug = process.env.PAKASIR_PROJECT_SLUG;
  const previousKey = process.env.PAKASIR_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.PAKASIR_PROJECT_SLUG = "eztopup";
  process.env.PAKASIR_API_KEY = "server-secret";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://app.pakasir.com");
    assert.equal(url.pathname, "/api/transactiondetail");
    assert.equal(url.searchParams.get("project"), "eztopup");
    assert.equal(url.searchParams.get("amount"), "22000");
    assert.equal(url.searchParams.get("order_id"), "order_123");
    assert.equal(url.searchParams.get("api_key"), "server-secret");
    return Response.json({
      transaction: {
        project: "eztopup",
        order_id: "order_123",
        amount: 22_000,
        status: "completed",
        payment_method: "qris",
      },
    });
  };
  try {
    const transaction = await getPakasirTransactionDetail({
      orderId: "order_123",
      amountIDR: 22_000,
    });
    assert.equal(transaction.status, "completed");
    assert.equal(transaction.paymentMethod, "qris");
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv("PAKASIR_PROJECT_SLUG", previousSlug);
    restoreEnv("PAKASIR_API_KEY", previousKey);
  }
});
