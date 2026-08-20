import { NextResponse } from "next/server";
import { writeAppLog } from "@/lib/app-log";
import { refreshAllSupplierPrices } from "@/lib/supplier-pricing";
import { isProductionRuntime, safeEqualSecret } from "@/lib/security";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorizeProductPriceCron(request: Request) {
  const secret =
    process.env.PRODUCT_PRICE_CRON_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "";
  if (!secret) return !isProductionRuntime();

  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (safeEqualSecret(bearer, secret)) return true;

  if (!isProductionRuntime()) {
    const querySecret = new URL(request.url).searchParams.get("secret") || "";
    return safeEqualSecret(querySecret, secret);
  }
  return false;
}

async function handle(request: Request) {
  if (!authorizeProductPriceCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshAllSupplierPrices();
    await writeAppLog({
      category: "SYSTEM",
      level:
        result.failedCountries.length > 0 || result.missing > 0
          ? "WARNING"
          : "SUCCESS",
      title: `Supplier prices refreshed: ${result.updated}/${result.checked}`,
      message:
        result.failedCountries.length > 0
          ? `Failed countries: ${result.failedCountries.join(", ")}`
          : undefined,
      actor: "cron:product-prices",
      route: "/api/cron/product-prices",
      metadata: result,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown refresh error";
    await writeAppLog({
      category: "SYSTEM",
      level: "ERROR",
      title: "Supplier price refresh failed",
      message,
      actor: "cron:product-prices",
      route: "/api/cron/product-prices",
    });
    return NextResponse.json(
      { ok: false, error: "Supplier price refresh failed" },
      { status: 503 },
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
