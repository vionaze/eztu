import "server-only";
import { prisma, type Prisma } from "@kupon/db";
import {
  generateBlogArticleDraft,
  sanitizeBlogHtml,
  type AiArticleDraft,
} from "@/lib/blog-ai";
import { getBlogAiSettings, setSetting, SETTING_KEYS } from "@/lib/settings";
import { writeAppLog } from "@/lib/app-log";

/**
 * Blog AI auto-publish — still BLOG SCOPE ONLY.
 * Creates/publishes BlogPost rows. Never touches orders, payments, users, admin auth.
 */

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

async function uniqueSlug(base: string) {
  let slug = slugify(base) || `post-${Date.now().toString(36)}`;
  const existing = await prisma.blogPost.findUnique({ where: { slug } });
  if (!existing) return slug;
  return `${slug}-${Date.now().toString(36)}`;
}

export async function persistBlogDraft(params: {
  draft: AiArticleDraft;
  countryCode: string;
  published: boolean;
  aiModel?: string | null;
  actor?: string;
}): Promise<{ id: string; slug: string; title: string; published: boolean }> {
  const slug = await uniqueSlug(params.draft.slug || params.draft.title);
  const published = params.published;
  const post = await prisma.blogPost.create({
    data: {
      title: params.draft.title.slice(0, 200),
      slug,
      excerpt: params.draft.excerpt.slice(0, 500) || null,
      content: sanitizeBlogHtml(params.draft.contentHtml),
      category: params.draft.category || "Guide",
      countryCode: params.countryCode.toUpperCase().slice(0, 12),
      metaTitle: params.draft.metaTitle.slice(0, 70) || null,
      metaDescription: params.draft.metaDescription.slice(0, 160) || null,
      focusKeyword: params.draft.focusKeyword || null,
      ogTitle: params.draft.metaTitle || null,
      ogDescription: params.draft.metaDescription || null,
      structuredData: {
        faq: params.draft.faq,
      } as Prisma.InputJsonValue,
      aiGenerated: true,
      aiModel: params.aiModel || null,
      published,
      publishedAt: published ? new Date() : null,
      // Images remain manual — left empty for auto jobs
      coverImage: null,
      thumbnailImage: null,
    },
  });

  await writeAppLog({
    category: "BLOG",
    level: "SUCCESS",
    title: published
      ? `AI published: ${post.title}`
      : `AI draft saved: ${post.title}`,
    actor: params.actor || "blog-ai",
    route: "/lib/blog-ai-publish",
    metadata: {
      scope: "blog_only",
      postId: post.id,
      slug: post.slug,
      country: post.countryCode,
      published,
    },
  });

  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    published: post.published,
  };
}

function languageForCountry(country: string) {
  if (country === "ID") return "Indonesian";
  if (country === "MY") return "English (Malaysia)";
  if (country === "TH") return "Thai";
  if (country === "VN") return "Vietnamese";
  if (country === "PH") return "English (Philippines)";
  if (country === "SG") return "English (Singapore)";
  return "English";
}

/** Build a unique topic seed for a market, avoiding recent titles. */
async function buildTopicForCountry(country: string): Promise<string> {
  const recent = await prisma.blogPost.findMany({
    where: { countryCode: country },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: { title: true },
  });
  const avoid = recent.map((r) => r.title).filter(Boolean);
  const avoidLine =
    avoid.length > 0
      ? ` Avoid repeating these existing titles: ${avoid.slice(0, 15).join(" | ")}.`
      : "";

  return (
    `Write a unique, useful SEO blog article for the ${country} market about ` +
    `EZTopUp digital game vouchers / mobile game top-ups paid with USDT or USDC. ` +
    `Pick a specific fresh angle (how-to, comparison, tips, regional payment guide, or game-focused guide).` +
    avoidLine
  );
}

export type AutoRunResult = {
  skipped: boolean;
  reason?: string;
  created: { id: string; slug: string; title: string; country: string; published: boolean }[];
  errors: string[];
  intervalHours: number;
  articlesPerRun: number;
  countries: string[];
};

