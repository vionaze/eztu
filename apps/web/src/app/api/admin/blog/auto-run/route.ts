import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/clerk";
import { runBlogAiAutoBatch } from "@/lib/blog-ai-publish";
import { BLOG_AI_COUNT_OPTIONS } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Manual "Run now" from admin Settings — same batch logic as cron.
 * Still blog-only (create/publish BlogPost).
 */
export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    const body = (await request.json().catch(() => ({}))) as {
      count?: number;
      publish?: boolean;
    };

    let count = body.count;
    if (
      count != null &&
      !BLOG_AI_COUNT_OPTIONS.includes(count as (typeof BLOG_AI_COUNT_OPTIONS)[number])
    ) {
      count = undefined;
    }

    const result = await runBlogAiAutoBatch({
      force: true,
      actor: admin.email || admin.dbUserId,
      count,
      publish: body.publish,
    });

    return NextResponse.json({
      ok: true,
      scope: "blog_article_only",
      ...result,
    });
  } catch (error) {
    console.error("[admin/blog/auto-run]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Auto-run failed",
      },
      { status: 500 }
    );
  }
}
