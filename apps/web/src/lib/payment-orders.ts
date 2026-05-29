import { prisma, type OrderStatus } from "@kupon/db";
import type { NormalizedPaymentStatus, PaymentWebhookEvent } from "@kupon/payments";
import { sendDiscordOrderNotification } from "@/lib/discord";
import { fulfillPaidOrder } from "@/lib/fulfillment";
import { sendOrderNotification } from "@/lib/telegram";

const statusMap: Record<NormalizedPaymentStatus, OrderStatus> = {
  pending: "PENDING",
  processing: "PROCESSING",
  paid: "PAID",
  failed: "FAILED",
  expired: "EXPIRED",
  refunded: "REFUNDED",
};

export async function applyPaymentEventToOrder(event: PaymentWebhookEvent) {
  const order = await prisma.order.findUnique({
    where: { id: event.orderId },
    include: {
      items: {
        include: {
          product: true,
          variant: true,
        },
      },
    },
  });

  if (!order) {
    return { ok: false as const, status: 404, error: "Order not found" };
  }

  const expectedProviderId = order.paymentProviderPaymentId;
  const providerIdMatches =
    !expectedProviderId ||
    expectedProviderId === event.providerPaymentId ||
    expectedProviderId === event.providerInvoiceId;

  if (!providerIdMatches) {
    return { ok: false as const, status: 409, error: "Payment ID mismatch" };
  }

  let newStatus = statusMap[event.status] || order.status;
  if (order.status === "COMPLETED" && newStatus === "PAID") {
    newStatus = "COMPLETED";
  }
  const isPaid = event.status === "paid";

  await prisma.order.update({
    where: { id: event.orderId },
    data: {
      status: newStatus,
      paymentProvider: event.provider,
      paymentProviderPaymentId: event.providerPaymentId,
      paymentProviderInvoiceId:
        event.providerInvoiceId ||
        order.paymentProviderInvoiceId ||
        expectedProviderId,
      paymentCurrency: event.payCurrency || order.paymentCurrency,
      paymentProviderTxHash: event.txHash || order.paymentProviderTxHash,
      ...(isPaid && !order.paidAt ? { paidAt: new Date() } : {}),
    },
  });

  if (newStatus !== order.status) {
    const firstItem = order.items[0];
    if (firstItem) {
      await sendOrderNotification({
        orderId: order.id,
        orderNumber: order.orderNumber,
        product: firstItem.product.name,
        variant: firstItem.variant.name,
        gameId: order.gameId,
        amountIDR: order.totalIDR,
        amountUSD: order.totalUSD,
        crypto: event.payCurrency || "unknown",
        status: newStatus,
        email: order.email,
      });
      await sendDiscordOrderNotification({
        orderId: order.id,
        orderNumber: order.orderNumber,
        product: firstItem.product.name,
        variant: firstItem.variant.name,
        gameId: order.gameId,
        amountIDR: order.totalIDR,
        amountUSD: order.totalUSD,
        crypto: event.payCurrency || "unknown",
        status: newStatus,
        email: order.email,
      });
    }
  }

  if (isPaid && order.status !== "PAID" && order.status !== "COMPLETED") {
    await fulfillPaidOrder(order.id);
  }

  return {
    ok: true as const,
    orderId: order.id,
    previousStatus: order.status,
    status: newStatus,
  };
}
