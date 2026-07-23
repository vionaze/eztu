import { NextResponse } from "next/server";
import { prisma } from "@kupon/db";
import { requireAdminUser } from "@/lib/clerk";
import { writeAppLog } from "@/lib/app-log";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

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

export async function PATCH(request: Request, ctx: RouteCtx) {
  try {
    const admin = await requireAdminUser();
    const { id } = await ctx.params;
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      name?: string;
      slug?: string;
      image?: string | null;
    };

    const data: { name?: string; slug?: string; image?: string | null } = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return NextResponse.json(
          { error: "Name cannot be empty" },
          { status: 400 }
        );
      }
      data.name = name;
    }

    if (body.slug !== undefined) {
      let slug = slugify(String(body.slug));
      if (!slug) {
        return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
      }
      const clash = await prisma.category.findFirst({
        where: { slug, NOT: { id } },
      });
      if (clash) slug = `${slug}-${Date.now().toString(36)}`;
      data.slug = slug;
    }

    if (body.image !== undefined) {
      data.image = body.image ? String(body.image).trim() : null;
    }

    const category = await prisma.category.update({
      where: { id },
      data,
      include: { _count: { select: { products: true } } },
    });

    await writeAppLog({
      category: "ADMIN",
      level: "INFO",
      title: `Category updated: ${category.name}`,
      actor: admin.email || admin.dbUserId,
      route: `/api/admin/categories/${id}`,
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error("[admin/categories PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, ctx: RouteCtx) {
  try {
    const admin = await requireAdminUser();
    const { id } = await ctx.params;
    const existing = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      confirmName?: string;
    };
    const confirmName = String(body.confirmName || "").trim();

    if (confirmName !== existing.name) {
      return NextResponse.json(
        {
          error:
            "Confirmation name does not match. Type the exact category name to delete.",
        },
        { status: 400 }
      );
    }

    const productCount = existing._count.products;

    // Products → Uncategorized (categoryId null) via onDelete SetNull
    await prisma.category.delete({ where: { id } });

    await writeAppLog({
      category: "ADMIN",
      level: "WARNING",
      title: `Category deleted: ${existing.name}`,
      actor: admin.email || admin.dbUserId,
      route: `/api/admin/categories/${id}`,
      message:
        productCount > 0
          ? `${productCount} product(s) set to Uncategorized`
          : "No products affected",
      metadata: {
        categoryId: id,
        slug: existing.slug,
        productsUncategorized: productCount,
      },
    });

    return NextResponse.json({
      ok: true,
      productsUncategorized: productCount,
    });
  } catch (error) {
    console.error("[admin/categories DELETE]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 }
    );
  }
}
