import Link from "next/link";
import Image from "next/image";
import { prisma } from "@kupon/db";
import { Badge, Button, Card } from "@kupon/ui";
import { formatPrice } from "@/lib/utils";
import { Plus, CaretRight } from "@phosphor-icons/react/dist/ssr";
import ProductQuickToggle from "./ProductQuickToggle";
import { buildProductFunnelReport } from "@/lib/product-analytics";

export const dynamic = "force-dynamic";

function productAnalyticsStartDate() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

export default async function AdminProductsPage() {
  const analyticsSince = productAnalyticsStartDate();
  const [products, analyticsEvents, paidOrderGroups] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ published: "desc" }, { name: "asc" }],
      include: {
        category: true,
        variants: {
          where: { published: true },
          orderBy: { priceIDR: "asc" },
        },
        _count: { select: { orders: true } },
      },
    }),
    prisma.productAnalyticsEvent.findMany({
      where: { createdAt: { gte: analyticsSince } },
      select: { productId: true, visitorHash: true, eventType: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        order: {
          createdAt: { gte: analyticsSince },
          status: { in: ["PAID", "PROCESSING", "COMPLETED"] },
        },
      },
      _count: { _all: true },
    }),
  ]);
  const paidOrdersByProduct = new Map(
    paidOrderGroups.map((row) => [row.productId, row._count._all]),
  );
  const funnel = buildProductFunnelReport(analyticsEvents, paidOrdersByProduct);

  const publishedCount = products.filter((p) => p.published).length;

  return (
    <>
      <div className="admin-page-toolbar">
        <div>
          <p className="text-[13px] text-text-secondary">
            {products.length} products · {publishedCount} published ·{" "}
            {products.length - publishedCount} hidden
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">
            Klik produk untuk detail, edit variant, hide/show storefront.
          </p>
        </div>
        <Link href="/admin/products/new">
          <Button size="sm">
            <Plus size={15} weight="bold" />
            New Product
          </Button>
        </Link>
      </div>

      <div className="space-y-2">
        {products.length === 0 ? (
          <Card padding="lg" className="text-center text-sm text-text-muted">
            No products yet.{" "}
            <Link href="/admin/products/new" className="text-accent underline">
              Create first product
            </Link>
          </Card>
        ) : (
          products.map((product) => {
            const metrics = funnel.get(product.id);
            const minPrice = product.variants[0]?.priceIDR;
            const maxPrice =
              product.variants[product.variants.length - 1]?.priceIDR;
            return (
              <Card
                key={product.id}
                padding="none"
                className="flex items-center gap-2.5 sm:gap-3 px-3 py-2.5 hover:border-accent/25 transition-colors"
              >
                <Link
                  href={`/admin/products/${product.id}`}
                  className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 group"
                >
                  <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-bg-elevated shrink-0">
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
                      <span
                        className={
                          product.category
                            ? ""
                            : "text-amber-400/90 font-medium"
                        }
                      >
                        {product.category?.name || "Uncategorized"}
                      </span>
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
                    <p className="mt-1 text-[11px] text-text-secondary">
                      30 hari: {metrics?.clicks || 0} klik · {metrics?.views || 0}{" "}
                      view · {metrics?.paymentCreations || 0} payment · {metrics?.paidOrders || 0}{" "}
                      paid · {((metrics?.conversionRate || 0) * 100).toFixed(1)}% conversion
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-text-muted">
                      Analitik: {metrics?.conclusion || "Belum ada data funnel."}
                    </p>
                  </div>
                  <CaretRight
                    size={16}
                    className="text-text-muted group-hover:text-accent shrink-0 hidden sm:block"
                  />
                </Link>

                <div className="flex items-center gap-2 shrink-0">
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
    </>
  );
}
