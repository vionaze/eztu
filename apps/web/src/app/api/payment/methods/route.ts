import { NextRequest, NextResponse } from "next/server";
import {
  getCryptoAvailability,
  isResellerCryptoEnabledForCheckout,
  isResellerWinpayEnabledForCheckout,
  isWinpayEnabledForCheckout,
} from "@/lib/payment-settings";
import { getDetectedMarketCode } from "@/lib/product-availability";
import {
  getMarketPaymentPolicy,
  type MarketPaymentPolicy,
} from "@/lib/payment-market";

export const dynamic = "force-dynamic";

function cryptoGate(policy: MarketPaymentPolicy, allowedBySettings: boolean) {
  const enabled = policy.cryptoAllowed && allowedBySettings;
  return {
    enabled,
    preferred: enabled && policy.cryptoPreferred,
    reason: policy.cryptoAllowed ? null : "indonesia_market",
  };
}

export async function GET(request: NextRequest) {
  const marketCode = getDetectedMarketCode(request.headers);
  const policy = getMarketPaymentPolicy(marketCode);
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

  const retailCrypto = cryptoGate(policy, cryptoAvailability.allowed);
  if (!policy.cryptoAllowed) retailCrypto.reason = "indonesia_market";
  else if (!cryptoAvailability.allowed) retailCrypto.reason = cryptoAvailability.reason;

  return NextResponse.json(
    {
      market: { code: policy.marketCode, indonesia: policy.isIndonesia },
      crypto: retailCrypto,
      winpay: { enabled: winpayEnabled },
      reseller: {
        market: { code: policy.marketCode, indonesia: policy.isIndonesia },
        crypto: cryptoGate(policy, resellerCryptoEnabled),
        winpay: { enabled: resellerWinpayEnabled },
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
