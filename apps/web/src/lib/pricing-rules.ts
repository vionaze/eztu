export type CheckoutPaymentMethod = "pakasir" | "crypto";

export const NON_CRYPTO_MARKUP_BPS = 1000;
export const CRYPTO_MARKUP_BPS = 1200;

export function getPricingMarkupBps(method: CheckoutPaymentMethod) {
  return method === "crypto" ? CRYPTO_MARKUP_BPS : NON_CRYPTO_MARKUP_BPS;
}

export function calculatePriceWithMarkupBps(
  supplierCostIDR: number,
  markupBps: number,
) {
  if (!Number.isSafeInteger(supplierCostIDR) || supplierCostIDR < 0) {
    throw new Error("Supplier cost must be a non-negative integer.");
  }
  if (!Number.isSafeInteger(markupBps) || markupBps < 0) {
    throw new Error("Pricing markup must be a non-negative integer.");
  }
  return Math.ceil((supplierCostIDR * (10_000 + markupBps)) / 10_000);
}

export function calculatePaymentPriceIDR(
  supplierCostIDR: number,
  method: CheckoutPaymentMethod,
) {
  return calculatePriceWithMarkupBps(
    supplierCostIDR,
    getPricingMarkupBps(method),
  );
}

export function isSupplierPurchasable(status: string | null | undefined) {
  return status?.trim().toLowerCase() === "available";
}
