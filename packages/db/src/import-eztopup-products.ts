import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import xlsx from "xlsx";
import {
  calculateSellPriceIDR,
  deduplicateCatalogItems,
  parseCatalogSheetRows,
  type CatalogItem,
} from "./eztopup-catalog.ts";
import {
  hydrateMissingSupplierCosts,
  type PricedCatalogItem,
} from "./supplier-catalog.ts";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = resolve(packageRoot, "../..");
const envFiles = [
  resolve(packageRoot, ".env"),
  resolve(repoRoot, ".env"),
  resolve(repoRoot, "apps/web/.env"),
];

for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    loadEnv({ path: envFile, override: false });
  }
}

const CATEGORIES = {
  "game-top-up": {
    id: "cat-game-top-up",
    name: "Game Top-Up",
    slug: "game-top-up",
    image: "/mlbb.webp",
  },
  "game-vouchers": {
    id: "cat-game-vouchers",
    name: "Game Vouchers",
    slug: "game-vouchers",
    image: "/steam.webp",
  },
} as const;

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getUsdIdrRate() {
  const parsed = Number(process.env.PRODUCT_USD_IDR_RATE || "15500");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15500;
}

function getWorkbookPaths() {
  return [
    process.env.EZTOPUP_PRODUCTS_XLSX ||
      resolve(repoRoot, "data/EZ ALL PRODUCTS.xlsx"),
    process.env.EZTOPUP_SUPPLEMENTAL_PRODUCTS_XLSX ||
      resolve(repoRoot, "data/roblox riot lol.xlsx"),
    process.env.EZTOPUP_BINANCE_PRODUCTS_XLSX ||
      resolve(repoRoot, "data/BINANCE-GIFTCARD.xlsx"),
  ];
}

export function readCatalogWorkbook(
  workbookPaths: string | string[] = getWorkbookPaths(),
) {
  const paths = Array.isArray(workbookPaths) ? workbookPaths : [workbookPaths];
  const parsedItems: CatalogItem[] = [];
  const skipped: string[] = [];

  for (const workbookPath of paths) {
    if (!existsSync(workbookPath)) {
      throw new Error(`EZTopUp workbook not found: ${workbookPath}`);
    }
    const workbook = xlsx.readFile(workbookPath);
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const rows = xlsx.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: null,
        raw: true,
      });
      const parsed = parseCatalogSheetRows(sheetName, rows);
      parsedItems.push(...parsed.items);
      skipped.push(...parsed.skipped);
    }
  }

  const deduplicated = deduplicateCatalogItems(parsedItems);
  return {
    workbookPaths: paths,
    items: deduplicated.items,
    duplicates: deduplicated.duplicates,
    skipped,
  };
}

function groupCatalog<T extends CatalogItem>(items: T[]) {
  const products = new Map<string, { item: T; variants: T[] }>();
  for (const item of items) {
    const existing = products.get(item.productKey);
    if (existing) existing.variants.push(item);
    else products.set(item.productKey, { item, variants: [item] });
  }
  return [...products.values()];
}

