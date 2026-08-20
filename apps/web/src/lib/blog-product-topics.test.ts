import assert from "node:assert/strict";
import test from "node:test";
import {
  BLOG_PRODUCT_DEFINITIONS,
  CATALOG_BLOG_MARKETS,
  createDefaultProductMarketSettings,
  getEnabledBlogMarkets,
  getEligibleBlogProducts,
  normalizeProductMarketSettings,
  selectBlogProductForMarket,
} from "./blog-product-topics.ts";

test("uses the eleven markets present in EZ All Products", () => {
  assert.deepEqual(CATALOG_BLOG_MARKETS, [
    "BR",
    "DE",
    "GB",
    "ID",
    "MY",
    "PH",
    "SA",
    "SG",
    "TH",
    "US",
    "VN",
  ]);
});

test("defines every catalog product and restricts Valorant to Indonesia", () => {
  assert.equal(BLOG_PRODUCT_DEFINITIONS.length, 10);
  const valorant = BLOG_PRODUCT_DEFINITIONS.find(
    (product) => product.key === "valorant",
  );
  assert.deepEqual(valorant?.markets, ["ID"]);

  const defaults = createDefaultProductMarketSettings();
  assert.deepEqual(defaults.valorant, ["ID"]);
  assert.deepEqual(defaults.steam, ["BR", "DE", "ID", "MY", "PH", "SG", "TH", "US", "VN"]);
});

test("normalizes saved settings and preserves an explicit disabled product", () => {
  const settings = normalizeProductMarketSettings({
    valorant: ["ID", "US"],
    steam: [],
    unknown: ["ID"],
  });

  assert.deepEqual(settings.valorant, ["ID"]);
  assert.deepEqual(settings.steam, []);
  assert.equal("unknown" in settings, false);
  assert.deepEqual(settings["free-fire"], ["ID", "MY", "PH", "SG", "TH"]);
});

test("selects only products enabled for a market and avoids recent products", () => {
  const settings = createDefaultProductMarketSettings();
  settings["mobile-legends"] = [];

  const indonesia = getEligibleBlogProducts("ID", settings);
  assert.equal(indonesia.some((product) => product.key === "mobile-legends"), false);
  assert.equal(indonesia.some((product) => product.key === "valorant"), true);
  assert.deepEqual(
    getEligibleBlogProducts("VN", settings).map((product) => product.key),
    ["steam"],
  );

  const first = selectBlogProductForMarket("BR", settings, []);
  assert.ok(first);
  const second = selectBlogProductForMarket("BR", settings, [
    `${first?.name}: regional guide`,
  ]);
  assert.ok(second);
  assert.notEqual(second?.key, first?.key);
});

test("intersects global auto markets with enabled product combinations", () => {
  const settings = createDefaultProductMarketSettings();
  for (const product of BLOG_PRODUCT_DEFINITIONS) {
    settings[product.key] = settings[product.key].filter(
      (market) => market !== "US",
    );
  }

  assert.deepEqual(
    getEnabledBlogMarkets(["ID", "US", "GLOBAL", "DE", "ID"], settings),
    ["ID", "DE"],
  );
});
