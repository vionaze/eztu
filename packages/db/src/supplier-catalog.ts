import type { CatalogItem } from "./eztopup-catalog.ts";

export type SupplierCatalogProduct = {
  code: string;
  name: string;
  price: number;
  status: string;
  category_code?: string;
};

export type PricedCatalogItem = CatalogItem & { supplierCostIDR: number };
export type FetchCountryCatalog = (
  countryCode: string,
) => Promise<SupplierCatalogProduct[]>;

function supplierApiUrl() {
  const value = process.env.SUPPLIER_API_URL?.trim().replace(/\/+$/, "");
  if (!value) throw new Error("SUPPLIER_API_URL is required.");
  return value;
}

function supplierApiKey() {
  const value =
    process.env.SUPPLIER_SECRET_KEY?.trim() ||
    process.env.SUPPLIER_API_KEY?.trim();
  if (!value) throw new Error("SUPPLIER_SECRET_KEY is required.");
  return value;
}

function readSupplierPrice(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

export async function fetchCountryCatalog(countryCode: string) {
  const url = new URL("/api/all-products", supplierApiUrl());
  url.searchParams.set("country_code", countryCode);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${supplierApiKey()}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Supplier ${countryCode} returned HTTP ${response.status}`);
  }

  const body = (await response.json()) as {
    code?: string;
    data?: { products?: unknown[] };
  };
  if (body.code !== "SUCCESS" || !Array.isArray(body.data?.products)) {
    throw new Error(
      `Supplier ${countryCode} returned ${body.code || "invalid response"}`,
    );
  }

  return body.data.products.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const product = value as Record<string, unknown>;
    const code = String(product.code ?? "").trim();
    const name = String(product.name ?? "").trim();
    const status = String(product.status ?? "").trim().toLowerCase();
    const price = readSupplierPrice(product.price);
    if (!code || !name || !status || price === null) return [];
    return [{
      code,
      name,
      price,
      status,
      category_code:
        typeof product.category_code === "string"
          ? product.category_code.trim()
          : undefined,
    }];
  });
}

export async function hydrateMissingSupplierCosts(
  items: CatalogItem[],
  fetchCatalog: FetchCountryCatalog = fetchCountryCatalog,
): Promise<PricedCatalogItem[]> {
  const countries = [
    ...new Set(
      items
        .filter((item) => item.supplierCostIDR === null)
        .map((item) => item.countryCode),
    ),
  ];
  const catalogs = await Promise.all(
    countries.map(async (countryCode) => [
      countryCode,
      await fetchCatalog(countryCode),
    ] as const),
  );
  const productsByCountry = new Map(
    catalogs.map(([countryCode, products]) => [
      countryCode,
      new Map(products.map((product) => [product.code, product])),
    ]),
  );

  const missing = items.filter(
    (item) =>
      item.supplierCostIDR === null &&
      !productsByCountry.get(item.countryCode)?.has(item.supplierSku),
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing supplier SKU ${missing
        .slice(0, 20)
        .map((item) => `${item.countryCode}:${item.supplierSku}`)
        .join(", ")}${missing.length > 20 ? ` (+${missing.length - 20} more)` : ""}`,
    );
  }

  return items.map((item) => {
    if (item.supplierCostIDR !== null) {
      return item as PricedCatalogItem;
    }
    const supplierProduct = productsByCountry
      .get(item.countryCode)
      ?.get(item.supplierSku);
    if (!supplierProduct) throw new Error("Supplier catalog hydration failed.");
    return {
      ...item,
      supplierCostIDR: supplierProduct.price,
      supplierStatus: supplierProduct.status.trim().toLowerCase(),
    };
  });
}
