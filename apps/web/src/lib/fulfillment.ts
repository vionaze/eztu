import { prisma } from "@kupon/db";
import { Prisma } from "@kupon/db";
import { sendDiscordFulfillmentNotification } from "@/lib/discord";
import { purchaseFlexaGiftVoucher } from "@/lib/flexagift";
import { notifySecurityEvent } from "@/lib/fraud";
import { MAX_SELF_SERVICE_QUANTITY } from "@/lib/checkout-limits";
import {
  calculateSupplierCostIDR,
  recordFulfilledOrderTreasury,
} from "@/lib/treasury";

export async function fulfillPaidOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      supplierOrder: true,
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

  if (order.status !== "PAID" && order.status !== "PROCESSING") {
    return {
      ok: true as const,
      skipped: true,
      reason: `Order status is ${order.status}`,
      orderId: order.id,
      status: order.status,
    };
  }

  if (order.supplierOrder?.status === "FULFILLED") {
    return {
      ok: true as const,
      skipped: true,
      reason: "Order already fulfilled",
      orderId: order.id,
      status: order.status,
    };
  }

  const firstItem = order.items[0];
  if (!firstItem) {
    return { ok: false as const, status: 409, error: "Order has no items" };
  }

  const integrityReasons: string[] = [];

  if (order.items.length !== 1) {
    integrityReasons.push(`Order has ${order.items.length} items; fulfillment expects exactly one`);
  }

  if (
    firstItem.quantity <= 0 ||
    firstItem.quantity > MAX_SELF_SERVICE_QUANTITY
  ) {
    integrityReasons.push(
      `Order item quantity is ${firstItem.quantity}; fulfillment expects 1-${MAX_SELF_SERVICE_QUANTITY}`
    );
  }

  if (order.totalIDR < 0 || order.totalUSD < 0) {
    integrityReasons.push(
      `Order has negative total: totalIDR=${order.totalIDR}, totalUSD=${order.totalUSD}`
    );
  }

  if (firstItem.priceIDR < 0 || firstItem.priceUSD < 0) {
    integrityReasons.push(
      `Order item has negative price: priceIDR=${firstItem.priceIDR}, priceUSD=${firstItem.priceUSD}`
    );
  }

  if (integrityReasons.length > 0) {
    await notifySecurityEvent({
      eventType: "fulfillment_order_integrity_failed",
      severity: "high",
      action: "blocked",
      reasons: integrityReasons,
      requestContext: {
        ip: "system",
        userAgent: "fulfillment",
        origin: "",
        referer: "",
        acceptLanguage: "",
        secFetchSite: "",
        method: "SYSTEM",
        path: "fulfillPaidOrder",
      },
      email: order.email,
      userId: order.userId,
      orderId: order.id,
      productId: firstItem.productId,
      variantId: firstItem.variantId,
      product: firstItem.product.name,
      variant: firstItem.variant.name,
      metadata: {
        orderNumber: order.orderNumber,
        orderStatus: order.status,
        itemCount: order.items.length,
        quantity: firstItem.quantity,
        totalIDR: order.totalIDR,
        totalUSD: order.totalUSD,
        priceIDR: firstItem.priceIDR,
        priceUSD: firstItem.priceUSD,
      },
    });

    return {
      ok: false as const,
      status: 409,
      error: "Order integrity check failed",
    };
  }

  const supplierCostIDR =
    firstItem.variant.supplierCostIDR !== null &&
    firstItem.variant.supplierCostIDR !== undefined
      ? firstItem.variant.supplierCostIDR * firstItem.quantity
      : calculateSupplierCostIDR(order.totalIDR);

  const supplierOrder = await prisma.supplierOrder.upsert({
    where: { orderId: order.id },
    update: {
      status: "PROCESSING",
      error: null,
    },
    create: {
      orderId: order.id,
      provider: "flexagift",
      status: "PROCESSING",
      productName: firstItem.product.name,
      variantName: firstItem.variant.name,
      costIDR: supplierCostIDR,
    },
  });

  try {
    const purchase = await purchaseFlexaGiftVoucher({
      orderId: order.id,
      orderNumber: order.orderNumber,
      productName: firstItem.product.name,
      variantName: firstItem.variant.name,
        customerEmail: order.email,
        gameId: order.gameId,
        serverId: order.serverId,
        quantity: firstItem.quantity,
        costIDR: supplierCostIDR,
      });

    await prisma.supplierOrder.update({
      where: { id: supplierOrder.id },
      data: {
        status: "FULFILLED",
        providerOrderId: purchase.providerOrderId,
        voucherCode: purchase.voucherCode,
        voucherPin: purchase.voucherPin,
        raw: purchase.raw as Prisma.InputJsonValue,
        fulfilledAt: new Date(),
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { status: "COMPLETED" },
    });

    const treasury = await recordFulfilledOrderTreasury({
      orderId: order.id,
      orderNumber: order.orderNumber,
      saleAmountIDR: order.totalIDR,
      saleAmountUSD: order.totalUSD,
      supplierCostIDR,
      paymentCurrency: order.paymentCurrency,
    });

    await sendDiscordFulfillmentNotification({
      orderId: order.id,
      orderNumber: order.orderNumber,
      product: firstItem.product.name,
      variant: firstItem.variant.name,
      gameId: order.gameId,
      amountIDR: order.totalIDR,
      amountUSD: order.totalUSD,
      crypto: order.paymentCurrency || "unknown",
      status: "COMPLETED",
      supplierStatus: "FULFILLED",
      providerOrderId: purchase.providerOrderId,
      email: order.email,
    });

    return {
      ok: true as const,
      orderId: order.id,
      status: "COMPLETED",
      supplierStatus: "FULFILLED",
      treasury,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown supplier fulfillment error";

    await prisma.supplierOrder.update({
      where: { id: supplierOrder.id },
      data: {
        status: "MANUAL_REVIEW",
        error: message,
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PROCESSING" },
    });

    return {
      ok: false as const,
      status: 502,
      error: "Supplier fulfillment failed",
      detail: message,
    };
  }
}
