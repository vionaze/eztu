import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionResellerStatus,
  resellerDisplayStatus,
  slugifyReseller,
} from "./reseller-utils.ts";

test("slugifies reseller organization names consistently", () => {
  assert.equal(slugifyReseller("  Toko Éxample & Co.  "), "toko-example-co");
  assert.equal(slugifyReseller("B2B Store__ID"), "b2b-store-id");
  assert.equal(slugifyReseller("!!!"), "");
});

test("maps reseller statuses to user-facing labels", () => {
  assert.equal(resellerDisplayStatus("PENDING"), "Pending approval");
  assert.equal(resellerDisplayStatus("ACTIVE"), "Active");
  assert.equal(resellerDisplayStatus("REJECTED"), "Rejected");
  assert.equal(resellerDisplayStatus("SUSPENDED"), "Suspended");
});

test("allows only intentional reseller status transitions", () => {
  assert.equal(canTransitionResellerStatus("PENDING", "ACTIVE"), true);
  assert.equal(canTransitionResellerStatus("PENDING", "REJECTED"), true);
  assert.equal(canTransitionResellerStatus("REJECTED", "SUSPENDED"), false);
  assert.equal(canTransitionResellerStatus("ACTIVE", "SUSPENDED"), true);
  assert.equal(canTransitionResellerStatus("SUSPENDED", "ACTIVE"), true);
});
