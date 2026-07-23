import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/clerk";
import { generateBlogArticleDraft } from "@/lib/blog-ai";
import { persistBlogDraft } from "@/lib/blog-ai-publish";
import { getBlogAiSettings } from "@/lib/settings";
import { writeAppLog } from "@/lib/app-log";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/admin/blog/generate
 *
 * Blog article only.
 * - Default: return draft JSON for the form
 * - publish: true → create BlogPost and publish immediately
 */
export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    const body = (await request.json()) as {
      topic?: string;
      countryCode?: string;
      language?: string;
      publish?: boolean;
    };

    const topic = String(body.topic || "").trim().slice(0, 500);
    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const countryCode =
      String(body.countryCode || "GLOBAL")
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 12) || "GLOBAL";

    const language = body.language
      ? String(body.language).trim().slice(0, 40)
      : undefined;

    const publish = Boolean(body.publish);

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
          error: `Country ${countryCode} is not enabled for AI articles. Enable it under Settings → Blog AI.`,
        },
        { status: 400 }
      );
    }

    const draft = await generateBlogArticleDraft({
      topic,
      countryCode,
      language,
    });

    if (publish) {
      const post = await persistBlogDraft({
        draft,
        countryCode,
        published: true,
        aiModel: settings.model,
        actor: admin.email || admin.dbUserId,
      });

      return NextResponse.json({
        scope: "blog_article_only",
        published: true,
        post,
        draft: {
          title: draft.title,
          slug: post.slug,
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
    }

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
      },
    });

    return NextResponse.json({
      scope: "blog_article_draft_only",
      published: false,
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
