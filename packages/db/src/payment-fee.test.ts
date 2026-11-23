import assert from "node:assert/strict";
import test from "node:test";
import { applyIdrPaymentFee, IDR_PAYMENT_FEE_BPS } from "./payment-fee.ts";

test("bakes the 0,7% WinPay fee into IDR prices", () => {
  assert.equal(IDR_PAYMENT_FEE_BPS, 70);
  assert.equal(applyIdrPaymentFee(100_000), 100_700);
  assert.equal(applyIdrPaymentFee(1_238_593), 1_247_264);
});

test("rounds up so the merchant never eats the fee", () => {
  assert.equal(applyIdrPaymentFee(1), 2);
  assert.equal(applyIdrPaymentFee(0), 0);
  assert.throws(() => applyIdrPaymentFee(-1), /non-negative/);
});
