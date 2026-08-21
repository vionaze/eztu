type MarketVariant = {
  countryCode?: string;
};

type MarketProduct<Variant extends MarketVariant> = {
  globalAvailability?: boolean;
  unavailableMarketCodes?: readonly string[];
  variants: readonly Variant[];
};

function normalizedMarketCode(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

export function isProductExcludedFromMarket(
  product: Pick<MarketProduct<MarketVariant>, "unavailableMarketCodes">,
  supplierMarketCode: string | null | undefined,
) {
  const marketCode = normalizedMarketCode(supplierMarketCode);
  if (!marketCode) return false;
  return (product.unavailableMarketCodes || []).some(
    (code) => normalizedMarketCode(code) === marketCode,
  );
}

export function getDetectedMarketCode(headers: Pick<Headers, "get">) {
  return normalizedMarketCode(
    headers.get("cf-ipcountry") ||
      headers.get("x-vercel-ip-country") ||
      headers.get("x-country-code"),
  );
}

export function getProductVariantsForMarket<Variant extends MarketVariant>(
  product: MarketProduct<Variant>,
  supplierMarketCode: string,
): Variant[] {
  if (isProductExcludedFromMarket(product, supplierMarketCode)) return [];
  if (product.globalAvailability) return [...product.variants];
  return product.variants.filter(
    (variant) => variant.countryCode === supplierMarketCode,
  );
}

export function isProductAvailableInMarket(
  product: MarketProduct<MarketVariant>,
  supplierMarketCode: string,
) {
  return getProductVariantsForMarket(product, supplierMarketCode).length > 0;
}
