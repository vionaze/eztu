import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogItem } from "./eztopup-catalog.ts";
import { hydrateMissingSupplierCosts } from "./supplier-catalog.ts";

function catalogItem(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    productKey: "roblox-gift-card",
    productName: "Roblox Gift Card",
    productImage: "/roblox.png",
    categorySlug: "game-vouchers",
    fulfillmentType: "VOUCHER",
    requiresServerId: false,
    globalAvailability: false,
    unavailableMarketCodes: [],
    countryCode: "id",
    supplierSku: "ROB50IDR-S22",
    variantName: "Roblox Gift Card IDR 50K",
    supplierCostIDR: null,
    supplierStatus: "available",
    nonCryptoMarkupBps: 400,
    cryptoMarkupBps: 600,
    ...overrides,
  };
}

test("hydrates missing cost and status by exact country and SKU", async () => {
  const result = await hydrateMissingSupplierCosts(
    [catalogItem()],
    async (countryCode) => {
      assert.equal(countryCode, "id");
      return [
        {
          code: "ROB50IDR-S22",
          name: "Roblox Gift Card IDR 50K",
          price: 48_250,
          status: "AVAILABLE",
        },
      ];
    },
  );

  assert.equal(result[0]?.supplierCostIDR, 48_250);
  assert.equal(result[0]?.supplierStatus, "available");
});

test("does not call supplier API for rows with workbook cost", async () => {
  let calls = 0;
  const result = await hydrateMissingSupplierCosts(
    [catalogItem({ supplierCostIDR: 50_000 })],
    async () => {
      calls += 1;
      return [];
    },
  );

  assert.equal(calls, 0);
  assert.equal(result[0]?.supplierCostIDR, 50_000);
});

test("fails before import when a required supplier SKU is missing", async () => {
  await assert.rejects(
    hydrateMissingSupplierCosts([catalogItem()], async () => []),
    /Missing supplier SKU id:ROB50IDR-S22/,
  );
});
