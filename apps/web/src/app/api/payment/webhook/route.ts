/**
 * POST /api/payment/webhook
 *
 * Receives payment status updates from Cryptomus.
 * Verifies the webhook body signature, updates order status,
 * and triggers fulfillment when paid.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  parsePaymentWebhook,
  verifyPaymentWebhook,
} from "@kupon/payments";
import { getRequestContext, notifySecurityEvent } from "@/lib/fraud";
import { applyPaymentEventToOrder } from "@/lib/payment-orders";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const requestContext = getRequestContext(request);

    // Cryptomus sends `sign` inside the JSON body (not a header).
    if (!verifyPaymentWebhook(rawBody, null)) {
      console.warn("[Webhook] Invalid Cryptomus signature");
      await notifySecurityEvent({
        eventType: "payment_webhook_invalid_signature",
        severity: "high",
        action: "blocked",
        reasons: ["Cryptomus webhook signature verification failed"],
        requestContext,
        metadata: {
          bodyLength: rawBody.length,
          provider: "cryptomus",
        },
      });

      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 403 }
      );
    }

    const event = parsePaymentWebhook(rawBody);

    if (!event.orderId || !event.providerPaymentId) {
      await notifySecurityEvent({
        eventType: "payment_webhook_missing_fields",
        severity: "high",
        action: "blocked",
        reasons: ["Cryptomus webhook missing orderId or providerPaymentId"],
        requestContext,
        metadata: {
          providerPaymentId: event.providerPaymentId || null,
          orderId: event.orderId || null,
          provider: "cryptomus",
        },
      });

      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const result = await applyPaymentEventToOrder(event, {
      requestContext,
      source: "webhook",
    });

    if (!result.ok && result.status === 404) {
      console.warn(`[Webhook] Order not found: ${event.orderId}`);
      return NextResponse.json(
        { error: result.error },
        { status: 404 }
      );
    }

    if (!result.ok && result.status === 409) {
      console.warn(`[Webhook] Payment integrity issue for order: ${event.orderId}`);
      return NextResponse.json(
        { error: result.error },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, status: result.status });
  } catch (error) {
    console.error("[Webhook]", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
