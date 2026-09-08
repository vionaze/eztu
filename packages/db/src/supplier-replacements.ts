import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { SupplierCatalogProduct } from "./supplier-catalog.ts";

// Only plain diamond packages are interchangeable. Passes and promotional
// packages must not be silently substituted for regular diamonds.
function diamonds(name: string) {
  const match = name.trim().match(/^(\d[\d,]*)\s+Diamonds?(?:\s*\(\s*\d[\d,]*\s*\+\s*\d[\d,]*\s+Bonus\s*\))?$/i);
  return match ? Number(match[1].replaceAll(",", "")) : null;
}

export function selectDiamondReplacement(original: SupplierCatalogProduct, catalog: SupplierCatalogProduct[]) {
  const target = diamonds(original.name);
  if (!target || !original.category_code) return null;
  const candidates = catalog.flatMap(row => {
    const amount = diamonds(row.name);
    return row.code !== original.code && row.category_code === original.category_code &&
      row.status.trim().toLowerCase() === "available" && Number.isFinite(row.price) && row.price > 0 && amount
      ? [{ row, amount }] : [];
  });
  const same = candidates.filter(c => c.amount === target);
  const lower = Math.max(0, ...candidates.filter(c => c.amount < target).map(c => c.amount));
  const higher = Math.min(Infinity, ...candidates.filter(c => c.amount > target).map(c => c.amount));
  const nearest = same.length ? same : candidates.filter(c => c.amount === lower || c.amount === higher);
  nearest.sort((a, b) => a.row.price - b.row.price || Math.abs(a.amount - target) - Math.abs(b.amount - target) || a.row.code.localeCompare(b.row.code));
  return nearest[0]?.row || null;
}

type OriginalVariant = {
  id: string; name: string; productId: string; countryCode: string;
  supplierSku: string | null; nonCryptoMarkupBps: number; cryptoMarkupBps: number;
  priceIDR: number; priceUSD: number;
};

export async function reconcileSupplierReplacements(db: Pick<PrismaClient, "productVariant">, originals: OriginalVariant[], catalog: SupplierCatalogProduct[]) {
  const byCode = new Map(catalog.map(row => [row.code, row]));
  for (const original of originals) {
    const current = byCode.get(original.supplierSku || "");
    const replacement = current && current.status.trim().toLowerCase() !== "available"
      ? selectDiamondReplacement(current, catalog) : null;
    // Keep old rows for order history, but expose only the current alternative.
    const id = replacement ? `replacement-${createHash("sha256").update(`${original.id}:${replacement.code}`).digest("hex").slice(0, 32)}` : null;
    await db.productVariant.updateMany({ where: { replacementForId: original.id, ...(id ? { id: { not: id } } : {}) }, data: { published: false } });
    if (!replacement || !id) continue;
    const cost = Math.round(replacement.price);
    const priceIDR = Math.ceil(cost * (10000 + original.nonCryptoMarkupBps) / 10000);
    const data = {
      name: replacement.name, productId: original.productId, countryCode: original.countryCode,
      replacementForId: original.id, supplierSku: replacement.code,
      supplierStatus: replacement.status.trim().toLowerCase(), supplierCostIDR: cost,
      supplierPriceUpdatedAt: new Date(), published: true, priceIDR,
      priceUSD: original.priceIDR > 0 ? priceIDR * original.priceUSD / original.priceIDR : 0,
      nonCryptoMarkupBps: original.nonCryptoMarkupBps, cryptoMarkupBps: original.cryptoMarkupBps,
    };
    await db.productVariant.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
}
