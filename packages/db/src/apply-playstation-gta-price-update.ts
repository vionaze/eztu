/**
 * Terapkan harga PlayStation Store + GTA VI dari
 * `data/playstation-gta-2026-11-24.json` (diambil dari
 * "PLAYSTATION + GTA B2B B2C.xlsx").
 *
 * Aturan file:
 * - B2B: semua PlayStation/PSN card = reseller price +1,5%; khusus GTA VI +2%.
 * - B2C: hanya GTA VI yang diatur ulang — Standard Edition +4,15%,
 *   Ultimate Edition +3,15%. Varian PlayStation lain mempertahankan markup B2C
 *   yang sudah ada.
 * - Buffer biaya WinPay 0,7% tidak disimpan di markup; buffer itu diterapkan
 *   otomatis oleh `calculateSellPriceIDR` dan `calculateResellerPrice`.
 *
 *   node --experimental-strip-types src/apply-playstation-gta-price-update.ts           # dry run
 *   node --experimental-strip-types src/apply-playstation-gta-price-update.ts --apply
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { calculateSellPriceIDR } from "./eztopup-catalog.ts";
import { calculateResellerPrice } from "./reseller-pricing.ts";
import { readPricingMarkup, resolveProductMarkupBps } from "./pricing-markup.ts";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = resolve(packageRoot, "../..");
for (const envFile of [
  resolve(packageRoot, ".env"),
  resolve(repoRoot, ".env"),
  resolve(repoRoot, "apps/web/.env"),
]) {
  if (existsSync(envFile)) loadEnv({ path: envFile, override: false });
}

const { prisma } = await import("./index.ts");
const markupSettings = await readPricingMarkup(prisma);

const SNAPSHOT_PATH = resolve(
  repoRoot,
  "data/playstation-gta-2026-11-24.json",
);
const PRODUCT_SLUGS = ["playstation-store", "gta-vi"] as const;
const TIERS = ["TIER_1", "TIER_2"] as const;
const isGtaSku = (sku: string) => sku.toUpperCase().includes("GTA");
const apply = process.argv.includes("--apply");

type Snapshot = {
  capturedAt: string;
  source: string;
  resellerMarkupMicros: number;
  gtaResellerMarkupMicros: number;
  retailNonCryptoMarkupBps: Record<string, number>;
  rows: {
    product: string;
    sku: string;
    country: string;
    cost: number | null;
    status: string;
  }[];
};

const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as Snapshot;

function rupiah(value: number | null | undefined) {
  return value === null || value === undefined
    ? "—"
    : `Rp${value.toLocaleString("id-ID")}`;
}

const products = await prisma.product.findMany({
  where: { slug: { in: [...PRODUCT_SLUGS] } },
  select: {
    slug: true,
    name: true,
    variants: {
      select: {
        id: true,
        name: true,
        supplierSku: true,
        countryCode: true,
        supplierCostIDR: true,
        supplierStatus: true,
        nonCryptoMarkupBps: true,
        cryptoMarkupBps: true,
        resellerTierPrices: {
          select: { tier: true, mode: true, markupMicros: true },
        },
      },
      orderBy: [{ supplierSku: "asc" }, { countryCode: "asc" }],
    },
  },
});

const variantsBySku = new Map<string, (typeof products)[number]["variants"][number] & { productSlug: string }>();
for (const product of products) {
  for (const variant of product.variants) {
    if (!variant.supplierSku) continue;
    variantsBySku.set(variant.supplierSku, { ...variant, productSlug: product.slug });
  }
}

const matched: {
  variantId: string;
  sku: string;
  productSlug: string;
  countryCode: string;
  name: string;
  cost: number | null;
  status: string;
  markupMicros: number;
  retailMarkupBps: number | null;
  currentNonCryptoMarkupBps: number;
  changes: string[];
}[] = [];
const missing: string[] = [];

for (const row of snapshot.rows) {
  const variant = variantsBySku.get(row.sku);
  if (!variant) {
    missing.push(`${row.sku} (${row.product})`);
    continue;
  }
  const isGta = isGtaSku(row.sku);
  const markupMicros = isGta
    ? snapshot.gtaResellerMarkupMicros
    : snapshot.resellerMarkupMicros;
  const retailMarkupBps = snapshot.retailNonCryptoMarkupBps[row.sku] ?? null;
  const changes: string[] = [];
  if (row.cost !== null && variant.supplierCostIDR !== row.cost) {
    changes.push(`cost ${rupiah(variant.supplierCostIDR)} → ${rupiah(row.cost)}`);
  }
  if (row.status && variant.supplierStatus !== row.status) {
    changes.push(`status ${variant.supplierStatus ?? "—"} → ${row.status}`);
  }
  if (retailMarkupBps !== null && variant.nonCryptoMarkupBps !== retailMarkupBps) {
    changes.push(
      `B2C ${variant.nonCryptoMarkupBps / 100}% → ${retailMarkupBps / 100}%`,
    );
  }
  for (const tier of TIERS) {
    const rule = variant.resellerTierPrices.find((item) => item.tier === tier);
    if (!rule || rule.mode !== "MARKUP" || rule.markupMicros !== markupMicros) {
      changes.push(
        `B2B ${tier} ${rule ? `${rule.mode}:${rule.markupMicros}` : "belum ada"} → ${markupMicros / 100_000}%`,
      );
    }
  }
  matched.push({
    variantId: variant.id,
    sku: row.sku,
    productSlug: row.product,
    countryCode: variant.countryCode,
    name: variant.name,
    cost: row.cost,
    status: row.status,
    markupMicros,
    retailMarkupBps,
    currentNonCryptoMarkupBps: variant.nonCryptoMarkupBps,
    changes,
  });
}

const rowBySku = new Map(snapshot.rows.map((row) => [row.sku, row]));
const priceRows = matched.filter((row) => {
  const fileRow = rowBySku.get(row.sku);
  return fileRow?.status === "available";
});

console.log(
  `Snapshot ${snapshot.source} (${snapshot.capturedAt}): ${snapshot.rows.length} baris, ` +
    `${matched.length} cocok, ${missing.length} tidak ada di katalog.\n`,
);
console.log(
  `B2B markup ${snapshot.resellerMarkupMicros / 100_000}% (PSN) / ` +
    `${snapshot.gtaResellerMarkupMicros / 100_000}% (GTA VI); ` +
    `B2C GTA ${Object.entries(snapshot.retailNonCryptoMarkupBps)
      .map(([sku, bps]) => `${sku}=${bps / 100}%`)
      .join(", ")}\n`,
);

if (missing.length) {
  console.log(`Tidak ada di katalog (${missing.length}): ${missing.slice(0, 12).join(", ")}${missing.length > 12 ? ", …" : ""}\n`);
}

console.log("Contoh harga GTA VI (sudah termasuk buffer 0,7%):");
for (const row of priceRows.filter((item) => isGtaSku(item.sku))) {
  const cost = row.cost ?? 0;
  const retailBps = row.retailMarkupBps ?? 0;
  console.log(
    `  ${row.sku} [${row.countryCode}] cost ${rupiah(cost)}` +
      ` · B2C ${rupiah(retailBps ? calculateSellPriceIDR(cost, retailBps, resolveProductMarkupBps(markupSettings, row.productSlug)) : cost)}` +
      ` · B2B ${rupiah(calculateResellerPrice(cost, { mode: "MARKUP", markupMicros: row.markupMicros, fixedPriceIDR: null, enabled: true }, resolveProductMarkupBps(markupSettings, row.productSlug)))}`,
  );
}

const changed = matched.filter((row) => row.changes.length > 0);
console.log(
  `\nVarian perlu diubah: ${changed.length} dari ${matched.length}.`,
);
for (const row of changed.slice(0, 15)) {
  console.log(`  ${row.sku} [${row.countryCode}] ${row.changes.join("; ")}`);
}
if (changed.length > 15) console.log(`  … dan ${changed.length - 15} lainnya`);

if (!apply) {
  console.log("\nDry run only. Jalankan ulang dengan --apply untuk menulis.");
  await prisma.$disconnect();
  process.exit(0);
}

await prisma.$transaction(async (tx) => {
  for (const row of matched) {
    const fileRow = rowBySku.get(row.sku);
    const cost = fileRow?.cost ?? null;
    const status = fileRow?.status || undefined;
    const nonCryptoMarkupBps =
      row.retailMarkupBps ?? undefined;
    const priceIDR =
      cost !== null && status === "available"
        ? calculateSellPriceIDR(
            cost,
            nonCryptoMarkupBps ?? row.currentNonCryptoMarkupBps,
            resolveProductMarkupBps(markupSettings, row.productSlug),
          )
        : undefined;
    await tx.productVariant.update({
      where: { id: row.variantId },
      data: {
        ...(cost === null ? {} : { supplierCostIDR: cost }),
        ...(status ? { supplierStatus: status } : {}),
        ...(nonCryptoMarkupBps === null || nonCryptoMarkupBps === undefined
          ? {}
          : { nonCryptoMarkupBps }),
        ...(priceIDR === undefined ? {} : { priceIDR }),
        supplierPriceUpdatedAt: new Date(),
      },
    });
    for (const tier of TIERS) {
      await tx.resellerTierSkuPrice.upsert({
        where: { tier_variantId: { tier, variantId: row.variantId } },
        update: {
          mode: "MARKUP",
          markupMicros: row.markupMicros,
          fixedPriceIDR: null,
          enabled: true,
        },
        create: {
          tier,
          variantId: row.variantId,
          mode: "MARKUP",
          markupMicros: row.markupMicros,
          enabled: true,
          provenance: {
            source: "apply-playstation-gta-price-update",
            file: snapshot.source,
            capturedAt: snapshot.capturedAt,
          },
        },
      });
    }
  }
});

console.log(
  `\n✓ Diterapkan: ${matched.length} varian, ${matched.length * TIERS.length} rule reseller.`,
);
await prisma.$disconnect();
