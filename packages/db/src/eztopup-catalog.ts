export type CatalogFulfillmentType = "TOP_UP" | "VOUCHER";

export type CatalogItem = {
  productKey: string;
  productName: string;
  productImage: string;
  categorySlug: "game-top-up" | "game-vouchers";
  fulfillmentType: CatalogFulfillmentType;
  requiresServerId: boolean;
  globalAvailability: boolean;
  countryCode: string;
  supplierSku: string;
  variantName: string;
  supplierCostIDR: number | null;
  supplierStatus: string;
  nonCryptoMarkupBps: number;
  cryptoMarkupBps: number;
};

export type ParsedCatalogSheet = {
  items: CatalogItem[];
  skipped: string[];
};

type ProductDefinition = {
  key: string;
  name: string;
  image: string;
  categorySlug: CatalogItem["categorySlug"];
  fulfillmentType: CatalogFulfillmentType;
  requiresServerId: boolean;
  globalAvailability?: boolean;
  allowMissingSupplierCost?: boolean;
};

const COUNTRY_CODES: Record<string, string> = {
  brazil: "br",
  germany: "de",
  indonesia: "id",
  malaysia: "my",
  mexico: "mx",
  philippines: "ph",
  phillipines: "ph",
  "saudi arabia": "sa",
  singapore: "sg",
  thailand: "th",
  "united kingdom": "gb",
  "united states": "us",
  vietnam: "vn",
};

const PRODUCTS: Record<string, ProductDefinition> = {
  ML: {
    key: "mobile-legends",
    name: "Mobile Legends",
    image: "/mlbb.webp",
    categorySlug: "game-top-up",
    fulfillmentType: "TOP_UP",
    requiresServerId: true,
  },
  MLGLO: {
    key: "mobile-legends-global",
    name: "Mobile Legends Global",
    image: "/mlbb.webp",
    categorySlug: "game-top-up",
    fulfillmentType: "TOP_UP",
    requiresServerId: true,
    globalAvailability: true,
  },
  HOK: {
    key: "honor-of-kings",
    name: "Honor of Kings",
    image: "/honor-of-kings.webp",
    categorySlug: "game-top-up",
    fulfillmentType: "TOP_UP",
    requiresServerId: false,
  },
  CODM: {
    key: "call-of-duty-mobile",
    name: "Call of Duty Mobile",
    image: "/call-of-duty-mobile.webp",
    categorySlug: "game-top-up",
    fulfillmentType: "TOP_UP",
    requiresServerId: false,
  },
  VSTEAM: {
    key: "steam",
    name: "Steam",
    image: "/steam.webp",
    categorySlug: "game-vouchers",
    fulfillmentType: "VOUCHER",
    requiresServerId: false,
  },
  FF: {
    key: "free-fire",
    name: "Free Fire",
    image: "/free-fire.webp",
    categorySlug: "game-top-up",
    fulfillmentType: "TOP_UP",
    requiresServerId: false,
  },
  VAL: {
    key: "valorant",
    name: "Valorant",
    image: "/valorant.webp",
    categorySlug: "game-top-up",
    fulfillmentType: "TOP_UP",
    requiresServerId: false,
  },
  NTD: {
    key: "nintendo-eshop",
    name: "Nintendo eShop",
    image: "/nintendo.webp",
    categorySlug: "game-vouchers",
    fulfillmentType: "VOUCHER",
    requiresServerId: false,
  },
  VPSN: {
    key: "playstation-store",
    name: "PlayStation Store",
    image: "/ps.png",
    categorySlug: "game-vouchers",
    fulfillmentType: "VOUCHER",
    requiresServerId: false,
  },
  VXBOX: {
    key: "xbox-pc-game-pass",
    name: "Xbox & PC Game Pass",
    image: "/xbox.png",
    categorySlug: "game-vouchers",
    fulfillmentType: "VOUCHER",
    requiresServerId: false,
  },
  ROB: {
    key: "roblox-gift-card",
    name: "Roblox Gift Card",
    image: "/roblox.png",
    categorySlug: "game-vouchers",
    fulfillmentType: "VOUCHER",
    requiresServerId: false,
    allowMissingSupplierCost: true,
  },
  LOL: {
    key: "league-of-legends-wild-rift",
    name: "League of Legends: Wild Rift",
    image: "/riotgames.png",
    categorySlug: "game-top-up",
    fulfillmentType: "TOP_UP",
    requiresServerId: false,
  },
  LOLPC: {
    key: "league-of-legends-pc",
    name: "League of Legends PC",
    image: "/riotgames.png",
    categorySlug: "game-top-up",
    fulfillmentType: "TOP_UP",
    requiresServerId: false,
    allowMissingSupplierCost: true,
  },
  VLOL: {
    key: "league-of-legends-voucher",
    name: "League of Legends Voucher",
    image: "/riotgames.png",
    categorySlug: "game-vouchers",
    fulfillmentType: "VOUCHER",
    requiresServerId: false,
  },
  RPGC: {
    key: "riot-points-gift-card",
    name: "Riot Points Gift Card",
    image: "/riotgames.png",
    categorySlug: "game-vouchers",
    fulfillmentType: "VOUCHER",
    requiresServerId: false,
    allowMissingSupplierCost: true,
  },
};

