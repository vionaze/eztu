/**
 * Market-based payment policy.
 *
 * - Indonesia: WinPay only. Crypto is hidden and rejected server-side.
 * - Everywhere else: all methods, with crypto shown first and preferred.
 *
 * An empty market code (no CDN country header) is treated as Indonesia: the
 * storefront is Indonesia-first, and the restriction is the safer default.
 */
export const INDONESIA_MARKET_CODE = "id";

export function normalizeMarketCode(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

export function isIndonesiaMarket(marketCode: string | null | undefined) {
  const code = normalizeMarketCode(marketCode);
  return code === "" || code === INDONESIA_MARKET_CODE;
}

export type MarketPaymentPolicy = {
  marketCode: string;
  isIndonesia: boolean;
  cryptoAllowed: boolean;
  cryptoPreferred: boolean;
};

export function getMarketPaymentPolicy(
  marketCode: string | null | undefined,
): MarketPaymentPolicy {
  const code = normalizeMarketCode(marketCode);
  const indonesia = isIndonesiaMarket(code);
  return {
    marketCode: code || INDONESIA_MARKET_CODE,
    isIndonesia: indonesia,
    cryptoAllowed: !indonesia,
    cryptoPreferred: !indonesia,
  };
}

export const CRYPTO_ID_MARKET_ERROR =
  "Crypto checkout is for international buyers only. Indonesian buyers can pay with WinPay (QRIS / VA).";
