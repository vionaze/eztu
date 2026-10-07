import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { calculateSellPriceIDR } from "./eztopup-catalog.ts";
import { reconcileSupplierReplacements } from "./supplier-replacements.ts";
import { fetchCountryCatalog, fetchCategoryCatalog } from "./supplier-catalog.ts";
import { buildSupplierExpansion, PRODUCT_SUPPLIER_CATEGORIES } from "./supplier-expansion.ts";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = resolve(packageRoot, "../..");
for (const envFile of [
  resolve(packageRoot, ".env"),
  resolve(repoRoot, ".env"),
  resolve(repoRoot, "apps/web/.env"),
]) {
  if (existsSync(envFile)) {
    loadEnv({ path: envFile, override: false });
  }
}

const { prisma } = await import("./index.ts");

async function main() {
  const shouldApply = process.argv.includes("--apply");
  if (process.argv.includes("--expand")) {
    await expandCatalog(shouldApply);
    return;
  }
  const variants = await prisma.productVariant.findMany({
    where: {
      published: true,
      replacementForId: null,
      supplierSku: { not: null },
      product: { published: true },
    },
    select: {
      id: true, productId: true, priceIDR: true, priceUSD: true, cryptoMarkupBps: true,
      supplierSku: true,
      countryCode: true,
      nonCryptoMarkupBps: true,
      product: { select: { name: true } },
      name: true,
    },
    orderBy: [{ countryCode: "asc" }, { supplierSku: "asc" }],
  });
  const countries = [...new Set(variants.map((variant) => variant.countryCode))];
  let updated = 0;
  let missing = 0;

  for (const countryCode of countries) {
    const catalog = await fetchCountryCatalog(countryCode);
    const byCode = new Map(catalog.map((product) => [product.code, product]));
    for (const variant of variants.filter((row) => row.countryCode === countryCode)) {
      const supplierProduct = variant.supplierSku
        ? byCode.get(variant.supplierSku)
        : null;
      if (!supplierProduct) {
        if (shouldApply) await prisma.productVariant.update({ where: { id: variant.id }, data: { supplierStatus: "missing", supplierPriceUpdatedAt: new Date() } });
        missing += 1;
        console.log(
          `[MISSING] ${countryCode} ${variant.supplierSku} ${variant.product.name} / ${variant.name}`,
        );
        continue;
      }
      console.log(
        `[${shouldApply ? "UPDATE" : "DRY"}] ${countryCode} ${supplierProduct.code} cost=${supplierProduct.price} status=${supplierProduct.status}`,
      );
      if (shouldApply) {
        await prisma.productVariant.update({
          where: { id: variant.id },
          data: {
            supplierCostIDR: Math.round(supplierProduct.price),
            priceIDR: calculateSellPriceIDR(
              Math.round(supplierProduct.price),
              variant.nonCryptoMarkupBps,
            ),
            supplierStatus: supplierProduct.status.toLowerCase(),
            supplierPriceUpdatedAt: new Date(),
          },
        });
      }
      updated += 1;
    }
    if (shouldApply) await reconcileSupplierReplacements(prisma, variants.filter(row => row.countryCode === countryCode), catalog);
  }

  console.log(
    `Exact supplier sync ${shouldApply ? "applied" : "dry run"}: matched=${updated}, missing=${missing}, countries=${countries.length}`,
  );
}

async function expandCatalog(shouldApply: boolean) {
  const products = await prisma.product.findMany({
    where: { published: true }, include: { variants: true }, orderBy: { slug: "asc" },
  });
  const countries = [...new Set(products.flatMap(p => p.variants.filter(v => !v.replacementForId).map(v => v.countryCode)))].sort();
  if (!products.length || !countries.length) throw new Error("Existing catalog is empty");
  const categoryCodes = [...new Set(products.flatMap(p => {
    const codes = PRODUCT_SUPPLIER_CATEGORIES[p.slug];
    if (!codes) throw new Error(`No supplier mapping for ${p.slug}`);
    return codes;
  }))];
  const catalogs = [];
  // A failed country aborts before writes, rather than publishing a partial import.
  for (const countryCode of countries) {
    const rows = process.argv.includes("--full-import")
      ? (await fetchCountryCatalog(countryCode)).filter(row => categoryCodes.includes(row.category_code || ""))
      : await fetchCategoryCatalog(countryCode, categoryCodes);
    catalogs.push({ countryCode, rows });
    console.log(`Fetched ${countryCode}: ${rows.length} exact SKU rows`);
  }
  const { changes, summary } = buildSupplierExpansion(products, catalogs, Number(process.env.PRODUCT_USD_IDR_RATE || "15500"));
  console.table(summary.map(s => ({ product: s.slug, total: s.total, available: s.available, unavailable: s.total - s.available, added: s.added })));
  const report = {
    capturedAt: new Date().toISOString(), applied: shouldApply, fullImport: process.argv.includes("--full-import"), countries,
    total: changes.length, available: summary.reduce((sum, s) => sum + s.available, 0),
    added: summary.reduce((sum, s) => sum + s.added, 0), products: summary,
    markupPairs: [...new Set(changes.map(c => `${c.productId}:${c.countryCode}:${c.nonCryptoMarkupBps}/${c.cryptoMarkupBps}`))],
  };
  const reportDir = resolve(repoRoot, "apps/web/.data/catalog-backups");
  mkdirSync(reportDir, { recursive: true, mode: 0o700 });
  const stamp = report.capturedAt.replace(/[:.]/g, "-");
  if (shouldApply) {
    if (report.added > 0) {
      const backupPath = resolve(reportDir, `before-expansion-${stamp}.json`);
      writeFileSync(backupPath, JSON.stringify(products, null, 2), { mode: 0o600 });
      console.log(`Catalog backup: ${backupPath}`);
    }
    await prisma.$transaction(async tx => {
      for (const product of products) {
        const currentIds = changes.filter(c => c.productId === product.id).map(c => c.id);
        // Category responses are subsets; only a full import can prove absence.
        if (process.argv.includes("--full-import")) {
          await tx.productVariant.updateMany({
            where: { productId: product.id, replacementForId: null, supplierSku: { not: null }, id: { notIn: currentIds } },
            data: { supplierStatus: "missing", supplierPriceUpdatedAt: new Date() },
          });
        }
        // Full exact-SKU catalog now represents alternatives canonically.
        await tx.productVariant.updateMany({ where: { productId: product.id, replacementForId: { not: null } }, data: { published: false } });
      }
      for (const { id, ...data } of changes) {
        await tx.productVariant.upsert({ where: { id }, update: { ...data, supplierPriceUpdatedAt: new Date() }, create: { id, ...data, supplierPriceUpdatedAt: new Date() } });
      }
    }, { timeout: 120_000 });
  }
  const reportPath = resolve(reportDir, `expansion-${shouldApply ? "applied" : "dry-run"}-${stamp}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(`Supplier expansion ${shouldApply ? "applied" : "dry run"}: total=${report.total}, available=${report.available}, added=${report.added}`);
  console.log(`Report: ${reportPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
