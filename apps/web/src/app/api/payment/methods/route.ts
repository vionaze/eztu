import { NextRequest, NextResponse } from "next/server";
import {
  getCryptoAvailability,
  isPakasirEnabledForCheckout,
  isResellerCryptoEnabledForCheckout,
  isResellerPakasirEnabledForCheckout,
} from "@/lib/payment-settings";
import { getDetectedMarketCode } from "@/lib/product-availability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const marketCode = getDetectedMarketCode(request.headers);
  const [
    cryptoAvailability,
    pakasirEnabled,
    resellerCryptoEnabled,
    resellerPakasirEnabled,
  ] = await Promise.all([
    getCryptoAvailability(marketCode),
    isPakasirEnabledForCheckout(),
    isResellerCryptoEnabledForCheckout(),
    isResellerPakasirEnabledForCheckout(),
  ]);

  return NextResponse.json(
    {
      crypto: {
        enabled: cryptoAvailability.allowed,
        reason: cryptoAvailability.reason,
      },
      pakasir: { enabled: pakasirEnabled },
      reseller: {
        crypto: { enabled: resellerCryptoEnabled },
        pakasir: { enabled: resellerPakasirEnabled },
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
