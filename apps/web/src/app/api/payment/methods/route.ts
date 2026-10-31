import { NextRequest, NextResponse } from "next/server";
import { isPakasirCheckoutEnabled } from "@kupon/payments";
import { getCryptoAvailability } from "@/lib/payment-settings";
import { getDetectedMarketCode } from "@/lib/product-availability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const marketCode = getDetectedMarketCode(request.headers);
  const cryptoAvailability = await getCryptoAvailability(marketCode);

  return NextResponse.json(
    {
      crypto: {
        enabled: cryptoAvailability.allowed,
        reason: cryptoAvailability.reason,
      },
      pakasir: { enabled: isPakasirCheckoutEnabled() },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
