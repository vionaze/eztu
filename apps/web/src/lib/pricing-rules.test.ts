import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePriceWithMarkupBps,
  isSupplierPurchasable,
} from "./pricing-rules.ts";

test("calculates checkout prices from the variant markup", () => {
  assert.equal(calculatePriceWithMarkupBps(10_001, 850), 10_852);
  assert.equal(calculatePriceWithMarkupBps(10_001, 1_050), 11_052);
});

test("only an available supplier SKU is purchasable", () => {
  assert.equal(isSupplierPurchasable("available"), true);
  assert.equal(isSupplierPurchasable("AVAILABLE"), true);
  assert.equal(isSupplierPurchasable("empty"), false);
  assert.equal(isSupplierPurchasable(null), false);
});
