import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Script } from "node:vm";
import test from "node:test";

const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const ts = require("typescript");
const source = readFileSync(new URL("../apps/web/src/lib/discord.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
function load(fetch) {
  const exports = {};
  new Script(compiled).runInNewContext({ exports, fetch, AbortSignal, Date, Intl,
    process: { env: { DISCORD_WEBHOOK_URL: "https://discord.example/sales",
      DISCORD_FRAUD_WEBHOOK_URL: "https://discord.example/fraud" } },
    console: { warn() {}, error() {} },
  });
  return exports;
}
const order = {
  orderNumber: "B2B-TEST", organizationName: "Test reseller", amountIDR: 45_500,
  paymentMethod: "PAKASIR", paidAt: new Date("2026-10-10T08:42:25.463Z"),
  lines: [{ productName: "Roblox Gift Card", variantName: "IDR 50K", quantity: 1,
    supplierCostIDR: 40_000, supplierRaw: { voucherCodes: ["PRIVATE-CODE"] } }],
};

test("completed reseller sale goes to sales with transaction details and no voucher or cost", async () => {
  const { sendDiscordResellerSale } = load(async (url, options) => {
    assert.equal(url, "https://discord.example/sales");
    const payload = JSON.parse(options.body);
    assert.equal(payload.username, "EZTopUp Reseller Reports");
    assert.deepEqual(payload.allowed_mentions, { parse: [] });
    assert.equal(payload.embeds[0].timestamp, order.paidAt.toISOString());
    assert.ok(options.body.includes("COMPLETED"));
    assert.ok(options.body.includes("45.500"));
    assert.ok(options.body.includes("Roblox Gift Card - IDR 50K × 1"));
    assert.ok(!options.body.includes("PRIVATE-CODE"));
    assert.ok(!options.body.includes("supplierCost"));
    return { ok: true };
  });
  assert.equal(await sendDiscordResellerSale(order), true);
});

test("Discord rejection or network failure does not throw into fulfillment", async () => {
  assert.equal(await load(async () => ({ ok: false, status: 429 })).sendDiscordResellerSale(order), false);
  assert.equal(await load(async () => { throw new Error("network"); }).sendDiscordResellerSale(order), false);
});
