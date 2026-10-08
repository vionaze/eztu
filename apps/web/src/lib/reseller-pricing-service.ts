import "server-only";

import { calculateResellerPrice, chooseEffectiveRule, prisma } from "@kupon/db";
import { AuthorizationRequiredError } from "@/lib/clerk";
import { requireResellerUser } from "@/lib/reseller-auth";
import { getDetectedMarketCode, isProductExcludedFromMarket } from "@/lib/product-availability";
import { getSupplierProduct, isSupplierProductCode } from "@/lib/supplier";
import { isB2BOrderingEnabled } from "@/lib/b2b-flags";
import { MAX_SELF_SERVICE_QUANTITY } from "@/lib/checkout-limits";

export class ResellerPricingError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message);
    this.name = "ResellerPricingError";
  }
}

export async function requireActiveReseller(organizationId: string) {
  if (!organizationId) {
    throw new ResellerPricingError("Select a reseller organization.", 400, "ORGANIZATION_REQUIRED");
  }
  const context = await requireResellerUser({ organizationId, statuses: ["ACTIVE"] });
  if (!context.authenticatedUser.emailVerified) {
    throw new AuthorizationRequiredError("A verified email is required.");
  }
  return context;
}

function marketAllows(
  product: { globalAvailability: boolean; unavailableMarketCodes: string[] },
  countryCode: string,
  requestHeaders: Headers,
) {
  const market = getDetectedMarketCode(requestHeaders) || "id";
  return !isProductExcludedFromMarket(product, market) &&
    (product.globalAvailability || countryCode === market);
}

export async function getResellerCatalog(organizationId: string, requestHeaders: Headers) {
  const { organization } = await requireActiveReseller(organizationId);
  const variants = await prisma.productVariant.findMany({
    where: {
      published: true,
      replacementForId: null,
      supplierSku: { not: null },
      supplierStatus: { equals: "available", mode: "insensitive" },
      product: { published: true },
      OR: [
        { resellerTierPrices: { some: { tier: organization.tier } } },
        { resellerOrganizationPrices: { some: { organizationId } } },
      ],
    },
    include: {
      product: true,
      resellerTierPrices: { where: { tier: organization.tier } },
      resellerOrganizationPrices: { where: { organizationId } },
    },
    orderBy: [{ productId: "asc" }, { name: "asc" }, { id: "asc" }],
  });

  const products = new Map<string, {
    id: string; name: string; slug: string; image: string;
    variants: { id: string; name: string; countryCode: string; priceIDR: number }[];
  }>();
  for (const variant of variants) {
    if (!marketAllows(variant.product, variant.countryCode, requestHeaders)) continue;
    const rule = chooseEffectiveRule(variant.resellerOrganizationPrices[0], variant.resellerTierPrices[0]);
    if (!rule || !rule.enabled) continue;
    let priceIDR: number;
    try {
      priceIDR = calculateResellerPrice(variant.supplierCostIDR ?? 0, rule);
    } catch {
      continue;
    }
    let product = products.get(variant.productId);
    if (!product) {
      product = {
        id: variant.productId, name: variant.product.name,
        slug: variant.product.slug, image: variant.product.image, variants: [],
      };
      products.set(variant.productId, product);
    }
    product.variants.push({ id: variant.id, name: variant.name, countryCode: variant.countryCode, priceIDR });
  }
  return {
    products: [...products.values()],
    quotedAt: new Date().toISOString(),
    orderingEnabled: isB2BOrderingEnabled(organizationId, organization.orderingEnabled),
    // Pakasir is the primary settlement method; crypto stays available as a secondary option.
    defaultPaymentMethod: "PAKASIR" as const,
  };
}

export async function getResellerLiveQuote(
  organizationId: string,
  variantId: string,
  quantity: number,
  requestHeaders: Headers,
) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_SELF_SERVICE_QUANTITY) {
    throw new ResellerPricingError("Invalid quantity.", 400, "INVALID_QUANTITY");
  }
  const initialContext = await requireActiveReseller(organizationId);
  const [initialOverride, initialTierRule] = await Promise.all([
    prisma.resellerOrganizationSkuPrice.findUnique({ where: { organizationId_variantId: { organizationId, variantId } } }),
    prisma.resellerTierSkuPrice.findUnique({ where: { tier_variantId: { tier: initialContext.organization.tier, variantId } } }),
  ]);
  const initialRule = chooseEffectiveRule(initialOverride, initialTierRule);
  if (!initialRule || !initialRule.enabled) {
    throw new ResellerPricingError("No reseller price is configured for this package.", 404, "PRICE_NOT_CONFIGURED");
  }
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: true },
  });
  if (!variant || !variant.published || !variant.product.published || variant.replacementForId ||
      !marketAllows(variant.product, variant.countryCode, requestHeaders)) {
    throw new ResellerPricingError("This package is not available.", 404, "VARIANT_UNAVAILABLE");
  }
  if (!isSupplierProductCode(variant.supplierSku)) {
    throw new ResellerPricingError("This package is not available.", 404, "VARIANT_UNAVAILABLE");
  }

  // Read supplier data directly: reseller quotes must not rewrite shared retail prices.
  const supplied = await getSupplierProduct({ productCode: variant.supplierSku!, countryCode: variant.countryCode });
  if (supplied.code !== variant.supplierSku ||
      (supplied.country_code && supplied.country_code.toLowerCase() !== variant.countryCode)) {
    throw new ResellerPricingError("Unable to verify this package.", 503, "SUPPLIER_IDENTITY_MISMATCH");
  }
  if (supplied.status.trim().toLowerCase() !== "available") {
    throw new ResellerPricingError("This package is currently out of stock.", 503, "SUPPLIER_SKU_UNAVAILABLE");
  }

  // Permissions and tier can change while the supplier request is in flight.
  const { organization } = await requireActiveReseller(organizationId);
  const [override, tierRule] = await Promise.all([
    prisma.resellerOrganizationSkuPrice.findUnique({ where: { organizationId_variantId: { organizationId, variantId } } }),
    prisma.resellerTierSkuPrice.findUnique({ where: { tier_variantId: { tier: organization.tier, variantId } } }),
  ]);
  const rule = chooseEffectiveRule(override, tierRule);
  if (!rule || !rule.enabled) {
    throw new ResellerPricingError("No reseller price is configured for this package.", 404, "PRICE_NOT_CONFIGURED");
  }
  let unitPriceIDR: number;
  try {
    unitPriceIDR = calculateResellerPrice(supplied.price, rule);
  } catch {
    throw new ResellerPricingError("This reseller price needs review. Please contact support.", 503, "PRICE_REVIEW_REQUIRED");
  }
  const totalIDR = unitPriceIDR * quantity;
  if (!Number.isSafeInteger(totalIDR) || totalIDR > 2_147_483_647) {
    throw new ResellerPricingError("Quote total is out of range.", 400, "TOTAL_OUT_OF_RANGE");
  }
  return { variantId, unitPriceIDR, totalIDR, quantity, quotedAt: new Date().toISOString() };
}
