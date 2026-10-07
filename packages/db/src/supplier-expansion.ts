import { createHash } from "node:crypto";
import { calculateSellPriceIDR } from "./eztopup-catalog.ts";
import type { SupplierCatalogProduct } from "./supplier-catalog.ts";

export const PRODUCT_SUPPLIER_CATEGORIES: Record<string, readonly string[]> = {
  "binance-gift-card": ["BNGC"],
  "call-of-duty-mobile": ["CODM"],
  "free-fire": ["FF", "FFGLOBAL"],
  "honor-of-kings": ["HOK"],
  "league-of-legends-pc": ["LOLPC"],
  "mobile-legends": ["ML"],
  "mobile-legends-global": ["MLGLO"],
  "nintendo-eshop": ["NTD"],
  "playstation-store": ["VPSN"],
  "riot-points-gift-card": ["RPGC"],
  "roblox-gift-card": ["ROB"],
  steam: ["VSTEAM"],
  valorant: ["VAL"],
  "xbox-pc-game-pass": ["VXBOX"],
};

type Variant = {
  id: string; countryCode: string; supplierSku: string | null;
  replacementForId: string | null; nonCryptoMarkupBps: number;
  cryptoMarkupBps: number; priceIDR: number; priceUSD: number;
};
export type ExpansionProduct = { id: string; slug: string; variants: Variant[] };
export type CountryCatalog = { countryCode: string; rows: SupplierCatalogProduct[] };

function markupTemplate(variants: Variant[], countryCode: string) {
  const regional = variants.filter(v => v.countryCode === countryCode);
  const candidates = regional.length ? regional : variants;
  if (!candidates.length) throw new Error("Cannot inherit SKU margins without an existing canonical variant");
  const counts = new Map<string, number>();
  for (const v of candidates) {
    const key = `${v.nonCryptoMarkupBps}:${v.cryptoMarkupBps}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...candidates].sort((a, b) =>
    (counts.get(`${b.nonCryptoMarkupBps}:${b.cryptoMarkupBps}`) || 0) -
    (counts.get(`${a.nonCryptoMarkupBps}:${a.cryptoMarkupBps}`) || 0) ||
    a.id.localeCompare(b.id),
  )[0];
}

export function buildSupplierExpansion(products: ExpansionProduct[], catalogs: CountryCatalog[], usdIdrRate = 15500) {
  if (!Number.isFinite(usdIdrRate) || usdIdrRate <= 0) throw new Error("Invalid import FX rate");
  const categories = new Map<string, ExpansionProduct>();
  for (const product of products) {
    const codes = PRODUCT_SUPPLIER_CATEGORIES[product.slug];
    if (!codes) throw new Error(`No supplier category mapping for ${product.slug}`);
    for (const code of codes) {
      if (categories.has(code)) throw new Error(`Ambiguous supplier category ${code}`);
      categories.set(code, product);
    }
  }
  const changes: {
    id: string; productId: string; supplierSku: string; countryCode: string;
    name: string; published: boolean; supplierCostIDR: number; supplierStatus: string;
    nonCryptoMarkupBps: number; cryptoMarkupBps: number; priceIDR: number; priceUSD: number;
  }[] = [];
  const seen = new Map<string, SupplierCatalogProduct>();
  const summary = products.map(p => ({ productId: p.id, slug: p.slug, total: 0, available: 0, added: 0 }));
  for (const { countryCode, rows } of catalogs) {
    for (const row of rows) {
      const product = categories.get(row.category_code || "");
      if (!product) continue;
      if (row.country_code !== countryCode) throw new Error(`Supplier country mismatch for ${countryCode}:${row.code}`);
      if (!row.code || !row.name || !row.status || !Number.isSafeInteger(row.price) || row.price <= 0) throw new Error(`Invalid supplier row ${row.code}`);
      const key = `${countryCode}:${row.code}`;
      const prior = seen.get(key);
      if (prior) {
        if (prior.category_code !== row.category_code || prior.price !== row.price || prior.status !== row.status || prior.name !== row.name) throw new Error(`Conflicting supplier SKU ${key}`);
        continue;
      }
      seen.set(key, row);
      const originals = product.variants.filter(v => !v.replacementForId);
      const existing = originals.filter(v => v.countryCode === countryCode && v.supplierSku === row.code).sort((a, b) => a.id.localeCompare(b.id))[0];
      const template = existing || markupTemplate(originals, countryCode);
      const priceIDR = calculateSellPriceIDR(row.price, template.nonCryptoMarkupBps);
      changes.push({
        id: existing?.id || `supplier-${createHash("sha256").update(`${product.id}:${key}`).digest("hex").slice(0, 32)}`,
        productId: product.id, supplierSku: row.code, countryCode, name: row.name,
        published: true, supplierCostIDR: row.price, supplierStatus: row.status.toLowerCase(),
        nonCryptoMarkupBps: template.nonCryptoMarkupBps, cryptoMarkupBps: template.cryptoMarkupBps,
        priceIDR, priceUSD: template.priceIDR > 0 && template.priceUSD > 0
          ? Number((priceIDR * template.priceUSD / template.priceIDR).toFixed(2))
          : Number((priceIDR / usdIdrRate).toFixed(2)),
      });
      const count = summary.find(s => s.productId === product.id)!;
      count.total++;
      if (row.status.toLowerCase() === "available") count.available++;
      if (!existing) count.added++;
    }
  }
  return { changes, summary };
}
