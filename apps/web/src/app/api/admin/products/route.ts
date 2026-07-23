import { NextResponse } from "next/server";
import { prisma, type ProductFulfillmentType } from "@kupon/db";
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

type VariantInput = {
  name?: string;
  priceIDR?: number | string;
  priceUSD?: number | string;
  supplierSku?: string | null;
  supplierCostIDR?: number | string | null;
};

export async function GET() {
  try {
    await requireAdminUser();
    const products = await prisma.product.findMany({
      orderBy: [{ published: "desc" }, { name: "asc" }],
      include: {
        category: true,
        variants: { orderBy: { priceIDR: "asc" } },
      },
    });
    return NextResponse.json({ products });
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
      description?: string;
      image?: string;
      categoryId?: string;
      featured?: boolean;
      published?: boolean;
      fulfillmentType?: string;
      requiresServerId?: boolean;
      gameIdLabel?: string;
      serverIdLabel?: string;
      variants?: VariantInput[];
    };

    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const categoryIdRaw = String(body.categoryId || "").trim();
    let categoryId: string | null = categoryIdRaw || null;
    if (categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
      });
      if (!category) {
        return NextResponse.json(
          { error: "Category not found" },
          { status: 400 }
        );
      }
    }

    let slug = slugify(String(body.slug || name));
    if (!slug) slug = `product-${Date.now().toString(36)}`;
    const clash = await prisma.product.findUnique({ where: { slug } });
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;

    const fulfillmentRaw = String(body.fulfillmentType || "VOUCHER").toUpperCase();
    const fulfillmentType: ProductFulfillmentType =
      fulfillmentRaw === "TOP_UP" ? "TOP_UP" : "VOUCHER";
    const requiresServerId =
      fulfillmentType === "TOP_UP" && Boolean(body.requiresServerId);

    const variants = Array.isArray(body.variants) ? body.variants : [];
    const cleanVariants = variants
      .map((v) => {
        const vName = String(v.name || "").trim();
        const priceIDR = Math.round(Number(v.priceIDR));
        const priceUSD = Number(v.priceUSD);
        if (!vName || !Number.isFinite(priceIDR) || priceIDR < 0) return null;
        if (!Number.isFinite(priceUSD) || priceUSD < 0) return null;
        const cost =
          v.supplierCostIDR != null && v.supplierCostIDR !== ""
            ? Math.round(Number(v.supplierCostIDR))
            : null;
        return {
          name: vName,
          priceIDR,
          priceUSD,
          supplierSku: v.supplierSku ? String(v.supplierSku).trim() : null,
          supplierCostIDR:
            cost != null && Number.isFinite(cost) ? cost : null,
        };
      })
      .filter(Boolean) as {
      name: string;
      priceIDR: number;
      priceUSD: number;
      supplierSku: string | null;
      supplierCostIDR: number | null;
    }[];

    if (cleanVariants.length === 0) {
      return NextResponse.json(
        { error: "At least one valid variant is required" },
        { status: 400 }
      );
    }

    const image =
      String(body.image || "").trim() ||
      `https://placehold.co/400x500/1a1a2e/a0a0b8?text=${encodeURIComponent(name.slice(0, 20))}`;

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        description: String(body.description || "").trim() || name,
        image,
        categoryId,
        featured: Boolean(body.featured),
        published: Boolean(body.published),
        fulfillmentType,
        requiresServerId,
        gameIdLabel:
          fulfillmentType === "TOP_UP"
            ? String(body.gameIdLabel || "User ID").trim() || "User ID"
            : null,
        serverIdLabel:
          fulfillmentType === "TOP_UP" && requiresServerId
            ? String(body.serverIdLabel || "Zone / Server ID").trim() ||
              "Zone / Server ID"
            : null,
        variants: {
          create: cleanVariants,
        },
      },
      include: {
        category: true,
        variants: true,
      },
    });

    await writeAppLog({
      category: "ADMIN",
      level: "SUCCESS",
      title: `Product created: ${product.name}`,
      actor: admin.email || admin.dbUserId,
      route: "/api/admin/products",
      metadata: {
        productId: product.id,
        fulfillmentType,
        variants: cleanVariants.length,
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error("[admin/products POST]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Create failed",
      },
      { status: 500 }
    );
  }
}
