import "server-only";
import { prisma } from "@kupon/db";

export const SETTING_KEYS = {
  AI_ENABLED: "blog.ai.enabled",
  AI_BASE_URL: "blog.ai.baseUrl",
  AI_API_KEY: "blog.ai.apiKey",
  AI_MODEL: "blog.ai.model",
  AI_COUNTRIES: "blog.ai.countries",
  AI_AUTO_COUNTRIES: "blog.ai.autoCountries",
} as const;

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function getBlogAiSettings() {
  const [enabled, baseUrl, apiKey, model, countriesRaw, autoCountriesRaw] =
    await Promise.all([
      getSetting(SETTING_KEYS.AI_ENABLED, "false"),
      getSetting(SETTING_KEYS.AI_BASE_URL, process.env.BLOG_AI_BASE_URL || ""),
      getSetting(SETTING_KEYS.AI_API_KEY, process.env.BLOG_AI_API_KEY || ""),
      getSetting(SETTING_KEYS.AI_MODEL, process.env.BLOG_AI_MODEL || "gpt-4o-mini"),
      getSetting(SETTING_KEYS.AI_COUNTRIES, "ID,MY,US,GLOBAL"),
      getSetting(SETTING_KEYS.AI_AUTO_COUNTRIES, "ID,GLOBAL"),
    ]);

  return {
    enabled: enabled === "true" || enabled === "1",
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey,
    model,
    countries: countriesRaw
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
    autoCountries: autoCountriesRaw
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
  };
}
