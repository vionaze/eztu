import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Script } from "node:vm";
import test from "node:test";
import { calculateResellerPrice, chooseEffectiveRule } from "../packages/db/src/reseller-pricing.ts";

const require = createRequire(new URL("../packages/db/package.json", import.meta.url));
const ts = require("typescript");

function loadService(overrides = {}) {
  class AuthorizationRequiredError extends Error {}
  const rule = { mode: "MARKUP", markupMicros: 150000, fixedPriceIDR: null, enabled: true };
  const variant = {
    id: "sku-1", productId: "product-1", name: "Test voucher", countryCode: "id",
    supplierSku: "TEST-S1", supplierStatus: "available", supplierCostIDR: 10000,
    published: true, replacementForId: null,
    product: { name: "Test", slug: "test", image: "", published: true, globalAvailability: false, unavailableMarketCodes: [] },
    resellerOrganizationPrices: [], resellerTierPrices: [rule],
  };
  let writes = 0;
  const prisma = {
    productVariant: {
      findMany: async () => [variant], findUnique: async () => variant,
      update: async () => { writes++; throw new Error("Unexpected retail write"); },
    },
    resellerOrganizationSkuPrice: { findUnique: async () => null },
    resellerTierSkuPrice: { findUnique: async () => rule },
  };
  const modules = {
    "server-only": {},
    "@/lib/checkout-limits": { MAX_SELF_SERVICE_QUANTITY: 20 },
    "@kupon/db": { calculateResellerPrice, chooseEffectiveRule, prisma },
    "@/lib/clerk": { AuthorizationRequiredError },
    "@/lib/reseller-auth": {
      requireResellerUser: async ({ organizationId, statuses }) => {
        assert.deepEqual(Array.from(statuses), ["ACTIVE"]);
        if (organizationId !== "org-1") throw new AuthorizationRequiredError();
        return { authenticatedUser: { emailVerified: true }, organization: { id: "org-1", tier: "TIER_1" } };
      },
    },
    "@/lib/product-availability": {
      getDetectedMarketCode: headers => (headers.get("cf-ipcountry") || "").toLowerCase(),
      isProductExcludedFromMarket: (product, market) => product.unavailableMarketCodes.includes(market),
    },
    "@/lib/supplier": {
      isSupplierProductCode: value => !!value,
      getSupplierProduct: async () => ({ code: "TEST-S1", country_code: "id", status: "available", price: 20000 }),
    },
  };
  Object.assign(modules, overrides);
  const source = readFileSync(new URL("../apps/web/src/lib/reseller-pricing-service.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Script(compiled).runInNewContext({ exports, require: name => {
    if (!(name in modules)) throw new Error(`Unknown test import ${name}`);
    return modules[name];
  }, Date, Map, Number });
  return { service: exports, prisma, variant, rule, writes: () => writes, AuthorizationRequiredError };
}

const headers = () => new Headers({ "cf-ipcountry": "ID" });

test("catalog exposes only reseller selling prices, never tier, margin or supplier cost", async () => {
  const { service, writes } = loadService();
  const body = await service.getResellerCatalog("org-1", headers());
  assert.equal(body.products[0].variants[0].priceIDR, 10150);
  const serialized = JSON.stringify(body);
  for (const key of ["supplierCost", "markup", "tier", "revision", "provenance", "TIER_1"]) assert.equal(serialized.includes(key), false);
  assert.equal(writes(), 0);
});

test("wrong organization and unverified email cannot load reseller prices", async () => {
  const { service, AuthorizationRequiredError } = loadService();
  await assert.rejects(service.getResellerCatalog("org-2", headers()), AuthorizationRequiredError);
  const denied = loadService({ "@/lib/reseller-auth": { requireResellerUser: async () => ({ authenticatedUser: { emailVerified: false }, organization: { tier: "TIER_1" } }) } });
  await assert.rejects(denied.service.getResellerCatalog("org-1", headers()));
});

test("pending or suspended organization fails closed through ACTIVE guard", async () => {
  const { service } = loadService({ "@/lib/reseller-auth": { requireResellerUser: async options => {
    assert.deepEqual(Array.from(options.statuses), ["ACTIVE"]);
    throw new Error("Organization is not active");
  } } });
  await assert.rejects(service.getResellerCatalog("org-1", headers()));
  await assert.rejects(service.getResellerLiveQuote("org-1", "sku-1", 1, headers()));
});

test("live quote recalculates from fresh supplier cost without changing retail data", async () => {
  const { service, writes } = loadService();
  const quote = await service.getResellerLiveQuote("org-1", "sku-1", 2, headers());
  assert.equal(quote.unitPriceIDR, 20300);
  assert.equal(quote.totalIDR, 40600);
  assert.equal(writes(), 0);
  assert.deepEqual(Object.keys(quote).sort(), ["quantity", "quotedAt", "totalIDR", "unitPriceIDR", "variantId"]);
});

test("unconfigured or disabled rules do not fall back to retail prices", async () => {
  const { service, prisma } = loadService();
  prisma.resellerTierSkuPrice.findUnique = async () => null;
  await assert.rejects(service.getResellerLiveQuote("org-1", "sku-1", 1, headers()), e => e.code === "PRICE_NOT_CONFIGURED");
  prisma.resellerOrganizationSkuPrice.findUnique = async () => ({ mode: "MARKUP", markupMicros: 100000, fixedPriceIDR: null, enabled: false });
  prisma.resellerTierSkuPrice.findUnique = async () => ({ mode: "MARKUP", markupMicros: 200000, fixedPriceIDR: null, enabled: true });
  await assert.rejects(service.getResellerLiveQuote("org-1", "sku-1", 1, headers()), e => e.code === "PRICE_NOT_CONFIGURED");
});

test("stock changes, country identity and market restrictions are enforced", async () => {
  const stock = loadService({ "@/lib/supplier": { isSupplierProductCode: () => true, getSupplierProduct: async () => ({ code: "TEST-S1", status: "empty", price: 20000 }) } });
  await assert.rejects(stock.service.getResellerLiveQuote("org-1", "sku-1", 1, headers()), e => e.code === "SUPPLIER_SKU_UNAVAILABLE");
  const identity = loadService({ "@/lib/supplier": { isSupplierProductCode: () => true, getSupplierProduct: async () => ({ code: "TEST-S1", country_code: "us", status: "available", price: 20000 }) } });
  await assert.rejects(identity.service.getResellerLiveQuote("org-1", "sku-1", 1, headers()), e => e.code === "SUPPLIER_IDENTITY_MISMATCH");
  const market = loadService();
  await assert.rejects(market.service.getResellerLiveQuote("org-1", "sku-1", 1, new Headers({ "cf-ipcountry": "US" })), e => e.code === "VARIANT_UNAVAILABLE");
});

test("service rejects invalid quantities before supplier lookup", async () => {
  const { service } = loadService();
  for (const quantity of [0, -1, 0.5, NaN, Infinity, 21, "2"]) {
    await assert.rejects(service.getResellerLiveQuote("org-1", "sku-1", quantity, headers()), e => e.code === "INVALID_QUANTITY");
  }
});

test("revoked membership is rechecked after supplier lookup", async () => {
  let calls = 0;
  const revoked = loadService({ "@/lib/reseller-auth": { requireResellerUser: async () => {
    if (++calls > 1) throw new Error("Membership revoked");
    return { authenticatedUser: { emailVerified: true }, organization: { tier: "TIER_1" } };
  } } });
  await assert.rejects(revoked.service.getResellerLiveQuote("org-1", "sku-1", 1, headers()), /Membership revoked/);
});
