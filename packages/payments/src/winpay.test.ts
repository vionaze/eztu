import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import {
  assertWinpayInvoiceMatches,
  createWinpayInvoice,
  createWinpaySignature,
  findWinpayInvoice,
  formatWinpayTimestamp,
  getWinpayBaseUrl,
  isWinpayCheckoutEnabled,
  isWinpayConfigured,
  isWinpayEnvironmentEnabled,
  normalizeWinpayStatus,
  parseWinpayCallback,
} from "./winpay.ts";

function restoreEnv(name: string, previous: string | undefined) {
  if (previous === undefined) delete process.env[name];
  else process.env[name] = previous;
}

test("enables checkout only from the server environment and credentials", () => {
  const previousEnabled = process.env.WINPAY_ENABLED;
  const previousKey = process.env.WINPAY_KEY;
  const previousSecret = process.env.WINPAY_SECRET_KEY;
  try {
    process.env.WINPAY_ENABLED = "false";
    process.env.WINPAY_KEY = "client-key";
    process.env.WINPAY_SECRET_KEY = "secret-key";
    assert.equal(isWinpayConfigured(), true);
    assert.equal(isWinpayEnvironmentEnabled(), false);
    assert.equal(isWinpayCheckoutEnabled(), false);

    process.env.WINPAY_ENABLED = "true";
    assert.equal(isWinpayCheckoutEnabled(), true);

    delete process.env.WINPAY_SECRET_KEY;
    assert.equal(isWinpayConfigured(), false);
    assert.equal(isWinpayCheckoutEnabled(), false);
  } finally {
    restoreEnv("WINPAY_ENABLED", previousEnabled);
    restoreEnv("WINPAY_KEY", previousKey);
    restoreEnv("WINPAY_SECRET_KEY", previousSecret);
  }
});

test("formats the Jakarta wall clock with a +07:00 offset", () => {
  assert.equal(
    formatWinpayTimestamp(new Date("2026-11-13T00:47:12Z")),
    "2026-11-13T07:47:12+07:00",
  );
  assert.equal(
    formatWinpayTimestamp(new Date("2026-11-13T18:00:00Z")),
    "2026-11-14T01:00:00+07:00",
  );
});

test("signs the timestamp with HMAC-SHA256 hex", () => {
  const timestamp = "2026-11-13T07:47:12+07:00";
  assert.equal(
    createWinpaySignature(timestamp, "secret"),
    "2f8fc1af9ada776dfe6d826af57b12cbf0eb6d84b72bfe655bb5fe466ab4a98b",
  );
  assert.equal(
    createWinpaySignature(timestamp, "secret"),
    createHmac("sha256", "secret").update(timestamp).digest("hex"),
  );
});

test("only allows the two documented WinPay checkout origins", () => {
  const previous = process.env.WINPAY_BASE_URL;
  try {
    delete process.env.WINPAY_BASE_URL;
    assert.equal(getWinpayBaseUrl(), "https://checkout.winpay.id");

    process.env.WINPAY_BASE_URL = "https://sandbox-checkout.winpay.id";
    assert.equal(getWinpayBaseUrl(), "https://sandbox-checkout.winpay.id");

    process.env.WINPAY_BASE_URL = "https://attacker.example";
    assert.throws(() => getWinpayBaseUrl(), /checkout origin/);

    process.env.WINPAY_BASE_URL = "http://checkout.winpay.id";
    assert.throws(() => getWinpayBaseUrl(), /checkout origin/);
  } finally {
    restoreEnv("WINPAY_BASE_URL", previous);
  }
});

