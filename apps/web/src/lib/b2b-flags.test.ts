import assert from "node:assert/strict";
import test from "node:test";
import { evaluateOrderingEnabled, isB2BOrderingEnabled } from "./b2b-flags.ts";

const base = { organizationId: "org-1", organizationFlag: false, globalDisabled: false, allowlist: "" };

test("the global kill switch always wins, even over an enabled organization", () => {
  assert.equal(evaluateOrderingEnabled({ ...base, globalDisabled: true, organizationFlag: true }), false);
  assert.equal(evaluateOrderingEnabled({ ...base, globalDisabled: true, allowlist: "org-1" }), false);
});

test("the per-organization admin flag is the primary control", () => {
  assert.equal(evaluateOrderingEnabled({ ...base, organizationFlag: true }), true);
  assert.equal(evaluateOrderingEnabled({ ...base, organizationFlag: true, allowlist: "other-org" }), true);
});

test("the env allowlist stays as a pilot escape hatch", () => {
  assert.equal(evaluateOrderingEnabled({ ...base, allowlist: "org-2, org-1" }), true);
  assert.equal(evaluateOrderingEnabled({ ...base, allowlist: "org-2" }), false);
  assert.equal(evaluateOrderingEnabled({ ...base, allowlist: "" }), false);
});

test("readers default to disabled when nothing is configured", () => {
  delete process.env.B2B_ORDERING_DISABLED;
  delete process.env.B2B_ORDERING_ORG_IDS;
  assert.equal(isB2BOrderingEnabled("org-1"), false);
  assert.equal(isB2BOrderingEnabled("org-1", true), true);
  process.env.B2B_ORDERING_DISABLED = "true";
  assert.equal(isB2BOrderingEnabled("org-1", true), false);
  delete process.env.B2B_ORDERING_DISABLED;
});
