/**
 * Add tier-level reseller pricing for a product that is not covered by the
 * supplier reseller workbooks yet.
 *
 *   node --experimental-strip-types src/seed-product-reseller-pricing.ts \
 *     --product phantom-blade-zero --markup 2.6 --apply
 *
 * Dry run by default. Existing tier rules are left untouched; use the admin
 * pricing editor for per-organization overrides.
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { formatResellerMarkupPercent, parseResellerMarkupPercent } from "./reseller-pricing.ts";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = resolve(packageRoot, "../..");
for (const envFile of [
  resolve(packageRoot, ".env"),
  resolve(repoRoot, ".env"),
  resolve(repoRoot, "apps/web/.env"),
]) {
  if (existsSync(envFile)) loadEnv({ path: envFile, override: false });
}

const { prisma, Prisma } = await import("./index.ts");

const TIERS = ["TIER_1", "TIER_2"] as const;

function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const slug = arg("--product")?.trim();
  const markupInput = arg("--markup")?.trim();
  const apply = process.argv.includes("--apply");

  if (!slug || !markupInput) {
    throw new Error("Usage: --product <slug> --markup <percent> [--apply]");
  }
  const markupMicros = parseResellerMarkupPercent(markupInput);

  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      variants: {
        where: { published: true, replacementForId: null, supplierSku: { not: null } },
        select: { id: true, name: true, countryCode: true, supplierSku: true, supplierCostIDR: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!product) throw new Error(`Product not found: ${slug}`);
  if (!product.published) throw new Error(`Product is not published: ${slug}`);
  if (!product.variants.length) throw new Error(`Product has no published supplier variants: ${slug}`);

  const existing = await prisma.resellerTierSkuPrice.findMany({
    where: { variantId: { in: product.variants.map((variant) => variant.id) } },
    select: { tier: true, variantId: true, mode: true, markupMicros: true, enabled: true },
  });
  const existingKeys = new Set(existing.map((rule) => `${rule.tier}:${rule.variantId}`));

  console.log(
    `Product ${product.name} (${product.slug}): ${product.variants.length} variants, ` +
      `markup ${formatResellerMarkupPercent(markupMicros)}%, tiers ${TIERS.join(", ")}`,
  );
  console.table(product.variants.map((variant) => ({
    sku: variant.supplierSku,
    country: variant.countryCode,
    name: variant.name,
    costIDR: variant.supplierCostIDR,
    previewPriceIDR: variant.supplierCostIDR
      ? Math.ceil((variant.supplierCostIDR * (10_000_000 + markupMicros)) / 10_000_000)
      : null,
  })));

  const missing = product.variants.flatMap((variant) =>
    TIERS.filter((tier) => !existingKeys.has(`${tier}:${variant.id}`)).map((tier) => ({ tier, variant })),
  );
  console.log(`Rules to create: ${missing.length}; existing rules kept: ${existing.length}`);

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to write tier pricing.");
    return;
  }
  if (!missing.length) {
    console.log("Nothing to write.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const { tier, variant } of missing) {
      await tx.resellerTierSkuPrice.create({
        data: {
          tier,
          variantId: variant.id,
          mode: "MARKUP",
          markupMicros,
          fixedPriceIDR: null,
          enabled: true,
          provenance: {
            source: "MANUAL_GAME_LAUNCH",
            productSlug: product.slug,
            supplierSku: variant.supplierSku,
            countryCode: variant.countryCode,
            markupPercent: formatResellerMarkupPercent(markupMicros),
            note: "Launch pricing outside the supplier reseller workbooks; B2B margin from product workbook.",
          },
        },
      });
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  console.log(`Created ${missing.length} tier pricing rules for ${product.slug}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
