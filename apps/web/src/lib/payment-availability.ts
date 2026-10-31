export type CryptoBlockReason = "disabled" | "country";

export type CryptoAvailabilitySettings = {
  enabled: boolean;
  disabledCountries: string[];
  disabledUntil: string | null;
};

export type CryptoAvailability = {
  allowed: boolean;
  reason: CryptoBlockReason | null;
};

/** Accepts "ID, sg ,my" and returns ["id", "sg", "my"]. */
export function parseCountryList(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const code = part.trim().toLowerCase();
    if (/^[a-z]{2}$/.test(code)) seen.add(code);
  }
  return [...seen];
}

/**
 * Empty or invalid values mean "no expiry". A past timestamp also means the
 * temporary block has already lapsed, so the country list stops applying.
 */
export function normalizeDisabledUntil(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function evaluateCryptoAvailability(
  settings: CryptoAvailabilitySettings,
  marketCode: string,
  now: Date = new Date(),
): CryptoAvailability {
  if (!settings.enabled) return { allowed: false, reason: "disabled" };

  const market = marketCode.trim().toLowerCase();
  if (!market) return { allowed: true, reason: null };

  if (settings.disabledUntil) {
    const until = new Date(settings.disabledUntil);
    if (!Number.isNaN(until.getTime()) && until.getTime() <= now.getTime()) {
      return { allowed: true, reason: null };
    }
  }

  if (settings.disabledCountries.includes(market)) {
    return { allowed: false, reason: "country" };
  }

  return { allowed: true, reason: null };
}
