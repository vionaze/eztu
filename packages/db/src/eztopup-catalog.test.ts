import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateSellPriceIDR,
  parseCatalogSheetRows,
} from "./eztopup-catalog.ts";

test("calculates prices from an explicit per-SKU markup", () => {
  assert.equal(calculateSellPriceIDR(10_001, 850), 10_852);
  assert.equal(calculateSellPriceIDR(10_001, 1_050), 11_052);
});

test("normalizes an Indonesia top-up row with exact SKU and local image", () => {
  const rows = [
    [
      "Category Name",
      "Product Name",
      "Product code",
      "Recommended Price",
      "Price reseller",
      "PRICE DYNAMIC NON CRYPTO",
      "PRICE DYNAMIC CRYPTO",
    ],
    [
      "Mobile Legends",
      "17 Diamonds",
      "ML15_2-S121",
      4_800,
      4_488,
      0.085,
      0.105,
    ],
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
    nonCryptoMarkupBps: 850,
    cryptoMarkupBps: 1_050,
  });
});

test("marks Mobile Legends Global as worldwide while retaining Indonesia supplier country", () => {
  const rows = [
    [
      "Country",
      "Category Code",
      "Product Code",
      "Product Name",
      "MODAL",
      "PRICE DYNAMIC NON CRYPTO",
      "PRICE DYNAMIC CRYPTO",
    ],
    [
      "Indonesia",
      "MLGLO",
      "MLGLO86-S1",
      "86 Diamonds",
      25_000,
      0.0725,
      0.0925,
    ],
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
      "DYNAMIC PRICING NON CRYPTO",
      "DYNAMIC PRICING CRYPTO",
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
      0.0575,
      0.0775,
    ],
  ];

  const result = parseCatalogSheetRows("STEAM", rows);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.productKey, "steam");
  assert.equal(result.items[0]?.productImage, "/steam.webp");
  assert.equal(result.items[0]?.categorySlug, "game-vouchers");
  assert.equal(result.items[0]?.countryCode, "sg");
  assert.equal(result.items[0]?.supplierCostIDR, 68_003);
  assert.equal(result.items[0]?.nonCryptoMarkupBps, 575);
  assert.equal(result.items[0]?.cryptoMarkupBps, 775);
});

test("reads the duplicated legacy Mobile Legends headers in column order", () => {
  const rows = [
    [
      "Country",
      "Category Code",
      "Product Code",
      "Product Name",
      "MODAL",
      "DYNAMIC NON CRYPTO",
      "DYNAMIC NON CRYPTO ",
    ],
    ["Singapore", "ML", "ML51_5-S1-sg", "56 Diamonds", 16_536, 0.1, 0.12],
  ];

  const result = parseCatalogSheetRows("singapore ML", rows);

  assert.equal(result.items[0]?.nonCryptoMarkupBps, 1_000);
  assert.equal(result.items[0]?.cryptoMarkupBps, 1_200);
});

test("derives crypto as non-crypto plus two percentage points when crypto is blank", () => {
  const rows = [
    [
      "Country",
      "Category Code",
      "Product Code",
      "Product Name",
      "MODAL Reseller Price",
      "DYNAMIC PRICING NON CRYPTO",
      "DYNAMIC PRICING CRYPTO",
    ],
    ["United States", "VXBOX", "XBOXUSD10-S16-us", "Xbox $10", 167_725, 0.073185, null],
  ];

  const result = parseCatalogSheetRows("XBOX", rows);

  assert.equal(result.items[0]?.nonCryptoMarkupBps, 732);
  assert.equal(result.items[0]?.cryptoMarkupBps, 932);
});

test("inherits a uniform game-sheet markup when a product row is blank", () => {
  const rows = [
    [
      "Country",
      "Category Code",
      "Product Code",
      "Product Name",
      "MODAL",
      "DYNAMIC PRICING NON CRYPTO",
      "DYNAMIC PRICING CRYPTO",
    ],
    ["Malaysia", "ML", "ML14-S1-my", "14 Diamonds", 4_123, 0.115, 0.135],
    ["Malaysia", "ML", "MLPASS-S1-my", "Weekly Pass", 35_304, null, null],
  ];

  const result = parseCatalogSheetRows("malaysia ML", rows);

  assert.equal(result.items.length, 2);
  assert.equal(result.items[1]?.nonCryptoMarkupBps, 1_150);
  assert.equal(result.items[1]?.cryptoMarkupBps, 1_350);
});

test("rejects blank, repeated-header, and unknown product rows", () => {
  const rows = [
    [
      "Country",
      "Product Code",
      "Product Name",
      "MODAL Reseller Price",
      "DYNAMIC PRICING NON CRYPTO",
      "DYNAMIC PRICING CRYPTO",
    ],
    [null, null, null, null],
    ["Country", "Product Code", "Product Name", "MODAL Reseller Price"],
    ["Indonesia", "ROB100-S1", "Robux 100", 15_000, 0.1, 0.12],
  ];

  const result = parseCatalogSheetRows("ROBLOX", rows);

  assert.equal(result.items.length, 0);
  assert.equal(result.skipped.length, 3);
});