/**
 * Scheduled / manual batch: generate N articles across checked auto countries, optionally publish.
 */
export async function runBlogAiAutoBatch(opts?: {
  force?: boolean;
  actor?: string;
  /** Override count for this run (still clamped to allowed set) */
  count?: number;
  publish?: boolean;
}): Promise<AutoRunResult> {
  const settings = await getBlogAiSettings();
  const publish = opts?.publish ?? settings.autoPublish;
  const countries =
    settings.autoCountries.length > 0
      ? settings.autoCountries
      : settings.countries.length > 0
        ? settings.countries
        : ["GLOBAL"];

  if (!settings.enabled) {
    return {
      skipped: true,
      reason: "Blog AI is disabled",
      created: [],
      errors: [],
      intervalHours: settings.intervalHours,
      articlesPerRun: settings.articlesPerRun,
      countries,
    };
  }

  if (!opts?.force && !settings.scheduleEnabled) {
    return {
      skipped: true,
      reason: "Schedule is off",
      created: [],
      errors: [],
      intervalHours: settings.intervalHours,
      articlesPerRun: settings.articlesPerRun,
      countries,
    };
  }

  if (!settings.baseUrl || !settings.apiKey) {
    return {
      skipped: true,
      reason: "AI base URL / API key missing",
      created: [],
      errors: [],
      intervalHours: settings.intervalHours,
      articlesPerRun: settings.articlesPerRun,
      countries,
    };
  }

  // Throttle by interval unless forced
  if (!opts?.force && settings.lastRunAt) {
    const last = new Date(settings.lastRunAt).getTime();
    if (!Number.isNaN(last)) {
      const minGapMs = settings.intervalHours * 60 * 60 * 1000;
      const elapsed = Date.now() - last;
      if (elapsed < minGapMs - 60_000) {
        // 1 min grace
        const waitMin = Math.ceil((minGapMs - elapsed) / 60_000);
        return {
          skipped: true,
          reason: `Next run in ~${waitMin} min (interval ${settings.intervalHours}h)`,
          created: [],
          errors: [],
          intervalHours: settings.intervalHours,
          articlesPerRun: settings.articlesPerRun,
          countries,
        };
      }
    }
  }

  const count = Math.min(
    12,
    Math.max(1, opts?.count ?? settings.articlesPerRun)
  );

  const created: AutoRunResult["created"] = [];
  const errors: string[] = [];

  for (let i = 0; i < count; i++) {
    const country = countries[i % countries.length];
    try {
      const topic = await buildTopicForCountry(country);
      const draft = await generateBlogArticleDraft({
        topic,
        countryCode: country,
        language: languageForCountry(country),
      });
      const post = await persistBlogDraft({
        draft,
        countryCode: country,
        published: publish,
        aiModel: settings.model,
        actor: opts?.actor || "cron:blog-ai",
      });
      created.push({
        id: post.id,
        slug: post.slug,
        title: post.title,
        country,
        published: post.published,
      });
    } catch (e) {
      errors.push(
        `${country}#${i + 1}: ${e instanceof Error ? e.message : "failed"}`
      );
    }
  }

  // Only mark last run when at least one article succeeded OR force completed with no hard skip
  if (created.length > 0 || (opts?.force && errors.length === 0)) {
    await setSetting(SETTING_KEYS.AI_LAST_RUN_AT, new Date().toISOString());
  }

  await writeAppLog({
    category: "BLOG",
    level: created.length > 0 ? "SUCCESS" : "WARNING",
    title: `Blog AI batch: ${created.length}/${count} articles`,
    actor: opts?.actor || "cron:blog-ai",
    route: "/lib/blog-ai-publish",
    message:
      errors.length > 0
        ? errors.slice(0, 5).join("; ")
        : `Published=${publish} countries=${countries.join(",")}`,
    metadata: {
      scope: "blog_only",
      created: created.length,
      errors: errors.length,
      publish,
      countries,
    },
  });

  return {
    skipped: false,
    created,
    errors,
    intervalHours: settings.intervalHours,
    articlesPerRun: count,
    countries,
  };
}
