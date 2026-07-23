import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/clerk";
import { generateBlogArticleDraft } from "@/lib/blog-ai";
import { getBlogAiSettings } from "@/lib/settings";
import { writeAppLog } from "@/lib/app-log";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    const body = (await request.json()) as {
      topic?: string;
      countryCode?: string;
      language?: string;
    };

    const topic = String(body.topic || "").trim();
    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const countryCode = String(body.countryCode || "GLOBAL")
      .toUpperCase()
      .slice(0, 12);

    const settings = await getBlogAiSettings();
    if (!settings.enabled) {
      return NextResponse.json(
        { error: "AI article generation is OFF in Settings." },
        { status: 400 }
      );
    }
    // When autoCountries is configured, only allow listed markets for AI gen
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

    const draft = await generateBlogArticleDraft({
      topic,
      countryCode,
      language: body.language,
    });

    await writeAppLog({
      category: "BLOG",
      level: "SUCCESS",
      title: `AI draft: ${draft.title}`,
      actor: admin.email || admin.dbUserId,
      route: "/api/admin/blog/generate",
      metadata: {
        country: countryCode,
        model: settings.model,
        focusKeyword: draft.focusKeyword,
      },
    });

    return NextResponse.json({
      draft: {
        ...draft,
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
