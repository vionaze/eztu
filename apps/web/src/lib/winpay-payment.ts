import "server-only";

import { Prisma, prisma } from "@kupon/db";
import {
  assertWinpayInvoiceMatches,
  findWinpayInvoice,
  type PaymentWebhookEvent,
  type WinpayCallbackNotification,
} from "@kupon/payments";
import { applyPaymentEventToOrder } from "@/lib/payment-orders";
import type { FraudRequestContext } from "@/lib/fraud";
import { applyB2BPaymentEvent } from "@/lib/b2b-order-service";

const VERIFICATION_COOLDOWN_MS = 5_000;

async function reserveWinpayVerification(
  orderId: string,
  source: string,
  isReseller: boolean,
) {
  const now = new Date();
  const eventId = `verification:${orderId}`;
  try {
    await prisma.paymentEvent.create({
      data: {
        provider: "winpay",
        eventId,
        eventType: "invoice.verify",
        providerPaymentId: orderId,
        orderId: isReseller ? null : orderId,
        processedAt: now,
        payload: { source },
      },
    });
    return true;
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      throw error;
    }
  }
  const claimed = await prisma.paymentEvent.updateMany({
    where: {
      provider: "winpay",
      eventId,
      OR: [
        { processedAt: null },
        { processedAt: { lt: new Date(now.getTime() - VERIFICATION_COOLDOWN_MS) } },
      ],
    },
    data: { processedAt: now, payload: { source } },
  });
  return claimed.count === 1;
}

export async function verifyAndApplyWinpayPayment(params: {
  orderId: string;
  notification?: WinpayCallbackNotification;
  requestContext?: FraudRequestContext;
  source: "webhook" | "sync";
  actorUserId?: string;
  actorClerkUserId?: string;
}) {
  const consumerOrder = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: {
      id: true,
      status: true,
      totalIDR: true,
      paymentProvider: true,
      paymentProviderPaymentId: true,
    },
  });
  const resellerOrder = consumerOrder
    ? null
    : await prisma.b2BOrder.findUnique({
        where: { id: params.orderId },
        select: {
          id: true,
          status: true,
          paymentIntent: {
            select: { provider: true, providerPaymentId: true, amountIDR: true },
          },
        },
      });
  const intent = resellerOrder?.paymentIntent;
  const order =
    consumerOrder ??
    (resellerOrder && intent
      ? {
          id: resellerOrder.id,
          status: resellerOrder.status,
          totalIDR: Number(intent.amountIDR),
          paymentProvider: intent.provider,
          paymentProviderPaymentId: intent.providerPaymentId,
        }
      : null);
  if (!order) {
    return { ok: false as const, status: 404, error: "Order not found" };
  }
  if (order.paymentProvider !== "winpay") {
    return { ok: false as const, status: 409, error: "Payment provider mismatch" };
  }

  if (["PAID", "PROCESSING", "COMPLETED"].includes(order.status)) {
    return {
      ok: true as const,
      orderId: order.id,
      previousStatus: order.status,
      status: order.status,
      providerStatus: "already_confirmed",
      applied: false as const,
    };
  }

  const invoiceId = order.paymentProviderPaymentId;
  if (!invoiceId) {
    return { ok: false as const, status: 409, error: "WinPay invoice ID is missing" };
  }

  // The callback carries no signature, so it is only a hint: the authenticated
  // find-invoice call below is the source of truth.
  if (
    params.notification?.amountIDR != null &&
    params.notification.amountIDR !== order.totalIDR
  ) {
    return { ok: false as const, status: 409, error: "WinPay amount mismatch" };
  }

  const reserved = await reserveWinpayVerification(
    order.id,
    params.source,
    Boolean(resellerOrder),
  );
  if (!reserved) {
    if (params.source === "webhook") {
      return {
        ok: false as const,
        status: 503,
        error: "WinPay verification is busy; retry callback",
      };
    }
    return {
      ok: true as const,
      orderId: order.id,
      previousStatus: order.status,
      status: order.status,
      providerStatus: "verification_throttled",
      applied: false as const,
    };
  }

  const invoice = await findWinpayInvoice({ invoiceId });
  assertWinpayInvoiceMatches({
    invoice,
    orderId: order.id,
    amountIDR: order.totalIDR,
  });

  if (invoice.status !== "paid") {
    if (params.source === "webhook") {
      return {
        ok: false as const,
        status: 503,
        error: `WinPay invoice is not paid yet (${invoice.providerStatus}); retry callback`,
      };
    }
    return {
      ok: true as const,
      orderId: order.id,
      previousStatus: order.status,
      status: order.status,
      providerStatus: invoice.providerStatus,
      applied: false as const,
    };
  }

  if (resellerOrder) {
    const result = await applyB2BPaymentEvent({
      provider: "winpay",
      providerPaymentId: invoice.id,
      eventId: `${invoice.id}:${invoice.providerStatus}`,
      normalizedStatus: "paid",
      raw: invoice.raw,
    });
    const current = await prisma.b2BOrder.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true },
    });
    return {
      ok: true as const,
      orderId: order.id,
      previousStatus: order.status,
      status: current.status,
      providerStatus: invoice.providerStatus,
      applied: result.applied,
    };
  }

  const event: PaymentWebhookEvent = {
    provider: "winpay",
    providerPaymentId: invoice.id,
    providerInvoiceId: invoice.id,
    orderId: order.id,
    status: "paid",
    providerStatus: invoice.providerStatus,
    payCurrency: "IDR",
    payAmount: invoice.amountIDR,
    actuallyPaid: invoice.paidAmountIDR ?? invoice.amountIDR,
    txHash: null,
    raw: invoice.raw,
  };
  return applyPaymentEventToOrder(event, {
    requestContext: params.requestContext,
    source: params.source,
    actorUserId: params.actorUserId,
    actorClerkUserId: params.actorClerkUserId,
  });
}
