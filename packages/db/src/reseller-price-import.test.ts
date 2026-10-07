import assert from "node:assert/strict";
import test from "node:test";
import { parseResellerWorkbook } from "./reseller-price-import.ts";

test("parses verified Roblox formula and exact identity", () => {
  const result = parseResellerWorkbook({
    sourceName: "roblox.xlsx", sheet: "Roblox Tier 1 FINAL",
    headers: ["Country", "Category Code", "Product Code", "Product Name", "PRICE CUSTOMER"],
    rows: [{ Country: { value: "Indonesia" }, "Category Code": { value: "ROB" }, "Product Code": { value: "ROB50IDR-S22" }, "Product Name": { value: "Roblox Gift Card IDR 50K" }, "PRICE CUSTOMER": { formula: "G2*101.11111%" } }],
    catalog: new Map([["id:rob50idr-s22", { variantId: "v1", supplierSku: "ROB50IDR-S22", countryCode: "id", productSlug: "roblox-gift-card", categorySlug: "game-vouchers", name: "Roblox Gift Card IDR 50K" }]]),
  });
  assert.equal(result.rules[0]?.markupMicros, 111111);
  assert.equal(result.rules[0]?.variantId, "v1");
});

test("mirrors validated non-Roblox rules to both tiers", () => {
  const result = parseResellerWorkbook({
    sourceName: "playstation store B2B Indonesia.xlsx", sheet: "PAKE INI FINAL RUMUS",
    headers: ["Category Code", "Product Code", "Product Name", "PRICE CUSTOMER"],
    rows: [{ "Category Code": { value: "VPSN" }, "Product Code": { value: "PS-SKU" }, "Product Name": { value: "PS Voucher" }, "PRICE CUSTOMER": { formula: "G2*101.5%" } }],
    catalog: new Map([["id:PS-SKU", { variantId: "v2", supplierSku: "PS-SKU", countryCode: "id", productSlug: "playstation-store", categorySlug: "game-vouchers", name: "PS Voucher" }]]),
  });
  assert.deepEqual(result.rules.map((rule) => rule.tier), ["TIER_1", "TIER_2"]);
});

test("rejects a formula with extra operands instead of selecting arbitrary cells", () => {
  const result = parseResellerWorkbook({
    sourceName: "steam B2B.xlsx", sheet: "STEAM COGS EZ b2b cust (2)",
    headers: ["Country", "Category Code", "Product Code", "Product Name"],
    rows: [{ Country: { value: "Indonesia" }, "Category Code": { value: "VSTEAM" }, "Product Code": { value: "STEAM-SKU" }, "Product Name": { value: "Steam" }, G: { formula: "H2+(2%*H2)+J2" } }],
    catalog: new Map([["id\\0STEAM-SKU", { variantId: "v3", supplierSku: "STEAM-SKU", countryCode: "id", productSlug: "steam", categorySlug: "game-vouchers", name: "Steam" }]]),
  });
  assert.equal(result.rules.length, 0);
  assert.equal(result.blocked[0]?.reason, "FORMULA_RULE_NOT_VERIFIED");
});

test("blocks unverified formulas and filters non-target categories", () => {
  const base = { sourceName: "x.xlsx", sheet: "STEAM COGS EZ b2b cust (2)", headers: ["Country", "Category Code", "Product Code", "Product Name", "CUSTOMER PRICE"], catalog: new Map() } as const;
  const result = parseResellerWorkbook({ ...base, rows: [{ Country: { value: "Indonesia" }, "Category Code": { value: "4FAN" }, "Product Code": { value: "x" }, "Product Name": { value: "x" }, "CUSTOMER PRICE": { formula: "H2+(2%*H2)" } }] });
  assert.equal(result.rules.length, 0);
  assert.equal(result.skipped[0]?.reason, "CATEGORY_NOT_ALLOWED");
});