test("creates an invoice with signed headers and a single price line", async () => {
  const previous = {
    key: process.env.WINPAY_KEY,
    secret: process.env.WINPAY_SECRET_KEY,
    fetch: globalThis.fetch,
  };
  process.env.WINPAY_KEY = "client-key";
  process.env.WINPAY_SECRET_KEY = "secret-key";
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://checkout.winpay.id");
    assert.equal(url.pathname, "/api/create");
    assert.equal(init?.method, "POST");

    const headers = new Headers(init?.headers);
    assert.equal(headers.get("X-Winpay-Key"), "client-key");
    assert.equal(headers.get("User-Agent"), "EZTopUp/1.0 (+https://eztopup.io)");
    const timestamp = headers.get("X-Winpay-Timestamp") || "";
    assert.match(timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00$/);
    assert.equal(
      headers.get("X-Winpay-Signature"),
      createHmac("sha256", "secret-key").update(timestamp).digest("hex"),
    );

    assert.deepEqual(JSON.parse(String(init?.body)), {
      customer: { name: "Buyer", email: "buyer@example.com", phone: "08000000000" },
      invoice: {
        ref: "cm-order_1",
        products: [{ name: "Mobile Legends 86 Diamonds", qty: 1, price: 25_000 }],
      },
      back_url: "https://eztopup.io/order/success?orderId=cm-order_1",
      interval: 60,
    });

    return Response.json({
      responseCode: "2010300",
      responseMessage: "Invoice created",
      responseData: {
        id: "2edff262-6228-4da1-96d7-729bf9fc85f0",
        ref: "cm-order_1",
        redirect_url: "https://checkout.winpay.id/upu90zxyid",
      },
    });
  };
  try {
    const invoice = await createWinpayInvoice({
      orderId: "cm-order_1",
      productName: "Mobile Legends 86 Diamonds",
      amountIDR: 25_000,
      customerName: "Buyer",
      customerEmail: "buyer@example.com",
      customerPhone: "08000000000",
      backUrl: "https://eztopup.io/order/success?orderId=cm-order_1",
      expiryMinutes: 60,
    });
    assert.equal(invoice.id, "2edff262-6228-4da1-96d7-729bf9fc85f0");
    assert.equal(invoice.redirectUrl, "https://checkout.winpay.id/upu90zxyid");
    assert.equal(invoice.amountIDR, 25_000);
  } finally {
    globalThis.fetch = previous.fetch;
    restoreEnv("WINPAY_KEY", previous.key);
    restoreEnv("WINPAY_SECRET_KEY", previous.secret);
  }
});

test("rejects a redirect URL outside the WinPay checkout origin", async () => {
  const previous = {
    key: process.env.WINPAY_KEY,
    secret: process.env.WINPAY_SECRET_KEY,
    fetch: globalThis.fetch,
  };
  process.env.WINPAY_KEY = "client-key";
  process.env.WINPAY_SECRET_KEY = "secret-key";
  globalThis.fetch = async () =>
    Response.json({
      responseCode: "2010300",
      responseData: {
        id: "invoice-1",
        ref: "cm-order_1",
        redirect_url: "https://attacker.example/phish",
      },
    });
  try {
    await assert.rejects(
      () =>
        createWinpayInvoice({
          orderId: "cm-order_1",
          productName: "x",
          amountIDR: 25_000,
          customerName: "Buyer",
          customerEmail: "buyer@example.com",
          customerPhone: "08000000000",
          backUrl: "https://eztopup.io/order/success",
          expiryMinutes: 60,
        }),
      /invalid redirect/,
    );
  } finally {
    globalThis.fetch = previous.fetch;
    restoreEnv("WINPAY_KEY", previous.key);
    restoreEnv("WINPAY_SECRET_KEY", previous.secret);
  }
});

test("fails closed on a non-2xx response code", async () => {
  const previous = {
    key: process.env.WINPAY_KEY,
    secret: process.env.WINPAY_SECRET_KEY,
    fetch: globalThis.fetch,
  };
  process.env.WINPAY_KEY = "client-key";
  process.env.WINPAY_SECRET_KEY = "secret-key";
  globalThis.fetch = async () =>
    Response.json({ responseCode: "4010300", responseMessage: "Invalid signature" });
  try {
    await assert.rejects(
      () => findWinpayInvoice({ invoiceId: "2edff262-6228-4da1-96d7-729bf9fc85f0" }),
      /WinPay API error: 4010300 Invalid signature/,
    );
  } finally {
    globalThis.fetch = previous.fetch;
    restoreEnv("WINPAY_KEY", previous.key);
    restoreEnv("WINPAY_SECRET_KEY", previous.secret);
  }
});

