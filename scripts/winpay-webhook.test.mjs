import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Script } from "node:vm";
import test from "node:test";
import * as winpay from "../packages/payments/src/winpay.ts";

const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const ts = require("typescript");

const ORDER_AMOUNT_IDR = 45_500;

function loadRoute({ invoiceStatus = "PAID", invoiceAmountIDR = ORDER_AMOUNT_IDR } = {}) {
  const applied = [];
  const securityEvents = [];
  const verified = [];
  const consumer = {
    id: "consumer_1",
    status: "PENDING",
    totalIDR: ORDER_AMOUNT_IDR,
    paymentProvider: "winpay",
    paymentProviderPaymentId: "inv_consumer",
  };
  const reseller = {
    id: "reseller_1",
    status: "PAYMENT_PENDING",
    paymentIntent: {
      provider: "winpay",
      providerPaymentId: "inv_reseller",
      amountIDR: BigInt(ORDER_AMOUNT_IDR),
    },
  };

  const modules = {
    "server-only": {},
    "next/server": {
      NextRequest: class NextRequest {},
      NextResponse: class NextResponse extends Response {
        static json(body, init) {
          return Response.json(body, init);
        }
      },
    },
    "@kupon/db": {
      Prisma: { PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {} },
      prisma: {
        order: {
          findUnique: async ({ where }) =>
            where.id === consumer.id ? { ...consumer } : null,
        },
        b2BOrder: {
          findUnique: async ({ where }) =>
            where.id === reseller.id ? { ...reseller } : null,
          findUniqueOrThrow: async () => ({ status: "PAID" }),
        },
        paymentEvent: {
          create: async ({ data }) => {
            assert.equal(data.provider, "winpay");
            assert.match(data.eventId, /^verification:/);
          },
          updateMany: async () => ({ count: 1 }),
        },
      },
    },
    "@kupon/payments": {
      ...winpay,
      findWinpayInvoice: async ({ invoiceId }) => {
        verified.push(invoiceId);
        return {
          id: invoiceId,
          ref: invoiceId === consumer.paymentProviderPaymentId ? consumer.id : reseller.id,
          providerStatus: invoiceStatus,
          status: winpay.normalizeWinpayStatus(invoiceStatus),
          redirectUrl: null,
          amountIDR: invoiceAmountIDR,
          paidAmountIDR: invoiceStatus === "PAID" ? invoiceAmountIDR : null,
          channel: "BSI",
          raw: { fromFindApi: true },
        };
      },
    },
    "@/lib/fraud": {
      getRequestContext: () => ({}),
      notifySecurityEvent: async (event) => {
        securityEvents.push(event);
      },
    },
    "@/lib/payment-orders": {
      applyPaymentEventToOrder: async (event) => {
        applied.push(event);
        return { ok: true, status: "COMPLETED" };
      },
    },
    "@/lib/b2b-order-service": {
      applyB2BPaymentEvent: async (event) => {
        applied.push(event);
        return { applied: true };
      },
    },
  };

  function load(path) {
    const source = readFileSync(new URL(`../apps/web/src/${path}`, import.meta.url), "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const exports = {};
    new Script(compiled).runInNewContext({
      exports,
      require: (name) => {
        assert.ok(name in modules, `Unexpected import ${name}`);
        return modules[name];
      },
      Buffer,
      Date,
      Error,
      JSON,
      Number,
      console,
      AbortSignal,
      setTimeout,
      clearTimeout,
    });
    return exports;
  }

  modules["@/lib/winpay-payment"] = load("lib/winpay-payment.ts");
  return {
    route: load("app/api/payment/winpay/callback/route.ts"),
    applied,
    verified,
    securityEvents,
  };
}

function callback(body) {
  return new Request("https://eztopup.io/api/payment/winpay/callback", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function paidBody(orderRef, invoiceUuid, extra = {}) {
  return {
    uuid: invoiceUuid,
    ref: orderRef,
    channel: "BSI",
    amount: ORDER_AMOUNT_IDR,
    invoice: { uuid: invoiceUuid, ref: orderRef },
    ...extra,
  };
}

test("a verified paid invoice fulfills the consumer order and answers ACCEPTED", async () => {
  const { route, applied, verified } = loadRoute();
  const response = await route.POST(callback(paidBody("consumer_1", "inv_consumer")));

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "ACCEPTED");
  assert.deepEqual(verified, ["inv_consumer"]);
  assert.equal(applied.length, 1);
  assert.equal(applied[0].provider, "winpay");
  assert.equal(applied[0].providerPaymentId, "inv_consumer");
  assert.equal(applied[0].payCurrency, "IDR");
  assert.equal(applied[0].payAmount, ORDER_AMOUNT_IDR);
  assert.equal(applied[0].raw.fromFindApi, true);
});

test("an unpaid invoice never marks the order paid and asks WinPay to retry", async () => {
  const { route, applied } = loadRoute({ invoiceStatus: "PENDING" });
  const response = await route.POST(callback(paidBody("consumer_1", "inv_consumer")));

  assert.equal(response.status, 503);
  assert.equal(applied.length, 0);
});

test("an amount mismatch is rejected and reported", async () => {
  const { route, applied, securityEvents } = loadRoute({ invoiceAmountIDR: ORDER_AMOUNT_IDR - 1 });
  const response = await route.POST(callback(paidBody("consumer_1", "inv_consumer")));

  assert.equal(response.status, 409);
  assert.equal(applied.length, 0);
  assert.ok(securityEvents.some((event) => event.eventType === "winpay_callback_rejected"));
});

test("a callback amount that disagrees with the order total is rejected before verification", async () => {
  const { route, applied, verified } = loadRoute();
  const response = await route.POST(
    callback(paidBody("consumer_1", "inv_consumer", { amount: ORDER_AMOUNT_IDR + 1 })),
  );

  assert.equal(response.status, 409);
  assert.equal(applied.length, 0);
  assert.deepEqual(verified, []);
});

test("resolves the order from invoice.ref when the top-level ref is missing", async () => {
  const { route, applied } = loadRoute();
  const body = paidBody("consumer_1", "inv_consumer");
  delete body.ref;

  const response = await route.POST(callback(body));

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "ACCEPTED");
  assert.equal(applied[0].orderId, "consumer_1");
});

test("a paid reseller invoice applies the B2B payment event", async () => {
  const { route, applied } = loadRoute();
  const response = await route.POST(callback(paidBody("reseller_1", "inv_reseller")));

  assert.equal(response.status, 200);
  assert.equal(applied.length, 1);
  assert.equal(applied[0].provider, "winpay");
  assert.equal(applied[0].normalizedStatus, "paid");
  assert.equal(applied[0].eventId, "inv_reseller:PAID");
});

test("an unknown order reference is rejected and reported", async () => {
  const { route, applied, verified, securityEvents } = loadRoute();
  const response = await route.POST(callback(paidBody("unknown_order", "inv_unknown")));

  assert.equal(response.status, 409);
  assert.equal(applied.length, 0);
  assert.deepEqual(verified, []);
  assert.ok(
    securityEvents.some((event) => event.eventType === "winpay_callback_unknown_order"),
  );
});
