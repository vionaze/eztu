export const CATALOG_BLOG_MARKETS = [
  "BR",
  "DE",
  "GB",
  "ID",
  "MY",
  "PH",
  "SA",
  "SG",
  "TH",
  "US",
  "VN",
] as const;

export type CatalogBlogMarket = (typeof CATALOG_BLOG_MARKETS)[number];

export type BlogProductDefinition = {
  key: string;
  name: string;
  markets: readonly CatalogBlogMarket[];
  focus: string;
};

export const BLOG_PRODUCT_DEFINITIONS: readonly BlogProductDefinition[] = [
  {
    key: "mobile-legends",
    name: "Mobile Legends",
    markets: ["BR", "ID", "MY", "PH", "SG", "TH"],
    focus: "choosing Diamond packages, passes, and entering the correct User ID and Zone ID",
  },
  {
    key: "mobile-legends-global",
    name: "Mobile Legends Global",
    markets: ["ID"],
    focus: "when to use the Global catalog and how to verify account identifiers before topping up",
  },
  {
    key: "honor-of-kings",
    name: "Honor of Kings",
    markets: ["BR", "ID", "MY", "PH", "SA", "SG", "TH", "US"],
    focus: "comparing Token packages and weekly cards for different player needs",
  },
  {
    key: "call-of-duty-mobile",
    name: "Call of Duty Mobile",
    markets: ["ID", "MY", "SG"],
    focus: "choosing CP packages, comparing bonuses, and avoiding Player ID mistakes",
  },
  {
    key: "steam",
    name: "Steam",
    markets: ["BR", "DE", "ID", "MY", "PH", "SG", "TH", "US", "VN"],
    focus: "choosing a Steam Wallet voucher for the correct account region and understanding region restrictions",
  },
  {
    key: "free-fire",
    name: "Free Fire",
    markets: ["ID", "MY", "PH", "SG", "TH"],
    focus: "choosing Diamond packages for events, bundles, and memberships without overbuying",
  },
  {
    key: "valorant",
    name: "Valorant",
    markets: ["ID"],
    focus: "choosing Valorant Points for skins, bundles, and Battle Pass purchases",
  },
  {
    key: "nintendo-eshop",
    name: "Nintendo eShop",
    markets: ["BR", "ID"],
    focus: "matching Nintendo eShop vouchers to the Nintendo Account region and store currency",
  },
  {
    key: "playstation-store",
    name: "PlayStation Store",
    markets: ["BR", "DE", "GB", "ID", "MY", "PH", "SG", "TH", "US"],
    focus: "matching PlayStation Store cards to the PSN region, denomination, games, and subscriptions",
  },
  {
    key: "xbox-pc-game-pass",
    name: "Xbox & PC Game Pass",
    markets: ["BR", "ID", "US"],
    focus: "comparing Xbox Gift Card, PC Game Pass, and Game Pass Ultimate for different users",
  },
] as const;

export type ProductMarketSettings = Record<string, string[]>;

function normalizedText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createDefaultProductMarketSettings(): ProductMarketSettings {
  return Object.fromEntries(
    BLOG_PRODUCT_DEFINITIONS.map((product) => [
      product.key,
      [...product.markets],
    ]),
  );
}

export function normalizeProductMarketSettings(
  value: unknown,
): ProductMarketSettings {
  const input = isRecord(value) ? value : {};

  return Object.fromEntries(
    BLOG_PRODUCT_DEFINITIONS.map((product) => {
      if (!Object.prototype.hasOwnProperty.call(input, product.key)) {
        return [product.key, [...product.markets]];
      }

      const rawMarkets = input[product.key];
      if (!Array.isArray(rawMarkets)) return [product.key, [...product.markets]];
      const requested = new Set(
        rawMarkets.map((market) => String(market).trim().toUpperCase()),
      );
      return [
        product.key,
        product.markets.filter((market) => requested.has(market)),
      ];
    }),
  );
}

export function parseProductMarketSettings(raw: string) {
  if (!raw.trim()) return createDefaultProductMarketSettings();
  try {
    return normalizeProductMarketSettings(JSON.parse(raw));
  } catch {
    return createDefaultProductMarketSettings();
  }
}

export function getEligibleBlogProducts(
  market: string,
  settings: ProductMarketSettings,
) {
  const normalizedMarket = market.trim().toUpperCase();
  return BLOG_PRODUCT_DEFINITIONS.filter((product) =>
    (settings[product.key] || []).includes(normalizedMarket),
  );
}

export function getEnabledBlogMarkets(
  globallyEnabledMarkets: string[],
  settings: ProductMarketSettings,
) {
  const catalogMarkets = new Set<string>(CATALOG_BLOG_MARKETS);
  return [...new Set(
    globallyEnabledMarkets
      .map((market) => market.trim().toUpperCase())
      .filter(Boolean),
  )].filter(
    (market) =>
      catalogMarkets.has(market) &&
      getEligibleBlogProducts(market, settings).length > 0,
  );
}

export function selectBlogProductForMarket(
  market: string,
  settings: ProductMarketSettings,
  recentTitles: string[],
) {
  const eligible = getEligibleBlogProducts(market, settings);
  if (eligible.length === 0) return null;

  const normalizedRecent = recentTitles.map(normalizedText);
  const unused = eligible.find((product) => {
    const name = normalizedText(product.name);
    return !normalizedRecent.some((title) => title.includes(name));
  });

  return unused || eligible[recentTitles.length % eligible.length];
}

export function buildProductBlogTopic(
  product: BlogProductDefinition,
  market: string,
  recentTitles: string[],
) {
  const avoidLine = recentTitles.length
    ? ` Avoid repeating these existing titles: ${recentTitles.slice(0, 15).join(" | ")}.`
    : "";

  return (
    `Create a unique, useful SEO article for the ${market.toUpperCase()} market focused on ${product.name}. ` +
    `Use a specific practical angle around ${product.focus}. ` +
    `Connect it naturally to buying the relevant digital product on EZTopUp and available payment options. ` +
    `Do not claim the lowest price or make delivery promises that cannot be verified.` +
    avoidLine
  );
}
