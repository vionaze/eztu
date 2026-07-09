import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = resolve(packageRoot, "../..");
const envFiles = [
  resolve(packageRoot, ".env"),
  resolve(repoRoot, ".env"),
  resolve(repoRoot, "apps/web/.env"),
];

for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    loadEnv({ path: envFile });
    break;
  }
}

const { prisma } = await import("./index.ts");

type SupplierCatalogProduct = {
  code: string;
  category_code: string;
  name: string;
  price: number;
  country_code: string;
  status: string;
};

type MatchResult = {
  product: SupplierCatalogProduct;
  reason: string;
  score: number;
};

const CATEGORY_ALIASES: Record<string, string[]> = {
  "google-play": ["VGP"],
  "playstation-store": ["VPSN"],
  "pc-game-pass": ["VXBOX"],
  roblox: ["ROB"],
  "riot-games": ["VVAL"],
};

function cleanBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function getApiUrl() {
  const apiUrl = process.env.SUPPLIER_API_URL || "";

  if (!apiUrl.trim()) {
    throw new Error("SUPPLIER_API_URL is required.");
  }

  return cleanBaseUrl(apiUrl);
}

function getSecretKey() {
  const secret =
    process.env.SUPPLIER_SECRET_KEY ||
    process.env.SUPPLIER_API_KEY ||
    "";

  if (!secret.trim()) {
    throw new Error("SUPPLIER_SECRET_KEY is required.");
  }

  return secret.trim();
}

function getCountryCode() {
  return (
    process.env.SUPPLIER_COUNTRY_CODE ||
    "id"
  )
    .trim()
    .toLowerCase();
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bidr\b/g, "")
    .replace(/\busd\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function isProductCode(value: string | null | undefined) {
  const code = value?.trim();
  if (!code) return false;
  if (/\s/.test(code)) return false;
  return /^[a-z0-9][a-z0-9._-]*$/i.test(code);
}

async function fetchSupplierProducts(): Promise<SupplierCatalogProduct[]> {
  const countryCode = getCountryCode();
  const url = new URL("/api/all-products", getApiUrl());
  if (countryCode) url.searchParams.set("country_code", countryCode);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${getSecretKey()}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supplier all-products failed: ${response.status}`);
  }

  const body = (await response.json()) as {
    code?: string;
    data?: { products?: SupplierCatalogProduct[] };
  };

  if (body.code !== "SUCCESS" || !Array.isArray(body.data?.products)) {
    throw new Error(`Supplier all-products returned ${body.code || "invalid response"}`);
  }

  return body.data.products;
}

function scoreProduct(params: {
  productSlug: string;
  variantName: string;
  supplierSku: string | null;
  supplierProduct: SupplierCatalogProduct;
}): MatchResult | null {
  const variantName = normalize(params.variantName);
  const supplierName = normalize(params.supplierProduct.name);
  const categoryAliases = CATEGORY_ALIASES[params.productSlug] || [];
  const sameCategory = categoryAliases.includes(params.supplierProduct.category_code);

  if (params.supplierSku && params.supplierSku === params.supplierProduct.code) {
    return { product: params.supplierProduct, reason: "existing-code", score: 100 };
  }

  if (variantName === supplierName) {
    return {
      product: params.supplierProduct,
      reason: sameCategory ? "exact-name-category" : "exact-name",
      score: sameCategory ? 95 : 85,
    };
  }

  const variantDigits = digits(params.variantName);
  const supplierDigits = digits(params.supplierProduct.name);

  if (sameCategory && variantDigits && variantDigits === supplierDigits) {
    return {
      product: params.supplierProduct,
      reason: "category-denomination",
      score: params.supplierProduct.status === "available" ? 90 : 82,
    };
  }

  if (
    sameCategory &&
    variantName.split(" ").every((part) => supplierName.includes(part))
  ) {
    return {
      product: params.supplierProduct,
      reason: "category-name-contains",
      score: params.supplierProduct.status === "available" ? 78 : 70,
    };
  }

  return null;
}

async function main() {
  const shouldApply = process.argv.includes("--apply");
  const products = await fetchSupplierProducts();
  const variants = await prisma.productVariant.findMany({
    where: {
      product: {
        published: true,
      },
    },
    include: {
      product: true,
    },
    orderBy: [
      { product: { name: "asc" } },
      { priceIDR: "asc" },
    ],
  });
  let updated = 0;
  let unchanged = 0;
  let unmatched = 0;
  let ambiguous = 0;

  for (const variant of variants) {
    const matches = products
      .map((product) =>
        scoreProduct({
          productSlug: variant.product.slug,
          variantName: variant.name,
          supplierSku: variant.supplierSku,
          supplierProduct: product,
        })
      )
      .filter((match): match is MatchResult => Boolean(match))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.product.status !== b.product.status) {
          return a.product.status === "available" ? -1 : 1;
        }
        return a.product.price - b.product.price;
      });

    const top = matches[0];
    const runnerUp = matches[1];
    const label = `${variant.product.name} / ${variant.name}`;

    if (!top) {
      unmatched += 1;
      console.log(`[UNMATCHED] ${label} current="${variant.supplierSku || "-"}"`);
      continue;
    }

    if (
      runnerUp &&
      top.score < 95 &&
      runnerUp.score >= top.score - 5 &&
      runnerUp.product.code !== top.product.code
    ) {
      ambiguous += 1;
      console.log(`[AMBIGUOUS] ${label}`);
      for (const candidate of matches.slice(0, 5)) {
        console.log(
          `  - ${candidate.product.code} | ${candidate.product.name} | ${candidate.product.price} | ${candidate.product.status} | ${candidate.reason}`
        );
      }
      continue;
    }

    const alreadySynced =
      variant.supplierSku === top.product.code &&
      variant.supplierCostIDR === top.product.price;

    if (alreadySynced) {
      unchanged += 1;
      continue;
    }

    console.log(
      `[${shouldApply ? "UPDATE" : "DRY"}] ${label}: ${variant.supplierSku || "-"} -> ${top.product.code} (${top.product.name}, ${top.product.price}, ${top.product.status}, ${top.reason})`
    );

    if (shouldApply) {
      await prisma.productVariant.update({
        where: { id: variant.id },
        data: {
          supplierSku: top.product.code,
          supplierCostIDR: top.product.price,
        },
      });
      updated += 1;
    }
  }

  console.log(
    `Supplier SKU sync ${shouldApply ? "applied" : "dry run"}: updated=${updated}, unchanged=${unchanged}, ambiguous=${ambiguous}, unmatched=${unmatched}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
