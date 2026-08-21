import { idrToUsdCentsCeil, usdCentsToAmount } from "./money.ts";

/**
 * Convert the canonical non-crypto IDR selling price with the same upward
 * cent rounding used by checkout. The imported USD value is only a fallback
 * for periods when no fresh FX rate is available.
 */
export function getDisplayPriceUSD(
  priceIDR: number,
  storedPriceUSD: number,
  usdIdrRate: number | null
) {
  if (!usdIdrRate) return storedPriceUSD;
  return usdCentsToAmount(idrToUsdCentsCeil(priceIDR, usdIdrRate));
}
