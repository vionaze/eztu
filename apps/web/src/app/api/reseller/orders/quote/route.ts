import { NextRequest } from "next/server";
import { quoteB2BOrder, b2bApiError } from "@/lib/b2b-order-service";
import { resellerJson, requireSameOrigin } from "@/lib/reseller-api";
import { validateB2BLines } from "@/lib/b2b-order-rules";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = (await request.json().catch(() => ({}))) as { organizationId?: unknown; lines?: unknown };
    const organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : "";
    const validated = validateB2BLines(body.lines);
    if (!organizationId || !validated.ok) {
      return resellerJson({ error: validated.ok ? "Select an organization." : validated.error }, 400);
    }
    const quote = await quoteB2BOrder({ organizationId, lines: validated.lines, requestHeaders: request.headers });
    return resellerJson(quote);
  } catch (error) {
    return b2bApiError(error, resellerJson);
  }
}
