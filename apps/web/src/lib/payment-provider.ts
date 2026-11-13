/**
 * Both Pakasir and WinPay settle in integer IDR. Keeping the set in one place
 * stops the amount-integrity check from silently becoming USD-only.
 */
const IDR_PAYMENT_PROVIDERS = new Set(["pakasir", "winpay"]);

export function isIdrPaymentProvider(provider: string | null | undefined) {
  return Boolean(provider && IDR_PAYMENT_PROVIDERS.has(provider));
}

const PROVIDER_LABELS: Record<string, string> = {
  winpay: "WinPay",
  // Legacy rows created before WinPay replaced Pakasir.
  pakasir: "Pakasir",
  cryptomus: "Cryptomus",
};

export function paymentProviderLabel(provider: string | null | undefined) {
  if (!provider) return "—";
  return PROVIDER_LABELS[provider] || provider;
}

function readNumber(raw: unknown, key: string) {
  if (!raw || typeof raw !== "object") return null;
  const value = (raw as Record<string, unknown>)[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * The expected amount in the order's own currency. WinPay's verified payload
 * has no top-level `amount`, so the caller passes the verified `payAmount`.
 */
export function resolveProviderAmount(params: {
  provider: string;
  raw: unknown;
  payAmount?: number | null;
}) {
  if (isIdrPaymentProvider(params.provider)) {
    const amount =
      readNumber(params.raw, "price_amount") ??
      readNumber(params.raw, "amount") ??
      (typeof params.payAmount === "number" && Number.isFinite(params.payAmount)
        ? params.payAmount
        : null);
    return amount === null ? null : { amount, currency: "IDR" as const };
  }
  const amount =
    readNumber(params.raw, "price_amount") ??
    readNumber(params.raw, "payment_amount_usd");
  return amount === null ? null : { amount, currency: "USD" as const };
}
