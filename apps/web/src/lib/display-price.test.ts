import test from "node:test";
import assert from "node:assert/strict";
import { getDisplayPriceUSD } from "./display-price.ts";

test("derives the catalog USD price from the Pakasir IDR price and current FX", () => {
  assert.equal(getDisplayPriceUSD(109_946, 7.09, 17_666.414196), 6.23);
});

test("falls back to the imported USD price when current FX is unavailable", () => {
  assert.equal(getDisplayPriceUSD(116_289, 7.09, null), 7.09);
});
