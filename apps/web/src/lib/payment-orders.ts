import { prisma, type OrderStatus } from "@kupon/db";
import type { NormalizedPaymentStatus, PaymentWebhookEvent } from "@kupon/payments";
import { sendDiscordOrderNotification } from "@/lib/discord";
import { fulfillPaidOrder } from "@/lib/fulfillment";
import { MAX_SELF_SERVICE_QUANTITY } from "@/lib/checkout-limits";
import {
  notifySecurityEvent,
  type FraudRequestContext,
} from "@/lib/fraud";
import { sendOrderNotification } from "@/lib/telegram";
import { writeAppLog } from "@/lib/app-log";

const statusMap: Record<NormalizedPaymentStatus, OrderStatus> = {
  pending: "PENDING",
  processing: "PROCESSING",
  paid: "PAID",
  failed: "FAILED",
  expired: "EXPIRED",
  refunded: "REFUNDED",
};

type ApplyPaymentEventOptions = {
  requestContext?: FraudRequestContext;
  source?: "webhook" | "sync";
  actorUserId?: string;
  actorClerkUserId?: string;
};

function getRawNumber(raw: unknown, key: string) {
  if (!raw || typeof raw !== "object") return null;

  const value = (raw as Record<string, unknown>)[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function createFallbackContext(source: string): FraudRequestContext {
  return {
    ip: "provider",
    userAgent: source,
    origin: "",
    referer: "",
    acceptLanguage: "",
    secFetchSite: "",
    method: "SYSTEM",
    path: source,
  };
}

async function alertPaymentIntegrity(
  event: PaymentWebhookEvent,
  options: ApplyPaymentEventOptions,
  params: {
    eventType: string;
    severity: "low" | "medium" | "high";
    action: "blocked" | "flagged";
    reasons: string[];
    orderId?: string;
    email?: string;
    productId?: string;
    variantId?: string;
    product?: string;
    variant?: string;
    metadata?: Record<string, unknown>;
  }
) {
  await notifySecurityEvent({
    eventType: params.eventType,
    severity: params.severity,
    action: params.action,
    reasons: params.reasons,
    requestContext:
      options.requestContext ||
      createFallbackContext(`payment_${options.source || "event"}`),
    email: params.email,
    userId: options.actorUserId,
    clerkUserId: options.actorClerkUserId,
    orderId: params.orderId || event.orderId,
    productId: params.productId,
    variantId: params.variantId,
    product: params.product,
    variant: params.variant,
    metadata: {
      source: options.source || "unknown",
      provider: event.provider,
      providerPaymentId: event.providerPaymentId,
      providerInvoiceId: event.providerInvoiceId,
      providerStatus: event.providerStatus,
      normalizedStatus: event.status,
      payAmount: event.payAmount,
      actuallyPaid: event.actuallyPaid,
      priceAmount: getRawNumber(event.raw, "price_amount"),
      ...params.metadata,
    },
  });
}

export async function applyPaymentEventToOrder(
  event: PaymentWebhookEvent,
  options: ApplyPaymentEventOptions = {}
) {
  const negativeAmounts = [
    ["pay_amount", event.payAmount],
    ["actually_paid", event.actuallyPaid],
    ["price_amount", getRawNumber(event.raw, "price_amount")],
  ].filter((entry): entry is [string, number] => {
    return typeof entry[1] === "number" && entry[1] < 0;
  });

  if (negativeAmounts.length > 0) {
    await alertPaymentIntegrity(event, options, {
      eventType: "payment_negative_amount",
      severity: "high",
      action: "blocked",
      reasons: negativeAmounts.map(([name, amount]) => `${name}=${amount}`),
      metadata: { raw: event.raw as Record<string, unknown> },
    });

    return { ok: false as const, status: 409, error: "Invalid payment amount" };
  }

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
    await alertPaymentIntegrity(event, options, {
      eventType: "payment_unknown_order",
      severity: "high",
      action: "blocked",
      reasons: [`Payment event referenced unknown order: ${event.orderId}`],
      metadata: { raw: event.raw as Record<string, unknown> },
    });

    return { ok: false as const, status: 404, error: "Order not found" };
  }

  const firstItem = order.items[0];
  const orderIntegrityReasons: string[] = [];

  if (order.totalIDR < 0 || order.totalUSD < 0) {
    orderIntegrityReasons.push(
      `Order has negative total: totalIDR=${order.totalIDR}, totalUSD=${order.totalUSD}`
    );
  }

  if (!firstItem) {
    orderIntegrityReasons.push("Order has no items");
  } else {
    if (
      firstItem.quantity <= 0 ||
      firstItem.quantity > MAX_SELF_SERVICE_QUANTITY
    ) {
      orderIntegrityReasons.push(`Order item quantity is ${firstItem.quantity}`);
    }

    if (firstItem.priceIDR < 0 || firstItem.priceUSD < 0) {
      orderIntegrityReasons.push(
        `Order item has negative price: priceIDR=${firstItem.priceIDR}, priceUSD=${firstItem.priceUSD}`
      );
    }
  }

  // NOWPayments used price_amount; Cryptomus invoice amount is usually `amount` (USD string).
  const providerPriceAmount =
    getRawNumber(event.raw, "price_amount") ??
    getRawNumber(event.raw, "amount") ??
    getRawNumber(event.raw, "payment_amount_usd");
  if (
    event.status === "paid" &&
    providerPriceAmount !== null &&
    Math.abs(providerPriceAmount - order.totalUSD) > 0.05
  ) {
    orderIntegrityReasons.push(
      `Provider amount=${providerPriceAmount} does not match order totalUSD=${order.totalUSD}`
    );
  }

  if (orderIntegrityReasons.length > 0) {
    await alertPaymentIntegrity(event, options, {
      eventType: "payment_order_integrity_failed",
      severity: "high",
      action: "blocked",
      reasons: orderIntegrityReasons,
      orderId: order.id,
      email: order.email,
      productId: firstItem?.productId,
      variantId: firstItem?.variantId,
      product: firstItem?.product.name,
      variant: firstItem?.variant.name,
      metadata: {
        orderNumber: order.orderNumber,
        orderStatus: order.status,
        orderTotalIDR: order.totalIDR,
        orderTotalUSD: order.totalUSD,
        raw: event.raw as Record<string, unknown>,
      },
    });

    return { ok: false as const, status: 409, error: "Payment integrity check failed" };
  }

  const expectedProviderId = order.paymentProviderPaymentId;
  const providerIdMatches =
    !expectedProviderId ||
    expectedProviderId === event.providerPaymentId ||
    expectedProviderId === event.providerInvoiceId;

  if (!providerIdMatches) {
    await alertPaymentIntegrity(event, options, {
      eventType: "payment_id_mismatch",
      severity: "high",
      action: "blocked",
      reasons: [
        `Expected provider payment ID ${expectedProviderId}, received ${event.providerPaymentId}`,
      ],
      orderId: order.id,
      email: order.email,
      productId: firstItem?.productId,
      variantId: firstItem?.variantId,
      product: firstItem?.product.name,
      variant: firstItem?.variant.name,
      metadata: {
        orderNumber: order.orderNumber,
        expectedProviderId,
        providerPaymentId: event.providerPaymentId,
        providerInvoiceId: event.providerInvoiceId,
      },
    });

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
    if (firstItem) {
      const payload = {
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
      };

      await sendOrderNotification(payload);

      // Sales channel = paid/completed revenue events only (DISCORD_WEBHOOK_URL)
      const isSalesEvent =
        newStatus === "PAID" ||
        newStatus === "COMPLETED" ||
        (isPaid && order.status !== "PAID");

      if (isSalesEvent) {
        await sendDiscordOrderNotification({
          ...payload,
          status: isPaid ? "PAID" : newStatus,
        });
        await writeAppLog({
          category: "SALES",
          level: "SUCCESS",
          title: `Sale ${order.orderNumber}`,
          message: `${firstItem.product.name} · ${firstItem.variant.name} · $${order.totalUSD.toFixed(2)}`,
          orderId: order.id,
          route: "/api/payment/webhook",
          metadata: {
            crypto: event.payCurrency,
            status: newStatus,
            email: order.email,
          },
        });
      } else {
        await writeAppLog({
          category: "PAYMENT",
          level:
            newStatus === "FAILED" || newStatus === "EXPIRED"
              ? "WARNING"
              : "INFO",
          title: `Payment ${newStatus}: ${order.orderNumber}`,
          message: `${firstItem.product.name} · ${event.providerStatus}`,
          orderId: order.id,
          route: "/api/payment/webhook",
        });
      }
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
