/**
 * Seed three supplier SKUs for local end-to-end testing:
 *   ML15_2-S121   Mobile Legends 17 Diamonds (DIGITAL top-up)
 *   STEAM45-S22   Steam Wallet IDR 45.000 (VOUCHER)
 *   ROB50IDR-S122 Roblox Gift Card IDR 50K (VOUCHER)
 *
 * Pricing taken from Product_Reseller CSV (Recommended = sell, Reseller = cost).
 * Run: pnpm --filter @kupon/db exec node --experimental-strip-types src/seed-test-skus.ts
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const envFiles = [
  resolve(packageRoot, ".env"),
  resolve(packageRoot, "../../.env"),
  resolve(packageRoot, "../../apps/web/.env"),
];

for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    loadEnv({ path: envFile });
    break;
  }
}

const { prisma } = await import("./index.ts");

const USD_IDR_RATE = Number(process.env.PRODUCT_USD_IDR_RATE || "15500") || 15500;

function toUSD(priceIDR: number) {
  return Number((priceIDR / USD_IDR_RATE).toFixed(2));
}

const CATEGORY = {
  id: "cat-eztopup-game",
  name: "Game Vouchers",
  slug: "game-vouchers",
  image: "/images/categories/game-vouchers.jpg",
};

type TestVariant = {
  id: string;
  name: string;
  priceIDR: number;
  supplierCostIDR: number;
  supplierSku: string;
};

type TestProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  featured: boolean;
  variants: TestVariant[];
};

const TEST_PRODUCTS: TestProduct[] = [
  {
    id: "test-mobile-legends",
    name: "Mobile Legends",
    slug: "mobile-legends",
    description:
      "Top up Mobile Legends diamonds. Enter your User ID and Zone/Server ID at checkout. Instant delivery after payment.",
    image: "/mlbb.webp",
    featured: true,
    variants: [
      {
        id: "test-ml-ml15-2-s121",
        name: "17 Diamonds (15 + 2 Bonus)",
        priceIDR: 4800,
        supplierCostIDR: 4488,
        supplierSku: "ML15_2-S121",
      },
    ],
  },
  {
    id: "test-steam-wallet",
    name: "Steam Wallet",
    slug: "steam-wallet",
    description:
      "Steam Wallet code for Indonesia. Pay with crypto and receive your voucher code after payment confirmation.",
    image: "/steam.webp",
    featured: true,
    variants: [
      {
        id: "test-steam-steam45-s22",
        name: "Steam Wallet IDR 45.000",
        priceIDR: 45150,
        supplierCostIDR: 44843,
        supplierSku: "STEAM45-S22",
      },
    ],
  },
  {
    id: "test-roblox",
    name: "Roblox",
    slug: "roblox",
    description:
      "Roblox gift card for Indonesia. Pay with crypto and receive your voucher code after payment confirmation.",
    image: "/roblox.png",
    featured: true,
    variants: [
      {
        id: "test-roblox-rob50idr-s122",
        name: "Roblox Gift Card IDR 50K",
        priceIDR: 48800,
        supplierCostIDR: 47614,
        supplierSku: "ROB50IDR-S122",
      },
    ],
  },
];

const TEST_SLUGS = TEST_PRODUCTS.map((product) => product.slug);

async function main() {
  await prisma.category.upsert({
    where: { id: CATEGORY.id },
    update: CATEGORY,
    create: CATEGORY,
  });

  // Keep storefront focused on the three test SKUs.
  const unpublishResult = await prisma.product.updateMany({
    where: {
      published: true,
      slug: { notIn: TEST_SLUGS },
    },
    data: { published: false, featured: false },
  });

  for (const product of TEST_PRODUCTS) {
    // Prefer updating an existing same-slug product (e.g. legacy roblox import)
    // so URLs stay stable; otherwise use the stable test id.
    const existingBySlug = await prisma.product.findUnique({
      where: { slug: product.slug },
      select: { id: true },
    });
    const productId = existingBySlug?.id || product.id;

    await prisma.product.upsert({
      where: { id: productId },
      update: {
        name: product.name,
        slug: product.slug,
        description: product.description,
        image: product.image,
        categoryId: CATEGORY.id,
        featured: product.featured,
        published: true,
      },
      create: {
        id: productId,
        name: product.name,
        slug: product.slug,
        description: product.description,
        image: product.image,
        categoryId: CATEGORY.id,
        featured: product.featured,
        published: true,
      },
    });

    // Replace variants so only the test SKU is purchasable.
    await prisma.productVariant.deleteMany({ where: { productId } });

    for (const variant of product.variants) {
      await prisma.productVariant.create({
        data: {
          id: variant.id,
          productId,
          name: variant.name,
          priceIDR: variant.priceIDR,
          priceUSD: toUSD(variant.priceIDR),
          supplierCostIDR: variant.supplierCostIDR,
          supplierSku: variant.supplierSku,
        },
      });
    }

    console.log(
      `✓ ${product.slug}: ${product.variants
        .map((v) => `${v.supplierSku} @ Rp${v.priceIDR}`)
        .join(", ")}`
    );
  }

  console.log(
    `Unpublished ${unpublishResult.count} other product(s) for a clean test storefront.`
  );
  console.log("Done. Test products are published:");
  for (const product of TEST_PRODUCTS) {
    console.log(`  /products/${product.slug}`);
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
