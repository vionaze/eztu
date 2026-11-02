import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Script } from "node:vm";
import test from "node:test";

const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const ts = require("typescript");
const source = readFileSync(
  new URL("../apps/web/src/lib/alert-throttle.ts", import.meta.url),
  "utf8"
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function load() {
  const exports = {};
  new Script(compiled).runInNewContext({ exports, Date, Map });
  return exports;
}

// 2026-11-02 22:26 WIB — the moment the bot hit /api/payment/create 20 times.
const T0 = Date.parse("2026-11-02T15:26:00.000Z");
const bot = { eventType: "checkout_create", ip: "192.25.102.65" };

test("first blocked checkout notifies", () => {
  const { takeAlertSlot } = load();
  assert.equal(takeAlertSlot(bot, T0), "send");
});

test("the same bot repeating 20 times produces one alert, not 20", () => {
  const { takeAlertSlot } = load();
  const slots = [takeAlertSlot(bot, T0)];
  for (let i = 1; i < 20; i++) slots.push(takeAlertSlot(bot, T0 + i * 1000));

  assert.equal(slots[0], "send");
  assert.deepEqual(slots.slice(1), Array(19).fill("cooldown"));
});

test("a different IP or a different event still notifies", () => {
  const { takeAlertSlot } = load();
  assert.equal(takeAlertSlot(bot, T0), "send");
  assert.equal(takeAlertSlot({ ...bot, ip: "203.0.113.9" }, T0), "send");
  assert.equal(
    takeAlertSlot({ ...bot, eventType: "supplier_callback_invalid_token" }, T0),
    "send"
  );
});

test("notifications resume after the cooldown window", () => {
  const { takeAlertSlot } = load();
  assert.equal(takeAlertSlot(bot, T0), "send");
  assert.equal(takeAlertSlot(bot, T0 + 9 * 60 * 1000), "cooldown");
  assert.equal(takeAlertSlot(bot, T0 + 10 * 60 * 1000), "send");
});

test("rotating IPs hit the global cap instead of flooding the channel", () => {
  const { takeAlertSlot } = load();
  for (let i = 0; i < 20; i++) {
    assert.equal(takeAlertSlot({ ...bot, ip: `198.51.100.${i}` }, T0), "send");
  }
  assert.equal(takeAlertSlot({ ...bot, ip: "198.51.100.200" }, T0), "flood");
  assert.equal(
    takeAlertSlot({ ...bot, ip: "198.51.100.201" }, T0 + 10 * 60 * 1000),
    "send"
  );
});
