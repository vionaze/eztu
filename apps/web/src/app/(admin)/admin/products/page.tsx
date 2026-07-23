import Link from "next/link";
import Image from "next/image";
import { prisma } from "@kupon/db";
import { Badge, Button, Card } from "@kupon/ui";
import { formatPrice } from "@/lib/utils";
import { Plus, CaretRight } from "@phosphor-icons/react/dist/ssr";
import ProductQuickToggle from "./ProductQuickToggle";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: [{ published: "desc" }, { name: "asc" }],
    include: {
      category: true,
      variants: { orderBy: { priceIDR: "asc" } },
      _count: { select: { orders: true } },
    },
  });

  const publishedCount = products.filter((p) => p.published).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">
            {products.length} products · {publishedCount} published ·{" "}
            {products.length - publishedCount} hidden
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            Klik produk untuk lihat detail, edit variant, hide/show storefront.
          </p>
        </div>
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
            No products yet.{" "}
            <Link href="/admin/products/new" className="text-accent underline">
              Create first product
            </Link>
          </Card>
        ) : (
          products.map((product) => {
            const minPrice = product.variants[0]?.priceIDR;
            const maxPrice =
              product.variants[product.variants.length - 1]?.priceIDR;
            return (
              <Card
                key={product.id}
                padding="none"
                className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 hover:border-accent/25 transition-colors"
              >
                <Link
                  href={`/admin/products/${product.id}`}
                  className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 group"
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
                      <h3 className="text-sm font-semibold text-text-primary truncate group-hover:text-accent transition-colors">
                        {product.name}
                      </h3>
                      <Badge variant={product.published ? "accent" : "muted"}>
                        {product.published ? "Published" : "Hidden"}
                      </Badge>
                      {product.featured ? (
                        <Badge variant="muted">Featured</Badge>
                      ) : null}
                      <Badge variant="muted">
                        {product.fulfillmentType === "TOP_UP"
                          ? "Top-up"
                          : "Voucher"}
                      </Badge>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      {product.category?.name || "Uncategorized"}
                      {product.fulfillmentType === "TOP_UP" &&
                      product.requiresServerId
                        ? " · Zone required"
                        : ""}{" "}
                      · {product.variants.length} variant
                      {product.variants.length === 1 ? "" : "s"}
                      {minPrice != null
                        ? maxPrice != null && maxPrice !== minPrice
                          ? ` · ${formatPrice(minPrice)} – ${formatPrice(maxPrice)}`
                          : ` · from ${formatPrice(minPrice)}`
                        : ""}{" "}
                      · {product._count.orders} order(s)
                    </p>
                  </div>
                  <CaretRight
                    size={16}
                    className="text-text-muted group-hover:text-accent shrink-0 hidden sm:block"
                  />
                </Link>

                <div
                  className="flex items-center gap-2 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ProductQuickToggle
                    id={product.id}
                    published={product.published}
                  />
                  <Link
                    href={`/products/${product.slug}`}
                    className="text-[11px] text-text-muted hover:text-accent hidden md:inline"
                    target="_blank"
                  >
                    Store
                  </Link>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