async function main() {
  const catalog = readCatalogWorkbook();
  const parsedProducts = groupCatalog(catalog.items);
  const countries = [...new Set(catalog.items.map((item) => item.countryCode))].sort();
  const livePriceRows = catalog.items.filter(
    (item) => item.supplierCostIDR === null,
  ).length;

  console.log(
    `Validated ${parsedProducts.length} products, ${catalog.items.length} SKU-country rows, ` +
      `${countries.length} countries from ${catalog.workbookPaths.length} workbooks`,
  );
  console.log(`Workbooks: ${catalog.workbookPaths.join(", ")}`);
  console.log(`Rows requiring live supplier price: ${livePriceRows}`);
  console.log(`Countries: ${countries.join(", ")}`);
  console.log(
    `Products: ${parsedProducts.map(({ item }) => item.productName).sort().join(", ")}`,
  );

  if (catalog.duplicates.length > 0) {
    throw new Error(
      `Duplicate supplier SKU/country rows: ${catalog.duplicates.slice(0, 20).join(", ")}`,
    );
  }

  if (process.argv.includes("--dry-run")) {
    console.log(`Dry run complete. Skipped ${catalog.skipped.length} non-catalog rows.`);
    return;
  }

  const pricedItems: PricedCatalogItem[] =
    await hydrateMissingSupplierCosts(catalog.items);
  const products = groupCatalog(pricedItems);
  const { prisma } = await import("./index.ts");
  const usdIdrRate = getUsdIdrRate();

  try {
    await prisma.$transaction(async (tx) => {
      for (const category of Object.values(CATEGORIES)) {
        await tx.category.upsert({
          where: { slug: category.slug },
          update: category,
          create: category,
        });
      }

      const productIds = products.map(({ item }) => `eztopup-${item.productKey}`);
      const productSlugs = products.map(({ item }) => item.productKey);
      const conflictingProducts = await tx.product.findMany({
        where: {
          slug: { in: productSlugs },
          id: { notIn: productIds },
        },
        select: { id: true, slug: true },
      });
      for (const product of conflictingProducts) {
        await tx.product.update({
          where: { id: product.id },
          data: {
            slug: `legacy-${product.slug}-${slugify(product.id).slice(-8)}`,
            published: false,
            featured: false,
          },
        });
      }

      // Preserve historical rows but hide everything not re-enabled below.
      await tx.product.updateMany({ data: { published: false, featured: false } });
      await tx.productVariant.updateMany({ data: { published: false } });

      for (const { item, variants } of products) {
        const productId = `eztopup-${item.productKey}`;
        const categoryId = CATEGORIES[item.categorySlug].id;
        const productData = {
          name: item.productName,
          slug: item.productKey,
          description:
            item.fulfillmentType === "TOP_UP"
              ? `${item.productName} top-up with live pricing and secure checkout.`
              : `${item.productName} digital voucher with live pricing and secure delivery.`,
          image: item.productImage,
          categoryId,
          featured: true,
          published: true,
          globalAvailability: item.globalAvailability,
          unavailableMarketCodes: item.unavailableMarketCodes,
          fulfillmentType: item.fulfillmentType,
          requiresServerId: item.requiresServerId,
          gameIdLabel: "User ID",
          serverIdLabel: item.requiresServerId ? "Zone / Server ID" : "Server ID",
        } as const;

        await tx.product.upsert({
          where: { id: productId },
          update: productData,
          create: { id: productId, ...productData },
        });

        for (const variant of variants) {
          const variantId = `eztopup-${item.productKey}-${variant.countryCode}-${slugify(variant.supplierSku)}`;
          const nonCryptoPriceIDR = calculateSellPriceIDR(
            variant.supplierCostIDR,
            variant.nonCryptoMarkupBps,
          );
          await tx.productVariant.upsert({
            where: { id: variantId },
            update: {
              name: variant.variantName,
              published: true,
              priceIDR: nonCryptoPriceIDR,
              priceUSD: Number((nonCryptoPriceIDR / usdIdrRate).toFixed(2)),
              supplierCostIDR: variant.supplierCostIDR,
              supplierSku: variant.supplierSku,
              countryCode: variant.countryCode,
              supplierStatus: variant.supplierStatus,
              nonCryptoMarkupBps: variant.nonCryptoMarkupBps,
              cryptoMarkupBps: variant.cryptoMarkupBps,
              productId,
            },
            create: {
              id: variantId,
              name: variant.variantName,
              published: true,
              priceIDR: nonCryptoPriceIDR,
              priceUSD: Number((nonCryptoPriceIDR / usdIdrRate).toFixed(2)),
              supplierCostIDR: variant.supplierCostIDR,
              supplierSku: variant.supplierSku,
              countryCode: variant.countryCode,
              supplierStatus: variant.supplierStatus,
              nonCryptoMarkupBps: variant.nonCryptoMarkupBps,
              cryptoMarkupBps: variant.cryptoMarkupBps,
              productId,
            },
          });
        }
      }
    });

    console.log(
      `Published the combined workbook catalog and hid every product absent from both sources.`,
    );
    console.log(`Skipped ${catalog.skipped.length} blank/header/malformed rows.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
