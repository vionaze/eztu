import { NextRequest } from "next/server";
import { B2BOrderError, downloadB2BOrderDelivery } from "@/lib/b2b-order-service";
import { resellerApiError, resellerJson } from "@/lib/reseller-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim();
    if (!organizationId) return resellerJson({ error: "Select an organization." }, 400);
    return await downloadB2BOrderDelivery(id, organizationId);
  } catch (error) {
    if (error instanceof B2BOrderError) return resellerJson({ error: error.message }, error.status);
    return resellerApiError(error);
  }
}
