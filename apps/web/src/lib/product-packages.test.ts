import assert from "node:assert/strict";
import test from "node:test";
import { groupProductPackages, quoteProductPackage } from "./product-packages.ts";

const base = { name: "14 Diamonds ( 13 + 1 Bonus )", priceIDR: 4406, priceUSD: 0.28, countryCode: "id" };

test("equal packages share a card and fall back to an available SKU; cheapest price gets Best value", async () => {
  const packages = groupProductPackages([
    { ...base, id: "a", supplierStatus: "empty" },
    { ...base, id: "b", supplierStatus: "available" },
    { ...base, id: "c", supplierStatus: "available" },
    { ...base, id: "d", priceIDR: 4752, supplierStatus: "available" },
  ]);
  assert.equal(packages.length, 2);
  assert.equal(packages[0].variant.id, "b");
  assert.equal(packages[0].bestValue, true);
  assert.equal(packages[1].bestValue, false);
  const repriced = groupProductPackages(packages.flatMap(group => group.variants), { b: { priceIDR: 5000 } });
  assert.equal(repriced[0].bestValue, false);
  assert.equal(repriced[1].bestValue, true);
  const checked: string[] = [];
  const result = await quoteProductPackage(packages[0].variants, async variant => {
    checked.push(variant.id);
    return variant.id === "b" ? null : { token: "signed-c" };
  });
  assert.deepEqual(checked, ["b", "c"]);
  assert.equal(result?.variant.id, "c");
  assert.equal(result?.quote.token, "signed-c");
});

test("all empty SKUs hide the package and cannot produce a checkout quote", async () => {
  const variants = ["a", "b"].map(id => ({ ...base, id, supplierStatus: "empty" }));
  assert.deepEqual(groupProductPackages(variants), []);
  const unavailable = async () => null;
  assert.equal(await quoteProductPackage(variants, () => { throw new Error("Should not quote known empty stock"); }), null);
  assert.equal(await quoteProductPackage(variants.map(v => ({ ...v, supplierStatus: "available" })), unavailable), null);
  await assert.rejects(quoteProductPackage([base].map(v => ({ ...v, id: "a" })), async () => {
    throw new Error("Supplier connection failed");
  }), /Supplier connection failed/);
});
