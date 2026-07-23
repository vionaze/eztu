import { prisma } from "@kupon/db";
import CategoriesManager from "./CategoriesManager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const [categories, uncategorized] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    }),
    prisma.product.count({ where: { categoryId: null } }),
  ]);

  return (
    <CategoriesManager
      uncategorizedCount={uncategorized}
      initialCategories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        image: c.image,
        productCount: c._count.products,
      }))}
    />
  );
}
