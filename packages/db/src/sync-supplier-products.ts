import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { calculateSellPriceIDR } from "./eztopup-catalog.ts";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = resolve(packageRoot, "../..");
for (const envFile of [
  resolve(packageRoot, ".env"),
  resolve(repoRoot, ".env"),
  resolve(repoRoot, "apps/web/.env"),
]) {
  if (existsSync(envFile)) {
    loadEnv({ path: envFile });
    break;
  }
}

const { prisma } = await import("./index.ts");

type SupplierProduct = {
  code: string;
  name: string;
  price: number;
  status: string;
};

function apiUrl() {
  const value = process.env.SUPPLIER_API_URL?.trim().replace(/\/+$/, "");
  if (!value) throw new Error("SUPPLIER_API_URL is required.");
  return value;
}

function apiKey() {
  const value =
    process.env.SUPPLIER_SECRET_KEY?.trim() ||
    process.env.SUPPLIER_API_KEY?.trim();
  if (!value) throw new Error("SUPPLIER_SECRET_KEY is required.");
  return value;
}

async function fetchCountryCatalog(countryCode: string) {
  const url = new URL("/api/all-products", apiUrl());
  url.searchParams.set("country_code", countryCode);
  const response = await fetch(url, {
    headers: { Accept: "application/json", Authorization: `Bearer ${apiKey()}` },
  });
  if (!response.ok) throw new Error(`Supplier ${countryCode} returned ${response.status}`);
  const body = (await response.json()) as {
    code?: string;
    data?: { products?: SupplierProduct[] };
  };
  if (body.code !== "SUCCESS" || !Array.isArray(body.data?.products)) {
    throw new Error(`Supplier ${countryCode} returned ${body.code || "invalid response"}`);
  }
  return body.data.products;
}

async function main() {
  const shouldApply = process.argv.includes("--apply");
  const variants = await prisma.productVariant.findMany({
    where: {
      published: true,
      supplierSku: { not: null },
      product: { published: true },
    },
    select: {
      id: true,
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
  }

  console.log(
    `Exact supplier sync ${shouldApply ? "applied" : "dry run"}: matched=${updated}, missing=${missing}, countries=${countries.length}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
