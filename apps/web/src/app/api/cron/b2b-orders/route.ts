import { NextResponse } from "next/server";
import { reconcileB2BOrders } from "@/lib/b2b-order-service";
import { isProductionRuntime, safeEqualSecret } from "@/lib/security";
import { writeAppLog } from "@/lib/app-log";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorize(request: Request) {
  const secret = process.env.B2B_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim() || "";
  if (!secret) return !isProductionRuntime();
  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  return safeEqualSecret(bearer, secret);
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await reconcileB2BOrders();
    await writeAppLog({
      category: "SYSTEM",
      level: result.stuck > 0 ? "WARNING" : "INFO",
      title: "B2B order reconciliation",
      message: `expired ${result.expired}, manual review ${result.stuck}, retried ${result.retried}`,
      actor: "cron:b2b-orders",
      route: "/api/cron/b2b-orders",
      metadata: result,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[B2B Cron]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 503 });
  }
}
