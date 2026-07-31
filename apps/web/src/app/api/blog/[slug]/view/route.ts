import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kupon/db";
import {
  BLOG_VISITOR_COOKIE,
  BLOG_VISITOR_COOKIE_MAX_AGE,
  getJakartaDay,
  hashBlogVisitorId,
  isLikelyBot,
  isValidBlogVisitorId,
} from "@/lib/blog-analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

function isSameSiteRequest(request: NextRequest) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site") {
    return false;
  }

  const origin = request.headers.get("origin");
  if (!origin) return true;

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const requestHost = forwardedHost || request.headers.get("host");
  if (!requestHost) return false;

  try {
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (
    !isSameSiteRequest(request) ||
    isLikelyBot(request.headers.get("user-agent"))
  ) {
    return NextResponse.json({ tracked: false }, { status: 202 });
  }

  const secret = process.env.BLOG_VIEW_HASH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    console.error(
      "[blog view] BLOG_VIEW_HASH_SECRET is missing or shorter than 32 characters."
    );
    return NextResponse.json(
      { tracked: false, error: "Analytics is not configured." },
      { status: 503 }
    );
  }

  const { slug } = await context.params;
  if (!slug || slug.length > 120) {
    return NextResponse.json({ tracked: false }, { status: 400 });
  }

  const post = await prisma.blogPost.findFirst({
    where: { slug, published: true },
    select: { id: true },
  });
  if (!post) {
    return NextResponse.json({ tracked: false }, { status: 404 });
  }

  const existingVisitorId = request.cookies.get(BLOG_VISITOR_COOKIE)?.value;
  const visitorId = isValidBlogVisitorId(existingVisitorId)
    ? existingVisitorId!
    : randomUUID();
  const visitorHash = hashBlogVisitorId(visitorId, secret);
  const day = getJakartaDay();

  const inserted = await prisma.$transaction(async (transaction) => {
    const result = await transaction.blogPostDailyVisit.createMany({
      data: [{ postId: post.id, visitorHash, day }],
      skipDuplicates: true,
    });

    if (result.count === 1) {
      await transaction.blogPost.update({
        where: { id: post.id },
        data: { views: { increment: 1 } },
      });
    }

    return result.count === 1;
  });

  const response = NextResponse.json({ tracked: true, newVisit: inserted });
  response.cookies.set({
    name: BLOG_VISITOR_COOKIE,
    value: visitorId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: BLOG_VISITOR_COOKIE_MAX_AGE,
  });
  return response;
}
