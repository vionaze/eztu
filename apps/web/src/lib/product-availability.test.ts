import assert from "node:assert/strict";
import test from "node:test";
import {
  getProductVariantsForMarket,
  isProductAvailableInMarket,
} from "./product-availability.ts";

const variants = [
  { id: "id-1", countryCode: "id" },
  { id: "sg-1", countryCode: "sg" },
];

test("regional products expose only exact-market variants", () => {
  const product = { globalAvailability: false, variants };
  assert.deepEqual(
    getProductVariantsForMarket(product, "sg").map((variant) => variant.id),
    ["sg-1"],
  );
  assert.equal(isProductAvailableInMarket(product, "us"), false);
});

test("global products expose their supplier variants in every visitor market", () => {
  const globalProduct = {
    globalAvailability: true,
    variants: [{ id: "global-id-sku", countryCode: "id" }],
  };

  assert.deepEqual(
    getProductVariantsForMarket(globalProduct, "us").map(
      (variant) => variant.id,
    ),
    ["global-id-sku"],
  );
  assert.equal(isProductAvailableInMarket(globalProduct, "de"), true);
});
