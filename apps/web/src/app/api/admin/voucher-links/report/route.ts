import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kupon/db";
import {
  AuthenticationRequiredError,
  AuthorizationRequiredError,
  requireAdminUser,
} from "@/lib/clerk";
import { getRequestContext, notifySecurityEvent } from "@/lib/fraud";

function getMonthRange(month: string | null) {
  const normalized = month || new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(normalized)) return null;

  const start = new Date(`${normalized}-01T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return null;

  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  return { month: normalized, start, end };
}

export async function GET(request: NextRequest) {
  try {
    try {
      await requireAdminUser();
    } catch (error) {
      const isAuthError =
        error instanceof AuthenticationRequiredError ||
        error instanceof AuthorizationRequiredError;

      await notifySecurityEvent({
        eventType: "voucher_link_report_unauthorized",
        severity: "high",
        action: "blocked",
        reasons: [
          isAuthError
            ? error.message
            : "Unable to verify admin permissions for voucher link report",
        ],
        requestContext: getRequestContext(request),
      });

      return NextResponse.json(
        { error: "Admin access required" },
        { status: error instanceof AuthenticationRequiredError ? 401 : 403 }
      );
    }

    const range = getMonthRange(request.nextUrl.searchParams.get("month"));
    if (!range) {
      return NextResponse.json(
        { error: "Invalid month. Use YYYY-MM." },
        { status: 400 }
      );
    }

    const links = await prisma.voucherDeliveryLink.findMany({
      where: {
        createdAt: {
          gte: range.start,
          lt: range.end,
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          include: {
            supplierOrder: true,
            items: {
              include: {
                product: true,
                variant: true,
              },
            },
          },
        },
      },
    });
    const visited = links.filter((link) => Boolean(link.firstVisitedAt));
    const unvisited = links.filter((link) => !link.firstVisitedAt);

    return NextResponse.json({
      month: range.month,
      totals: {
        links: links.length,
        visited: visited.length,
        unvisited: unvisited.length,
      },
      links: links.map((link) => {
        const item = link.order.items[0];

        return {
          orderId: link.orderId,
          orderNumber: link.order.orderNumber,
          email: link.email,
          sentAt: link.sentAt,
          firstVisitedAt: link.firstVisitedAt,
          lastVisitedAt: link.lastVisitedAt,
          visitCount: link.visitCount,
          product: item?.product.name || null,
          variant: item?.variant.name || null,
          fulfillmentStatus: link.order.supplierOrder?.status || null,
          fulfillmentRef: link.order.supplierOrder?.providerOrderId || null,
          lastSendError: link.lastSendError,
        };
      }),
    });
  } catch (error) {
    console.error("[Voucher Link Report]", error);
    return NextResponse.json(
      { error: "Failed to generate voucher link report" },
      { status: 500 }
    );
  }
}
