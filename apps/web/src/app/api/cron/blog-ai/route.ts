import { NextResponse } from "next/server";
import { runBlogAiAutoBatch } from "@/lib/blog-ai-publish";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET/POST /api/cron/blog-ai
 *
 * Call every hour from system crontab / uptime monitor.
 * Self-throttles using Settings interval (1/2/4/8/12h).
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 *   or  ?secret=<CRON_SECRET>
 *
 * Scope: BlogPost create/publish only.
 */
function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET || process.env.BLOG_AI_CRON_SECRET;
  if (!secret) {
    // Fail closed in production if no secret configured
    if (process.env.NODE_ENV === "production") return false;
    return true;
  }
  const header = request.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const url = new URL(request.url);
  const q = url.searchParams.get("secret") || "";
  return bearer === secret || q === secret;
}

async function handle(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";

  const result = await runBlogAiAutoBatch({
    force,
    actor: "cron:blog-ai",
  });

  return NextResponse.json({
    ok: true,
    scope: "blog_article_only",
    ...result,
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
