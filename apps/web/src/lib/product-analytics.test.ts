import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductFunnelReport,
  hashProductVisitorId,
  isProductAnalyticsEventType,
} from "./product-analytics.ts";

test("validates events and hashes visitor IDs without retaining the raw ID", () => {
  assert.equal(isProductAnalyticsEventType("VIEW"), true);
  assert.equal(isProductAnalyticsEventType("UNKNOWN"), false);
  const hash = hashProductVisitorId(
    "550e8400-e29b-41d4-a716-446655440000",
    "test-secret-with-at-least-thirty-two-characters",
  );
  assert.equal(hash.length, 64);
  assert.equal(hash.includes("550e8400"), false);
});

test("identifies observable pre-checkout and payment abandonment", () => {
  const preCheckout = buildProductFunnelReport(
    [
      { productId: "p1", visitorHash: "a", eventType: "VIEW" },
      { productId: "p1", visitorHash: "b", eventType: "VIEW" },
      { productId: "p1", visitorHash: "c", eventType: "VIEW" },
      { productId: "p1", visitorHash: "d", eventType: "VIEW" },
      { productId: "p1", visitorHash: "e", eventType: "VARIANT_SELECTED" },
    ],
    new Map([["p1", 0]]),
  ).get("p1");
  assert.match(preCheckout?.conclusion || "", /SKU/i);

  const paymentAbandon = buildProductFunnelReport(
    [
      { productId: "p2", visitorHash: "a", eventType: "VIEW" },
      { productId: "p2", visitorHash: "a", eventType: "PAYMENT_CREATED" },
      { productId: "p2", visitorHash: "b", eventType: "PAYMENT_CREATED" },
    ],
    new Map([["p2", 0]]),
  ).get("p2");
  assert.match(paymentAbandon?.conclusion || "", /belum dibayar/i);
});
