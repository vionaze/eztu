import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kupon/db";
import { isLikelyBot } from "@/lib/blog-analytics";
import {
  PRODUCT_VISITOR_COOKIE,
  PRODUCT_VISITOR_COOKIE_MAX_AGE,
  hashProductVisitorId,
  isProductAnalyticsEventType,
  isValidProductVisitorId,
} from "@/lib/product-analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isSameSiteRequest(request: NextRequest) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site") {
    return false;
  }
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: NextRequest) {
  if (
    request.headers.get("x-analytics-consent") !== "all" ||
    !isSameSiteRequest(request) ||
    isLikelyBot(request.headers.get("user-agent"))
  ) {
    return NextResponse.json({ tracked: false }, { status: 202 });
  }

  const secret =
    process.env.PRODUCT_ANALYTICS_HASH_SECRET?.trim() ||
    process.env.BLOG_VIEW_HASH_SECRET?.trim() ||
    "";
  if (secret.length < 32) {
    return NextResponse.json(
      { tracked: false, error: "Analytics is not configured." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const productId = text(body?.productId, 120);
  const variantId = text(body?.variantId, 160) || null;
  const eventType = body?.eventType;
  if (!productId || !isProductAnalyticsEventType(eventType)) {
    return NextResponse.json({ tracked: false }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, published: true },
    select: {
      id: true,
      variants: {
        where: variantId ? { id: variantId } : { id: "__no_variant__" },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!product || (variantId && product.variants.length === 0)) {
    return NextResponse.json({ tracked: false }, { status: 404 });
  }

  const existingVisitorId = request.cookies.get(PRODUCT_VISITOR_COOKIE)?.value;
  const visitorId = isValidProductVisitorId(existingVisitorId)
    ? existingVisitorId!
    : randomUUID();
  const visitorHash = hashProductVisitorId(visitorId, secret);

  await prisma.productAnalyticsEvent.create({
    data: {
      productId,
      variantId,
      eventType,
      visitorHash,
      countryCode: text(body?.countryCode, 12).toLowerCase() || null,
      paymentMethod: text(body?.paymentMethod, 20) || null,
      reason: text(body?.reason, 160) || null,
    },
  });

  const response = NextResponse.json({ tracked: true });
  response.cookies.set({
    name: PRODUCT_VISITOR_COOKIE,
    value: visitorId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PRODUCT_VISITOR_COOKIE_MAX_AGE,
  });
  return response;
}
