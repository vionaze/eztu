import { prisma } from "@kupon/db";
import OrdersFilterClient from "./OrdersFilterClient";
import OrdersTableClient, { type AdminOrderRow } from "./OrdersTableClient";

export const dynamic = "force-dynamic";

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
              { gameId: { contains: q, mode: "insensitive" } },
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

  const rows: AdminOrderRow[] = orders.map((order) => {
    const item = order.items[0];
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      email: order.email,
      gameId: order.gameId,
      serverId: order.serverId,
      status: order.status,
      totalIDR: order.totalIDR,
      totalUSD: order.totalUSD,
      paymentCurrency: order.paymentCurrency,
      paymentProvider: order.paymentProvider,
      paymentUrl: order.paymentUrl,
      paidAt: order.paidAt?.toISOString() || null,
      expiresAt: order.expiresAt?.toISOString() || null,
      createdAt: order.createdAt.toISOString(),
      subtotalIDR: order.subtotalIDR,
      discountIDR: order.discountIDR,
      productName: item?.product.name || null,
      variantName: item?.variant.name || null,
      quantity: item?.quantity || 1,
      unitPriceIDR: item?.priceIDR ?? null,
      unitPriceUSD: item?.priceUSD ?? null,
      fulfillmentType: item?.product.fulfillmentType || null,
      requiresServerId: Boolean(item?.product.requiresServerId),
      gameIdLabel: item?.product.gameIdLabel || null,
      serverIdLabel: item?.product.serverIdLabel || null,
      supplierStatus: order.supplierOrder?.status || null,
      voucherCode: order.supplierOrder?.voucherCode || null,
      supplierError: order.supplierOrder?.error || null,
    };
  });

  return (
    <div className="space-y-6">
      <OrdersFilterClient initialQ={q} initialStatus={status} />
      <p className="text-xs text-text-muted">
        Klik baris order untuk preview lengkap: package, qty, email, User ID /
        Zone (top-up), payment &amp; fulfillment.
      </p>
      <OrdersTableClient orders={rows} />
    </div>
  );
}
