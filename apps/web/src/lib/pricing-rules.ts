export type CheckoutPaymentMethod = "pakasir" | "crypto";

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

export function isSupplierPurchasable(status: string | null | undefined) {
  return status?.trim().toLowerCase() === "available";
}
