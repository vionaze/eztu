import "server-only";
import { prisma } from "@kupon/db";
import {
  getSupplierProduct,
  getSupplierProducts,
  isSupplierProductCode,
  type SupplierProduct,
} from "@/lib/supplier";
import {
  calculatePriceWithMarkupBps,
  isSupplierPurchasable,
  type CheckoutPaymentMethod,
} from "@/lib/pricing-rules";

export class SupplierPriceUnavailableError extends Error {
  code: string;

  constructor(message: string, code = "SUPPLIER_PRICE_UNAVAILABLE") {
    super(message);
    this.name = "SupplierPriceUnavailableError";
    this.code = code;
  }
}

type PricedVariant = {
  id: string;
  supplierSku: string | null;
  countryCode: string;
  nonCryptoMarkupBps: number;
  cryptoMarkupBps: number;
};

function getMarkupBps(variant: PricedVariant, method: CheckoutPaymentMethod) {
  return method === "crypto"
    ? variant.cryptoMarkupBps
    : variant.nonCryptoMarkupBps;
}

async function persistSupplierProduct(
  variant: PricedVariant,
  supplierProduct: SupplierProduct,
  verifiedAt: Date,
) {
  const nonCryptoPriceIDR = calculatePriceWithMarkupBps(
    supplierProduct.price,
    variant.nonCryptoMarkupBps,
  );
  await prisma.productVariant.update({
    where: { id: variant.id },
    data: {
      supplierCostIDR: supplierProduct.price,
      supplierStatus: supplierProduct.status,
      supplierPriceUpdatedAt: verifiedAt,
      priceIDR: nonCryptoPriceIDR,
    },
  });
}

export async function getFreshVariantPricing(
  variant: PricedVariant,
  paymentMethod: CheckoutPaymentMethod,
) {
  const supplierSku = variant.supplierSku?.trim() || "";
  if (!isSupplierProductCode(supplierSku)) {
    throw new SupplierPriceUnavailableError(
      "This SKU is not connected to the supplier.",
      "SUPPLIER_SKU_MISSING",
    );
  }

  const supplierProduct = await getSupplierProduct({
    productCode: supplierSku,
    countryCode: variant.countryCode,
  });
  const verifiedAt = new Date();
  await persistSupplierProduct(variant, supplierProduct, verifiedAt);

  if (!isSupplierPurchasable(supplierProduct.status)) {
    throw new SupplierPriceUnavailableError(
      "This SKU is temporarily unavailable from the supplier.",
      "SUPPLIER_SKU_UNAVAILABLE",
    );
  }

  const markupBps = getMarkupBps(variant, paymentMethod);
  return {
    supplierSku,
    countryCode: variant.countryCode,
    supplierCostIDR: supplierProduct.price,
    supplierStatus: supplierProduct.status,
    unitPriceIDR: calculatePriceWithMarkupBps(supplierProduct.price, markupBps),
    markupBps,
    verifiedAt,
  };
}

export async function refreshAllSupplierPrices() {
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
      cryptoMarkupBps: true,
    },
    orderBy: [{ countryCode: "asc" }, { supplierSku: "asc" }],
  });
  const countries = [...new Set(variants.map((variant) => variant.countryCode))];
  const summary = {
    countries: countries.length,
    checked: variants.length,
    updated: 0,
    unavailable: 0,
    missing: 0,
    failedCountries: [] as string[],
  };

  for (const countryCode of countries) {
    const countryVariants = variants.filter(
      (variant) => variant.countryCode === countryCode,
    );
    let supplierProducts: SupplierProduct[];
    try {
      supplierProducts = await getSupplierProducts(countryCode);
    } catch {
      summary.failedCountries.push(countryCode);
      continue;
    }
    const productByCode = new Map(
      supplierProducts.map((product) => [product.code, product]),
    );
    const verifiedAt = new Date();

    for (const variant of countryVariants) {
      const supplierProduct = variant.supplierSku
        ? productByCode.get(variant.supplierSku)
        : null;
      if (!supplierProduct) {
        summary.missing += 1;
        continue;
      }
      await persistSupplierProduct(variant, supplierProduct, verifiedAt);
      if (isSupplierPurchasable(supplierProduct.status)) summary.updated += 1;
      else summary.unavailable += 1;
    }
  }

  return summary;
}
