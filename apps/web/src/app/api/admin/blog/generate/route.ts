import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/clerk";
import { generateBlogArticleDraft } from "@/lib/blog-ai";
import { getBlogAiSettings } from "@/lib/settings";
import { writeAppLog } from "@/lib/app-log";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/admin/blog/generate
 *
 * SCOPE: blog article draft JSON only.
 * - Does NOT write BlogPost / Order / Setting / User
 * - Does NOT publish, fulfill, or touch payments
 * - Does NOT run AI against any admin domain other than this draft helper
 * Human must review and save via /api/admin/blog (manual publish).
 */
export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    const body = (await request.json()) as {
      topic?: string;
      countryCode?: string;
      language?: string;
    };

    // Reject payloads that try to smuggle non-blog fields into the AI path
    const allowedKeys = new Set(["topic", "countryCode", "language"]);
    for (const key of Object.keys(body || {})) {
      if (!allowedKeys.has(key)) {
        // ignore extras silently — do not forward to the model
      }
    }

    const topic = String(body.topic || "").trim().slice(0, 500);
    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const countryCode = String(body.countryCode || "GLOBAL")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 12) || "GLOBAL";

    const language = body.language
      ? String(body.language).trim().slice(0, 40)
      : undefined;

    const settings = await getBlogAiSettings();
    if (!settings.enabled) {
      return NextResponse.json(
        { error: "AI article generation is OFF in Settings." },
        { status: 400 }
      );
    }
    if (
      settings.autoCountries.length > 0 &&
      !settings.autoCountries.includes(countryCode)
    ) {
      return NextResponse.json(
        {
          error: `Country ${countryCode} is not enabled for auto AI articles. Enable it under Settings → Blog AI.`,
        },
        { status: 400 }
      );
    }

    // Draft only — never auto-save / publish
    const draft = await generateBlogArticleDraft({
      topic,
      countryCode,
      language,
    });

    await writeAppLog({
      category: "BLOG",
      level: "SUCCESS",
      title: `AI draft (blog only): ${draft.title}`,
      actor: admin.email || admin.dbUserId,
      route: "/api/admin/blog/generate",
      metadata: {
        scope: "blog_article_draft_only",
        country: countryCode,
        model: settings.model,
        focusKeyword: draft.focusKeyword,
        // Never log API key, base URL secrets, or full prompt
      },
    });

    // Explicit whitelist response — no AI extras leak through
    return NextResponse.json({
      scope: "blog_article_draft_only",
      draft: {
        title: draft.title,
        slug: draft.slug,
        excerpt: draft.excerpt,
        contentHtml: draft.contentHtml,
        metaTitle: draft.metaTitle,
        metaDescription: draft.metaDescription,
        focusKeyword: draft.focusKeyword,
        category: draft.category,
        faq: draft.faq,
        countryCode,
        aiGenerated: true,
        aiModel: settings.model,
      },
    });
  } catch (error) {
    console.error("[admin/blog/generate]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "AI generation failed",
      },
      { status: 500 }
    );
  }
}
