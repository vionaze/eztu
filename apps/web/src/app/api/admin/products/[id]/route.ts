import { NextResponse } from "next/server";
import { prisma, type ProductFulfillmentType } from "@kupon/db";
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

export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    await requireAdminUser();
    const { id } = await ctx.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: { orderBy: { priceIDR: "asc" } },
        _count: { select: { orders: true } },
      },
    });
    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ product });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

type VariantBody = {
  id?: string;
  name?: string;
  priceIDR?: number | string;
  priceUSD?: number | string;
  supplierSku?: string | null;
  supplierCostIDR?: number | string | null;
  _delete?: boolean;
};

export async function PATCH(request: Request, ctx: RouteCtx) {
  try {
    const admin = await requireAdminUser();
    const { id } = await ctx.params;
    const existing = await prisma.product.findUnique({
      where: { id },
      include: { variants: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;

    // Quick toggles only
    if (body.published !== undefined && Object.keys(body).length === 1) {
      const product = await prisma.product.update({
        where: { id },
        data: { published: Boolean(body.published) },
        include: {
          category: true,
          variants: { orderBy: { priceIDR: "asc" } },
        },
      });
      await writeAppLog({
        category: "ADMIN",
        level: "INFO",
        title: body.published
          ? `Product shown: ${product.name}`
          : `Product hidden: ${product.name}`,
        actor: admin.email || admin.dbUserId,
        route: `/api/admin/products/${id}`,
      });
      return NextResponse.json({ product });
    }

    if (body.featured !== undefined && Object.keys(body).length === 1) {
      const product = await prisma.product.update({
        where: { id },
        data: { featured: Boolean(body.featured) },
        include: {
          category: true,
          variants: { orderBy: { priceIDR: "asc" } },
        },
      });
      return NextResponse.json({ product });
    }

    const data: {
      name?: string;
      slug?: string;
      description?: string;
      image?: string;
      categoryId?: string;
      featured?: boolean;
      published?: boolean;
      fulfillmentType?: ProductFulfillmentType;
      requiresServerId?: boolean;
      gameIdLabel?: string | null;
      serverIdLabel?: string | null;
    } = {};

    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.slug !== undefined) {
      let slug = slugify(String(body.slug));
      const clash = await prisma.product.findFirst({
        where: { slug, NOT: { id } },
      });
      if (clash) slug = `${slug}-${Date.now().toString(36)}`;
      data.slug = slug;
    }
    if (body.description !== undefined) {
      data.description = String(body.description).trim();
    }
    if (body.image !== undefined) data.image = String(body.image).trim();
    if (body.categoryId !== undefined) {
      data.categoryId = String(body.categoryId).trim();
    }
    if (body.featured !== undefined) data.featured = Boolean(body.featured);
    if (body.published !== undefined) data.published = Boolean(body.published);

    if (body.fulfillmentType !== undefined) {
      const raw = String(body.fulfillmentType).toUpperCase();
      data.fulfillmentType = raw === "TOP_UP" ? "TOP_UP" : "VOUCHER";
    }
    const fulfillment =
      data.fulfillmentType || existing.fulfillmentType;

    if (body.requiresServerId !== undefined) {
      data.requiresServerId =
        fulfillment === "TOP_UP" && Boolean(body.requiresServerId);
    } else if (data.fulfillmentType === "VOUCHER") {
      data.requiresServerId = false;
    }

    if (body.gameIdLabel !== undefined) {
      data.gameIdLabel =
        fulfillment === "TOP_UP"
          ? String(body.gameIdLabel || "User ID").trim() || "User ID"
          : null;
    }
    if (body.serverIdLabel !== undefined) {
      data.serverIdLabel =
        fulfillment === "TOP_UP"
          ? String(body.serverIdLabel || "Zone / Server ID").trim() ||
            "Zone / Server ID"
          : null;
    }

    await prisma.product.update({ where: { id }, data });

    // Variants: update / create / delete
    if (Array.isArray(body.variants)) {
      const variants = body.variants as VariantBody[];
      const existingIds = new Set(existing.variants.map((v) => v.id));
      const keepIds = new Set<string>();

      for (const v of variants) {
        if (v._delete && v.id && existingIds.has(v.id)) {
          const orderCount = await prisma.orderItem.count({
            where: { variantId: v.id },
          });
          if (orderCount > 0) {
            return NextResponse.json(
              {
                error: `Variant “${v.name || v.id}” has ${orderCount} order(s) and cannot be deleted. Hide the product or edit the price instead.`,
              },
              { status: 400 }
            );
          }
          await prisma.productVariant.delete({ where: { id: v.id } });
          continue;
        }

        const name = String(v.name || "").trim();
        const priceIDR = Math.round(Number(v.priceIDR));
        const priceUSD = Number(v.priceUSD);
        if (!name || !Number.isFinite(priceIDR) || priceIDR < 0) continue;
        if (!Number.isFinite(priceUSD) || priceUSD < 0) continue;

        const costRaw = v.supplierCostIDR;
        const cost =
          costRaw != null && costRaw !== ""
            ? Math.round(Number(costRaw))
            : null;

        const payload = {
          name,
          priceIDR,
          priceUSD,
          supplierSku: v.supplierSku ? String(v.supplierSku).trim() : null,
          supplierCostIDR:
            cost != null && Number.isFinite(cost) ? cost : null,
        };

        if (v.id && existingIds.has(v.id)) {
          await prisma.productVariant.update({
            where: { id: v.id },
            data: payload,
          });
          keepIds.add(v.id);
        } else {
          const created = await prisma.productVariant.create({
            data: { ...payload, productId: id },
          });
          keepIds.add(created.id);
        }
      }
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: { orderBy: { priceIDR: "asc" } },
      },
    });

    await writeAppLog({
      category: "ADMIN",
      level: "INFO",
      title: `Product updated: ${product?.name || id}`,
      actor: admin.email || admin.dbUserId,
      route: `/api/admin/products/${id}`,
      metadata: {
        published: product?.published,
        variants: product?.variants.length,
      },
    });

    return NextResponse.json({ product });
  } catch (error) {
    console.error("[admin/products PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}
