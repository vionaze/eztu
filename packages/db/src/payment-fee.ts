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
 * Override with `IDR_PAYMENT_FEE_BPS` (0 disables the buffer).
 */
function readFeeBps() {
  const raw = process.env.IDR_PAYMENT_FEE_BPS;
  if (raw === undefined || raw.trim() === "") return 70;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 5_000) return 70;
  return parsed;
}

export const IDR_PAYMENT_FEE_BPS = readFeeBps();

/** Markup that turns a base price into the final IDR selling price. */
export function applyIdrPaymentFee(priceIDR: number) {
  if (!Number.isFinite(priceIDR) || priceIDR < 0) {
    throw new Error("Price must be a non-negative number.");
  }
  if (IDR_PAYMENT_FEE_BPS === 0) return Math.ceil(priceIDR);
  return Math.ceil((priceIDR * (10_000 + IDR_PAYMENT_FEE_BPS)) / 10_000);
}