const PRODUCT_CODE_PREFIXES = Object.keys(PRODUCTS).sort(
  (left, right) => right.length - left.length,
);

const COST_HEADERS = [
  "MODAL/Reseller Price",
  "MODAL Reseller Price",
  "modal Reseller Price",
  "HARGA MODAL",
  "Price reseller",
  "Reseller Price",
  "MODAL",
];

const NON_CRYPTO_MARKUP_HEADERS = new Set([
  "dynamic non crypto",
  "price dynamic non crypto",
  "dynamic pricing non crypto",
  "margin non crypto",
]);

const CRYPTO_MARKUP_HEADERS = new Set([
  "dynamic crypto",
  "price dynamic crypto",
  "dynamic pricing crypto",
  "margin crypto",
]);

const CRYPTO_MARKUP_FALLBACK_BPS = 200;

function normalizedText(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizedKey(value: unknown) {
  return normalizedText(value).toLowerCase();
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const cleaned = value
    .trim()
    .replace(/rp|idr/gi, "")
    .replace(/[^\d.,-]/g, "");
  if (!cleaned) return null;

  const normalized = cleaned.includes(",") && cleaned.includes(".")
    ? cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "")
    : cleaned.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function readMarkupBps(value: unknown) {
  const percentage = readNumber(value);
  if (percentage === null || percentage < 0 || percentage > 1) return null;
  return Math.round(percentage * 10_000);
}

function findMarkupColumnIndexes(headerRow: unknown[]) {
  const normalizedHeaders = headerRow.map(normalizedKey);
  const nonCryptoMatches = normalizedHeaders.flatMap((header, index) =>
    NON_CRYPTO_MARKUP_HEADERS.has(header) ? [index] : [],
  );
  const explicitCryptoIndex = normalizedHeaders.findIndex((header) =>
    CRYPTO_MARKUP_HEADERS.has(header),
  );

  return {
    nonCrypto: nonCryptoMatches[0] ?? -1,
    crypto:
      explicitCryptoIndex >= 0
        ? explicitCryptoIndex
        : (nonCryptoMatches[1] ?? -1),
  };
}

function valueByAliases(
  row: unknown[],
  headerIndex: Map<string, number>,
  aliases: string[],
) {
  for (const alias of aliases) {
    const index = headerIndex.get(alias.toLowerCase());
    if (index !== undefined) return row[index];
  }
  return null;
}

function inferCountry(sheetName: string, rawCountry: unknown) {
  const explicit = normalizedKey(rawCountry);
  if (COUNTRY_CODES[explicit]) return COUNTRY_CODES[explicit];

  const sheet = normalizedKey(sheetName);
  for (const [name, code] of Object.entries(COUNTRY_CODES)) {
    if (sheet.includes(name)) return code;
  }
  if (sheet.includes("indo") || sheet === "ml global") return "id";
  return null;
}

function inferProductCode(
  sheetName: string,
  rawCategoryCode: unknown,
  supplierSku: string,
) {
  const explicit = normalizedText(rawCategoryCode).toUpperCase();
  if (PRODUCTS[explicit]) return explicit;

  const upperSku = supplierSku.toUpperCase();
  for (const prefix of PRODUCT_CODE_PREFIXES) {
    if (upperSku.startsWith(prefix)) return prefix;
  }

  const sheet = normalizedKey(sheetName);
  if (sheet.includes("mobile") || /(^|\s)ml(\s|$)/.test(sheet)) return "ML";
  return null;
}

export function calculateSellPriceIDR(
  supplierCostIDR: number,
  markupBps: number,
) {
  if (!Number.isFinite(supplierCostIDR) || supplierCostIDR < 0) {
    throw new Error("Supplier cost must be a non-negative number.");
  }
  if (!Number.isSafeInteger(markupBps) || markupBps < 0) {
    throw new Error("Pricing markup must be a non-negative integer.");
  }
  return Math.ceil((supplierCostIDR * (10_000 + markupBps)) / 10_000);
}

export function parseCatalogSheetRows(
  sheetName: string,
  rows: unknown[][],
): ParsedCatalogSheet {
  const [headerRow, ...dataRows] = rows;
  if (!headerRow) return { items: [], skipped: [`${sheetName}: missing header`] };

  const headerIndex = new Map(
    headerRow.map((value, index) => [normalizedKey(value), index]),
  );
  const markupColumns = findMarkupColumnIndexes(headerRow);
  const sheetNonCryptoMarkups = new Set(
    dataRows
      .map((row) => readMarkupBps(row[markupColumns.nonCrypto]))
      .filter((value): value is number => value !== null),
  );
  const sheetCryptoMarkups = new Set(
    dataRows
      .map((row) => readMarkupBps(row[markupColumns.crypto]))
      .filter((value): value is number => value !== null),
  );
  const uniformNonCryptoMarkupBps =
    sheetNonCryptoMarkups.size === 1
      ? [...sheetNonCryptoMarkups][0] ?? null
      : null;
  const uniformCryptoMarkupBps =
    sheetCryptoMarkups.size === 1 ? [...sheetCryptoMarkups][0] ?? null : null;
  const items: CatalogItem[] = [];
  const skipped: string[] = [];

  for (const [rowIndex, row] of dataRows.entries()) {
    const line = rowIndex + 2;
    const supplierSku = normalizedText(
      valueByAliases(row, headerIndex, ["Product Code", "Product code"]),
    );
    const variantName = normalizedText(
      valueByAliases(row, headerIndex, ["Product Name"]),
    );
    const rawCountry = valueByAliases(row, headerIndex, ["Country"]);
    const countryCode = inferCountry(sheetName, rawCountry);
    const categoryCode = inferProductCode(
      sheetName,
      valueByAliases(row, headerIndex, ["Category Code"]),
      supplierSku,
    );
    const product = categoryCode ? PRODUCTS[categoryCode] : null;
    const supplierCost = readNumber(
      valueByAliases(row, headerIndex, COST_HEADERS),
    );
    const nonCryptoMarkupBps =
      readMarkupBps(row[markupColumns.nonCrypto]) ?? uniformNonCryptoMarkupBps;
    const workbookCryptoMarkupBps = readMarkupBps(row[markupColumns.crypto]);
    const cryptoMarkupBps =
      workbookCryptoMarkupBps ??
      uniformCryptoMarkupBps ??
      (nonCryptoMarkupBps === null
        ? null
        : nonCryptoMarkupBps + CRYPTO_MARKUP_FALLBACK_BPS);

    if (
      !supplierSku ||
      !variantName ||
      normalizedKey(supplierSku) === "product code" ||
      normalizedKey(variantName) === "product name" ||
      !countryCode ||
      !product ||
      (supplierCost === null && !product.allowMissingSupplierCost) ||
      (supplierCost !== null && supplierCost <= 0) ||
      nonCryptoMarkupBps === null ||
      cryptoMarkupBps === null
    ) {
      skipped.push(`${sheetName}:${line}`);
      continue;
    }

    const explicitVariant = normalizedText(
      valueByAliases(row, headerIndex, ["Variant"]),
    ).toUpperCase();
    const fulfillmentType: CatalogFulfillmentType =
      explicitVariant === "VOUCHER" ? "VOUCHER" : product.fulfillmentType;
    const categorySlug =
      fulfillmentType === "VOUCHER" ? "game-vouchers" : "game-top-up";

    items.push({
      productKey: product.key,
      productName: product.name,
      productImage: product.image,
      categorySlug,
      fulfillmentType,
      requiresServerId:
        fulfillmentType === "TOP_UP" && product.requiresServerId,
      globalAvailability: Boolean(product.globalAvailability),
      countryCode,
      supplierSku,
      variantName,
      supplierCostIDR:
        supplierCost === null ? null : Math.round(supplierCost),
      supplierStatus:
        normalizedKey(valueByAliases(row, headerIndex, ["Status"])) ||
        "available",
      nonCryptoMarkupBps,
      cryptoMarkupBps,
    });
  }

  return { items, skipped };
}

export function deduplicateCatalogItems(items: CatalogItem[]) {
  const bySkuCountry = new Map<string, CatalogItem>();
  const duplicates: string[] = [];

  for (const item of items) {
    const key = `${item.countryCode}:${item.supplierSku}`.toLowerCase();
    if (bySkuCountry.has(key)) duplicates.push(key);
    bySkuCountry.set(key, item);
  }

  return { items: [...bySkuCountry.values()], duplicates };
}
