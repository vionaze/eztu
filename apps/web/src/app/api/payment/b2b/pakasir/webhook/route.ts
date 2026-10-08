import { NextRequest, NextResponse } from "next/server";
import {
  assertPakasirTransactionMatches,
  getPakasirTransactionStatus,
  parsePakasirWebhook,
  verifyPakasirWebhookSecret,
} from "@kupon/payments";
import { prisma } from "@kupon/db";
import { applyB2BPaymentEvent } from "@/lib/b2b-order-service";

export const dynamic = "force-dynamic";

const MAX_WEBHOOK_BYTES = 8 * 1024;

export async function POST(request: NextRequest) {
  try {
    if (!verifyPakasirWebhookSecret(request.headers.get("x-secret"))) {
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
    }
    const declaredLength = Number(request.headers.get("content-length") || "0");
    if (declaredLength > MAX_WEBHOOK_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    const notification = parsePakasirWebhook(rawBody);
    if (notification.status !== "completed") {
      return NextResponse.json({ success: true, ignored: true });
    }

    const intent = await prisma.b2BPaymentIntent.findFirst({
      where: { provider: "pakasir", providerPaymentId: notification.txnId },
    });
    if (!intent) {
      // Not a B2B intent (could be a consumer order); acknowledge without action.
      return NextResponse.json({ success: true, ignored: true });
    }

    const transaction = await getPakasirTransactionStatus({ txnId: notification.txnId });
    assertPakasirTransactionMatches({
      transaction,
      txnId: notification.txnId,
      orderId: intent.orderId,
      amountIDR: Number(intent.amountIDR),
      requireCompleted: true,
    });

    const result = await applyB2BPaymentEvent({
      provider: "pakasir",
      providerPaymentId: transaction.txnId,
      eventId: `${transaction.txnId}:${transaction.status}`,
      normalizedStatus: "paid",
      raw: transaction.raw,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[B2B Pakasir Webhook]", message);
    const unavailable = message.includes("Pakasir API error") || message.includes("timeout") || message.includes("aborted");
    return NextResponse.json({ error: "Webhook verification failed" }, { status: unavailable ? 503 : 409 });
  }
}
