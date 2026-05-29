import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import xlsx from "xlsx";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = resolve(packageRoot, "../..");
const envFiles = [
  resolve(packageRoot, ".env"),
  resolve(repoRoot, ".env"),
  resolve(repoRoot, "apps/web/.env"),
];

for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    loadEnv({ path: envFile });
    break;
  }
}

const { prisma } = await import("./index.ts");

type SheetRow = Record<string, unknown>;

type ImportProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  categoryId: string;
  featured: boolean;
  published: boolean;
  variants: ImportVariant[];
};

type ImportVariant = {
  id: string;
  name: string;
  priceIDR: number;
  priceUSD: number;
  supplierCostIDR: number;
  supplierSku: string;
};

const SOURCE_SHEET = "list product";
const CATEGORY = {
  id: "cat-eztopup-game",
  name: "Game Vouchers",
  slug: "game-vouchers",
  image: "/images/categories/game-vouchers.jpg",
};

const PRODUCT_IMAGE_OVERRIDES: Record<string, string> = {
  "google-play": "/google-play.webp",
  "pc-game-pass": "/xbox.png",
  "playstation-store": "/ps.png",
  "riot-games": "/riotgames.png",
  roblox: "/roblox.png",
  webtoon: "/webtoon.png",
};

const PRODUCT_NAME_OVERRIDES: Record<string, string> = {
  webtoon: "LINE Webtoon",
};

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

function getText(row: SheetRow, key: string) {
  const value = row[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return value.toString();
  return "";
}

function parseMoney(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value !== "string") return null;

  const raw = value
    .trim()
    .replace(/rp|idr/gi, "")
    .replace(/\s/g, "");

  if (!raw) return null;

  const commaIndex = raw.lastIndexOf(",");
  const dotIndex = raw.lastIndexOf(".");
  let normalized = raw;

  if (commaIndex > -1 && dotIndex > -1) {
    normalized =
      commaIndex > dotIndex
        ? raw.replace(/\./g, "").replace(",", ".")
        : raw.replace(/,/g, "");
  } else if (commaIndex > -1) {
    const decimals = raw.length - commaIndex - 1;
    normalized =
      decimals > 0 && decimals <= 2
        ? raw.replace(",", ".")
        : raw.replace(/,/g, "");
  } else {
    const parts = raw.split(".");
    normalized =
      parts.length > 2 || parts.at(-1)?.length === 3
        ? raw.replace(/\./g, "")
        : raw;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundCurrency(value: number) {
  return Math.round(value);
}

function getUsdIdrRate() {
  const parsed = Number(process.env.PRODUCT_USD_IDR_RATE || "15500");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15500;
}

function toUSD(priceIDR: number, usdIdrRate: number) {
  return Number((priceIDR / usdIdrRate).toFixed(2));
}

function getProductImage(productSlug: string) {
  return (
    PRODUCT_IMAGE_OVERRIDES[productSlug] ||
    `https://picsum.photos/seed/eztopup-${productSlug}/400/500`
  );
}

function getProductName(productSlug: string, merchantName: string) {
  return PRODUCT_NAME_OVERRIDES[productSlug] || merchantName;
}

function getWorkbookPath() {
  return (
    process.env.EZTOPUP_PRODUCTS_XLSX ||
    resolve(repoRoot, "data/list-product-for-eztopup.xlsx")
  );
}

function readProductsFromWorkbook() {
  const workbookPath = getWorkbookPath();

  if (!existsSync(workbookPath)) {
    throw new Error(`EZTOPUP workbook not found: ${workbookPath}`);
  }

  const workbook = xlsx.readFile(workbookPath);
  const sheet = workbook.Sheets[SOURCE_SHEET];

  if (!sheet) {
    throw new Error(`Sheet "${SOURCE_SHEET}" not found in ${workbookPath}`);
  }

  const rows = xlsx.utils.sheet_to_json<SheetRow>(sheet, { defval: null });
  const usdIdrRate = getUsdIdrRate();
  const products = new Map<string, ImportProduct>();
  const skipped: string[] = [];

  for (const [index, row] of rows.entries()) {
    const line = index + 2;
    const merchantName = getText(row, "Merchant Name");
    const productName = getText(row, "Product Name");
    const denom = parseMoney(row.Denom);
    const supplierCost = parseMoney(row["Cost Price from Merchant"]);

    if (!merchantName || !productName || !denom || !supplierCost) {
      skipped.push(
        `row ${line}: missing merchant/product/denom/supplier cost`
      );
      continue;
    }

    const productSlug = slugify(merchantName);
    const productId = `eztopup-${productSlug}`;
    const variantSlug = slugify(`${productName}-${roundCurrency(denom)}`);
    const variant: ImportVariant = {
      id: `eztopup-${productSlug}-${variantSlug}`,
      name: productName,
      priceIDR: roundCurrency(denom),
      priceUSD: toUSD(roundCurrency(denom), usdIdrRate),
      supplierCostIDR: roundCurrency(supplierCost),
      supplierSku: productName,
    };

    const existing = products.get(productId);
    if (existing) {
      existing.variants.push(variant);
      continue;
    }

    products.set(productId, {
      id: productId,
      name: getProductName(productSlug, merchantName),
      slug: productSlug,
      description: `${getProductName(productSlug, merchantName)} digital voucher. Pay with crypto and receive your code after payment confirmation.`,
      image: getProductImage(productSlug),
      categoryId: CATEGORY.id,
      featured: products.size < 6,
      published: true,
      variants: [variant],
    });
  }

  return {
    products: [...products.values()].map((product) => ({
      ...product,
      variants: product.variants.sort((a, b) => a.priceIDR - b.priceIDR),
    })),
    skipped,
    workbookPath,
  };
}

async function main() {
  const { products, skipped, workbookPath } = readProductsFromWorkbook();

  await prisma.category.upsert({
    where: { id: CATEGORY.id },
    update: CATEGORY,
    create: CATEGORY,
  });

  const legacyProducts = await prisma.product.findMany({
    where: {
      id: {
        startsWith: "prod-",
      },
    },
    select: {
      id: true,
      slug: true,
    },
  });

  for (const product of legacyProducts) {
    await prisma.product.update({
      where: { id: product.id },
      data: {
        slug: product.slug.startsWith("legacy-")
          ? product.slug
          : `legacy-${product.slug}`,
        published: false,
        featured: false,
      },
    });
  }

  let variantCount = 0;

  for (const product of products) {
    const { variants, ...productData } = product;

    await prisma.product.upsert({
      where: { id: product.id },
      update: productData,
      create: productData,
    });

    for (const variant of variants) {
      await prisma.productVariant.upsert({
        where: { id: variant.id },
        update: {
          ...variant,
          productId: product.id,
        },
        create: {
          ...variant,
          productId: product.id,
        },
      });
      variantCount += 1;
    }
  }

  console.log(`Imported EZTOPUP catalog from ${workbookPath}`);
  console.log(`Published ${products.length} products and ${variantCount} variants.`);

  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} rows:`);
    for (const reason of skipped) {
      console.log(`- ${reason}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
