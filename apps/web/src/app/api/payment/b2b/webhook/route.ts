import { NextRequest, NextResponse } from "next/server";
import { parsePaymentWebhook, verifyPaymentWebhook } from "@kupon/payments";
import { applyB2BPaymentEvent } from "@/lib/b2b-order-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifyPaymentWebhook(rawBody)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  try {
    const event = parsePaymentWebhook(rawBody);
    const result = await applyB2BPaymentEvent({
      provider: "cryptomus",
      providerPaymentId: event.providerPaymentId,
      eventId: `${event.providerPaymentId}:${event.providerStatus}`,
      normalizedStatus: event.status,
      raw: event.raw,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[B2B Cryptomus Webhook]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 503 });
  }
}
