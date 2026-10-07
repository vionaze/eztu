import type { ProductVariant } from "../types/product.ts";

export function isPackageVariantAvailable(variant: ProductVariant) {
  return variant.supplierStatus == null || variant.supplierStatus.trim().toLowerCase() === "available";
}

export function groupProductPackages(
  variants: readonly ProductVariant[],
  displayPrices: Readonly<Record<string, { priceIDR: number }>> = {},
) {
  const groups = new Map<string, {
    key: string; family: string; variants: ProductVariant[];
  }>();
  for (const variant of variants) {
    // Region and the full package name (including bonuses) must match.
    const family = JSON.stringify([variant.countryCode || "", variant.name]);
    const key = JSON.stringify([family, variant.priceIDR]);
    const group = groups.get(key);
    if (group) group.variants.push(variant);
    else groups.set(key, { key, family, variants: [variant] });
  }
  const packages = [...groups.values()].map(group => {
    const candidates = [...group.variants].sort((a, b) => a.id.localeCompare(b.id));
    const variant = candidates.find(isPackageVariantAvailable) || candidates[0];
    return { ...group, variants: candidates, variant, available: candidates.some(isPackageVariantAvailable) };
  });
  const cheapest = new Map<string, number>();
  const displayPrice = (variant: ProductVariant) => displayPrices[variant.id]?.priceIDR ?? variant.priceIDR;
  for (const group of packages) {
    if (group.available) cheapest.set(group.family, Math.min(cheapest.get(group.family) ?? Infinity, displayPrice(group.variant)));
  }
  return packages.map(group => ({
    ...group,
    bestValue: group.available && displayPrice(group.variant) === cheapest.get(group.family),
  })).sort((a, b) => a.variant.priceIDR - b.variant.priceIDR || a.key.localeCompare(b.key));
}

/** Only a confirmed stock failure advances to another equivalent SKU. */
export async function quoteProductPackage<Quote>(
  variants: readonly ProductVariant[],
  loadQuote: (variant: ProductVariant) => Promise<Quote | null>,
) {
  for (const variant of variants.filter(isPackageVariantAvailable)) {
    const quote = await loadQuote(variant);
    if (quote !== null) return { variant, quote };
  }
  return null;
}
