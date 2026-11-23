import { NextRequest, NextResponse } from "next/server";
import {
  getCryptoAvailability,
  isResellerCryptoEnabledForCheckout,
  isResellerWinpayEnabledForCheckout,
  isWinpayEnabledForCheckout,
} from "@/lib/payment-settings";
import { getDetectedMarketCode } from "@/lib/product-availability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const marketCode = getDetectedMarketCode(request.headers);
  const [
    cryptoAvailability,
    winpayEnabled,
    resellerCryptoEnabled,
    resellerWinpayEnabled,
  ] = await Promise.all([
    getCryptoAvailability(marketCode),
    isWinpayEnabledForCheckout(),
    isResellerCryptoEnabledForCheckout(),
    isResellerWinpayEnabledForCheckout(),
  ]);

  return NextResponse.json(
    {
      crypto: {
        enabled: cryptoAvailability.allowed,
        reason: cryptoAvailability.reason,
      },
      winpay: { enabled: winpayEnabled },
      reseller: {
        crypto: { enabled: resellerCryptoEnabled },
        winpay: { enabled: resellerWinpayEnabled },
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
