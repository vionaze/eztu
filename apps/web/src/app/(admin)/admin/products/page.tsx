import Link from "next/link";
import Image from "next/image";
import { prisma } from "@kupon/db";
import { Badge, Button, Card } from "@kupon/ui";
import { formatPrice } from "@/lib/utils";
import { Plus } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: [{ published: "desc" }, { name: "asc" }],
    include: {
      category: true,
      variants: { orderBy: { priceIDR: "asc" } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          {products.length} products in database
        </p>
        <Link href="/admin/products/new">
          <Button>
            <Plus size={16} weight="bold" />
            New Product
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        {products.length === 0 ? (
          <Card padding="lg" className="text-center text-sm text-text-muted">
            No products yet. Add one or run the test SKU seed.
          </Card>
        ) : (
          products.map((product) => {
            const minPrice = product.variants[0]?.priceIDR;
            return (
              <Card
                key={product.id}
                padding="none"
                className="flex items-center gap-4 px-4 py-3"
              >
                <div className="relative h-14 w-14 rounded-xl overflow-hidden bg-bg-elevated shrink-0">
                  {product.image ? (
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-text-primary truncate">
                      {product.name}
                    </h3>
                    <Badge variant={product.published ? "accent" : "muted"}>
                      {product.published ? "Published" : "Hidden"}
                    </Badge>
                    {product.featured ? (
                      <Badge variant="muted">Featured</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    {product.category?.name || "Uncategorized"} ·{" "}
                    {product.variants.length} variant(s)
                    {minPrice != null ? ` · from ${formatPrice(minPrice)}` : ""}
                  </p>
                </div>
                <Link
                  href={`/products/${product.slug}`}
                  className="text-xs text-accent hover:text-accent-hover shrink-0"
                  target="_blank"
                >
                  View storefront
                </Link>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
