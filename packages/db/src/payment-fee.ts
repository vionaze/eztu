/**
 * Payment-fee buffer for IDR (non-crypto) prices.
 *
 * WinPay charges a QRIS MDR of 0,7% that cannot be surcharged at the end of the
 * checkout, so it is baked into every IDR selling price instead. VA transfers
 * carry a much smaller fee; a single buffer keeps one price for every IDR rail.
 *
 * Applied to retail prices (stored display price + live quote) and reseller
 * prices. Crypto prices are USD-settled through Cryptomus and stay untouched.
 *
 * The live value is an admin setting (`pricing.markup.*`); this env fallback
 * keeps offline scripts and legacy call sites working. 0 disables the buffer.
 */
function readFeeBps() {
  const raw = process.env.IDR_PAYMENT_FEE_BPS;
  if (raw === undefined || raw.trim() === "") return 70;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 5_000) return 70;
  return parsed;
}

export const IDR_PAYMENT_FEE_BPS = readFeeBps();

export const MAX_IDR_PAYMENT_FEE_BPS = 100_000; // 1000%

/**
 * Markup that turns a base price into the final IDR selling price.
 *
 * Callers pass the admin-configured value when they have it; the env default
 * (70) keeps offline scripts, tests, and legacy code paths working.
 */
export function applyIdrPaymentFee(
  priceIDR: number,
  feeBps: number = IDR_PAYMENT_FEE_BPS,
) {
  if (!Number.isFinite(priceIDR) || priceIDR < 0) {
    throw new Error("Price must be a non-negative number.");
  }
  if (
    !Number.isInteger(feeBps) ||
    feeBps < 0 ||
    feeBps > MAX_IDR_PAYMENT_FEE_BPS
  ) {
    throw new Error("Payment fee markup must be between 0 and 1000%.");
  }
  if (feeBps === 0) return Math.ceil(priceIDR);
  return Math.ceil((priceIDR * (10_000 + feeBps)) / 10_000);
}
