import { NextRequest } from "next/server";
import { createB2BOrder, listB2BOrders, b2bApiError } from "@/lib/b2b-order-service";
import { resellerJson, requireSameOrigin } from "@/lib/reseller-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim() || "";
    if (!organizationId) return resellerJson({ error: "Select an organization." }, 400);
    return resellerJson(await listB2BOrders(organizationId));
  } catch (error) {
    return b2bApiError(error, resellerJson);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = (await request.json().catch(() => ({}))) as {
      organizationId?: unknown;
      quoteToken?: unknown;
      idempotencyKey?: unknown;
      paymentMethod?: unknown;
      deliveryEmail?: unknown;
    };
    const organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : "";
    const quoteToken = typeof body.quoteToken === "string" ? body.quoteToken : "";
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
    const paymentMethod = body.paymentMethod === "CRYPTO" || body.paymentMethod === "PAKASIR" ? body.paymentMethod : null;
    if (!organizationId || !quoteToken || !/^[A-Za-z0-9_-]{8,120}$/.test(idempotencyKey) || !paymentMethod) {
      return resellerJson({ error: "Invalid order request." }, 400);
    }
    const result = await createB2BOrder({
      organizationId,
      quoteToken,
      idempotencyKey,
      paymentMethod,
      deliveryEmail: typeof body.deliveryEmail === "string" ? body.deliveryEmail : null,
      requestHeaders: request.headers,
    });
    return resellerJson(result, result.reused ? 200 : 201);
  } catch (error) {
    return b2bApiError(error, resellerJson);
  }
}
