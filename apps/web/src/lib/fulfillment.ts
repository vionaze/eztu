import { Prisma, prisma } from "@kupon/db";
import { sendDiscordFulfillmentNotification } from "@/lib/discord";
import { notifySecurityEvent } from "@/lib/fraud";
import { MAX_SELF_SERVICE_QUANTITY } from "@/lib/checkout-limits";
import {
  createSupplierOrder,
  getSupplierOrderStatus,
  isSupplierProductCode,
  SUPPLIER_PROVIDER,
  redactSupplierSnapshot,
  type SupplierOrderSnapshot,
} from "@/lib/supplier";
import {
  calculateSupplierCostIDR,
  recordFulfilledOrderTreasury,
} from "@/lib/treasury";
import { sendVoucherDeliveryEmailForOrder } from "@/lib/voucher-delivery";

function createSystemContext(path: string) {
  return {
    ip: "system",
    userAgent: "fulfillment",
    origin: "",
    referer: "",
    acceptLanguage: "",
    secFetchSite: "",
    method: "SYSTEM",
    path,
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeSupplierStatus(status: string) {
  return status.trim().toUpperCase();
}

function getVoucherCodeValue(snapshot: SupplierOrderSnapshot) {
  return snapshot.voucherCodes.join("\n");
}

async function loadOrder(orderId: string) {
  return prisma.order.findUnique({
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
}

async function loadOrderBySupplierSnapshot(snapshot: SupplierOrderSnapshot) {
  const filters: Prisma.OrderWhereInput[] = [];
  if (snapshot.referenceId) {
    filters.push({ orderNumber: snapshot.referenceId });
  }
  if (snapshot.tid) {
    filters.push({
      supplierOrder: {
        is: {
          provider: SUPPLIER_PROVIDER,
          providerOrderId: snapshot.tid,
        },
      },
    });
  }

  if (filters.length === 0) return null;

  return prisma.order.findFirst({
    where: {
      OR: filters,
    },
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
}

async function markSupplierManualReview(params: {
  orderId: string;
  providerOrderId?: string | null;
  productName: string;
  variantName: string;
  costIDR: number;
  error: string;
  raw?: unknown;
}) {
  await prisma.supplierOrder.upsert({
    where: { orderId: params.orderId },
    update: {
      provider: SUPPLIER_PROVIDER,
      providerOrderId: params.providerOrderId,
      status: "MANUAL_REVIEW",
      costIDR: params.costIDR,
      error: params.error,
      raw: params.raw === undefined ? undefined : toJson(params.raw),
    },
    create: {
      orderId: params.orderId,
      provider: SUPPLIER_PROVIDER,
      providerOrderId: params.providerOrderId,
      status: "MANUAL_REVIEW",
      productName: params.productName,
      variantName: params.variantName,
      costIDR: params.costIDR,
      error: params.error,
      raw: params.raw === undefined ? undefined : toJson(params.raw),
    },
  });

  await prisma.order.update({
    where: { id: params.orderId },
    data: { status: "PROCESSING" },
  });
}

export async function applySupplierOrderSnapshot(
  snapshot: SupplierOrderSnapshot
) {
  const order = await loadOrderBySupplierSnapshot(snapshot);

  if (!order) {
    // Ops noise (test/dummy TIDs, late callbacks) — log to DB only, not Discord "Bot/Fraud"
    await notifySecurityEvent({
      eventType: "supplier_callback_unknown_order",
      severity: "low",
      action: "flagged",
      reasons: [
        `Unknown supplier callback (no matching order) tid=${snapshot.tid || "-"} reference=${snapshot.referenceId || "-"}`,
      ],
      requestContext: createSystemContext("supplier_callback"),
      metadata: { snapshot: redactSupplierSnapshot(snapshot) },
    });

    return { ok: false as const, status: 404, error: "Order not found" };
  }

  const firstItem = order.items[0];
  if (!firstItem) {
    return { ok: false as const, status: 409, error: "Order has no items" };
  }

  const status = normalizeSupplierStatus(snapshot.status);
  const supplierCostIDR =
    firstItem.variant.supplierCostIDR !== null &&
    firstItem.variant.supplierCostIDR !== undefined
      ? firstItem.variant.supplierCostIDR * firstItem.quantity
      : calculateSupplierCostIDR(order.totalIDR);
  const raw = toJson(snapshot.raw);

  if (status === "PENDING") {
    await prisma.supplierOrder.upsert({
      where: { orderId: order.id },
      update: {
        provider: SUPPLIER_PROVIDER,
        providerOrderId: snapshot.tid || order.supplierOrder?.providerOrderId,
        status: "PROCESSING",
        raw,
        error: null,
      },
      create: {
        orderId: order.id,
        provider: SUPPLIER_PROVIDER,
        providerOrderId: snapshot.tid,
        status: "PROCESSING",
        productName: firstItem.product.name,
        variantName: firstItem.variant.name,
        costIDR: supplierCostIDR,
        raw,
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PROCESSING" },
    });

    return {
      ok: true as const,
      orderId: order.id,
      status: "PROCESSING",
      supplierStatus: "PROCESSING",
    };
  }

  if (status === "REFUNDED") {
    await prisma.supplierOrder.upsert({
      where: { orderId: order.id },
      update: {
        provider: SUPPLIER_PROVIDER,
        providerOrderId: snapshot.tid || order.supplierOrder?.providerOrderId,
        status: "FAILED",
        raw,
        error: "Supplier refunded the supplier transaction.",
      },
      create: {
        orderId: order.id,
        provider: SUPPLIER_PROVIDER,
        providerOrderId: snapshot.tid,
        status: "FAILED",
        productName: firstItem.product.name,
        variantName: firstItem.variant.name,
        costIDR: supplierCostIDR,
        raw,
        error: "Supplier refunded the supplier transaction.",
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { status: "REFUNDED" },
    });

    return {
      ok: true as const,
      orderId: order.id,
      status: "REFUNDED",
      supplierStatus: "FAILED",
    };
  }

  if (status !== "SUCCESS") {
    await markSupplierManualReview({
      orderId: order.id,
      providerOrderId: snapshot.tid || order.supplierOrder?.providerOrderId,
      productName: firstItem.product.name,
      variantName: firstItem.variant.name,
      costIDR: supplierCostIDR,
      error: `Supplier returned non-final status: ${snapshot.status}`,
      raw: snapshot.raw,
    });

    return {
      ok: false as const,
      status: 409,
      error: `Supplier returned ${snapshot.status}`,
    };
  }

  // TOP_UP credits the game account — supplier SUCCESS has no voucher_code.
  // VOUCHER products must return at least one code before we complete.
  const isTopUp = firstItem.product.fulfillmentType === "TOP_UP";
  const voucherCode = getVoucherCodeValue(snapshot);
  if (!voucherCode && !isTopUp) {
    await markSupplierManualReview({
      orderId: order.id,
      providerOrderId: snapshot.tid || order.supplierOrder?.providerOrderId,
      productName: firstItem.product.name,
      variantName: firstItem.variant.name,
      costIDR: supplierCostIDR,
      error: "Supplier marked the order successful but returned no voucher_code.",
      raw: snapshot.raw,
    });

    return {
      ok: false as const,
      status: 409,
      error: "Supplier returned no voucher code",
    };
  }

  const wasFulfilled = order.supplierOrder?.status === "FULFILLED";
  const fulfilledAt = order.supplierOrder?.fulfilledAt || new Date();
  await prisma.supplierOrder.upsert({
    where: { orderId: order.id },
    update: {
      provider: SUPPLIER_PROVIDER,
      providerOrderId: snapshot.tid || order.supplierOrder?.providerOrderId,
      status: "FULFILLED",
      // Keep empty string as null for top-up (no code to deliver)
      voucherCode: voucherCode || null,
      voucherPin: null,
      raw,
      error: null,
      fulfilledAt,
    },
    create: {
      orderId: order.id,
      provider: SUPPLIER_PROVIDER,
      providerOrderId: snapshot.tid,
      status: "FULFILLED",
      productName: firstItem.product.name,
      variantName: firstItem.variant.name,
      costIDR: supplierCostIDR,
      voucherCode: voucherCode || null,
      raw,
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

  // Voucher delivery email only when there is a code to share
  const emailResult = voucherCode
    ? await sendVoucherDeliveryEmailForOrder(order.id)
    : {
        sent: false as const,
        skipped: true as const,
        reason: "Top-up order — no voucher code to email",
      };

  if (!wasFulfilled) {
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
      providerOrderId: snapshot.tid || order.supplierOrder?.providerOrderId,
      email: order.email,
    });
  }

  return {
    ok: true as const,
    orderId: order.id,
    status: "COMPLETED",
    supplierStatus: "FULFILLED",
    treasury,
    email: emailResult,
  };
}

export async function fulfillPaidOrder(orderId: string) {
  const order = await loadOrder(orderId);

  if (!order) {
    return { ok: false as const, status: 404, error: "Order not found" };
  }

  if (order.supplierOrder?.status === "FULFILLED") {
    const emailResult = await sendVoucherDeliveryEmailForOrder(order.id);

    return {
      ok: true as const,
      skipped: true,
      reason: "Order already fulfilled",
      orderId: order.id,
      status: order.status,
      email: emailResult,
    };
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
      requestContext: createSystemContext("fulfillPaidOrder"),
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
  const supplierSku = firstItem.variant.supplierSku?.trim() || "";

  if (!isSupplierProductCode(supplierSku)) {
    const error =
      "Product variant supplierSku must be a Supplier product_code before live fulfillment.";
    await markSupplierManualReview({
      orderId: order.id,
      productName: firstItem.product.name,
      variantName: firstItem.variant.name,
      costIDR: supplierCostIDR,
      error,
      raw: {
        supplierSku,
        product: firstItem.product.name,
        variant: firstItem.variant.name,
      },
    });

    return { ok: false as const, status: 409, error };
  }

  let providerOrderId = order.supplierOrder?.providerOrderId || null;
  const supplierOrder = await prisma.supplierOrder.upsert({
    where: { orderId: order.id },
    update: {
      provider: SUPPLIER_PROVIDER,
      status: "PROCESSING",
      productName: firstItem.product.name,
      variantName: firstItem.variant.name,
      costIDR: supplierCostIDR,
      error: null,
    },
    create: {
      orderId: order.id,
      provider: SUPPLIER_PROVIDER,
      status: "PROCESSING",
      productName: firstItem.product.name,
      variantName: firstItem.variant.name,
      costIDR: supplierCostIDR,
    },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { status: "PROCESSING" },
  });

  try {
    if (!providerOrderId) {
      const createResult = await createSupplierOrder({
        orderNumber: order.orderNumber,
        productCode: supplierSku,
        quantity: firstItem.quantity,
        unitPriceIDR: firstItem.variant.supplierCostIDR,
        gameId: order.gameId,
        serverId: order.serverId,
      });

      providerOrderId = createResult.tid;
      await prisma.supplierOrder.update({
        where: { id: supplierOrder.id },
        data: {
          providerOrderId,
          raw: createResult.raw as Prisma.InputJsonValue,
        },
      });
    }

    const snapshot = await getSupplierOrderStatus({
      tid: providerOrderId,
      partnerReferenceId: order.orderNumber,
    });

    return applySupplierOrderSnapshot(snapshot);
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
