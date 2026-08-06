import "server-only";

import { Prisma, prisma } from "@kupon/db";
import {
  assertPakasirTransactionMatches,
  getPakasirProjectSlug,
  getPakasirTransactionDetail,
  type PakasirWebhookNotification,
  type PaymentWebhookEvent,
} from "@kupon/payments";
import {
  applyPaymentEventToOrder,
} from "@/lib/payment-orders";
import type { FraudRequestContext } from "@/lib/fraud";

const VERIFICATION_COOLDOWN_MS = 5_000;

async function reservePakasirVerification(orderId: string, source: string) {
  const now = new Date();
  const eventId = `verification:${orderId}`;
  try {
    await prisma.paymentEvent.create({
      data: {
        provider: "pakasir",
        eventId,
        eventType: "transaction.detail",
        providerPaymentId: orderId,
        orderId,
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
      provider: "pakasir",
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

export async function verifyAndApplyPakasirPayment(params: {
  orderId: string;
  notification?: PakasirWebhookNotification;
  requestContext?: FraudRequestContext;
  source: "webhook" | "sync";
  actorUserId?: string;
  actorClerkUserId?: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: {
      id: true,
      status: true,
      totalIDR: true,
      paymentProvider: true,
    },
  });
  if (!order) {
    return { ok: false as const, status: 404, error: "Order not found" };
  }
  if (order.paymentProvider !== "pakasir") {
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

  const project = getPakasirProjectSlug();
  if (params.notification) {
    assertPakasirTransactionMatches({
      transaction: params.notification,
      project,
      orderId: order.id,
      amountIDR: order.totalIDR,
      requireCompleted: true,
    });
  }

  const reserved = await reservePakasirVerification(order.id, params.source);
  if (!reserved) {
    return {
      ok: true as const,
      orderId: order.id,
      previousStatus: order.status,
      status: order.status,
      providerStatus: "verification_throttled",
      applied: false as const,
    };
  }

  const transaction = await getPakasirTransactionDetail({
    orderId: order.id,
    amountIDR: order.totalIDR,
  });
  assertPakasirTransactionMatches({
    transaction,
    project,
    orderId: order.id,
    amountIDR: order.totalIDR,
  });

  if (transaction.status !== "completed") {
    return {
      ok: true as const,
      orderId: order.id,
      previousStatus: order.status,
      status: order.status,
      providerStatus: transaction.status,
      applied: false as const,
    };
  }

  const event: PaymentWebhookEvent = {
    provider: "pakasir",
    providerPaymentId: order.id,
    providerInvoiceId: order.id,
    orderId: order.id,
    status: "paid",
    providerStatus: transaction.status,
    payCurrency: "IDR",
    payAmount: transaction.amount,
    actuallyPaid: transaction.amount,
    txHash: null,
    raw: transaction.raw,
  };
  return applyPaymentEventToOrder(event, {
    requestContext: params.requestContext,
    source: params.source,
    actorUserId: params.actorUserId,
    actorClerkUserId: params.actorClerkUserId,
  });
}
