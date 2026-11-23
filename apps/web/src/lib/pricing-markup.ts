import "server-only";

import {
  calculateSellPriceIDR,
  prisma,
  PRICING_MARKUP_KEYS,
  readPricingMarkup,
  resolveProductMarkupBps,
  type PricingMarkupSettings,
} from "@kupon/db";
import { setSetting } from "@/lib/settings";
import { getUsdIdrRate } from "@/lib/fx";
import { idrToUsdCentsCeil, usdCentsToAmount } from "@/lib/money";
import { parseMarkupPercent } from "@/lib/pricing-markup-parse";

export { parseMarkupPercent } from "@/lib/pricing-markup-parse";

const CACHE_TTL_MS = 10_000;
type Cache = { value: PricingMarkupSettings; expiresAt: number };
let cache: Cache | null = null;

export class PricingMarkupError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = "PricingMarkupError";
  }
}

/** Cached read so quotes do not hit the Setting table on every request. */
export async function getPricingMarkupSettings(force = false) {
  if (!force && cache && cache.expiresAt > Date.now()) return cache.value;
  const value = await readPricingMarkup(prisma);
  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export function invalidatePricingMarkupCache() {
  cache = null;
}

export async function getProductMarkupBps(productSlug: string) {
  const settings = await getPricingMarkupSettings();
  return resolveProductMarkupBps(settings, productSlug);
}

export type PricingMarkupInput = {
  globalPercent: string;
  /** Product slug → percent string. An empty string removes the override. */
  overrides: Record<string, string>;
};

/**
 * Recompute the stored display price for every available SKU so listings
 * (product cards, vouchers) immediately reflect the new markup. This replaces
 * any manual per-variant price edit — the admin UI says so explicitly.
 */
export async function recalculateRetailDisplayPrices(
  settings: PricingMarkupSettings,
) {
  const variants = await prisma.productVariant.findMany({
    where: {
      supplierCostIDR: { not: null },
      supplierStatus: { equals: "available", mode: "insensitive" },
    },
    select: {
      id: true,
      supplierCostIDR: true,
      nonCryptoMarkupBps: true,
      product: { select: { slug: true } },
    },
  });

  const rate = await getUsdIdrRate().catch(() => null);
  const updates = variants.map((variant) => {
    const feeBps = resolveProductMarkupBps(settings, variant.product.slug);
    const priceIDR = calculateSellPriceIDR(
      variant.supplierCostIDR!,
      variant.nonCryptoMarkupBps,
      feeBps,
    );
    return prisma.productVariant.update({
      where: { id: variant.id },
      data: {
        priceIDR,
        ...(rate
          ? {
              priceUSD: usdCentsToAmount(
                idrToUsdCentsCeil(priceIDR, rate.usdIdrRate),
              ),
            }
          : {}),
      },
    });
  });

  let updated = 0;
  for (let index = 0; index < updates.length; index += 100) {
    const chunk = updates.slice(index, index + 100);
    await prisma.$transaction(chunk);
    updated += chunk.length;
  }
  return updated;
}

export async function savePricingMarkupSettings(input: PricingMarkupInput) {
  const global = parseMarkupPercent(input.globalPercent);
  if (!global.ok) throw new PricingMarkupError(global.error, "globalPercent");

  const overrides: Record<string, number> = {};
  for (const [slug, raw] of Object.entries(input.overrides)) {
    if (!raw.trim()) continue;
    const parsed = parseMarkupPercent(raw);
    if (!parsed.ok) throw new PricingMarkupError(parsed.error, `product:${slug}`);
    overrides[slug] = parsed.bps;
  }

  await Promise.all([
    setSetting(PRICING_MARKUP_KEYS.GLOBAL_BPS, String(global.bps)),
    setSetting(PRICING_MARKUP_KEYS.PRODUCT_OVERRIDES, JSON.stringify(overrides)),
  ]);
  invalidatePricingMarkupCache();

  const settings: PricingMarkupSettings = { globalBps: global.bps, overrides };
  const updated = await recalculateRetailDisplayPrices(settings);
  return { settings, updated };
}
