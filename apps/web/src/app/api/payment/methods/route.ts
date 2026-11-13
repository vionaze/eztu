import { NextRequest, NextResponse } from "next/server";
import {
  getCryptoAvailability,
  isPakasirEnabledForCheckout,
  isResellerCryptoEnabledForCheckout,
  isResellerPakasirEnabledForCheckout,
  isResellerWinpayEnabledForCheckout,
  isWinpayEnabledForCheckout,
} from "@/lib/payment-settings";
import { getDetectedMarketCode } from "@/lib/product-availability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const marketCode = getDetectedMarketCode(request.headers);
  const [
    cryptoAvailability,
    pakasirEnabled,
    winpayEnabled,
    resellerCryptoEnabled,
    resellerPakasirEnabled,
    resellerWinpayEnabled,
  ] = await Promise.all([
    getCryptoAvailability(marketCode),
    isPakasirEnabledForCheckout(),
    isWinpayEnabledForCheckout(),
    isResellerCryptoEnabledForCheckout(),
    isResellerPakasirEnabledForCheckout(),
    isResellerWinpayEnabledForCheckout(),
  ]);

  return NextResponse.json(
    {
      crypto: {
        enabled: cryptoAvailability.allowed,
        reason: cryptoAvailability.reason,
      },
      pakasir: { enabled: pakasirEnabled },
      winpay: { enabled: winpayEnabled },
      reseller: {
        crypto: { enabled: resellerCryptoEnabled },
        pakasir: { enabled: resellerPakasirEnabled },
        winpay: { enabled: resellerWinpayEnabled },
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
