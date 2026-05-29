/**
 * POST /api/payment/sync
 *
 * Pulls a NOWPayments payment status and applies it to the local order.
 * This is useful in local development where NOWPayments cannot reach localhost
 * webhooks directly.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPaymentStatus } from "@kupon/payments";
import { applyPaymentEventToOrder } from "@/lib/payment-orders";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const paymentId =
      typeof body.paymentId === "string" ? body.paymentId.trim() : "";

    if (!paymentId) {
      return NextResponse.json(
        { error: "Missing required field: paymentId" },
        { status: 400 }
      );
    }

    const event = await getPaymentStatus(paymentId);
    const result = await applyPaymentEventToOrder(event);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: result.orderId,
      status: result.status,
    });
  } catch (error) {
    console.error("[Payment Sync]", error);
    return NextResponse.json(
      { error: "Failed to sync payment status" },
      { status: 500 }
    );
  }
}
