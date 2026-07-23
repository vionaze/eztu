import Link from "next/link";
import { prisma } from "@kupon/db";
import { Card } from "@kupon/ui";
import { formatPrice, cn, formatAdminRelative } from "@/lib/utils";
import {
  ShoppingCart,
  CurrencyDollar,
  Package,
  Users,
  ArrowRight,
} from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400",
  PAID: "bg-blue-500/10 text-blue-400",
  PROCESSING: "bg-orange-500/10 text-orange-400",
  COMPLETED: "bg-emerald-500/10 text-emerald-400",
  FAILED: "bg-red-500/10 text-red-400",
  EXPIRED: "bg-zinc-500/10 text-zinc-400",
  REFUNDED: "bg-violet-500/10 text-violet-400",
};

export default async function DashboardPage() {
  const [
    revenueAgg,
    orderCount,
    productCount,
    customerCount,
    recentOrders,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { status: { in: ["PAID", "PROCESSING", "COMPLETED"] } },
      _sum: { totalIDR: true },
    }),
    prisma.order.count(),
    prisma.product.count({ where: { published: true } }),
    prisma.user.count(),
    prisma.order.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: { product: true, variant: true },
          take: 1,
        },
      },
    }),
  ]);

  const stats = [
    {
      label: "Total Revenue (paid+)",
      value: formatPrice(revenueAgg._sum.totalIDR || 0),
      icon: CurrencyDollar,
    },
    {
      label: "Orders",
      value: orderCount.toLocaleString("en-US"),
      icon: ShoppingCart,
    },
    {
      label: "Published products",
      value: productCount.toLocaleString("en-US"),
      icon: Package,
    },
    {
      label: "Customers",
      value: customerCount.toLocaleString("en-US"),
      icon: Users,
    },
  ];

  return (
    <>
      <div className="admin-bento admin-bento-4">
        {stats.map((stat) => (
          <div key={stat.label} className="admin-tile gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <stat.icon size={18} className="text-accent" />
            </div>
            <div>
              <p className="text-xl font-bold text-text-primary tracking-tight tabular-nums">
                {stat.value}
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-bento admin-bento-3">
        <Card variant="default" padding="none" className="lg:col-span-2 overflow-hidden !p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/80">
            <h2 className="text-[13px] font-semibold text-text-primary">
              Recent Orders
            </h2>
            <Link
              href="/admin/orders"
              className="text-xs font-medium text-accent hover:text-accent-hover inline-flex items-center gap-1"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentOrders.length === 0 ? (
              <p className="px-4 py-8 text-sm text-text-muted text-center">
                No orders yet.
              </p>
            ) : (
              recentOrders.map((order) => {
                const item = order.items[0];
                const label = item
                  ? `${item.product.name} - ${item.variant.name}`
                  : "Order";
                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-text-primary font-[family-name:var(--font-geist-mono)]">
                          {order.orderNumber}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full",
                            statusColor[order.status] || "bg-zinc-500/10 text-zinc-400"
                          )}
                        >
                          {order.status}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary truncate mt-0.5">
                        {label}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-text-primary">
                        {formatPrice(order.totalIDR)}
                      </p>
                      <p
                        className="text-[11px] text-text-muted"
                        title="Asia/Jakarta (GMT+7)"
                      >
                        {formatAdminRelative(order.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <div className="admin-tile h-fit gap-2">
          <p className="admin-tile-title">Quick actions</p>
          {[
            { label: "Add Product", href: "/admin/products/new" },
            { label: "View Orders", href: "/admin/orders" },
            { label: "Blog posts", href: "/admin/blog" },
            { label: "Activity logs", href: "/admin/logs" },
            { label: "Site Settings", href: "/admin/settings" },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center justify-between rounded-lg border border-border/80 px-2.5 py-2 text-[13px] text-text-secondary hover:text-text-primary hover:border-accent/30 transition-colors"
            >
              {action.label}
              <ArrowRight size={14} />
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
