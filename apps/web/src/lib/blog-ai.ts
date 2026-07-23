import "server-only";
import { getBlogAiSettings } from "@/lib/settings";

export type AiArticleDraft = {
  title: string;
  slug: string;
  excerpt: string;
  contentHtml: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  category: string;
  faq: { question: string; answer: string }[];
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Generate an AISEO-oriented article draft via OpenAI-compatible Chat Completions API.
 * Structure targets helpful, people-first content with clear H2/H3, FAQ, and meta for SERP.
 */
export async function generateBlogArticleDraft(params: {
  topic: string;
  countryCode: string;
  language?: string;
}): Promise<AiArticleDraft> {
  const settings = await getBlogAiSettings();
  if (!settings.enabled) {
    throw new Error("AI article generation is turned off in Settings.");
  }
  if (!settings.baseUrl || !settings.apiKey) {
    throw new Error("AI base URL and API key must be configured in Settings.");
  }

  const country = params.countryCode.toUpperCase();
  const language =
    params.language ||
    (country === "ID" ? "Indonesian" : country === "MY" ? "English (Malaysia)" : "English");

  const system = `You are an expert SEO content strategist for 2026 Google quality systems (Helpful Content, E-E-A-T, people-first search).
Write for EZTopUp (eztopup.io): digital vouchers and game top-ups paid with USDT/USDC crypto.
Rules:
- People-first, accurate, non-spammy. No keyword stuffing.
- Clear structure: intro hook, H2 sections, short paragraphs, bullet lists where useful.
- Include practical steps, FAQ (3-5 Q&A), and a short conclusion with soft CTA to eztopup.io.
- Do NOT invent fake prices or guarantee "instant" if payment is pending.
- Mention USDT/USDC only as payment options, not financial advice.
- Return ONLY valid JSON matching the schema requested.`;

  const user = `Create a blog article draft for country/market: ${country}.
Language: ${language}.
Topic: ${params.topic}

JSON schema:
{
  "title": "string (compelling, under 70 chars)",
  "slug": "string (url-safe)",
  "excerpt": "string (1-2 sentences)",
  "contentHtml": "string (semantic HTML with h2, h3, p, ul, li, strong — no script tags)",
  "metaTitle": "string (under 60 chars, include primary intent)",
  "metaDescription": "string (under 155 chars, actionable)",
  "focusKeyword": "string",
  "category": "Guide|News|Tips|Payments",
  "faq": [{"question":"string","answer":"string"}]
}`;

  const endpoint = `${settings.baseUrl}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  const data = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  } | null;

  if (!response.ok) {
    throw new Error(
      data?.error?.message || `AI API error HTTP ${response.status}`
    );
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI API returned empty content.");
  }

  const parsed = JSON.parse(content) as Partial<AiArticleDraft>;
  const title = (parsed.title || params.topic).trim();
  const slug = slugify(parsed.slug || title);

  return {
    title,
    slug,
    excerpt: (parsed.excerpt || "").trim(),
    contentHtml: (parsed.contentHtml || "").trim(),
    metaTitle: (parsed.metaTitle || title).trim().slice(0, 70),
    metaDescription: (parsed.metaDescription || parsed.excerpt || "")
      .trim()
      .slice(0, 160),
    focusKeyword: (parsed.focusKeyword || "").trim(),
    category: (parsed.category || "Guide").trim(),
    faq: Array.isArray(parsed.faq) ? parsed.faq : [],
  };
}
