import { Prisma, prisma } from "@kupon/db";
import type { Product } from "@/types/product";

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    category: true;
    variants: true;
  };
}>;

function getStorefrontProductName(name: string) {
  return name.startsWith("E-voucher ") ? name : `E-voucher ${name}`;
}

function toProduct(product: ProductWithRelations): Product {
  return {
    id: product.id,
    name: getStorefrontProductName(product.name),
    slug: product.slug,
    description: product.description,
    image: product.image,
    categoryId: product.categoryId,
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
      priceUSD: variant.priceUSD,
      supplierCostIDR: variant.supplierCostIDR,
      supplierSku: variant.supplierSku,
    })),
    featured: product.featured,
    published: product.published,
    fulfillmentType: product.fulfillmentType || "VOUCHER",
    requiresServerId: Boolean(product.requiresServerId),
    gameIdLabel: product.gameIdLabel || "User ID",
    serverIdLabel: product.serverIdLabel || "Zone / Server ID",
    createdAt: product.createdAt.toISOString(),
  };
}

export async function getPublishedProducts() {
  return prisma.product.findMany({
    where: { published: true },
    include: {
      category: true,
      variants: {
        orderBy: [{ priceIDR: "asc" }, { name: "asc" }],
      },
    },
    orderBy: [{ featured: "desc" }, { name: "asc" }],
  });
}

export async function getStorefrontProducts() {
  const products = await getPublishedProducts();
  return products.map(toProduct);
}

export async function getStorefrontProductBySlug(slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, published: true },
    include: {
      category: true,
      variants: {
        orderBy: [{ priceIDR: "asc" }, { name: "asc" }],
      },
    },
  });

  return product ? toProduct(product) : null;
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
