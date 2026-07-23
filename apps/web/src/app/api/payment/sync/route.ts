/**
 * POST /api/payment/sync
 *
 * Pulls a Cryptomus payment status and applies it to the local order.
 * Useful in local development where Cryptomus cannot reach localhost webhooks.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kupon/db";
import { getPaymentStatus } from "@kupon/payments";
import {
  AuthenticationRequiredError,
  isAdminRole,
  requireClerkUser,
} from "@/lib/clerk";
import { getRequestContext, notifySecurityEvent } from "@/lib/fraud";
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

    let authenticatedUser;
    try {
      authenticatedUser = await requireClerkUser();
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        await notifySecurityEvent({
          eventType: "payment_sync_unauthenticated",
          severity: "medium",
          action: "blocked",
          reasons: ["Unauthenticated payment sync attempt"],
          requestContext: getRequestContext(request),
          metadata: { paymentId },
        });

        return NextResponse.json(
          { error: "Please log in before syncing payment status." },
          { status: 401 }
        );
      }

      throw error;
    }

    const localOrder = await prisma.order.findFirst({
      where: {
        OR: [
          { paymentProviderPaymentId: paymentId },
          { paymentProviderInvoiceId: paymentId },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        email: true,
        status: true,
      },
    });

    if (!localOrder) {
      await notifySecurityEvent({
        eventType: "payment_sync_unknown_payment",
        severity: "medium",
        action: "flagged",
        reasons: [`Unknown payment ID sync attempt: ${paymentId}`],
        requestContext: getRequestContext(request),
        userId: authenticatedUser.dbUserId,
        clerkUserId: authenticatedUser.clerkUserId,
        metadata: { paymentId },
      });

      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    if (
      localOrder.userId !== authenticatedUser.dbUserId &&
      !isAdminRole(authenticatedUser.role, authenticatedUser.email)
    ) {
      await notifySecurityEvent({
        eventType: "payment_sync_forbidden",
        severity: "high",
        action: "blocked",
        reasons: [
          `User attempted to sync another user's payment: ${paymentId}`,
        ],
        requestContext: getRequestContext(request),
        email: localOrder.email,
        userId: authenticatedUser.dbUserId,
        clerkUserId: authenticatedUser.clerkUserId,
        orderId: localOrder.id,
        metadata: {
          paymentId,
          orderOwnerUserId: localOrder.userId,
          orderNumber: localOrder.orderNumber,
          orderStatus: localOrder.status,
        },
      });

      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    const event = await getPaymentStatus(paymentId);
    const result = await applyPaymentEventToOrder(event, {
      requestContext: getRequestContext(request),
      source: "sync",
      actorUserId: authenticatedUser.dbUserId,
      actorClerkUserId: authenticatedUser.clerkUserId,
    });

    if (!result.ok) {
      await notifySecurityEvent({
        eventType: "payment_sync_apply_failed",
        severity: result.status === 404 ? "medium" : "high",
        action: result.status === 409 ? "blocked" : "flagged",
        reasons: [`Payment sync apply failed: ${result.error}`],
        requestContext: getRequestContext(request),
        email: localOrder.email,
        userId: authenticatedUser.dbUserId,
        clerkUserId: authenticatedUser.clerkUserId,
        orderId: localOrder.id,
        metadata: {
          paymentId,
          result,
        },
      });

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
