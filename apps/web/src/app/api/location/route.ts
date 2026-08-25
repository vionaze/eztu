import { NextResponse } from "next/server";
import { resolveCountryByRegion } from "@/lib/currencies";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const headerCode =
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("x-country-code");
  const country = resolveCountryByRegion(headerCode);
  return NextResponse.json(
    { countryCode: country.code },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
