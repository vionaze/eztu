import test from "node:test";
import assert from "node:assert/strict";
import { selectDiamondReplacement, reconcileSupplierReplacements } from "./supplier-replacements.ts";

const original = { code: "original", name: "17 Diamonds ( 15 + 2 Bonus )", category_code: "ml", price: 5000, status: "empty" };
const candidate = (code: string, amount: number, price: number) => ({ ...original, code, name: `${amount} Diamonds`, price, status: "available" });

test("chooses the cheapest nearest package and retires its replacement when stock returns", async () => {
  const rows = [candidate("lower", 16, 4500), candidate("higher", 18, 4200), candidate("far", 5, 1000), candidate("expensive", 18, 6000)];
  assert.equal(selectDiamondReplacement(original, rows)?.code, "higher");
  const changes: unknown[] = [];
  const created: { create: { supplierSku: string; name: string; priceIDR: number } }[] = [];
  const db = { productVariant: { upsert: async (change: typeof created[number]) => { created.push(change); }, updateMany: async (change: unknown) => { changes.push(change); } } };
  const source = { id: "variant", name: original.name, productId: "ml", countryCode: "id", supplierSku: original.code, nonCryptoMarkupBps: 1000, cryptoMarkupBps: 1200, priceIDR: 5500, priceUSD: 0.35 };
  await reconcileSupplierReplacements(db as unknown as Parameters<typeof reconcileSupplierReplacements>[0], [source], [original, ...rows]);
  assert.equal(created[0].create.supplierSku, "higher");
  assert.equal(created[0].create.name, "18 Diamonds");
  assert.equal(created[0].create.priceIDR, 4620);
  changes.length = 0;
  await reconcileSupplierReplacements(db as unknown as Parameters<typeof reconcileSupplierReplacements>[0], [source], [{ ...original, status: "available" }, ...rows]);
  assert.deepEqual(changes, [{ where: { replacementForId: "variant" }, data: { published: false } }]);
});

test("does not substitute unavailable stock, another game, or a promotional package", () => {
  assert.equal(selectDiamondReplacement(original, [
    { ...candidate("other-game", 17, 10), category_code: "other" },
    { ...candidate("empty", 17, 10), status: "empty" },
    { ...candidate("pass", 17, 10), name: "17 Diamonds Weekly Pass" },
  ]), null);
});
