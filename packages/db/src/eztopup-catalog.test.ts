import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateSellPriceIDR,
  parseCatalogSheetRows,
} from "./eztopup-catalog.ts";

test("uses global 10% non-crypto and 12% crypto markup", () => {
  assert.equal(calculateSellPriceIDR(10_001, "NON_CRYPTO"), 11_002);
  assert.equal(calculateSellPriceIDR(10_001, "CRYPTO"), 11_202);
});

test("normalizes an Indonesia top-up row with exact SKU and local image", () => {
  const rows = [
    [
      "Category Name",
      "Product Name",
      "Product code",
      "Recommended Price",
      "Price reseller",
    ],
    ["Mobile Legends", "17 Diamonds", "ML15_2-S121", 4_800, 4_488],
  ];

  const result = parseCatalogSheetRows("indonesia ML", rows);

  assert.equal(result.items.length, 1);
  assert.deepEqual(result.items[0], {
    productKey: "mobile-legends",
    productName: "Mobile Legends",
    productImage: "/mlbb.webp",
    categorySlug: "game-top-up",
    fulfillmentType: "TOP_UP",
    requiresServerId: true,
    globalAvailability: false,
    countryCode: "id",
    supplierSku: "ML15_2-S121",
    variantName: "17 Diamonds",
    supplierCostIDR: 4_488,
    supplierStatus: "available",
  });
});

test("marks Mobile Legends Global as worldwide while retaining Indonesia supplier country", () => {
  const rows = [
    ["Country", "Category Code", "Product Code", "Product Name", "MODAL"],
    ["Indonesia", "MLGLO", "MLGLO86-S1", "86 Diamonds", 25_000],
  ];

  const result = parseCatalogSheetRows("ML Global", rows);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.productKey, "mobile-legends-global");
  assert.equal(result.items[0]?.globalAvailability, true);
  assert.equal(result.items[0]?.countryCode, "id");
});

test("accepts header aliases and country-specific voucher rows", () => {
  const rows = [
    [
      "Country",
      "Category Code",
      "Category Name",
      "Variant",
      "Product Code",
      "Product Name",
      "MODAL Reseller Price",
      "Status",
    ],
    [
      "Singapore",
      "VSTEAM",
      "Steam Gift Card",
      "VOUCHER",
      "STEAMSGD5-S22-sg",
      "Steam Wallet SGD 5",
      68_003,
      "available",
    ],
  ];

  const result = parseCatalogSheetRows("STEAM", rows);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.productKey, "steam");
  assert.equal(result.items[0]?.productImage, "/steam.webp");
  assert.equal(result.items[0]?.categorySlug, "game-vouchers");
  assert.equal(result.items[0]?.countryCode, "sg");
  assert.equal(result.items[0]?.supplierCostIDR, 68_003);
});

test("rejects blank, repeated-header, and unknown product rows", () => {
  const rows = [
    ["Country", "Product Code", "Product Name", "MODAL Reseller Price"],
    [null, null, null, null],
    ["Country", "Product Code", "Product Name", "MODAL Reseller Price"],
    ["Indonesia", "ROB100-S1", "Robux 100", 15_000],
  ];

  const result = parseCatalogSheetRows("ROBLOX", rows);

  assert.equal(result.items.length, 0);
  assert.equal(result.skipped.length, 3);
});
