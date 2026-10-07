import { NextRequest } from "next/server";
import { getResellerCatalog } from "@/lib/reseller-pricing-service";
import { resellerApiError, resellerJson } from "@/lib/reseller-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim() || "";
    return resellerJson(await getResellerCatalog(organizationId, request.headers));
  } catch (error) {
    return resellerApiError(error);
  }
}
