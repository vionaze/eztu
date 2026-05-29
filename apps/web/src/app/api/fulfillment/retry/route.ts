/**
 * POST /api/fulfillment/retry
 *
 * Retries supplier fulfillment for a paid or processing order.
 */

import { NextRequest, NextResponse } from "next/server";
import { fulfillPaidOrder } from "@/lib/fulfillment";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";

    if (!orderId) {
      return NextResponse.json(
        { error: "Missing required field: orderId" },
        { status: 400 }
      );
    }

    const result = await fulfillPaidOrder(orderId);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Fulfillment Retry]", error);
    return NextResponse.json(
      { error: "Failed to retry fulfillment" },
      { status: 500 }
    );
  }
}
