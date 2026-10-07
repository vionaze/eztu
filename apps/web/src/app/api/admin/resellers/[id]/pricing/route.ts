import { NextRequest } from "next/server";
import { calculateResellerPrice, chooseEffectiveRule, formatResellerMarkupPercent, parseResellerMarkupPercent, prisma, Prisma } from "@kupon/db";
import { requirePlatformAdminForResellers } from "@/lib/reseller-auth";
import { resellerApiError, resellerJson, requireSameOrigin } from "@/lib/reseller-api";
import { ResellerPricingError } from "@/lib/reseller-pricing-service";
import { getSupplierProduct } from "@/lib/supplier";
import { writeAppLog } from "@/lib/app-log";

type Context = { params: Promise<{ id: string }> };

async function getOrganization(id: string) {
  const organization = await prisma.resellerOrganization.findUnique({ where: { id } });
  if (!organization) throw new ResellerPricingError("Reseller not found.", 404, "ORGANIZATION_NOT_FOUND");
  return organization;
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: Context) {
  try {
    await requirePlatformAdminForResellers();
    const { id } = await context.params;
    const organization = await getOrganization(id);
    const search = request.nextUrl.searchParams.get("search")?.trim().slice(0, 100) || "";
    const variants = await prisma.productVariant.findMany({
      where: {
        published: true, replacementForId: null, supplierSku: { not: null }, product: { published: true },
        ...(search ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { supplierSku: { contains: search, mode: "insensitive" as const } },
            { product: { name: { contains: search, mode: "insensitive" as const } } },
          ],
        } : {
          OR: [
            { resellerTierPrices: { some: { tier: organization.tier } } },
            { resellerOrganizationPrices: { some: { organizationId: id } } },
          ],
        }),
      },
      include: {
        product: { select: { name: true } },
        resellerTierPrices: { where: { tier: organization.tier } },
        resellerOrganizationPrices: { where: { organizationId: id } },
      },
      take: 101,
      orderBy: [{ productId: "asc" }, { name: "asc" }, { id: "asc" }],
    });
    const items = variants.slice(0, 100).map((variant) => {
      const override = variant.resellerOrganizationPrices[0];
      const tierRule = variant.resellerTierPrices[0];
      const rule = chooseEffectiveRule(override, tierRule);
      let previewPriceIDR: number | null = null;
      if (rule?.enabled && variant.supplierStatus?.trim().toLowerCase() === "available") {
        try { previewPriceIDR = calculateResellerPrice(variant.supplierCostIDR ?? 0, rule); } catch { /* Unpriced snapshot remains unavailable. */ }
      }
      return {
        variantId: variant.id, name: variant.name, productName: variant.product.name,
        countryCode: variant.countryCode, supplierSku: variant.supplierSku,
        supplierCostIDR: variant.supplierCostIDR, supplierStatus: variant.supplierStatus,
        source: override ? "ORGANIZATION" : tierRule ? "TIER" : null,
        mode: rule?.mode ?? null,
        markupPercent: rule?.markupMicros !== null && rule?.markupMicros !== undefined ? formatResellerMarkupPercent(rule.markupMicros) : null,
        fixedPriceIDR: rule?.fixedPriceIDR ?? null,
        enabled: rule?.enabled ?? false,
        revision: override?.revision ?? null,
        effectiveRevision: override?.revision ?? tierRule?.revision ?? null,
        previewPriceIDR, hasOverride: Boolean(override),
      };
    });
    return resellerJson({ organization: { id: organization.id, name: organization.name, tier: organization.tier }, items, hasMore: variants.length > 100 });
  } catch (error) { return resellerApiError(error); }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const admin = await requirePlatformAdminForResellers();
    requireSameOrigin(request);
    const { id } = await context.params;
    await getOrganization(id);
    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return resellerJson({ error: "Invalid payload" }, 400);
    const body = raw as Record<string, unknown>;
    if (typeof body.variantId !== "string" || !["MARKUP", "FIXED"].includes(String(body.mode)) || typeof body.enabled !== "boolean" ||
        !(body.expectedRevision === null || (Number.isInteger(body.expectedRevision) && Number(body.expectedRevision) > 0))) {
      return resellerJson({ error: "Invalid pricing fields" }, 400);
    }
    const variantId = body.variantId;
    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant || !variant.published || variant.replacementForId || !variant.supplierSku) return resellerJson({ error: "Package not found" }, 404);
    const mode = body.mode as "MARKUP" | "FIXED";
    let markupMicros: number | null = null;
    let fixedPriceIDR: number | null = null;
    try {
      if (mode === "MARKUP") {
        if (typeof body.markupPercent !== "string") throw new Error();
        markupMicros = parseResellerMarkupPercent(body.markupPercent);
      } else {
        if (!Number.isInteger(body.fixedPriceIDR) || Number(body.fixedPriceIDR) <= 0 || Number(body.fixedPriceIDR) >= 2_147_483_647) throw new Error();
        fixedPriceIDR = Number(body.fixedPriceIDR);
        if (body.enabled) {
          const supplier = await getSupplierProduct({ productCode: variant.supplierSku, countryCode: variant.countryCode });
          if (supplier.code !== variant.supplierSku || (supplier.country_code && supplier.country_code.toLowerCase() !== variant.countryCode) || supplier.status.trim().toLowerCase() !== "available") {
            throw new ResellerPricingError("Supplier cost could not be verified for this package.", 503, "COST_UNAVAILABLE");
          }
          calculateResellerPrice(supplier.price, { mode, markupMicros: null, fixedPriceIDR, enabled: true });
        }
      }
    } catch (error) {
      if (error instanceof ResellerPricingError) throw error;
      return resellerJson({ error: "Invalid markup/price, or fixed price is below current supplier cost." }, 400);
    }
    const changes = { mode, markupMicros, fixedPriceIDR, enabled: body.enabled, provenance: { source: "ADMIN_MANUAL", actor: admin.dbUserId } };
    await prisma.$transaction(async (tx) => {
      await tx.resellerOrganization.findUniqueOrThrow({ where: { id } });
      const where = { organizationId_variantId: { organizationId: id, variantId } };
      const existing = await tx.resellerOrganizationSkuPrice.findUnique({ where });
      if ((existing?.revision ?? null) !== body.expectedRevision) {
        throw new ResellerPricingError("This price was changed by another admin. Refresh and try again.", 409, "STALE_REVISION");
      }
      if (existing) {
        await tx.resellerOrganizationSkuPrice.update({ where, data: { ...changes, revision: { increment: 1 } } });
      } else {
        await tx.resellerOrganizationSkuPrice.create({ data: { ...changes, organizationId: id, variantId } });
      }
      await tx.appLog.create({ data: {
        category: "ADMIN", level: "INFO", title: "Reseller price override saved",
        actor: admin.email || admin.dbUserId, route: `/api/admin/resellers/${id}/pricing`,
        metadata: { organizationId: id, variantId, before: existing ? { mode: existing.mode, markupMicros: existing.markupMicros, fixedPriceIDR: existing.fixedPriceIDR, enabled: existing.enabled, revision: existing.revision } : null, after: changes },
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return resellerJson({ ok: true });
  } catch (error) { return resellerApiError(error); }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const admin = await requirePlatformAdminForResellers();
    requireSameOrigin(request);
    const { id } = await context.params;
    await getOrganization(id);
    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return resellerJson({ error: "Invalid payload" }, 400);
    const body = raw as Record<string, unknown>;
    if (typeof body.variantId !== "string" || !Number.isInteger(body.expectedRevision) || Number(body.expectedRevision) < 1) {
      return resellerJson({ error: "Invalid package or revision" }, 400);
    }
    const deleted = await prisma.resellerOrganizationSkuPrice.deleteMany({
      where: { organizationId: id, variantId: body.variantId, revision: Number(body.expectedRevision) },
    });
    if (!deleted.count) return resellerJson({ error: "Override changed or was already reset. Refresh first." }, 409);
    await writeAppLog({ category: "ADMIN", level: "INFO", title: "Reseller price reset to tier default", actor: admin.email || admin.dbUserId,
      route: `/api/admin/resellers/${id}/pricing`, metadata: { organizationId: id, variantId: body.variantId } });
    return resellerJson({ ok: true });
  } catch (error) { return resellerApiError(error); }
}
