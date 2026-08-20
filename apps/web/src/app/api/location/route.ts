import { NextResponse } from "next/server";
import { findCountryByRegion } from "@/lib/currencies";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const headerCode =
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("x-country-code");
  const country = findCountryByRegion(headerCode);
  return NextResponse.json(
    { countryCode: country?.code || null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
