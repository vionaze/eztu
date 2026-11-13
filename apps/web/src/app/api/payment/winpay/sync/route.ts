import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kupon/db";
import { AuthenticationRequiredError, requireClerkUser } from "@/lib/clerk";
import { getRequestContext } from "@/lib/fraud";
import { verifyAndApplyWinpayPayment } from "@/lib/winpay-payment";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requireClerkUser();
    const body = (await request.json()) as { orderId?: unknown };
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required." }, { status: 400 });
    }
    const ownedOrder = await prisma.order.findFirst({
      where: { id: orderId, userId: user.dbUserId, paymentProvider: "winpay" },
      select: { id: true, status: true },
    });
    if (!ownedOrder) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    if (["PAID", "PROCESSING", "COMPLETED"].includes(ownedOrder.status)) {
      return NextResponse.json({
        success: true,
        orderId: ownedOrder.id,
        status: ownedOrder.status,
      });
    }
    const result = await verifyAndApplyWinpayPayment({
      orderId,
      requestContext: getRequestContext(request),
      source: "sync",
      actorUserId: user.dbUserId,
      actorClerkUserId: user.clerkUserId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      success: true,
      orderId: result.orderId,
      status: result.status,
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Please log in." }, { status: 401 });
    }
    console.error("[WinPay Sync]", error);
    return NextResponse.json(
      { error: "Unable to verify WinPay payment." },
      { status: 503 },
    );
  }
}
