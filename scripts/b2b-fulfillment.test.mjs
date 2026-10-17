import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Script } from "node:vm";
import test from "node:test";

const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const ts = require("typescript");
const compiled = ts.transpileModule(readFileSync(new URL("../apps/web/src/lib/b2b-order-service.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function setup() {
  const line = { id: "line", orderId: "order", supplierSku: "SKU", quantity: 1, supplierCostIDR: 100n, status: "PENDING", supplierTid: null };
  const order = { id: "order", orderNumber: "B2B-TEST", status: "PAID", secureDelivery: true,
    fulfillmentAttempts: 0, lines: [line], organization: { name: "Reseller" } };
  let purchases = 0, reports = 0, snapshot = { status: "pending", voucherCodes: [] };
  const update = data => {
    const { fulfillmentAttempts, ...rest } = data;
    Object.assign(order, rest);
    if (fulfillmentAttempts) order.fulfillmentAttempts += fulfillmentAttempts.increment || -fulfillmentAttempts.decrement;
  };
  const prisma = {
    b2BOrder: {
      findUnique: async () => order,
      update: async ({ data }) => update(data),
      updateMany: async ({ where, data }) => {
        if (where.secureDelivery || !where.id) return { count: 0 };
        if (!["PAID", "PROCESSING"].includes(order.status) || order.fulfillmentLeaseUntil || order.fulfillmentAttempts >= 3) return { count: 0 };
        update(data); return { count: 1 };
      },
      findMany: async ({ where }) => {
        if (where.OR && !where.status) {
          assert.ok(where.OR.some(filter => filter.status === "PROCESSING"));
          return order.status === "PROCESSING" ? [order] : [];
        }
        return [];
      },
    },
    b2BOrderLine: {
      update: async ({ data }) => Object.assign(line, data),
      updateMany: async ({ data }) => Object.assign(line, data),
      findFirst: async ({ where }) => where.supplierTid === line.supplierTid ? line : null,
    },
    b2BPaymentIntent: { findMany: async () => [] },
  };
  const modules = {
    "@kupon/db": { prisma, Prisma: { JsonNull: null } },
    "@/lib/b2b-order-rules": { FULFILLMENT_LEASE_MINUTES: 10, MAX_FULFILLMENT_ATTEMPTS: 3 },
    "@/lib/supplier": {
      createSupplierOrder: async () => { purchases++; return { tid: "tid-1" }; },
      getSupplierOrderStatus: async ({ tid }) => { assert.equal(tid, "tid-1"); assert.equal(line.supplierTid, tid); return snapshot; },
    },
    "@/lib/discord": { sendDiscordResellerSale: async () => { reports++; } },
  };
  const service = {};
  new Script(compiled).runInNewContext({ exports: service, require: name => modules[name] || {}, Date, console });
  return { service, order, line, counts: () => ({ purchases, reports }), snapshot: value => { snapshot = value; } };
}

test("pending reseller fulfillment resumes through cron/callback using one supplier purchase", async () => {
  const s = setup();
  await s.service.fulfillB2BOrder("order");
  assert.equal(s.order.status, "PROCESSING");
  assert.equal(s.line.status, "PENDING");
  await s.service.reconcileB2BOrders();
  assert.equal(s.order.fulfillmentAttempts, 0);
  s.snapshot({ status: "SUCCESS", voucherCodes: ["PRIVATE"] });
  assert.equal(await s.service.reconcileB2BSupplierCallback("tid-1"), true);
  await s.service.reconcileB2BSupplierCallback("tid-1");
  assert.equal(s.order.status, "COMPLETED");
  assert.equal(s.line.status, "FULFILLED");
  assert.equal(s.line.supplierRaw, null);
  assert.deepEqual(s.counts(), { purchases: 1, reports: 1 });
});

test("supplier success without the full voucher quantity stays in review; retry reuses TID", async () => {
  const s = setup();
  s.snapshot({ status: "success", voucherCodes: [] });
  await s.service.fulfillB2BOrder("order");
  assert.equal(s.order.status, "MANUAL_REVIEW");
  assert.match(s.order.manualReviewReason, /incomplete_voucher_codes/);
  await s.service.adminRetryFulfillment("order");
  assert.equal(s.order.status, "MANUAL_REVIEW");
  assert.deepEqual(s.counts(), { purchases: 1, reports: 0 });
});
