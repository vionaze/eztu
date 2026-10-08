import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRequestFingerprint,
  canAdvanceIntent,
  mapNormalizedStatus,
  signB2BQuote,
  validateB2BLines,
  verifyB2BQuote,
  type B2BQuotePayload,
} from "./b2b-order-rules.ts";

const secret = "test-secret-with-at-least-thirty-two-characters";
const payload: B2BQuotePayload = {
  v: 1,
  ch: "RESELLER_B2B",
  org: "org-1",
  user: "user-1",
  fp: "fingerprint",
  exp: new Date(Date.now() + 60_000).toISOString(),
  totalIDR: 1_000_000,
  lines: [{
    variantId: "v1",
    supplierSku: "SKU-1",
    countryCode: "id",
    productName: "Product",
    variantName: "Package",
    quantity: 1,
    unitPriceIDR: 1_000_000,
    supplierCostIDR: 900_000,
    ruleId: "rule-1",
    ruleRevision: 1,
    mode: "MARKUP",
    markupMicros: 111111,
    fixedPriceIDR: null,
  }],
};

test("quote tokens round-trip and reject tampering", () => {
  const token = signB2BQuote(payload, secret);
  assert.deepEqual(verifyB2BQuote(token, new Date(), secret), payload);
  const [body, signature] = token.split(".");
  assert.equal(verifyB2BQuote(`${body}.${signature.slice(0, -2)}xx`, new Date(), secret), null);
  const flipped = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  flipped.totalIDR = 1;
  const tampered = `${Buffer.from(JSON.stringify(flipped)).toString("base64url")}.${signature}`;
  assert.equal(verifyB2BQuote(tampered, new Date(), secret), null);
});

test("expired, malformed and foreign quotes are rejected", () => {
  const expired = signB2BQuote({ ...payload, exp: new Date(Date.now() - 1000).toISOString() }, secret);
  assert.equal(verifyB2BQuote(expired, new Date(), secret), null);
  assert.equal(verifyB2BQuote("garbage", new Date(), secret), null);
  const consumer = signB2BQuote({ ...payload, ch: "CONSUMER" as never }, secret);
  assert.equal(verifyB2BQuote(consumer, new Date(), secret), null);
});

test("line validation enforces caps and duplicates", () => {
  assert.equal(validateB2BLines([]).ok, false);
  assert.equal(validateB2BLines([{ variantId: "a", quantity: 0 }]).ok, false);
  assert.equal(validateB2BLines([{ variantId: "a", quantity: 21 }]).ok, false);
  assert.equal(validateB2BLines([{ variantId: "a", quantity: 1 }, { variantId: "a", quantity: 2 }]).ok, false);
  const ok = validateB2BLines([{ variantId: "a", quantity: 2 }, { variantId: "b", quantity: 20 }]);
  assert.equal(ok.ok, true);
});

test("request fingerprints are order-independent and payload-sensitive", () => {
  const a = buildRequestFingerprint("org-1", [{ variantId: "a", quantity: 1 }, { variantId: "b", quantity: 2 }], "CRYPTO");
  const b = buildRequestFingerprint("org-1", [{ variantId: "b", quantity: 2 }, { variantId: "a", quantity: 1 }], "CRYPTO");
  assert.equal(a, b);
  assert.notEqual(a, buildRequestFingerprint("org-1", [{ variantId: "a", quantity: 2 }, { variantId: "b", quantity: 2 }], "CRYPTO"));
  assert.notEqual(a, buildRequestFingerprint("org-1", [{ variantId: "a", quantity: 1 }, { variantId: "b", quantity: 2 }], "PAKASIR"));
  assert.notEqual(a, buildRequestFingerprint("org-2", [{ variantId: "a", quantity: 1 }, { variantId: "b", quantity: 2 }], "CRYPTO"));
});

test("intent statuses only move forward", () => {
  assert.equal(canAdvanceIntent("PENDING", "PAID"), true);
  assert.equal(canAdvanceIntent("PENDING", "FAILED"), true);
  assert.equal(canAdvanceIntent("PENDING", "EXPIRED"), true);
  assert.equal(canAdvanceIntent("PENDING", "PENDING"), false);
  assert.equal(canAdvanceIntent("PAID", "FAILED"), false);
  assert.equal(canAdvanceIntent("PAID", "PAID"), false);
  assert.equal(canAdvanceIntent("FAILED", "PAID"), false);
  assert.equal(canAdvanceIntent("REVIEW", "PAID"), false);
  assert.equal(mapNormalizedStatus("paid"), "PAID");
  assert.equal(mapNormalizedStatus("refunded"), "REVIEW");
  assert.equal(mapNormalizedStatus("processing"), "PENDING");
});