test("reads and normalizes a found invoice", async () => {
  const previous = {
    key: process.env.WINPAY_KEY,
    secret: process.env.WINPAY_SECRET_KEY,
    fetch: globalThis.fetch,
  };
  process.env.WINPAY_KEY = "client-key";
  process.env.WINPAY_SECRET_KEY = "secret-key";
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://checkout.winpay.id");
    assert.equal(url.pathname, "/api/find/a3ef3f93-7fcb-439a-889e-14976a46492e");
    assert.equal(init?.method, "GET");
    assert.equal(new Headers(init?.headers).get("X-Winpay-Key"), "client-key");
    return Response.json({
      responseCode: "2000300",
      responseMessage: "Invoice Found",
      responseData: {
        id: "a3ef3f93-7fcb-439a-889e-14976a46492e",
        ref: "cm-order_1",
        status: "PAID",
        redirect_url: "https://checkout.winpay.id/HJHKvf1chmn",
        products: [
          { uuid: "p1", name: "Mobile Legends 86 Diamonds", qty: 1, price: "25000" },
        ],
        payment: { channel: "BSI", paid_amount: "26000", fee: "1000", nett: "25000" },
      },
    });
  };
  try {
    const invoice = await findWinpayInvoice({
      invoiceId: "a3ef3f93-7fcb-439a-889e-14976a46492e",
    });
    assert.equal(invoice.id, "a3ef3f93-7fcb-439a-889e-14976a46492e");
    assert.equal(invoice.ref, "cm-order_1");
    assert.equal(invoice.status, "paid");
    assert.equal(invoice.amountIDR, 25_000);
    assert.equal(invoice.paidAmountIDR, 25_000);
    assert.equal(invoice.channel, "BSI");
  } finally {
    globalThis.fetch = previous.fetch;
    restoreEnv("WINPAY_KEY", previous.key);
    restoreEnv("WINPAY_SECRET_KEY", previous.secret);
  }
});

test("normalizes undocumented provider statuses defensively", () => {
  assert.equal(normalizeWinpayStatus("PAID"), "paid");
  assert.equal(normalizeWinpayStatus("expired"), "expired");
  assert.equal(normalizeWinpayStatus("CANCELLED"), "failed");
  assert.equal(normalizeWinpayStatus("REFUNDED"), "refunded");
  assert.equal(normalizeWinpayStatus("UNPAID"), "pending");
  assert.equal(normalizeWinpayStatus(undefined), "pending");
});

test("parses the callback and tolerates both documented ref shapes", () => {
  const bothRefs = parseWinpayCallback(
    JSON.stringify({
      uuid: "40777df1-ad3d-4572-b0a3-6c90574330fa",
      ref: "cm-order_1",
      channel: "BSI",
      amount: 25000,
      invoice: {
        uuid: "40777df1-ad3d-4572-b0a3-6c90574330fa",
        ref: "cm-order_1",
        url: "https://checkout.winpay.id/ilhwj3z75x5",
      },
    }),
  );
  assert.equal(bothRefs.ref, "cm-order_1");
  assert.equal(bothRefs.invoiceRef, "cm-order_1");
  assert.equal(bothRefs.invoiceId, "40777df1-ad3d-4572-b0a3-6c90574330fa");
  assert.equal(bothRefs.amountIDR, 25_000);
  assert.equal(bothRefs.channel, "BSI");

  const nestedOnly = parseWinpayCallback(
    JSON.stringify({ uuid: "u1", invoice: { uuid: "u1", ref: "cm-order_2" } }),
  );
  assert.equal(nestedOnly.ref, null);
  assert.equal(nestedOnly.invoiceRef, "cm-order_2");
});

test("fails closed on ref, amount, or status mismatch", () => {
  const invoice = {
    id: "ctx-1",
    ref: "cm-order_1",
    providerStatus: "PAID",
    status: "paid" as const,
    redirectUrl: null,
    amountIDR: 25_000,
    paidAmountIDR: 25_000,
    channel: "BSI",
    raw: {},
  };
  assertWinpayInvoiceMatches({
    invoice,
    orderId: "cm-order_1",
    amountIDR: 25_000,
    requirePaid: true,
  });
  assert.throws(
    () =>
      assertWinpayInvoiceMatches({
        invoice: { ...invoice, ref: "cm-order_2", amountIDR: 24_999, status: "pending" },
        orderId: "cm-order_1",
        amountIDR: 25_000,
        requirePaid: true,
      }),
    /ref, amount, status/,
  );
});

