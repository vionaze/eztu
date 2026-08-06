import { NextResponse } from "next/server";
import { getPakasirPaymentSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const pakasir = await getPakasirPaymentSettings();
  return NextResponse.json(
    {
      crypto: { enabled: true },
      pakasir: { enabled: pakasir.effectiveEnabled },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
