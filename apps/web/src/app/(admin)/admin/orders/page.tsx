import { prisma } from "@kupon/db";
import { Card } from "@kupon/ui";
import { formatPrice, cn } from "@/lib/utils";
import OrdersFilterClient from "./OrdersFilterClient";

export const dynamic = "force-dynamic";

const statusStyles: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400",
  PAID: "bg-blue-500/10 text-blue-400",
  PROCESSING: "bg-orange-500/10 text-orange-400",
  COMPLETED: "bg-emerald-500/10 text-emerald-400",
  FAILED: "bg-red-500/10 text-red-400",
  EXPIRED: "bg-zinc-500/10 text-zinc-400",
  REFUNDED: "bg-violet-500/10 text-violet-400",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q || "").trim();
  const status = (params.status || "ALL").toUpperCase();

  const orders = await prisma.order.findMany({
    where: {
      ...(status !== "ALL" ? { status: status as never } : {}),
      ...(q
        ? {
            OR: [
              { orderNumber: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              {
                items: {
                  some: {
                    product: { name: { contains: q, mode: "insensitive" } },
                  },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      items: {
        include: { product: true, variant: true },
        take: 1,
      },
      supplierOrder: true,
    },
  });

  return (
    <div className="space-y-6">
      <OrdersFilterClient initialQ={q} initialStatus={status} />

      <Card variant="default" padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                {[
                  "Order",
                  "Customer",
                  "Product",
                  "Amount",
                  "Pay",
                  "Status",
                  "Fulfillment",
                  "Date",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-sm text-text-muted"
                  >
                    No orders match this filter.
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const item = order.items[0];
                  return (
                    <tr key={order.id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3.5 text-sm font-mono text-text-primary">
                        {order.orderNumber}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-text-secondary">
                        {order.email}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-text-secondary max-w-[220px] truncate">
                        {item
                          ? `${item.product.name} · ${item.variant.name}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-text-primary">
                        {formatPrice(order.totalIDR)}
                        <span className="block text-[11px] text-text-muted">
                          ${order.totalUSD.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-text-muted uppercase">
                        {order.paymentCurrency || order.paymentProvider || "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            "text-[10px] font-semibold uppercase px-2 py-1 rounded-full",
                            statusStyles[order.status]
                          )}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-text-muted">
                        {order.supplierOrder?.status || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-text-muted whitespace-nowrap">
                        {order.createdAt.toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Asia/Jakarta",
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
