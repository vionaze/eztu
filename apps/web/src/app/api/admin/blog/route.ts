import { NextResponse } from "next/server";
import { prisma, type Prisma } from "@kupon/db";
import { requireAdminUser } from "@/lib/clerk";
import { writeAppLog } from "@/lib/app-log";
import { sanitizeBlogHtml } from "@/lib/blog-ai";

export const dynamic = "force-dynamic";

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

export async function GET() {
  try {
    await requireAdminUser();
    const posts = await prisma.blogPost.findMany({
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ posts });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    const body = (await request.json()) as Record<string, unknown>;

    const title = String(body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    let slug = String(body.slug || "").trim() || slugify(title);
    slug = slugify(slug);

    const existing = await prisma.blogPost.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const published = Boolean(body.published);
    const faq = Array.isArray(body.faq) ? body.faq : undefined;

    const post = await prisma.blogPost.create({
      data: {
        title,
        slug,
        excerpt: body.excerpt ? String(body.excerpt).slice(0, 500) : null,
        content: sanitizeBlogHtml(String(body.content || "")),
        coverImage: body.coverImage ? String(body.coverImage) : null,
        thumbnailImage: body.thumbnailImage
          ? String(body.thumbnailImage)
          : null,
        category: body.category ? String(body.category) : null,
        countryCode: String(body.countryCode || "GLOBAL")
          .toUpperCase()
          .slice(0, 12),
        metaTitle: body.metaTitle ? String(body.metaTitle).slice(0, 70) : null,
        metaDescription: body.metaDescription
          ? String(body.metaDescription).slice(0, 160)
          : null,
        focusKeyword: body.focusKeyword ? String(body.focusKeyword) : null,
        canonicalUrl: body.canonicalUrl ? String(body.canonicalUrl) : null,
        ogTitle: body.ogTitle ? String(body.ogTitle) : null,
        ogDescription: body.ogDescription ? String(body.ogDescription) : null,
        structuredData: faq
          ? ({ faq } as Prisma.InputJsonValue)
          : body.structuredData
            ? (body.structuredData as Prisma.InputJsonValue)
            : undefined,
        aiGenerated: Boolean(body.aiGenerated),
        aiModel: body.aiModel ? String(body.aiModel) : null,
        published,
        publishedAt: published ? new Date() : null,
      },
    });

    await writeAppLog({
      category: "BLOG",
      level: "SUCCESS",
      title: published ? `Published: ${post.title}` : `Draft created: ${post.title}`,
      actor: admin.email || admin.dbUserId,
      route: "/api/admin/blog",
      metadata: { postId: post.id, slug: post.slug, country: post.countryCode },
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error("[admin/blog POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create post" },
      { status: 500 }
    );
  }
}
