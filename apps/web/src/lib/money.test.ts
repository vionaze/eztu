import test from "node:test";
import assert from "node:assert/strict";
import {
  idrToUsdCentsCeil,
  usdAmountToCents,
  usdCentsToFixed,
  underpaidUSDCents,
} from "./money.ts";

test("converts IDR to USD cents by rounding only the final total upward", () => {
  assert.equal(idrToUsdCentsCeil(48_800, 18_049), 271);
  assert.equal(usdCentsToFixed(271), "2.71");
});

test("holds any payment below the exact quoted cents", () => {
  assert.equal(underpaidUSDCents(271, 270), 1);
  assert.equal(underpaidUSDCents(271, 271), 0);
  assert.equal(underpaidUSDCents(271, 300), 0);
});

test("converts provider decimal amounts to integer cents", () => {
  assert.equal(usdAmountToCents(2.71), 271);
  assert.equal(usdAmountToCents(3.15), 315);
});
