export type ResellerPriceMode = "MARKUP" | "FIXED";

export type ResellerPriceRule = {
  mode: ResellerPriceMode;
  markupMicros: number | null;
  fixedPriceIDR: number | null;
  enabled: boolean;
};

/** Parse a percentage where 1% is 100000 micros and at most five decimals are allowed. */
export function parseResellerMarkupPercent(value: string): number {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,5})?$/.test(value)) {
    throw new Error("INVALID_MARKUP_PERCENT");
  }
  const [whole, fraction = ""] = value.split(".");
  const micros = BigInt(whole) * BigInt(100_000) + BigInt(fraction.padEnd(5, "0") || "0");
  if (micros > BigInt(100_000_000)) throw new Error("MARKUP_OUT_OF_RANGE");
  return Number(micros);
}

/** Format micros as a percentage value without a percent sign. */
export function formatResellerMarkupPercent(micros: number): string {
  assertMarkupMicros(micros);
  const whole = Math.floor(micros / 100_000);
  const fraction = String(micros % 100_000).padStart(5, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

/** Backwards-compatible name used by importer/parser callers. */
export const parsePercentMicros = parseResellerMarkupPercent;

function assertMarkupMicros(value: number): asserts value is number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100_000_000) {
    throw new Error("MARKUP_OUT_OF_RANGE");
  }
}

function assertCost(costIDR: number): asserts costIDR is number {
  if (!Number.isSafeInteger(costIDR) || costIDR <= 0 || costIDR >= 2_147_483_647) {
    throw new Error("INVALID_COST");
  }
}

function assertRule(rule: ResellerPriceRule): void {
  if (!rule || (rule.mode !== "MARKUP" && rule.mode !== "FIXED")) {
    throw new Error("INVALID_RESELLER_RULE");
  }
  if (rule.mode === "MARKUP") {
    if (rule.fixedPriceIDR !== null || rule.markupMicros === null) {
      throw new Error("INVALID_RESELLER_RULE");
    }
    assertMarkupMicros(rule.markupMicros);
  } else {
    if (rule.markupMicros !== null || rule.fixedPriceIDR === null ||
        !Number.isSafeInteger(rule.fixedPriceIDR) || rule.fixedPriceIDR <= 0 ||
        rule.fixedPriceIDR >= 2_147_483_647) {
      throw new Error("INVALID_RESELLER_RULE");
    }
  }
}

export function calculateResellerPrice(costIDR: number, rule: ResellerPriceRule): number {
  assertCost(costIDR);
  assertRule(rule);
  if (!rule.enabled) throw new Error("RESELLER_RULE_DISABLED");
  if (rule.mode === "FIXED") {
    if (rule.fixedPriceIDR! < costIDR) throw new Error("FIXED_PRICE_BELOW_COST");
    return rule.fixedPriceIDR!;
  }
  const result = (BigInt(costIDR) * (BigInt(10_000_000) + BigInt(rule.markupMicros!)) + BigInt(9_999_999)) / BigInt(10_000_000);
  if (result >= BigInt(2_147_483_647)) throw new Error("PRICE_OUT_OF_RANGE");
  return Number(result);
}

/** Organization rules win even when disabled; null means no rule at that level. */
export function chooseEffectiveRule(
  organizationRule: ResellerPriceRule | null | undefined,
  tierRule: ResellerPriceRule | null | undefined,
): ResellerPriceRule | null {
  return organizationRule ?? tierRule ?? null;
}
