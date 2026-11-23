/**
 * Admin-editable pricing markup layer.
 *
 * The markup is applied on top of each SKU's own margin (the numbers imported
 * from the supplier workbooks), and exists to absorb payment fees such as the
 * WinPay QRIS MDR. Two levels:
 *
 * - global  — one percentage for every product (default 0,7%)
 * - product — optional override per product slug
 *
 * Percentages are stored as basis points (1% = 100 bps) and may never be
 * negative; the admin API rejects anything else before it reaches this module.
 */
import { IDR_PAYMENT_FEE_BPS } from "./payment-fee.ts";

export const PRICING_MARKUP_KEYS = {
  GLOBAL_BPS: "pricing.markup.globalBps",
  PRODUCT_OVERRIDES: "pricing.markup.productOverrides",
} as const;

export const DEFAULT_PRICING_MARKUP_BPS = 70;
export const MAX_PRICING_MARKUP_BPS = 100_000; // 1000%

export type PricingMarkupSettings = {
  globalBps: number;
  /** Product slug → basis points. */
  overrides: Record<string, number>;
};

export function isValidMarkupBps(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_PRICING_MARKUP_BPS
  );
}

export function parseOverrides(raw: string | null | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: Record<string, number> = {};
    for (const [slug, value] of Object.entries(parsed as Record<string, unknown>)) {
      const bps = typeof value === "string" ? Number(value) : value;
      if (typeof slug === "string" && slug.trim() && isValidMarkupBps(bps)) {
        result[slug.trim()] = bps;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function resolveProductMarkupBps(
  settings: PricingMarkupSettings,
  productSlug: string | null | undefined,
) {
  const slug = productSlug?.trim();
  if (slug && Object.prototype.hasOwnProperty.call(settings.overrides, slug)) {
    return settings.overrides[slug];
  }
  return settings.globalBps;
}

type SettingReader = {
  setting: {
    findMany: (args: {
      where: { key: { in: string[] } };
      select: { key: true; value: true };
    }) => Promise<{ key: string; value: string }[]>;
  };
};

export async function readPricingMarkup(
  db: SettingReader,
): Promise<PricingMarkupSettings> {
  const rows = await db.setting.findMany({
    where: {
      key: { in: [PRICING_MARKUP_KEYS.GLOBAL_BPS, PRICING_MARKUP_KEYS.PRODUCT_OVERRIDES] },
    },
    select: { key: true, value: true },
  });
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const parsedGlobal = Number(byKey.get(PRICING_MARKUP_KEYS.GLOBAL_BPS));
  // Until an admin saves a value, keep honouring IDR_PAYMENT_FEE_BPS.
  const globalBps = isValidMarkupBps(parsedGlobal)
    ? parsedGlobal
    : IDR_PAYMENT_FEE_BPS;
  return {
    globalBps,
    overrides: parseOverrides(byKey.get(PRICING_MARKUP_KEYS.PRODUCT_OVERRIDES)),
  };
}
