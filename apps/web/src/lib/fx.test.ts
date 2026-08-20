import test from "node:test";
import assert from "node:assert/strict";
import { createPricingQuote, signPricingQuote, verifyPricingQuote } from "./fx.ts";

const secret = "test-secret-with-at-least-thirty-two-characters";
const now = new Date("2026-07-27T12:00:00.000Z");

test("signed pricing quote round-trips and locks price", () => {
  const quote = createPricingQuote({
    variantId: "variant-1",
    quantity: 1,
    unitPriceIDR: 48_800,
    paymentMethod: "pakasir",
    supplierCostIDR: 44_363,
    supplierCountryCode: "id",
    pricingMarkupBps: 1000,
    rate: { usdIdrRate: 18_049, source: "override", quotedAt: now },
    now,
  });
  const token = signPricingQuote(quote, secret);
  assert.equal(quote.version, 2);
  assert.equal(quote.paymentMethod, "pakasir");
  const verified = verifyPricingQuote(
    token,
    {
      variantId: "variant-1",
      quantity: 1,
      unitPriceIDR: 48_800,
      paymentMethod: "pakasir",
      supplierCostIDR: 44_363,
      supplierCountryCode: "id",
      pricingMarkupBps: 1000,
      now,
    },
    secret
  );
  assert.equal(verified.totalUSDCents, 271);
  assert.throws(() =>
    verifyPricingQuote(
      token,
      {
        variantId: "variant-1",
        quantity: 1,
        unitPriceIDR: 48_801,
        paymentMethod: "pakasir",
        supplierCostIDR: 44_363,
        supplierCountryCode: "id",
        pricingMarkupBps: 1000,
        now,
      },
      secret
    )
  );
  assert.throws(() =>
    verifyPricingQuote(
      token,
      {
        variantId: "variant-1",
        quantity: 1,
        unitPriceIDR: 48_800,
        paymentMethod: "crypto",
        supplierCostIDR: 44_363,
        supplierCountryCode: "id",
        pricingMarkupBps: 1000,
        now,
      },
      secret,
    ),
  );
});

test("expired pricing quote is rejected", () => {
  const quote = createPricingQuote({
    variantId: "variant-1",
    quantity: 1,
    unitPriceIDR: 48_800,
    paymentMethod: "crypto",
    supplierCostIDR: 43_571,
    supplierCountryCode: "sg",
    pricingMarkupBps: 1200,
    rate: { usdIdrRate: 18_049, source: "override", quotedAt: now },
    now,
  });
  const token = signPricingQuote(quote, secret);
  assert.throws(() =>
    verifyPricingQuote(
      token,
      {
        variantId: "variant-1",
        quantity: 1,
        unitPriceIDR: 48_800,
        paymentMethod: "crypto",
        supplierCostIDR: 43_571,
        supplierCountryCode: "sg",
        pricingMarkupBps: 1200,
        now: new Date("2026-07-27T12:11:00.000Z"),
      },
      secret
    )
  );
});
