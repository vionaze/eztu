/**
 * Terapkan update harga GTA VI dari katalog supplier terbaru
 * ("GTA BARU-UPDATE.xlsx", sheet `GTA BARU`, baris kategori GTAVI).
 *
 * Dua jenis harga yang diatur:
 * - RETAIL (B2C): markup `nonCryptoMarkupBps` 400 (4%) dan `cryptoMarkupBps` 475 (4,75%),
 *   sesuai catatan di sheet ("B2C PRICE = reseller price +4%" / "+4,75%").
 * - RESELLER (B2B): rule tier TIER_1/TIER_2 mode MARKUP 1,5% (150000 micros),
 *   sesuai catatan "B2B PRICE = reseller price +1,5%".
 *
 * Harga retail di aplikasi dihitung dari harga supplier LIVE saat checkout
 * (`getFreshVariantPricing`), sedangkan harga reseller memakai `supplierCostIDR`
 * yang tersimpan. Skrip ini memperbarui keduanya, dan sengaja tidak menyentuh
 * produk lain.
 *
 *   node --experimental-strip-types src/apply-gta-vi-price-update.ts           # dry run
 *   node --experimental-strip-types src/apply-gta-vi-price-update.ts --apply
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

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

const PRODUCT_SLUG = "gta-vi";
const NON_CRYPTO_MARKUP_BPS = 400; // 4%
const CRYPTO_MARKUP_BPS = 475; // 4,75%
const RESELLER_MARKUP_MICROS = 150_000; // 1,5%
const TIERS = ["TIER_1", "TIER_2"] as const;

/** Baris kategori GTAVI di workbook; `cost` = kolom "Reseller Price". */
const FILE_ROWS = [
  { sku: "GTAVISEB2B-S22", country: "id", cost: 1_135_850, status: "available" },
  { sku: "GTAVISE-S22", country: "id", cost: 1_151_480, status: "empty" },
  { sku: "GTAVISE-S22PO-my", country: "my", cost: 1_165_710, status: "available" },
  { sku: "GTAVISE-S22-my", country: "my", cost: 1_151_480, status: "empty" },
  { sku: "GTAVISE-S22PO-th", country: "th", cost: 1_165_710, status: "available" },
  { sku: "GTAVISE-S22-th", country: "th", cost: 1_151_480, status: "empty" },
  { sku: "GTAVISE-S22PO-sg", country: "sg", cost: 1_165_710, status: "available" },
  { sku: "GTAVISE-S22-sg", country: "sg", cost: 1_151_480, status: "empty" },
] as const;

const apply = process.argv.includes("--apply");

function sell(cost: number, bps: number) {
  return Math.ceil((cost * (10_000 + bps)) / 10_000);
}

function rupiah(value: number | null | undefined) {
  return value === null || value === undefined
    ? "—"
    : `Rp${value.toLocaleString("id-ID")}`;
}

const product = await prisma.product.findFirst({
  where: { slug: PRODUCT_SLUG },
  select: {
    id: true,
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
        resellerTierPrices: { select: { tier: true, mode: true, markupMicros: true } },
      },
      orderBy: [{ supplierSku: "asc" }, { countryCode: "asc" }],
    },
  },
});

if (!product) {
  console.error(`Produk ${PRODUCT_SLUG} tidak ditemukan.`);
  process.exit(1);
}

const rowsFromFile = new Map<string, (typeof FILE_ROWS)[number]>(
  FILE_ROWS.map((row) => [row.sku, row]),
);
const missingTierRules: { variantId: string; tier: (typeof TIERS)[number] }[] = [];

console.log(
  `${product.name} (${PRODUCT_SLUG}): ${product.variants.length} varian` +
    ` — markup retail ${NON_CRYPTO_MARKUP_BPS / 100}% / crypto ${CRYPTO_MARKUP_BPS / 100}%,` +
    ` reseller ${RESELLER_MARKUP_MICROS / 10_000}%\n`,
);

