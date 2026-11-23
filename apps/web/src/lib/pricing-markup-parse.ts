/** Keep in sync with packages/db/src/pricing-markup.ts (max 1000%). */
const MAX_PRICING_MARKUP_BPS = 100_000;

function isValidMarkupBps(value: number) {
  return (
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_PRICING_MARKUP_BPS
  );
}

export type ParsedMarkupPercent =
  | { ok: true; bps: number }
  | { ok: false; error: string };

/**
 * Admin input is a percentage string ("0.7", "4,15", "12"). It must be a
 * non-negative number with at most two decimals and never above 1000%.
 */
export function parseMarkupPercent(raw: string): ParsedMarkupPercent {
  const value = raw.trim().replace(",", ".");
  if (!value) return { ok: false, error: "Isi persentase (0–1000)." };
  if (value.startsWith("-")) {
    return { ok: false, error: "Persentase tidak boleh negatif." };
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    return { ok: false, error: "Gunakan angka 0–1000, maksimal 2 desimal." };
  }
  const percent = Number(value);
  if (!Number.isFinite(percent) || percent < 0) {
    return { ok: false, error: "Persentase tidak boleh negatif." };
  }
  const bps = Math.round(percent * 100);
  if (!isValidMarkupBps(bps) || bps > MAX_PRICING_MARKUP_BPS) {
    return { ok: false, error: "Maksimal 1000%." };
  }
  return { ok: true, bps };
}

export function bpsToPercent(bps: number) {
  return String(Number((bps / 100).toFixed(2)));
}
