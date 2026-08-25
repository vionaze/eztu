import assert from "node:assert/strict";
import test from "node:test";
import {
  getDetectedMarketCode,
  getProductVariantsForMarket,
  isProductExcludedFromMarket,
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

test("the Global storefront hides regional products and exposes global products", () => {
  const regionalProduct = { globalAvailability: false, variants };
  const globalProduct = {
    globalAvailability: true,
    variants: [{ id: "global-id-sku", countryCode: "id" }],
  };

  assert.deepEqual(getProductVariantsForMarket(regionalProduct, "global"), []);
  assert.equal(isProductAvailableInMarket(regionalProduct, "global"), false);
  assert.equal(isProductAvailableInMarket(globalProduct, "global"), true);
});

test("Roblox-style global products remain unavailable in excluded markets", () => {
  const globalExceptVietnam = {
    globalAvailability: true,
    unavailableMarketCodes: ["vn"],
    variants: [{ id: "roblox-id-sku", countryCode: "id" }],
  };

  assert.equal(isProductAvailableInMarket(globalExceptVietnam, "us"), true);
  assert.equal(isProductAvailableInMarket(globalExceptVietnam, "sg"), true);
  assert.equal(isProductAvailableInMarket(globalExceptVietnam, "VN"), false);
  assert.deepEqual(getProductVariantsForMarket(globalExceptVietnam, "vn"), []);
});

test("normalizes the detected request market for server-side enforcement", () => {
  const headers = new Headers({ "cf-ipcountry": "VN" });
  const marketCode = getDetectedMarketCode(headers);

  assert.equal(marketCode, "vn");
  assert.equal(
    isProductExcludedFromMarket({ unavailableMarketCodes: ["vn"] }, marketCode),
    true,
  );
});
