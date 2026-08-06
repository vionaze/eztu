import { NextResponse } from "next/server";
import { isPakasirCheckoutEnabled } from "@kupon/payments";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      crypto: { enabled: true },
      pakasir: { enabled: isPakasirCheckoutEnabled() },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