const plan = product.variants.map((variant) => {
  const fileRow = variant.supplierSku ? rowsFromFile.get(variant.supplierSku) : undefined;
  const nextCost = fileRow ? fileRow.cost : variant.supplierCostIDR;
  const nextStatus = fileRow ? fileRow.status : variant.supplierStatus;
  for (const tier of TIERS) {
    if (!variant.resellerTierPrices.some((rule) => rule.tier === tier)) {
      missingTierRules.push({ variantId: variant.id, tier });
    }
  }
  return { variant, fileRow, nextCost, nextStatus };
});

for (const { variant, fileRow, nextCost, nextStatus } of plan) {
  const costChanged = nextCost !== variant.supplierCostIDR;
  const markupChanged =
    variant.nonCryptoMarkupBps !== NON_CRYPTO_MARKUP_BPS ||
    variant.cryptoMarkupBps !== CRYPTO_MARKUP_BPS;
  const statusChanged = nextStatus !== variant.supplierStatus;
  const flags = [
    fileRow ? "" : "di luar file",
    costChanged ? "cost" : "",
    markupChanged ? "markup" : "",
    statusChanged ? "status" : "",
  ]
    .filter(Boolean)
    .join(", ");
  console.log(
    `${variant.supplierSku} [${variant.countryCode}] ${flags ? `(${flags})` : ""}\n` +
      `  cost   ${rupiah(variant.supplierCostIDR)} → ${rupiah(nextCost)}\n` +
      `  markup ${variant.nonCryptoMarkupBps}/${variant.cryptoMarkupBps} bps → ${NON_CRYPTO_MARKUP_BPS}/${CRYPTO_MARKUP_BPS} bps\n` +
      `  status ${variant.supplierStatus ?? "—"} → ${nextStatus ?? "—"}\n` +
      `  harga retail ${rupiah(nextCost === null ? null : sell(nextCost, NON_CRYPTO_MARKUP_BPS))}` +
      ` / crypto ${rupiah(nextCost === null ? null : sell(nextCost, CRYPTO_MARKUP_BPS))}` +
      ` · reseller ${rupiah(nextCost === null ? null : sell(nextCost, RESELLER_MARKUP_MICROS / 1000))}`,
  );
}

console.log(
  `\nRule reseller yang perlu dibuat: ${missingTierRules.length}` +
    (missingTierRules.length
      ? ` (${missingTierRules.map((item) => `${item.tier}`).join(", ")})`
      : " — semua varian sudah punya TIER_1 & TIER_2"),
);

if (!apply) {
  console.log("\nDry run only. Jalankan ulang dengan --apply untuk menulis.");
  await prisma.$disconnect();
  process.exit(0);
}

await prisma.$transaction(async (tx) => {
  for (const { variant, nextCost, nextStatus } of plan) {
    await tx.productVariant.update({
      where: { id: variant.id },
      data: {
        ...(nextCost === null ? {} : { supplierCostIDR: nextCost }),
        ...(nextStatus === null ? {} : { supplierStatus: nextStatus }),
        nonCryptoMarkupBps: NON_CRYPTO_MARKUP_BPS,
        cryptoMarkupBps: CRYPTO_MARKUP_BPS,
      },
    });
  }
  for (const item of missingTierRules) {
    await tx.resellerTierSkuPrice.create({
      data: {
        tier: item.tier,
        variantId: item.variantId,
        mode: "MARKUP",
        markupMicros: RESELLER_MARKUP_MICROS,
        enabled: true,
        provenance: { source: "apply-gta-vi-price-update", file: "GTA BARU-UPDATE.xlsx" },
      },
    });
  }
});

console.log(
  `\n✓ Diterapkan: ${plan.length} varian diperbarui, ${missingTierRules.length} rule reseller dibuat.`,
);
await prisma.$disconnect();
