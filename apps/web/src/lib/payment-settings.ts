import "server-only";
import { getSetting, setSetting } from "@/lib/settings";
import {
  evaluateCryptoAvailability,
  normalizeDisabledUntil,
  parseCountryList,
  type CryptoAvailability,
  type CryptoAvailabilitySettings,
} from "@/lib/payment-availability";

export const PAYMENT_SETTING_KEYS = {
  CRYPTO_ENABLED: "payments.crypto.enabled",
  CRYPTO_DISABLED_COUNTRIES: "payments.crypto.disabledCountries",
  CRYPTO_DISABLED_UNTIL: "payments.crypto.disabledUntil",
} as const;

export type CryptoCheckoutSettings = CryptoAvailabilitySettings;

export async function getCryptoCheckoutSettings(): Promise<CryptoCheckoutSettings> {
  const [enabledRaw, countriesRaw, untilRaw] = await Promise.all([
    getSetting(PAYMENT_SETTING_KEYS.CRYPTO_ENABLED, "true"),
    getSetting(PAYMENT_SETTING_KEYS.CRYPTO_DISABLED_COUNTRIES, ""),
    getSetting(PAYMENT_SETTING_KEYS.CRYPTO_DISABLED_UNTIL, ""),
  ]);

  return {
    // The master switch defaults to on so an empty Setting table keeps the
    // existing behaviour.
    enabled: enabledRaw.trim().toLowerCase() !== "false",
    disabledCountries: parseCountryList(countriesRaw),
    disabledUntil: normalizeDisabledUntil(untilRaw),
  };
}

export async function getCryptoAvailability(
  marketCode: string,
): Promise<CryptoAvailability> {
  const settings = await getCryptoCheckoutSettings();
  return evaluateCryptoAvailability(settings, marketCode);
}

export async function saveCryptoCheckoutSettings(input: {
  enabled: boolean;
  disabledCountries: string;
  disabledUntil: string;
}): Promise<CryptoCheckoutSettings> {
  const disabledCountries = parseCountryList(input.disabledCountries);
  const disabledUntil = normalizeDisabledUntil(input.disabledUntil);

  await Promise.all([
    setSetting(PAYMENT_SETTING_KEYS.CRYPTO_ENABLED, input.enabled ? "true" : "false"),
    setSetting(
      PAYMENT_SETTING_KEYS.CRYPTO_DISABLED_COUNTRIES,
      disabledCountries.join(","),
    ),
    setSetting(PAYMENT_SETTING_KEYS.CRYPTO_DISABLED_UNTIL, disabledUntil ?? ""),
  ]);

  return { enabled: input.enabled, disabledCountries, disabledUntil };
}
