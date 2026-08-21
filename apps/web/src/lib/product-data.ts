import { Prisma, prisma } from "@kupon/db";
import type { Product } from "@/types/product";
import { getDisplayPriceUSD } from "./display-price.ts";
import { getUsdIdrRate } from "./fx.ts";

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    category: true;
    variants: true;
  };
}>;

function getStorefrontProductName(name: string) {
  return name.startsWith("E-voucher ") ? name : `E-voucher ${name}`;
}

function toProduct(product: ProductWithRelations, usdIdrRate: number | null): Product {
  return {
    id: product.id,
    name:
      product.fulfillmentType === "VOUCHER"
        ? getStorefrontProductName(product.name)
        : product.name,
    slug: product.slug,
    description: product.description,
    image: product.image,
    categoryId: product.categoryId ?? null,
    category: product.category
      ? {
          id: product.category.id,
          name: product.category.name,
          slug: product.category.slug,
          image: product.category.image || undefined,
        }
      : undefined,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      priceIDR: variant.priceIDR,
      priceUSD: getDisplayPriceUSD(variant.priceIDR, variant.priceUSD, usdIdrRate),
      supplierCostIDR: variant.supplierCostIDR,
      supplierSku: variant.supplierSku,
      countryCode: variant.countryCode,
      supplierStatus: variant.supplierStatus,
      supplierPriceUpdatedAt: variant.supplierPriceUpdatedAt?.toISOString() || null,
    })),
    featured: product.featured,
    published: product.published,
    globalAvailability: product.globalAvailability,
    unavailableMarketCodes: product.unavailableMarketCodes,
    fulfillmentType: product.fulfillmentType || "VOUCHER",
    requiresServerId: Boolean(product.requiresServerId),
    gameIdLabel: product.gameIdLabel || "User ID",
    serverIdLabel: product.serverIdLabel || "Zone / Server ID",
    createdAt: product.createdAt.toISOString(),
  };
}

async function getDisplayUsdIdrRate() {
  try {
    return (await getUsdIdrRate()).usdIdrRate;
  } catch (error) {
    console.error("Catalog FX refresh failed; using imported USD fallback", error);
    return null;
  }
}

export async function getPublishedProducts() {
  return prisma.product.findMany({
    where: { published: true },
    include: {
      category: true,
      variants: {
        where: { published: true },
        orderBy: [{ priceIDR: "asc" }, { name: "asc" }],
      },
    },
    orderBy: [{ featured: "desc" }, { name: "asc" }],
  });
}

export async function getStorefrontProducts() {
  const [products, usdIdrRate] = await Promise.all([
    getPublishedProducts(),
    getDisplayUsdIdrRate(),
  ]);
  return products.map((product) => toProduct(product, usdIdrRate));
}

export async function getStorefrontProductBySlug(slug: string) {
  const [product, usdIdrRate] = await Promise.all([
    prisma.product.findFirst({
      where: { slug, published: true },
      include: {
        category: true,
        variants: {
          where: { published: true },
          orderBy: [{ priceIDR: "asc" }, { name: "asc" }],
        },
      },
    }),
    getDisplayUsdIdrRate(),
  ]);

  return product ? toProduct(product, usdIdrRate) : null;
}

export async function getStorefrontCategories() {
  const categories = await prisma.category.findMany({
    include: {
      _count: {
        select: {
          products: {
            where: { published: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return categories
    .filter((category) => category._count.products > 0)
    .map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      image: category.image || undefined,
      productCount: category._count.products,
    }));
}
