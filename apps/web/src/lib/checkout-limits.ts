export const BULK_PURCHASE_THRESHOLD = 21;
export const MAX_SELF_SERVICE_QUANTITY = BULK_PURCHASE_THRESHOLD - 1;
export const SALES_EMAIL = "sales@eztopup.io";

export const CRYPTO_MINIMUM_IDR = 45_000;
export const CRYPTO_MINIMUM_USD_CENTS = 250;

export function getCryptoMinimumQuantity(unitPriceIDR: number, usdIdrRate: number) {
  if (unitPriceIDR <= 0) return 1;
  const minimumIDR = Math.max(
    CRYPTO_MINIMUM_IDR,
    (CRYPTO_MINIMUM_USD_CENTS / 100) * usdIdrRate,
  );
  return Math.ceil(minimumIDR / unitPriceIDR);
}
