import "server-only";
import { prisma } from "@kupon/db";

export const SETTING_KEYS = {
  AI_ENABLED: "blog.ai.enabled",
  AI_BASE_URL: "blog.ai.baseUrl",
  AI_API_KEY: "blog.ai.apiKey",
  AI_MODEL: "blog.ai.model",
  AI_COUNTRIES: "blog.ai.countries",
  AI_AUTO_COUNTRIES: "blog.ai.autoCountries",
  AI_SYSTEM_PROMPT: "blog.ai.systemPrompt",
} as const;

/** Default system prompt used when none is saved in Settings. */
export const DEFAULT_BLOG_AI_SYSTEM_PROMPT = `You are an expert SEO content strategist for 2026 Google quality systems (Helpful Content, E-E-A-T, people-first search).
Write for EZTopUp (eztopup.io): digital vouchers and game top-ups paid with USDT/USDC crypto.
Rules:
- People-first, accurate, non-spammy. No keyword stuffing.
- Clear structure: intro hook, H2 sections, short paragraphs, bullet lists where useful.
- Include practical steps, FAQ (3-5 Q&A), and a short conclusion with soft CTA to eztopup.io.
- Do NOT invent fake prices or guarantee "instant" if payment is pending.
- Mention USDT/USDC only as payment options, not financial advice.
- Return ONLY valid JSON matching the schema requested.`;

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
  const [
    enabled,
    baseUrl,
    apiKey,
    model,
    countriesRaw,
    autoCountriesRaw,
    systemPromptRaw,
  ] = await Promise.all([
    getSetting(SETTING_KEYS.AI_ENABLED, "false"),
    getSetting(SETTING_KEYS.AI_BASE_URL, process.env.BLOG_AI_BASE_URL || ""),
    getSetting(SETTING_KEYS.AI_API_KEY, process.env.BLOG_AI_API_KEY || ""),
    getSetting(SETTING_KEYS.AI_MODEL, process.env.BLOG_AI_MODEL || "gpt-4o-mini"),
    getSetting(SETTING_KEYS.AI_COUNTRIES, "ID,MY,US,GLOBAL"),
    getSetting(SETTING_KEYS.AI_AUTO_COUNTRIES, "ID,GLOBAL"),
    getSetting(SETTING_KEYS.AI_SYSTEM_PROMPT, ""),
  ]);

  const systemPrompt = systemPromptRaw.trim()
    ? systemPromptRaw
    : DEFAULT_BLOG_AI_SYSTEM_PROMPT;

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
    systemPrompt,
    /** True when a custom prompt is stored in DB (not just the built-in default). */
    hasCustomSystemPrompt: Boolean(systemPromptRaw.trim()),
  };
}
