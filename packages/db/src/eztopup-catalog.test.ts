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
    unavailableMarketCodes: [],
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

test("parses Roblox voucher SKU with live supplier cost and margin headers", () => {
  const rows = [
    [
      "Country",
      "Category Code",
      "Variant",
      "Product Code",
      "Product Name",
      "Reseller Price",
      "MARGIN NON CRYPTO",
      "MARGIN CRYPTO",
    ],
    [
      "Indonesia",
      "ROB",
      "VOUCHER",
      "ROB50IDR-S22",
      "Roblox Gift Card IDR 50K",
      "Ikutin price terbaru",
      0.04,
      0.06,
    ],
  ];

  const result = parseCatalogSheetRows("ROBLOX FOR EZ FINAL PRICE", rows);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.productKey, "roblox-gift-card");
  assert.equal(result.items[0]?.categorySlug, "game-vouchers");
  assert.equal(result.items[0]?.globalAvailability, true);
  assert.deepEqual(result.items[0]?.unavailableMarketCodes, ["vn"]);
  assert.equal(result.items[0]?.supplierCostIDR, null);
  assert.equal(result.items[0]?.nonCryptoMarkupBps, 400);
  assert.equal(result.items[0]?.cryptoMarkupBps, 600);
});

test("parses League of Legends PC top-up SKU by market", () => {
  const rows = [
    [
      "Country",
      "Category Code",
      "Variant",
      "Product Code",
      "Product Name",
      "Reseller Price",
      "MARGIN NON CRYPTO",
      "MARGIN CRYPTO",
    ],
    [
      "Philippines",
      "LOLPC",
      "DIGITAL",
      "LOLPC575-S10-ph",
      "575 RP",
      "ikutin harga update aja",
      0.06,
      0.085,
    ],
  ];

  const result = parseCatalogSheetRows("LEAGUE OF LEGENDS PC", rows);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.productKey, "league-of-legends-pc");
  assert.equal(result.items[0]?.categorySlug, "game-top-up");
  assert.equal(result.items[0]?.countryCode, "ph");
  assert.equal(result.items[0]?.nonCryptoMarkupBps, 600);
  assert.equal(result.items[0]?.cryptoMarkupBps, 850);
});

test("parses Mexico Riot gift card with duplicated legacy margin headers", () => {
  const rows = [
    [
      "Country",
      "Category Code",
      "Variant",
      "Product Code",
      "Product Name",
      "Reseller Price",
      "Status",
      "MARGIN NON CRYPTO",
      "MARGIN NON CRYPTO",
    ],
    [
      "Mexico",
      "RPGC",
      "VOUCHER",
      "RPGCMXN99-S16-mx",
      "Riot Access 99 MXN",
      "ikutin harga update aja",
      "available",
      0.05,
      0.07,
    ],
  ];

  const result = parseCatalogSheetRows("RIOT GAMES", rows);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.productKey, "riot-points-gift-card");
  assert.equal(result.items[0]?.categorySlug, "game-vouchers");
  assert.equal(result.items[0]?.countryCode, "mx");
  assert.equal(result.items[0]?.nonCryptoMarkupBps, 500);
  assert.equal(result.items[0]?.cryptoMarkupBps, 700);
});

test("parses Binance gift card SKU with live supplier cost and exact margins", () => {
  const rows = [
    [
      "Country",
      "Category Code",
      "Category Name",
      "Variant",
      "Group Product Code",
      "Product Code",
      "Product Name",
      "SLA In Mins",
      "Margin non crypto",
      "margin Crypto",
    ],
    [
      "Malaysia",
      "BNGC",
      "Binance Gift Card",
      "VOUCHER",
      "BNGCBTC20",
      "BNGCBTC20-S16-my",
      "Binance BTC Gift Card 20 USD",
      "INSTANT",
      0.1086,
      0.1386,
    ],
  ];

  const result = parseCatalogSheetRows("binance gift card", rows);

  assert.equal(result.items.length, 1);
  assert.deepEqual(result.items[0], {
    productKey: "binance-gift-card",
    productName: "Binance Gift Card",
    productImage: "/binance-gift-card.webp",
    categorySlug: "game-vouchers",
    fulfillmentType: "VOUCHER",
    requiresServerId: false,
    globalAvailability: false,
    unavailableMarketCodes: [],
    countryCode: "my",
    supplierSku: "BNGCBTC20-S16-my",
    variantName: "Binance BTC Gift Card 20 USD",
    supplierCostIDR: null,
    supplierStatus: "available",
    nonCryptoMarkupBps: 1_086,
    cryptoMarkupBps: 1_386,
  });
});

test("keeps Riot rows without workbook margins inactive", () => {
  const rows = [
    [
      "Country",
      "Category Code",
      "Variant",
      "Product Code",
      "Product Name",
      "Reseller Price",
      "MARGIN NON CRYPTO",
      "MARGIN CRYPTO",
    ],
    ["Indonesia", "LOL", "DIGITAL", "LOL425-S10", "425 Cores", 51_623, null, null],
  ];

  const result = parseCatalogSheetRows("LEAGUE OF LEGENDS PC", rows);

  assert.equal(result.items.length, 0);
  assert.equal(result.skipped.length, 1);
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
    ["Indonesia", "UNKNOWN100-S1", "Unknown 100", 15_000, 0.1, 0.12],
  ];

  const result = parseCatalogSheetRows("UNKNOWN", rows);

  assert.equal(result.items.length, 0);
  assert.equal(result.skipped.length, 3);
});
