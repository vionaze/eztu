import { NextResponse } from "next/server";
import { runBlogAiAutoBatch } from "@/lib/blog-ai-publish";
import { isProductionRuntime, safeEqualSecret } from "@/lib/security";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET/POST /api/cron/blog-ai
 *
 * Auth: Authorization: Bearer <CRON_SECRET>  (preferred)
 * Query ?secret= is rejected in production (secrets in URLs end up in logs/proxies).
 *
 * Scope: BlogPost create/publish only.
 */
function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET || process.env.BLOG_AI_CRON_SECRET;
  if (!secret) {
    // Fail closed in production if no secret configured
    return !isProductionRuntime();
  }

  const header = request.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (safeEqualSecret(bearer, secret)) {
    return true;
  }

  // Dev-only fallback for quick local testing — never accept query secrets in prod
  if (!isProductionRuntime()) {
    const url = new URL(request.url);
    const q = url.searchParams.get("secret") || "";
    return safeEqualSecret(q, secret);
  }

  return false;
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
