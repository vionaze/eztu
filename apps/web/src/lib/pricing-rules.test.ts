import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePaymentPriceIDR,
  getPricingMarkupBps,
  isSupplierPurchasable,
} from "./pricing-rules.ts";

test("Pakasir uses 10% and crypto uses 12%", () => {
  assert.equal(getPricingMarkupBps("pakasir"), 1000);
  assert.equal(getPricingMarkupBps("crypto"), 1200);
  assert.equal(calculatePaymentPriceIDR(10_001, "pakasir"), 11_002);
  assert.equal(calculatePaymentPriceIDR(10_001, "crypto"), 11_202);
});

test("only an available supplier SKU is purchasable", () => {
  assert.equal(isSupplierPurchasable("available"), true);
  assert.equal(isSupplierPurchasable("AVAILABLE"), true);
  assert.equal(isSupplierPurchasable("empty"), false);
  assert.equal(isSupplierPurchasable(null), false);
});
