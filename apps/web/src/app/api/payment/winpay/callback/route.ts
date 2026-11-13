import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kupon/db";
import { parseWinpayCallback } from "@kupon/payments";
import { getRequestContext, notifySecurityEvent } from "@/lib/fraud";
import { verifyAndApplyWinpayPayment } from "@/lib/winpay-payment";

export const dynamic = "force-dynamic";

const MAX_CALLBACK_BYTES = 8 * 1024;

/** WinPay retries up to 3 times until it receives exactly this body. */
function accepted() {
  return new NextResponse("ACCEPTED", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function resolveOrderId(candidate: string | null) {
  if (!candidate) return null;
  const order = await prisma.order.findUnique({
    where: { id: candidate },
    select: { id: true },
  });
  if (order) return order.id;
  const b2b = await prisma.b2BOrder.findUnique({
    where: { id: candidate },
    select: { id: true },
  });
  return b2b?.id ?? null;
}

export async function POST(request: NextRequest) {
  const requestContext = getRequestContext(request);
  let rawBody = "";
  try {
    const declaredLength = Number(request.headers.get("content-length") || "0");
    if (declaredLength > MAX_CALLBACK_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_CALLBACK_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    const notification = parseWinpayCallback(rawBody);
    // Docs show `ref` and `invoice.ref` carrying different values; try both.
    const orderId =
      (await resolveOrderId(notification.ref)) ||
      (await resolveOrderId(notification.invoiceRef));

    if (!orderId) {
      await notifySecurityEvent({
        eventType: "winpay_callback_unknown_order",
        severity: "high",
        action: "blocked",
        reasons: [
          `ref=${notification.ref ?? "-"} invoiceRef=${notification.invoiceRef ?? "-"}`,
        ],
        requestContext,
        metadata: {
          amountIDR: notification.amountIDR,
          channel: notification.channel,
        },
      });
      return NextResponse.json({ error: "Order not found" }, { status: 409 });
    }

    const result = await verifyAndApplyWinpayPayment({
      orderId,
      notification,
      requestContext,
      source: "webhook",
    });

    if (!result.ok) {
      if (result.status === 503) {
        return NextResponse.json({ error: result.error }, { status: 503 });
      }
      await notifySecurityEvent({
        eventType: "winpay_callback_rejected",
        severity: "high",
        action: "blocked",
        reasons: [result.error],
        requestContext,
        orderId,
        metadata: {
          invoiceId: notification.invoiceId,
          amountIDR: notification.amountIDR,
        },
      });
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return accepted();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[WinPay Callback]", message);
    await notifySecurityEvent({
      eventType: "winpay_callback_verification_failed",
      severity: "high",
      action: "blocked",
      reasons: [message],
      requestContext,
      metadata: { bodyLength: Buffer.byteLength(rawBody, "utf8") },
    });
    const unavailable =
      message.includes("WinPay API error") ||
      message.includes("aborted") ||
      message.includes("timeout");
    return NextResponse.json(
      { error: "Callback verification failed" },
      { status: unavailable ? 503 : 409 },
    );
  }
}
