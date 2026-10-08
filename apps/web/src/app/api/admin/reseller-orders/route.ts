import { NextRequest } from "next/server";
import { requirePlatformAdminForResellers } from "@/lib/reseller-auth";
import { listAdminB2BOrders, b2bApiError } from "@/lib/b2b-order-service";
import { resellerJson } from "@/lib/reseller-api";

export const dynamic = "force-dynamic";

const STATUSES = ["DRAFT", "PAYMENT_PENDING", "PAID", "PROCESSING", "COMPLETED", "PAYMENT_FAILED", "CANCELLED", "MANUAL_REVIEW", "REFUND_PENDING", "REFUNDED"];

export async function GET(request: NextRequest) {
  try {
    await requirePlatformAdminForResellers();
    const params = request.nextUrl.searchParams;
    const status = params.get("status")?.trim() ?? "";
    return resellerJson(await listAdminB2BOrders({
      status: STATUSES.includes(status) ? status : undefined,
      organizationId: params.get("organizationId")?.trim() || undefined,
      q: params.get("q")?.trim().slice(0, 100) || undefined,
    }));
  } catch (error) {
    return b2bApiError(error, resellerJson);
  }
}
