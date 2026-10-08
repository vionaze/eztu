import assert from "node:assert/strict";
import test from "node:test";
import { evaluateResellerMfa } from "./reseller-mfa-policy.ts";

test("first-factor login never satisfies reseller MFA", () => {
  assert.equal(evaluateResellerMfa(true, [0, -1]).verifiedRecently, false);
  assert.equal(evaluateResellerMfa(true, [-1, -1]).verifiedRecently, false);
});

test("TOTP enrollment is required even with second-factor session claims", () => {
  assert.equal(evaluateResellerMfa(false, [0, 0]).verifiedRecently, false);
  assert.equal(evaluateResellerMfa(true, [0, 0]).verifiedRecently, true);
});

test("second-factor verification must be less than ten minutes old", () => {
  assert.equal(evaluateResellerMfa(true, [30, 9]).verifiedRecently, true);
  assert.equal(evaluateResellerMfa(true, [0, 10]).verifiedRecently, false);
  assert.equal(evaluateResellerMfa(true, [0, 100]).verifiedRecently, false);
});

test("missing and malformed factor ages fail closed", () => {
  for (const value of [null, undefined, [], [0], [0, "0"], [0, NaN], [0, Infinity], [0, -2], [0, 0.5], { secondFactor: 0 }]) {
    assert.equal(evaluateResellerMfa(true, value).verifiedRecently, false);
  }
});
