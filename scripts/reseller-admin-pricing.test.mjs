import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Script } from "node:vm";
import test from "node:test";
import { calculateResellerPrice, chooseEffectiveRule, formatResellerMarkupPercent, parseResellerMarkupPercent } from "../packages/db/src/reseller-pricing.ts";

const require = createRequire(new URL("../packages/db/package.json", import.meta.url));
const ts = require("typescript");

function harness() {
  let authorized = true;
  let rule = null;
  let supplierCost = 10000;
  const logs = [];
  const variant = { id: "v1", published: true, replacementForId: null, supplierSku: "SKU-1", countryCode: "id",
    name: "Package", supplierCostIDR: 10000, supplierStatus: "available", product: { name: "Product" },
    resellerOrganizationPrices: [], resellerTierPrices: [{ mode: "MARKUP", markupMicros: 150000, fixedPriceIDR: null, enabled: true, revision: 5 }] };
  const prisma = {
    resellerOrganization: { findUnique: async () => ({ id: "org1", tier: "TIER_1", name: "Test Org" }), findUniqueOrThrow: async () => ({ id: "org1" }) },
    productVariant: { findUnique: async () => variant, findMany: async () => [variant] },
    resellerOrganizationSkuPrice: {
      findUnique: async () => rule,
      create: async ({ data }) => { rule = { ...data, revision: 1 }; return rule; },
      update: async ({ data }) => { rule = { ...rule, ...data, revision: rule.revision + 1 }; return rule; },
      deleteMany: async ({ where }) => {
        if (!rule || where.revision !== rule.revision) return { count: 0 };
        rule = null; return { count: 1 };
      },
    },
    appLog: { create: async entry => { logs.push(entry); } },
    $transaction: async fn => fn(prisma),
  };
  class ResellerPricingError extends Error { constructor(message, status, code) { super(message); this.status = status; this.code = code; } }
  const modules = {
    "next/server": {},
    "@kupon/db": { prisma, Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } }, calculateResellerPrice, chooseEffectiveRule, formatResellerMarkupPercent, parseResellerMarkupPercent },
    "@/lib/reseller-auth": { requirePlatformAdminForResellers: async () => { if (!authorized) throw new Error("Denied"); return { dbUserId: "admin1", email: "admin@example.invalid" }; } },
    "@/lib/reseller-api": {
      resellerJson: (body, status = 200) => ({ body, status }),
      resellerApiError: error => ({ status: error.status ?? 403, body: { error: error.message } }),
      requireSameOrigin: request => { if (request.headers.get("origin") !== "https://eztopup.io") throw new ResellerPricingError("Origin denied", 403); },
    },
    "@/lib/reseller-pricing-service": { ResellerPricingError },
    "@/lib/supplier": { getSupplierProduct: async () => ({ code: "SKU-1", country_code: "id", status: " available ", price: supplierCost }) },
    "@/lib/app-log": { writeAppLog: async entry => logs.push(entry) },
  };
  const source = readFileSync(new URL("../apps/web/src/app/api/admin/resellers/[id]/pricing/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Script(compiled).runInNewContext({ exports, require: name => { if (!(name in modules)) throw new Error(`Unknown import ${name}`); return modules[name]; }, Date, Map, Number });
  return { routes: exports, logs, variant, getRule: () => rule, setRule: value => { rule = value; }, deny: () => { authorized = false; }, setCost: value => { supplierCost = value; } };
}

const ctx = { params: Promise.resolve({ id: "org1" }) };
function request(body, origin = "https://eztopup.io") {
  return { nextUrl: new URL("https://eztopup.io/api/admin/resellers/org1/pricing"), headers: new Headers({ origin, host: "eztopup.io" }), json: async () => body };
}
const draft = { variantId: "v1", mode: "MARKUP", markupPercent: "1.11111", enabled: true, expectedRevision: null };

test("admin GET keeps override CAS revision separate from tier revision", async () => {
  const h = harness(); const result = await h.routes.GET(request({}), ctx);
  assert.equal(result.status, 200);
  assert.equal(result.body.items[0].revision, null);
  assert.equal(result.body.items[0].effectiveRevision, 5);
});

test("only admin with same-origin request can mutate reseller prices", async () => {
  const h = harness();
  assert.equal((await h.routes.PATCH(request(draft, "https://elsewhere.invalid"), ctx)).status, 403);
  assert.equal(h.getRule(), null);
  h.deny();
  assert.equal((await h.routes.PATCH(request(draft), ctx)).status, 403);
  assert.equal(h.getRule(), null);
});

test("exact markup override saves with audit and stale revision rejects overwrite", async () => {
  const h = harness();
  assert.equal((await h.routes.PATCH(request(draft), ctx)).status, 200);
  assert.equal(h.getRule().markupMicros, 111111);
  assert.equal(h.getRule().revision, 1);
  assert.equal(h.logs.length, 1);
  assert.equal((await h.routes.PATCH(request({ ...draft, markupPercent: "5" }), ctx)).status, 409);
  assert.equal(h.getRule().markupMicros, 111111);
});

test("fixed override rejects below fresh cost and accepts normalized available status", async () => {
  const h = harness(); h.setCost(11000);
  const fixed = { variantId: "v1", mode: "FIXED", fixedPriceIDR: 10000, enabled: true, expectedRevision: null };
  assert.equal((await h.routes.PATCH(request(fixed), ctx)).status, 400);
  assert.equal(h.getRule(), null);
  assert.equal((await h.routes.PATCH(request({ ...fixed, fixedPriceIDR: 12000 }), ctx)).status, 200);
  assert.equal(h.getRule().fixedPriceIDR, 12000);
});

test("reset requires exact override revision and deletes only selected org override", async () => {
  const h = harness(); await h.routes.PATCH(request(draft), ctx);
  assert.equal((await h.routes.DELETE(request({ variantId: "v1", expectedRevision: 2 }), ctx)).status, 409);
  assert.ok(h.getRule());
  assert.equal((await h.routes.DELETE(request({ variantId: "v1", expectedRevision: 1 }), ctx)).status, 200);
  assert.equal(h.getRule(), null);
});
