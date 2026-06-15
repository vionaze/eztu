export type FlexaGiftPurchaseParams = {
  orderId: string;
  orderNumber: string;
  productName: string;
  variantName: string;
  customerEmail: string;
  gameId: string;
  serverId?: string | null;
  quantity: number;
  costIDR: number;
};

export type FlexaGiftPurchaseResult = {
  provider: "flexagift";
  providerOrderId: string;
  voucherCode: string;
  voucherCodes?: string[];
  voucherPin?: string | null;
  raw: Record<string, unknown>;
};

function getFlexaGiftMode() {
  return (process.env.FLEXAGIFT_MODE || "mock").trim().toLowerCase();
}

function createMockVoucherCode(orderNumber: string, index: number) {
  const suffix = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `MOCK-${orderNumber}-${String(index).padStart(2, "0")}-${suffix}`;
}

export async function purchaseFlexaGiftVoucher(
  params: FlexaGiftPurchaseParams
): Promise<FlexaGiftPurchaseResult> {
  const mode = getFlexaGiftMode();

  if (mode !== "live") {
    const quantity = Math.max(1, Math.trunc(params.quantity));
    const voucherCodes = Array.from({ length: quantity }, (_, index) =>
      createMockVoucherCode(params.orderNumber, index + 1)
    );

    return {
      provider: "flexagift",
      providerOrderId: `mock-flexagift-${params.orderId}`,
      voucherCode: voucherCodes.join("\n"),
      voucherCodes,
      voucherPin: null,
      raw: {
        mode: "mock",
        orderId: params.orderId,
        orderNumber: params.orderNumber,
        productName: params.productName,
        variantName: params.variantName,
        customerEmail: params.customerEmail,
        gameId: params.gameId,
        serverId: params.serverId,
        quantity,
        costIDR: params.costIDR,
      },
    };
  }

  const apiUrl = process.env.FLEXAGIFT_API_URL;
  const apiKey = process.env.FLEXAGIFT_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error("FLEXAGIFT_API_URL and FLEXAGIFT_API_KEY are required in live mode.");
  }

  throw new Error("FlexaGift live adapter needs the official purchase API contract.");
}
