import { notFound } from "next/navigation";
import { prisma } from "@kupon/db";
import ProductEditForm from "./ProductEditForm";

export const dynamic = "force-dynamic";

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: { orderBy: { priceIDR: "asc" } },
        _count: { select: { orders: true } },
      },
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!product) notFound();

  return (
    <ProductEditForm
      categories={categories}
      product={{
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        image: product.image,
        categoryId: product.categoryId,
        featured: product.featured,
        published: product.published,
        fulfillmentType: product.fulfillmentType,
        requiresServerId: product.requiresServerId,
        gameIdLabel: product.gameIdLabel || "User ID",
        serverIdLabel: product.serverIdLabel || "Zone / Server ID",
        orderCount: product._count.orders,
        categoryName: product.category?.name || "",
        variants: product.variants.map((v) => ({
          id: v.id,
          name: v.name,
          priceIDR: String(v.priceIDR),
          priceUSD: String(v.priceUSD),
          supplierSku: v.supplierSku || "",
          supplierCostIDR:
            v.supplierCostIDR != null ? String(v.supplierCostIDR) : "",
        })),
      }}
    />
  );
}
