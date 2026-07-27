export function usdCentsToAmount(cents: number): number {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error("USD cents must be a non-negative safe integer");
  }
  return cents / 100;
}

export function usdCentsToFixed(cents: number): string {
  return usdCentsToAmount(cents).toFixed(2);
}

export function usdAmountToCents(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("USD amount must be non-negative");
  }
  return Math.round((amount + Number.EPSILON) * 100);
}

export function idrToUsdCentsCeil(amountIDR: number, usdIdrRate: number): number {
  if (!Number.isSafeInteger(amountIDR) || amountIDR < 0) {
    throw new Error("IDR amount must be a non-negative safe integer");
  }
  if (!Number.isFinite(usdIdrRate) || usdIdrRate <= 0) {
    throw new Error("USD/IDR rate must be positive");
  }
  return Math.ceil((amountIDR * 100) / usdIdrRate);
}

export function underpaidUSDCents(
  expectedUSDCents: number,
  actualPaidUSDCents: number
): number {
  if (
    !Number.isSafeInteger(expectedUSDCents) ||
    !Number.isSafeInteger(actualPaidUSDCents) ||
    expectedUSDCents < 0 ||
    actualPaidUSDCents < 0
  ) {
    throw new Error("Payment cents must be non-negative safe integers");
  }
  return Math.max(0, expectedUSDCents - actualPaidUSDCents);
}
