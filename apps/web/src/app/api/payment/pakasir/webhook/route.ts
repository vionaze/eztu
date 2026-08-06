import { NextRequest, NextResponse } from "next/server";
import { parsePakasirWebhook } from "@kupon/payments";
import { getRequestContext, notifySecurityEvent } from "@/lib/fraud";
import { verifyAndApplyPakasirPayment } from "@/lib/pakasir-payment";

export const dynamic = "force-dynamic";

const MAX_WEBHOOK_BYTES = 8 * 1024;

export async function POST(request: NextRequest) {
  const requestContext = getRequestContext(request);
  let rawBody = "";
  try {
    const declaredLength = Number(request.headers.get("content-length") || "0");
    if (declaredLength > MAX_WEBHOOK_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    const notification = parsePakasirWebhook(rawBody);
    if (notification.status !== "completed") {
      return NextResponse.json({ success: true, ignored: true });
    }
    const result = await verifyAndApplyPakasirPayment({
      orderId: notification.orderId,
      notification,
      requestContext,
      source: "webhook",
    });
    if (!result.ok) {
      await notifySecurityEvent({
        eventType: "pakasir_webhook_rejected",
        severity: "high",
        action: "blocked",
        reasons: [result.error],
        requestContext,
        orderId: notification.orderId,
        metadata: {
          project: notification.project,
          amount: notification.amount,
          status: notification.status,
        },
      });
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, status: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Pakasir Webhook]", message);
    await notifySecurityEvent({
      eventType: "pakasir_webhook_verification_failed",
      severity: "high",
      action: "blocked",
      reasons: [message],
      requestContext,
      metadata: { bodyLength: Buffer.byteLength(rawBody, "utf8") },
    });
    const unavailable =
      message.includes("Pakasir API error") ||
      message.includes("aborted") ||
      message.includes("timeout");
    return NextResponse.json(
      { error: "Webhook verification failed" },
      { status: unavailable ? 503 : 409 }
    );
  }
}
