import { NextRequest } from "next/server";
import { getResellerLiveQuote } from "@/lib/reseller-pricing-service";
import { resellerApiError, resellerJson } from "@/lib/reseller-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const organizationId = params.get("organizationId")?.trim() || "";
    const variantId = params.get("variantId")?.trim() || "";
    const quantity = Number(params.get("quantity") || "1");
    if (!variantId || !Number.isSafeInteger(quantity) || quantity < 1) {
      return resellerJson({ error: "Invalid package or quantity" }, 400);
    }
    return resellerJson(await getResellerLiveQuote(organizationId, variantId, quantity, request.headers));
  } catch (error) {
    return resellerApiError(error);
  }
}
