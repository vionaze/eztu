import assert from "node:assert/strict";
import test from "node:test";
import {
  getMarketPaymentPolicy,
  isIndonesiaMarket,
  normalizeMarketCode,
} from "./payment-market.ts";

test("Indonesian and unknown markets only get WinPay", () => {
  assert.equal(isIndonesiaMarket("id"), true);
  assert.equal(isIndonesiaMarket("ID "), true);
  assert.equal(isIndonesiaMarket(""), true);
  assert.equal(isIndonesiaMarket(null), true);
  const policy = getMarketPaymentPolicy("id");
  assert.equal(policy.cryptoAllowed, false);
  assert.equal(policy.cryptoPreferred, false);
});

test("international markets keep every method and prefer crypto", () => {
  for (const code of ["sg", "my", "us", "de"]) {
    const policy = getMarketPaymentPolicy(code);
    assert.equal(policy.isIndonesia, false);
    assert.equal(policy.cryptoAllowed, true);
    assert.equal(policy.cryptoPreferred, true);
  }
});

test("normalizes market codes", () => {
  assert.equal(normalizeMarketCode(" SG "), "sg");
  assert.equal(normalizeMarketCode(undefined), "");
});
