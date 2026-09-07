import test from "node:test";
import assert from "node:assert/strict";
import { privateShopActor, selectedShopOption, validShopSecret } from "./telegram-shop-protocol.ts";

test("authenticated private-chat selection resolves its server-side SKU", () => {
  assert.equal(validShopSecret("test-secret", "test-secret"), true);
  assert.equal(privateShopActor({ update_id: 10, message: { from: { id: 42 }, chat: { id: 42, type: "private" } } }), "42");
  assert.equal(selectedShopOption({ nonce: "current", options: ["sku-1"] }, "pick:current:0"), "sku-1");
});

test("forged access and stale selections cannot identify a customer or SKU", () => {
  assert.equal(validShopSecret("wrong", "test-secret"), false);
  assert.equal(validShopSecret(null, undefined), false);
  assert.equal(privateShopActor({ update_id: 11, message: { from: { id: 42 }, chat: { id: 43, type: "private" } } }), null);
  assert.equal(selectedShopOption({ nonce: "current", options: ["sku-1"] }, "pick:old:0"), null);
});
