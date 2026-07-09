import { NextRequest, NextResponse } from "next/server";
import { applySupplierOrderSnapshot } from "@/lib/fulfillment";
import { getRequestContext, notifySecurityEvent } from "@/lib/fraud";
import {
  parseSupplierCallbackPayload,
  redactSupplierSnapshot,
} from "@/lib/supplier";

function isValidCallbackToken(request: NextRequest) {
  const expected =
    process.env.ORDER_STATUS_CALLBACK_TOKEN?.trim() ||
    process.env.SUPPLIER_CALLBACK_TOKEN?.trim();
  if (!expected) return true;

  return request.nextUrl.searchParams.get("token") === expected;
}

export async function POST(request: NextRequest) {
  const requestContext = getRequestContext(request);

  try {
    if (!isValidCallbackToken(request)) {
      await notifySecurityEvent({
        eventType: "supplier_callback_invalid_token",
        severity: "high",
        action: "blocked",
        reasons: ["Order callback token is missing or invalid"],
        requestContext,
      });

      return NextResponse.json({ message: "FORBIDDEN" }, { status: 403 });
    }

    const body = (await request.json()) as unknown;
    const snapshot = parseSupplierCallbackPayload(body);

    if (!snapshot.tid && !snapshot.referenceId) {
      await notifySecurityEvent({
        eventType: "supplier_callback_missing_reference",
        severity: "high",
        action: "blocked",
        reasons: ["Order callback missing tid and reference_id"],
        requestContext,
        metadata: { snapshot: redactSupplierSnapshot(snapshot) },
      });

      return NextResponse.json({ message: "BAD_REQUEST" }, { status: 400 });
    }

    const result = await applySupplierOrderSnapshot(snapshot);

    if (!result.ok) {
      return NextResponse.json(
        { message: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({ message: "SUCCESS" });
  } catch (error) {
    console.error("[Order Callback]", error);
    await notifySecurityEvent({
      eventType: "supplier_callback_failed",
      severity: "high",
      action: "flagged",
      reasons: [
        error instanceof Error ? error.message : "Unknown callback processing error",
      ],
      requestContext,
    });

    return NextResponse.json(
      { message: "CALLBACK_PROCESSING_FAILED" },
      { status: 500 }
    );
  }
}
