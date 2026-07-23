import { prisma } from "@kupon/db";
import { Card } from "@kupon/ui";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { products: true } },
    },
  });

  return (
    <div className="space-y-6">
      <p className="text-sm text-text-secondary">
        {categories.length} categories
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.length === 0 ? (
          <Card padding="lg" className="text-sm text-text-muted col-span-full text-center">
            No categories in database.
          </Card>
        ) : (
          categories.map((cat) => (
            <Card key={cat.id} padding="md" className="space-y-1">
              <h3 className="text-sm font-semibold text-text-primary">
                {cat.name}
              </h3>
              <p className="text-xs text-text-muted font-mono">{cat.slug}</p>
              <p className="text-xs text-text-secondary">
                {cat._count.products} product(s)
              </p>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
