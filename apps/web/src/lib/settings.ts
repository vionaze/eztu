import "server-only";
import { prisma } from "@kupon/db";
import {
  DEFAULT_BLOG_AI_BASE_URL,
  DEFAULT_BLOG_AI_COUNTRIES,
  DEFAULT_BLOG_AI_MODEL,
} from "@/lib/blog-ai-defaults";
import { parseProductMarketSettings } from "@/lib/blog-product-topics";

export const SETTING_KEYS = {
  AI_ENABLED: "blog.ai.enabled",
  AI_BASE_URL: "blog.ai.baseUrl",
  AI_API_KEY: "blog.ai.apiKey",
  AI_MODEL: "blog.ai.model",
  AI_COUNTRIES: "blog.ai.countries",
  AI_AUTO_COUNTRIES: "blog.ai.autoCountries",
  AI_PRODUCT_MARKETS: "blog.ai.productMarkets",
  AI_SYSTEM_PROMPT: "blog.ai.systemPrompt",
  /** Master switch for scheduled auto generate+publish */
  AI_SCHEDULE_ENABLED: "blog.ai.scheduleEnabled",
  /** Hours between runs: 1 | 2 | 4 | 8 | 12 */
  AI_INTERVAL_HOURS: "blog.ai.intervalHours",
  /** Articles per scheduled run: 1|2|5|6|7|8|10|12 */
  AI_ARTICLES_PER_RUN: "blog.ai.articlesPerRun",
  /** When true, scheduled (and optional one-shot) jobs publish immediately */
  AI_AUTO_PUBLISH: "blog.ai.autoPublish",
  /** ISO timestamp of last successful scheduled run */
  AI_LAST_RUN_AT: "blog.ai.lastRunAt",
  /** Last market attempted by the rotating auto-publish queue */
  AI_LAST_AUTO_COUNTRY: "blog.ai.lastAutoCountry",
} as const;

export const BLOG_AI_INTERVAL_OPTIONS = [1, 2, 4, 8, 12] as const;
export const BLOG_AI_COUNT_OPTIONS = [1, 2, 5, 6, 7, 8, 10, 12] as const;

export type BlogAiIntervalHours = (typeof BLOG_AI_INTERVAL_OPTIONS)[number];
export type BlogAiArticlesPerRun = (typeof BLOG_AI_COUNT_OPTIONS)[number];

/**
 * Default system prompt used when none is saved in Settings.
 * Scope is blog article content only — an immutable lock is always appended in blog-ai.ts.
 */
export const DEFAULT_BLOG_AI_SYSTEM_PROMPT = `You are an expert SEO content strategist for 2026 Google quality systems (Helpful Content, E-E-A-T, people-first search).
Write for EZTopUp (eztopup.io): digital vouchers and game top-ups paid with USDT/USDC crypto.
You ONLY write public blog article content. You do not access or control any website admin, payments, or backend systems.
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

function isTruthySetting(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function parseAllowedNumber<T extends number>(
  raw: string,
  allowed: readonly T[],
  fallback: T
): T {
  const n = Number(raw);
  if (allowed.includes(n as T)) return n as T;
  return fallback;
}

export async function getBlogAiSettings() {
  const envModel = process.env.BLOG_AI_MODEL?.trim();
  const modelFallback =
    !envModel || envModel === "gpt-4o-mini"
      ? DEFAULT_BLOG_AI_MODEL
      : envModel;

  const [
    enabled,
    baseUrl,
    apiKey,
    model,
    countriesRaw,
    autoCountriesRaw,
    productMarketsRaw,
    systemPromptRaw,
    scheduleEnabled,
    intervalRaw,
    countRaw,
    autoPublish,
    lastRunAt,
    lastAutoCountry,
  ] = await Promise.all([
    // DB Setting wins when present; env is fallback for first deploy / emergency enable
    getSetting(
      SETTING_KEYS.AI_ENABLED,
      process.env.BLOG_AI_ENABLED || "false"
    ),
    getSetting(
      SETTING_KEYS.AI_BASE_URL,
      process.env.BLOG_AI_BASE_URL || DEFAULT_BLOG_AI_BASE_URL
    ),
    getSetting(SETTING_KEYS.AI_API_KEY, process.env.BLOG_AI_API_KEY || ""),
    getSetting(SETTING_KEYS.AI_MODEL, modelFallback),
    getSetting(
      SETTING_KEYS.AI_COUNTRIES,
      DEFAULT_BLOG_AI_COUNTRIES.join(",")
    ),
    getSetting(
      SETTING_KEYS.AI_AUTO_COUNTRIES,
      DEFAULT_BLOG_AI_COUNTRIES.join(","),
    ),
    getSetting(SETTING_KEYS.AI_PRODUCT_MARKETS, ""),
    getSetting(SETTING_KEYS.AI_SYSTEM_PROMPT, ""),
    getSetting(
      SETTING_KEYS.AI_SCHEDULE_ENABLED,
      process.env.BLOG_AI_SCHEDULE_ENABLED || "false"
    ),
    getSetting(
      SETTING_KEYS.AI_INTERVAL_HOURS,
      process.env.BLOG_AI_INTERVAL_HOURS || "4"
    ),
    getSetting(
      SETTING_KEYS.AI_ARTICLES_PER_RUN,
      process.env.BLOG_AI_ARTICLES_PER_RUN || "1"
    ),
    getSetting(
      SETTING_KEYS.AI_AUTO_PUBLISH,
      process.env.BLOG_AI_AUTO_PUBLISH || "true"
    ),
    getSetting(SETTING_KEYS.AI_LAST_RUN_AT, ""),
    getSetting(SETTING_KEYS.AI_LAST_AUTO_COUNTRY, ""),
  ]);

  const systemPrompt = systemPromptRaw.trim()
    ? systemPromptRaw
    : DEFAULT_BLOG_AI_SYSTEM_PROMPT;

  const resolvedBaseUrl = baseUrl.trim() || DEFAULT_BLOG_AI_BASE_URL;
  const resolvedModel = model.trim() || DEFAULT_BLOG_AI_MODEL;

  return {
    enabled: isTruthySetting(enabled),
    baseUrl: resolvedBaseUrl.replace(/\/$/, ""),
    apiKey,
    model: resolvedModel,
    countries: countriesRaw
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
    autoCountries: autoCountriesRaw
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
    productMarkets: parseProductMarketSettings(productMarketsRaw),
    systemPrompt,
    hasCustomSystemPrompt: Boolean(systemPromptRaw.trim()),
    scheduleEnabled: isTruthySetting(scheduleEnabled),
    intervalHours: parseAllowedNumber(
      intervalRaw,
      BLOG_AI_INTERVAL_OPTIONS,
      4
    ),
    articlesPerRun: parseAllowedNumber(
      countRaw,
      BLOG_AI_COUNT_OPTIONS,
      1
    ),
    autoPublish: autoPublish !== "false" && autoPublish !== "0",
    lastRunAt: lastRunAt || null,
    lastAutoCountry: lastAutoCountry.trim().toUpperCase() || null,
  };
}