test("clamps the invoice interval into the range WinPay accepts", async () => {
  const previous = {
    key: process.env.WINPAY_KEY,
    secret: process.env.WINPAY_SECRET_KEY,
    fetch: globalThis.fetch,
  };
  process.env.WINPAY_KEY = "client-key";
  process.env.WINPAY_SECRET_KEY = "secret-key";
  const intervals: number[] = [];
  globalThis.fetch = async (_input, init) => {
    intervals.push(JSON.parse(String(init?.body)).interval);
    return Response.json({
      responseCode: "2010300",
      responseData: {
        id: "invoice-1",
        ref: "cm-order_1",
        redirect_url: "https://checkout.winpay.id/token",
      },
    });
  };
  const base = {
    orderId: "cm-order_1",
    productName: "x",
    amountIDR: 10_000,
    customerName: "Buyer",
    customerEmail: "buyer@example.com",
    customerPhone: "08000000000",
    backUrl: "https://eztopup.io/order/success",
  };
  try {
    await createWinpayInvoice({ ...base, expiryMinutes: 1 });
    await createWinpayInvoice({ ...base, expiryMinutes: 5_000 });
    assert.deepEqual(intervals, [5, 1440]);
  } finally {
    globalThis.fetch = previous.fetch;
    restoreEnv("WINPAY_KEY", previous.key);
    restoreEnv("WINPAY_SECRET_KEY", previous.secret);
  }
});

test("rejects a callback body that is not a JSON object", () => {
  assert.throws(() => parseWinpayCallback("[]"), /must be a JSON object/);
  assert.throws(() => parseWinpayCallback("not-json"), SyntaxError);
});

test("surfaces an edge block instead of hiding it behind Unknown API error", async () => {
  const previous = {
    key: process.env.WINPAY_KEY,
    secret: process.env.WINPAY_SECRET_KEY,
    fetch: globalThis.fetch,
  };
  process.env.WINPAY_KEY = "client-key";
  process.env.WINPAY_SECRET_KEY = "secret-key";
  globalThis.fetch = async () =>
    new Response("<html><body><h1>Forbidden</h1></body></html>", {
      status: 403,
      headers: { "content-type": "text/html" },
    });
  try {
    await assert.rejects(
      () => findWinpayInvoice({ invoiceId: "a3ef3f93-7fcb-439a-889e-14976a46492e" }),
      (error) =>
        error instanceof Error &&
        error.message.startsWith("WinPay API error: 403") &&
        error.message.includes("Forbidden"),
    );
  } finally {
    globalThis.fetch = previous.fetch;
    restoreEnv("WINPAY_KEY", previous.key);
    restoreEnv("WINPAY_SECRET_KEY", previous.secret);
  }
});

test("surfaces a JSON rejection envelope with its response code", async () => {
  const previous = {
    key: process.env.WINPAY_KEY,
    secret: process.env.WINPAY_SECRET_KEY,
    fetch: globalThis.fetch,
  };
  process.env.WINPAY_KEY = "client-key";
  process.env.WINPAY_SECRET_KEY = "secret-key";
  globalThis.fetch = async () =>
    Response.json(
      {
        responseCode: "4010100",
        responseMessage: "Your have no access to this resource",
      },
      { status: 401 },
    );
  try {
    await assert.rejects(
      () => findWinpayInvoice({ invoiceId: "a3ef3f93-7fcb-439a-889e-14976a46492e" }),
      (error) =>
        error instanceof Error &&
        error.message ===
          "WinPay API error: 4010100 Your have no access to this resource",
    );
  } finally {
    globalThis.fetch = previous.fetch;
    restoreEnv("WINPAY_KEY", previous.key);
    restoreEnv("WINPAY_SECRET_KEY", previous.secret);
  }
});

test("names the Cloudflare block and its error code", async () => {
  const previous = {
    key: process.env.WINPAY_KEY,
    secret: process.env.WINPAY_SECRET_KEY,
    fetch: globalThis.fetch,
  };
  process.env.WINPAY_KEY = "client-key";
  process.env.WINPAY_SECRET_KEY = "secret-key";
  globalThis.fetch = async () =>
    new Response(
      '<!DOCTYPE html><html class="no-js ie6 oldie"><head><title>Access denied</title></head>' +
        "<body><h1>Access denied</h1><p>Error 1020</p></body></html>",
      {
        status: 403,
        headers: { "content-type": "text/html", "cf-ray": "a59b4f64ebaaa01e-FRA" },
      },
    );
  try {
    await assert.rejects(
      () => findWinpayInvoice({ invoiceId: "a3ef3f93-7fcb-439a-889e-14976a46492e" }),
      (error) =>
        error instanceof Error &&
        error.message ===
          "WinPay API error: 403 Cloudflare Error 1020 (cf-ray a59b4f64ebaaa01e-FRA)",
    );
  } finally {
    globalThis.fetch = previous.fetch;
    restoreEnv("WINPAY_KEY", previous.key);
    restoreEnv("WINPAY_SECRET_KEY", previous.secret);
  }
});
