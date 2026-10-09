import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Script } from "node:vm";
import test from "node:test";
import * as payments from "../packages/payments/src/pakasir.ts";

const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const ts = require("typescript");

function loadWebhook(apiAmount = 45_500) {
  const applied = [];
  const verified = [];
  const consumer = { id: "consumer_1", status: "PENDING", totalIDR: 45_500,
    paymentProvider: "pakasir", paymentProviderPaymentId: "consumer_txn" };
  const reseller = { id: "reseller_1", status: "PAYMENT_PENDING", paymentIntent: {
    provider: "pakasir", providerPaymentId: "reseller_txn", amountIDR: 45_500n } };
  const modules = {
    "server-only": {},
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@kupon/db": { Prisma: {}, prisma: {
      order: { findUnique: async ({ where }) => where.id === consumer.id ? consumer : null },
      b2BOrder: {
        findUnique: async ({ where }) => where.id === reseller.id ? reseller : null,
        findUniqueOrThrow: async () => ({ status: "COMPLETED" }),
      },
      paymentEvent: { create: async ({ data }) => {
        assert.equal(data.orderId, data.eventId.endsWith(reseller.id) ? null : consumer.id);
      } },
    } },
    "@kupon/payments": { ...payments, getPakasirTransactionStatus: async ({ txnId }) => {
      verified.push(txnId);
      return { txnId, orderId: txnId === consumer.paymentProviderPaymentId ? consumer.id : reseller.id,
        amount: apiAmount, status: "completed", isSandbox: false, raw: { fromStatusApi: true } };
    } },
    "@/lib/fraud": { getRequestContext: () => ({}), notifySecurityEvent: async () => {} },
    "@/lib/payment-orders": { applyPaymentEventToOrder: async event => {
      applied.push(event);
      return { ok: true, status: "COMPLETED" };
    } },
    "@/lib/b2b-order-service": { applyB2BPaymentEvent: async event => {
      applied.push(event);
      return { applied: true };
    } },
  };
  function load(path) {
    const source = readFileSync(new URL(`../apps/web/src/${path}`, import.meta.url), "utf8");
    const compiled = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    const exports = {};
    new Script(compiled).runInNewContext({ exports, require: name => {
      assert.ok(name in modules, `Unexpected import ${name}`);
      return modules[name];
    }, Buffer, Date, Error, console });
    return exports;
  }
  modules["@/lib/pakasir-payment"] = load("lib/pakasir-payment.ts");
  return { route: load("app/api/payment/pakasir/webhook/route.ts"), applied, verified };
}

function callback(orderId, txnId) {
  return new Request("https://eztopup.io/api/payment/pakasir/webhook", {
    method: "POST", body: JSON.stringify({ order_id: orderId, txn_id: txnId,
      amount: 45_500, status: "completed", is_sandbox: false }),
  });
}

// Existing package tests cover secret authentication and payload matching;
// these two tests cover dispatch plus the mandatory API check before fulfillment.
test("shared webhook verifies and fulfills consumer and reseller payments without a configured secret", async () => {
  const previous = process.env.PAKASIR_WEBHOOK_SECRET;
  delete process.env.PAKASIR_WEBHOOK_SECRET;
  try {
    const { route, applied, verified } = loadWebhook();
    assert.equal((await route.POST(callback("consumer_1", "consumer_txn"))).status, 200);
    assert.equal((await route.POST(callback("reseller_1", "reseller_txn"))).status, 200);
    assert.deepEqual(verified, ["consumer_txn", "reseller_txn"]);
    assert.equal(applied[0].orderId, "consumer_1");
    assert.equal(applied[1].eventId, "reseller_txn:completed");
    assert.equal(applied[1].normalizedStatus, "paid");
    assert.ok(applied.every(event => event.raw.fromStatusApi === true));
  } finally {
    if (previous === undefined) delete process.env.PAKASIR_WEBHOOK_SECRET;
    else process.env.PAKASIR_WEBHOOK_SECRET = previous;
  }
});

test("a successful callback cannot fulfill a reseller payment with a mismatched API amount", async () => {
  const previous = process.env.PAKASIR_WEBHOOK_SECRET;
  delete process.env.PAKASIR_WEBHOOK_SECRET;
  try {
    const { route, applied, verified } = loadWebhook(45_499);
    assert.equal((await route.POST(callback("reseller_1", "reseller_txn"))).status, 409);
    assert.deepEqual(verified, ["reseller_txn"]);
    assert.equal(applied.length, 0);
  } finally {
    if (previous === undefined) delete process.env.PAKASIR_WEBHOOK_SECRET;
    else process.env.PAKASIR_WEBHOOK_SECRET = previous;
  }
});
