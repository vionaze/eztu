import { createHmac } from "node:crypto";

export const PRODUCT_VISITOR_COOKIE = "ezt_product_visitor";
export const PRODUCT_VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const PRODUCT_ANALYTICS_EVENT_TYPES = [
  "CARD_CLICK",
  "VIEW",
  "VARIANT_SELECTED",
  "PAYMENT_METHOD_SELECTED",
  "QUOTE_ERROR",
  "CHECKOUT_SUBMITTED",
  "CHECKOUT_REJECTED",
  "PAYMENT_CREATED",
] as const;

export type ProductAnalyticsEventName =
  (typeof PRODUCT_ANALYTICS_EVENT_TYPES)[number];

export type ProductFunnelEventRow = {
  productId: string;
  visitorHash: string;
  eventType: ProductAnalyticsEventName;
};

export type ProductFunnelMetrics = {
  clicks: number;
  views: number;
  uniqueVisitors: number;
  variantSelections: number;
  checkoutSubmissions: number;
  paymentCreations: number;
  paidOrders: number;
  conversionRate: number;
  conclusion: string;
};

const VISITOR_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidProductVisitorId(value: string | undefined) {
  return Boolean(value && VISITOR_ID_PATTERN.test(value));
}

export function isProductAnalyticsEventType(
  value: unknown,
): value is ProductAnalyticsEventName {
  return (
    typeof value === "string" &&
    PRODUCT_ANALYTICS_EVENT_TYPES.includes(value as ProductAnalyticsEventName)
  );
}

export function hashProductVisitorId(visitorId: string, secret: string) {
  if (secret.trim().length < 32) {
    throw new Error(
      "PRODUCT_ANALYTICS_HASH_SECRET must contain at least 32 characters.",
    );
  }
  return createHmac("sha256", secret).update(visitorId).digest("hex");
}

function getConclusion(metrics: Omit<ProductFunnelMetrics, "conclusion">) {
  if (metrics.views >= 4 && metrics.variantSelections / metrics.views < 0.3) {
    return "Banyak view, tetapi sedikit pengunjung memilih SKU; cek kecocokan pilihan, nominal, dan kejelasan harga.";
  }
  if (
    metrics.checkoutSubmissions >= 2 &&
    metrics.paymentCreations / metrics.checkoutSubmissions < 0.5
  ) {
    return "Banyak checkout disubmit tetapi payment tidak dibuat; periksa error quote, login, field akun game, atau ketersediaan supplier.";
  }
  if (metrics.paymentCreations > metrics.paidOrders) {
    return "Payment sudah dibuat tetapi sebagian belum dibayar; evaluasi metode pembayaran, expiry, dan friction pada halaman provider.";
  }
  if (metrics.paidOrders > 0) {
    return "Funnel menghasilkan pembelian; pertahankan SKU dan pantau perubahan conversion rate.";
  }
  if (metrics.clicks > 0 || metrics.views > 0) {
    return "Traffic ada, tetapi datanya belum cukup untuk menentukan tahap drop-off yang dominan.";
  }
  return "Belum ada aktivitas yang cukup untuk dianalisis.";
}

export function buildProductFunnelReport(
  events: ProductFunnelEventRow[],
  paidOrdersByProduct: Map<string, number>,
) {
  const productIds = new Set([
    ...events.map((event) => event.productId),
    ...paidOrdersByProduct.keys(),
  ]);
  const report = new Map<string, ProductFunnelMetrics>();

  for (const productId of productIds) {
    const rows = events.filter((event) => event.productId === productId);
    const count = (eventType: ProductAnalyticsEventName) =>
      rows.filter((event) => event.eventType === eventType).length;
    const views = count("VIEW");
    const uniqueVisitors = new Set(
      rows
        .filter((event) => event.eventType === "VIEW")
        .map((event) => event.visitorHash),
    ).size;
    const paidOrders = paidOrdersByProduct.get(productId) || 0;
    const metrics = {
      clicks: count("CARD_CLICK"),
      views,
      uniqueVisitors,
      variantSelections: count("VARIANT_SELECTED"),
      checkoutSubmissions: count("CHECKOUT_SUBMITTED"),
      paymentCreations: count("PAYMENT_CREATED"),
      paidOrders,
      conversionRate: uniqueVisitors > 0 ? paidOrders / uniqueVisitors : 0,
    };
    report.set(productId, { ...metrics, conclusion: getConclusion(metrics) });
  }
  return report;
}
