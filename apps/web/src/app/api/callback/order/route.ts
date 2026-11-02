import { NextRequest, NextResponse } from "next/server";
import { applySupplierOrderSnapshot } from "@/lib/fulfillment";
import { reconcileB2BSupplierCallback } from "@/lib/b2b-order-service";
import { getRequestContext, notifySecurityEvent } from "@/lib/fraud";
import {
  parseSupplierCallbackPayload,
  redactSupplierSnapshot,
} from "@/lib/supplier";
import { isProductionRuntime, safeEqualSecret } from "@/lib/security";

function isValidCallbackToken(request: NextRequest) {
  const expected =
    process.env.ORDER_STATUS_CALLBACK_TOKEN?.trim() ||
    process.env.SUPPLIER_CALLBACK_TOKEN?.trim();

  // Fail closed in production if callback token is not configured
  if (!expected) {
    if (isProductionRuntime()) {
      console.error(
        "[Callback] ORDER_STATUS_CALLBACK_TOKEN is not set — rejecting"
      );
      return false;
    }
    return true;
  }

  const provided = request.nextUrl.searchParams.get("token");
  return safeEqualSecret(provided, expected);
}

export async function POST(request: NextRequest) {
  const requestContext = getRequestContext(request);

  try {
    if (!isValidCallbackToken(request)) {
      // No IP / User-Agent exemption. Client IPs are header-derived and
      // spoofable when the origin is reached directly, so a "trusted IP" bypass
      // is replayable by anyone (see docs/audits/2026-10-31-security-audit.md).
      // The token is the only proof of authenticity — healthchecks must send it
      // like every other caller.
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

    if (await reconcileB2BSupplierCallback(snapshot.tid)) {
      return NextResponse.json({ message: "SUCCESS" });
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
