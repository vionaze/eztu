import { NextResponse } from "next/server";
import { prisma, type Prisma } from "@kupon/db";
import { requireAdminUser } from "@/lib/clerk";
import { writeAppLog } from "@/lib/app-log";

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

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    await requireAdminUser();
    const { id } = await ctx.params;
    const post = await prisma.blogPost.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ post });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  try {
    const admin = await requireAdminUser();
    const { id } = await ctx.params;
    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const data: Prisma.BlogPostUpdateInput = {};

    if (body.title !== undefined) data.title = String(body.title).trim();
    if (body.slug !== undefined) {
      let slug = slugify(String(body.slug));
      const clash = await prisma.blogPost.findFirst({
        where: { slug, NOT: { id } },
      });
      if (clash) slug = `${slug}-${Date.now().toString(36)}`;
      data.slug = slug;
    }
    if (body.excerpt !== undefined) {
      data.excerpt = body.excerpt ? String(body.excerpt).slice(0, 500) : null;
    }
    if (body.content !== undefined) data.content = String(body.content);
    if (body.coverImage !== undefined) {
      data.coverImage = body.coverImage ? String(body.coverImage) : null;
    }
    if (body.thumbnailImage !== undefined) {
      data.thumbnailImage = body.thumbnailImage
        ? String(body.thumbnailImage)
        : null;
    }
    if (body.category !== undefined) {
      data.category = body.category ? String(body.category) : null;
    }
    if (body.countryCode !== undefined) {
      data.countryCode = String(body.countryCode || "GLOBAL")
        .toUpperCase()
        .slice(0, 12);
    }
    if (body.metaTitle !== undefined) {
      data.metaTitle = body.metaTitle
        ? String(body.metaTitle).slice(0, 70)
        : null;
    }
    if (body.metaDescription !== undefined) {
      data.metaDescription = body.metaDescription
        ? String(body.metaDescription).slice(0, 160)
        : null;
    }
    if (body.focusKeyword !== undefined) {
      data.focusKeyword = body.focusKeyword
        ? String(body.focusKeyword)
        : null;
    }
    if (body.canonicalUrl !== undefined) {
      data.canonicalUrl = body.canonicalUrl
        ? String(body.canonicalUrl)
        : null;
    }
    if (body.ogTitle !== undefined) {
      data.ogTitle = body.ogTitle ? String(body.ogTitle) : null;
    }
    if (body.ogDescription !== undefined) {
      data.ogDescription = body.ogDescription
        ? String(body.ogDescription)
        : null;
    }
    if (body.faq !== undefined) {
      data.structuredData = {
        faq: Array.isArray(body.faq) ? body.faq : [],
      } as Prisma.InputJsonValue;
    } else if (body.structuredData !== undefined) {
      data.structuredData = body.structuredData as Prisma.InputJsonValue;
    }
    if (body.aiGenerated !== undefined) {
      data.aiGenerated = Boolean(body.aiGenerated);
    }
    if (body.aiModel !== undefined) {
      data.aiModel = body.aiModel ? String(body.aiModel) : null;
    }
    if (body.published !== undefined) {
      const published = Boolean(body.published);
      data.published = published;
      if (published && !existing.publishedAt) {
        data.publishedAt = new Date();
      }
      if (!published) {
        data.publishedAt = null;
      }
    }

    const post = await prisma.blogPost.update({ where: { id }, data });

    await writeAppLog({
      category: "BLOG",
      level: "INFO",
      title: `Updated: ${post.title}`,
      actor: admin.email || admin.dbUserId,
      route: `/api/admin/blog/${id}`,
      metadata: { postId: post.id, published: post.published },
    });

    return NextResponse.json({ post });
  } catch (error) {
    console.error("[admin/blog PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  try {
    const admin = await requireAdminUser();
    const { id } = await ctx.params;
    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.blogPost.delete({ where: { id } });

    await writeAppLog({
      category: "BLOG",
      level: "WARNING",
      title: `Deleted: ${existing.title}`,
      actor: admin.email || admin.dbUserId,
      route: `/api/admin/blog/${id}`,
      metadata: { postId: id, slug: existing.slug },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/blog DELETE]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 }
    );
  }
}
