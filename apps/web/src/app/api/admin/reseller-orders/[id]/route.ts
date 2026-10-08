import { NextRequest } from "next/server";
import { requirePlatformAdminForResellers } from "@/lib/reseller-auth";
import { adminRetryFulfillment, adminSetOrderStatus, getAdminB2BOrder, b2bApiError } from "@/lib/b2b-order-service";
import { resellerJson, requireSameOrigin } from "@/lib/reseller-api";
import { canAdminOrderTransition, type B2BAdminStatusTarget } from "@/lib/b2b-order-rules";
import { writeAppLog } from "@/lib/app-log";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    await requirePlatformAdminForResellers();
    const { id } = await context.params;
    return resellerJson(await getAdminB2BOrder(id));
  } catch (error) {
    return b2bApiError(error, resellerJson);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const admin = await requirePlatformAdminForResellers();
    requireSameOrigin(request);
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { action?: unknown; status?: unknown; note?: unknown; confirmOrderNumber?: unknown };
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;
    const actor = admin.email || admin.dbUserId;

    if (body.action === "retry") {
      if (body.confirmOrderNumber !== undefined) {
        const current = await getAdminB2BOrder(id);
        if (body.confirmOrderNumber !== current.order.orderNumber) {
          return resellerJson({ error: "Confirmation does not match this order number." }, 400);
        }
      }
      const result = await adminRetryFulfillment(id);
      await writeAppLog({
        category: "ADMIN", level: "WARNING", title: `B2B fulfillment retry: ${id}`,
        message: note || "Admin re-submitted the order to the supplier.", actor,
        route: `/api/admin/reseller-orders/${id}`, metadata: { orderId: id, result, note },
      });
      return resellerJson({ ok: true, result });
    }

    if (typeof body.status === "string" && ["REFUND_PENDING", "REFUNDED", "CANCELLED"].includes(body.status)) {
      const target = body.status as B2BAdminStatusTarget;
      const current = await getAdminB2BOrder(id);
      if (!canAdminOrderTransition(current.order.status, target)) {
        return resellerJson({ error: `Cannot move ${current.order.status} to ${target}.` }, 409);
      }
      await adminSetOrderStatus(id, target, note);
      await writeAppLog({
        category: "ADMIN", level: "WARNING", title: `B2B order marked ${target}: ${current.order.orderNumber}`,
        message: note || "Manual refund/cancel bookkeeping recorded. Provider-side money movement stays manual.",
        actor, route: `/api/admin/reseller-orders/${id}`, metadata: { orderId: id, from: current.order.status, to: target, note },
      });
      return resellerJson({ ok: true, status: target });
    }

    return resellerJson({ error: "Unknown admin action." }, 400);
  } catch (error) {
    return b2bApiError(error, resellerJson);
  }
}
