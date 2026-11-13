import test from "node:test";
import assert from "node:assert/strict";
import {
  isIdrPaymentProvider,
  paymentProviderLabel,
  resolveProviderAmount,
} from "./payment-provider.ts";

test("treats both Indonesian providers as IDR", () => {
  assert.equal(isIdrPaymentProvider("winpay"), true);
  assert.equal(isIdrPaymentProvider("pakasir"), true);
  assert.equal(isIdrPaymentProvider("cryptomus"), false);
  assert.equal(isIdrPaymentProvider(null), false);
  assert.equal(isIdrPaymentProvider(undefined), false);
});

test("labels every provider including legacy rows", () => {
  assert.equal(paymentProviderLabel("winpay"), "WinPay");
  assert.equal(paymentProviderLabel("pakasir"), "Pakasir");
  assert.equal(paymentProviderLabel("cryptomus"), "Cryptomus");
  assert.equal(paymentProviderLabel(null), "—");
});

test("reads the verified IDR amount from the provider payload", () => {
  assert.deepEqual(
    resolveProviderAmount({ provider: "winpay", raw: {}, payAmount: 25_000 }),
    { amount: 25_000, currency: "IDR" },
  );
  assert.deepEqual(
    resolveProviderAmount({
      provider: "pakasir",
      raw: { amount: 22_000 },
      payAmount: null,
    }),
    { amount: 22_000, currency: "IDR" },
  );
  assert.deepEqual(
    resolveProviderAmount({
      provider: "cryptomus",
      raw: { price_amount: "12.50" },
      payAmount: null,
    }),
    { amount: 12.5, currency: "USD" },
  );
  assert.equal(resolveProviderAmount({ provider: "winpay", raw: {} }), null);
});
