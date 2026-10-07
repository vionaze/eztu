import assert from "node:assert/strict";
import test from "node:test";
import { calculateResellerPrice, chooseEffectiveRule, formatResellerMarkupPercent, parseResellerMarkupPercent } from "./reseller-pricing.ts";

test("parses and formats five-decimal percentages", () => {
  assert.equal(parseResellerMarkupPercent("1.11111"), 111111);
  assert.equal(parseResellerMarkupPercent("3.33333"), 333333);
  assert.equal(formatResellerMarkupPercent(111111), "1.11111");
});
test("rejects malformed and excessive percentages", () => {
  assert.throws(() => parseResellerMarkupPercent("1.111111"), /INVALID_MARKUP_PERCENT/);
  assert.throws(() => parseResellerMarkupPercent("1000.00001"), /MARKUP_OUT_OF_RANGE/);
});
test("uses integer ceiling math", () => {
  assert.equal(calculateResellerPrice(100, { mode: "MARKUP", markupMicros: 111111, fixedPriceIDR: null, enabled: true }), 102);
});
test("rejects disabled and below-cost fixed rules", () => {
  assert.throws(() => calculateResellerPrice(100, { mode: "MARKUP", markupMicros: 0, fixedPriceIDR: null, enabled: false }), /RESELLER_RULE_DISABLED/);
  assert.throws(() => calculateResellerPrice(100, { mode: "FIXED", markupMicros: null, fixedPriceIDR: 99, enabled: true }), /FIXED_PRICE_BELOW_COST/);
});
test("prefers an organization rule even when disabled", () => {
  const org = { mode: "MARKUP" as const, markupMicros: 0, fixedPriceIDR: null, enabled: false };
  assert.equal(chooseEffectiveRule(org, null), org);
});
