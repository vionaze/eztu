import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Regression guard for the HIGH finding in docs/audits/2026-10-31-security-audit.md:
 * the supplier callback accepted a spoofable "trusted IP + curl UA" combination
 * instead of the token, so anyone able to reach the origin could POST a fake
 * fulfillment snapshot.
 *
 * The bypass was removed from code on 2026-11-02 — it must not come back,
 * including as an env-gated default. These assertions are cheap tripwires.
 */
const routeSource = readFileSync(
  new URL("../apps/web/src/app/api/callback/order/route.ts", import.meta.url),
  "utf8"
);
const envExample = readFileSync(
  new URL("../apps/web/.env.example", import.meta.url),
  "utf8"
);

test("callback route has no trusted-IP / healthcheck token bypass", () => {
  assert.equal(routeSource.includes("isTrustedCallbackHealthcheck"), false);
  assert.equal(routeSource.includes("ORDER_CALLBACK_HEALTHCHECK_IPS"), false);
  assert.equal(routeSource.includes("DEFAULT_CALLBACK_HEALTHCHECK_IPS"), false);
});

test("callback route always validates the token before touching the payload", () => {
  const gate = routeSource.indexOf("isValidCallbackToken(request)");
  const parse = routeSource.indexOf("parseSupplierCallbackPayload(body)");

  assert.notEqual(gate, -1);
  assert.notEqual(parse, -1);
  // Token check must happen before the body is even parsed.
  assert.ok(gate < parse, "token check must precede payload parsing");
  assert.equal(routeSource.includes('message: "FORBIDDEN"'), true);
});

test("env template no longer advertises the bypass IP list", () => {
  assert.equal(envExample.includes("ORDER_CALLBACK_HEALTHCHECK_IPS="), false);
});
