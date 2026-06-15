/**
 * POST /api/fulfillment/retry
 *
 * Retries supplier fulfillment for a paid or processing order.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  AuthorizationRequiredError,
  AuthenticationRequiredError,
  requireAdminUser,
} from "@/lib/clerk";
import { fulfillPaidOrder } from "@/lib/fulfillment";
import { getRequestContext, notifySecurityEvent } from "@/lib/fraud";

export async function POST(request: NextRequest) {
  try {
    let adminUser;
    try {
      adminUser = await requireAdminUser();
    } catch (error) {
      const requestContext = getRequestContext(request);
      const isAuthError =
        error instanceof AuthenticationRequiredError ||
        error instanceof AuthorizationRequiredError;

      await notifySecurityEvent({
        eventType: "fulfillment_retry_unauthorized",
        severity: "high",
        action: "blocked",
        reasons: [
          isAuthError
            ? error.message
            : "Unable to verify admin permissions for fulfillment retry",
        ],
        requestContext,
      });

      return NextResponse.json(
        { error: "Admin access required" },
        { status: error instanceof AuthenticationRequiredError ? 401 : 403 }
      );
    }

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
      await notifySecurityEvent({
        eventType: "fulfillment_retry_failed",
        severity: result.status === 404 ? "medium" : "high",
        action: "flagged",
        reasons: [`Retry failed: ${result.error}`],
        requestContext: getRequestContext(request),
        userId: adminUser.dbUserId,
        clerkUserId: adminUser.clerkUserId,
        orderId,
        metadata: { result },
      });

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
