import test from "node:test";
import assert from "node:assert/strict";
import { buildSupplierExpansion } from "./supplier-expansion.ts";

const variant = { id: "old", countryCode: "id", supplierSku: "ML17-S1", replacementForId: null,
  nonCryptoMarkupBps: 800, cryptoMarkupBps: 1000, priceIDR: 10800, priceUSD: 0.6 };
const products = [{ id: "ml", slug: "mobile-legends", variants: [variant] }];
const row = { code: "ML17-S1", name: "17 Diamonds", price: 10000, status: "available", category_code: "ML", country_code: "id" };

test("imports every exact SKU with stable IDs, existing margins and inactive stock", () => {
  const catalogs = [{ countryCode: "id", rows: [row, { ...row, code: "ML33-S2", status: "empty" }, { ...row, code: "OTHER", category_code: "UCPUBGM" }] }];
  const result = buildSupplierExpansion(products, catalogs);
  assert.equal(result.changes.length, 2);
  assert.equal(result.changes[0].id, "old");
  assert.equal(result.changes[0].nonCryptoMarkupBps, 800);
  assert.equal(result.changes[1].supplierStatus, "empty");
  assert.equal(result.changes[1].priceIDR, 10800);
  assert.deepEqual(result.summary[0], { productId: "ml", slug: "mobile-legends", total: 2, available: 1, added: 1, unpriced: 0 });
  const updated = [{ ...products[0], variants: result.changes.map(v => ({ ...v, replacementForId: null })) }];
  const rerun = buildSupplierExpansion(updated, catalogs);
  assert.equal(rerun.summary[0].added, 0);
  assert.deepEqual(rerun.changes.map(v => v.id), result.changes.map(v => v.id));
});

test("rejects region fallback and conflicting supplier rows before writes", () => {
  assert.throws(() => buildSupplierExpansion(products, [{ countryCode: "my", rows: [row] }]), /country mismatch/);
  assert.throws(() => buildSupplierExpansion(products, [{ countryCode: "id", rows: [row, { ...row, price: 1 }] }]), /Conflicting supplier SKU/);
  const sentinel = { ...row, price: 2147483647, status: "empty" };
  const result = buildSupplierExpansion(products, [{ countryCode: "id", rows: [sentinel] }]);
  assert.equal(result.changes[0].priceIDR, 0);
  assert.equal(result.changes[0].supplierStatus, "empty");
  assert.equal(result.summary[0].unpriced, 1);
  assert.throws(() => buildSupplierExpansion(products, [{ countryCode: "id", rows: [{ ...sentinel, status: "available" }] }]), /out of range/);
});
