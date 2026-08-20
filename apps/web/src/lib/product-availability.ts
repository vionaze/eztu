type MarketVariant = {
  countryCode?: string;
};

type MarketProduct<Variant extends MarketVariant> = {
  globalAvailability?: boolean;
  variants: readonly Variant[];
};

export function getProductVariantsForMarket<Variant extends MarketVariant>(
  product: MarketProduct<Variant>,
  supplierMarketCode: string,
): Variant[] {
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
