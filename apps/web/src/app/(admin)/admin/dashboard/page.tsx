import Link from "next/link";
import { prisma } from "@kupon/db";
import { Card } from "@kupon/ui";
import { formatPrice, cn } from "@/lib/utils";
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

function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

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
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} variant="default" padding="md" className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <stat.icon size={20} className="text-accent" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary tracking-tight">
                {stat.value}
              </p>
              <p className="text-xs text-text-muted mt-1">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card variant="default" padding="none" className="lg:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-text-primary">Recent Orders</h2>
            <Link
              href="/admin/orders"
              className="text-xs font-medium text-accent hover:text-accent-hover inline-flex items-center gap-1"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentOrders.length === 0 ? (
              <p className="px-5 py-10 text-sm text-text-muted text-center">
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
                    className="flex items-center justify-between gap-4 px-5 py-3.5"
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
                      <p className="text-[11px] text-text-muted">
                        {timeAgo(order.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card variant="default" padding="md" className="space-y-3 h-fit">
          <h2 className="text-sm font-semibold text-text-primary">Quick Actions</h2>
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
              className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:border-accent/30 transition-colors"
            >
              {action.label}
              <ArrowRight size={14} />
            </Link>
          ))}
        </Card>
      </div>
    </div>
  );
}
