import { NextRequest } from "next/server";
import { getB2BOrder, b2bApiError } from "@/lib/b2b-order-service";
import { resellerJson } from "@/lib/reseller-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim() || "";
    const { id } = await context.params;
    if (!organizationId || !id) return resellerJson({ error: "Order not found." }, 404);
    return resellerJson(await getB2BOrder(organizationId, id));
  } catch (error) {
    return b2bApiError(error, resellerJson);
  }
}
