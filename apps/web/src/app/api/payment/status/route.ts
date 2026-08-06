import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kupon/db";
import {
  AuthenticationRequiredError,
  requireClerkUser,
} from "@/lib/clerk";

export const dynamic = "force-dynamic";

function customerMessage(status: string) {
  if (status === "PAYMENT_REVIEW") {
    return "Payment received and held for a short manual review. No further payment is needed.";
  }
  if (status === "UNDERPAID") {
    return "Payment is incomplete and on hold. Please email cs@eztopup.io for help completing the balance.";
  }
  if (status === "PAID" || status === "PROCESSING") {
    return "Payment received. Your order is being processed.";
  }
  if (status === "COMPLETED") return "Order completed.";
  if (status === "DISPUTED" || status === "REFUNDED") {
    return "This payment requires support assistance. Please email cs@eztopup.io.";
  }
  if (status === "FAILED" || status === "EXPIRED") {
    return "Payment was not completed.";
  }
  return "Waiting for payment confirmation.";
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireClerkUser();
    const orderId = request.nextUrl.searchParams.get("orderId")?.trim();
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required." }, { status: 400 });
    }
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: user.dbUserId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentProvider: true,
        totalUSDCents: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    return NextResponse.json(
      {
        ...order,
        message: customerMessage(order.status),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Please log in." }, { status: 401 });
    }
    console.error("[Payment Status]", error);
    return NextResponse.json(
      { error: "Unable to load payment status." },
      { status: 500 }
    );
  }
}
