import { NextResponse } from "next/server";
import { prisma } from "@kupon/db";
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

export async function GET() {
  try {
    await requireAdminUser();
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    });
    const uncategorized = await prisma.product.count({
      where: { categoryId: null },
    });
    return NextResponse.json({ categories, uncategorized });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    const body = (await request.json()) as {
      name?: string;
      slug?: string;
      image?: string;
    };

    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    let slug = slugify(String(body.slug || name));
    if (!slug) slug = `category-${Date.now().toString(36)}`;

    const clash = await prisma.category.findUnique({ where: { slug } });
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        image: body.image ? String(body.image).trim() : null,
      },
      include: { _count: { select: { products: true } } },
    });

    await writeAppLog({
      category: "ADMIN",
      level: "SUCCESS",
      title: `Category created: ${category.name}`,
      actor: admin.email || admin.dbUserId,
      route: "/api/admin/categories",
      metadata: { categoryId: category.id, slug: category.slug },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error("[admin/categories POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Create failed" },
      { status: 500 }
    );
  }
}
