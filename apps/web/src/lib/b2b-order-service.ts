import "server-only";

import { randomUUID } from "node:crypto";
import { createPakasirPayment, createPaymentInvoice } from "@kupon/payments";
import { calculateResellerPrice, chooseEffectiveRule, prisma, Prisma } from "@kupon/db";
import { getUsdIdrRate } from "@/lib/fx";
import { getDetectedMarketCode, isProductExcludedFromMarket } from "@/lib/product-availability";
import { ResellerPricingError, requireActiveReseller } from "@/lib/reseller-pricing-service";
import { getSupplierOrderStatus, getSupplierProduct, isSupplierProductCode, createSupplierOrder } from "@/lib/supplier";
import { isB2BOrderingEnabled } from "@/lib/b2b-flags";
import { buildOrderDetailsWorkbook, orderDetailsFilename } from "@/lib/b2b-delivery-export";
import { sendB2BDeliveryEmail } from "@/lib/reseller-notifications";
import {
  buildRequestFingerprint,
  canAdminOrderTransition,
  canAdvanceIntent,
  mapNormalizedStatus,
  FULFILLMENT_LEASE_MINUTES,
  MAX_FULFILLMENT_ATTEMPTS,
  type B2BAdminStatusTarget,
  signB2BQuote,
  verifyB2BQuote,
  B2B_QUOTE_TTL_MINUTES,
  type B2BPaymentMethodValue,
  type B2BQuoteLine,
  type B2BQuotePayload,
} from "@/lib/b2b-order-rules";

export class B2BOrderError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message);
    this.name = "B2BOrderError";
  }
}

export { isB2BOrderingEnabled };

function requireOrderingEnabled(organizationId: string, orderingFlag: boolean) {
  if (!isB2BOrderingEnabled(organizationId, orderingFlag)) {
    throw new B2BOrderError("Wholesale ordering is not enabled for this organization yet.", 403, "ORDERING_DISABLED");
  }
}

function marketAllows(
  product: { globalAvailability: boolean; unavailableMarketCodes: string[] },
  countryCode: string,
  headers: Headers,
) {
  const market = getDetectedMarketCode(headers) || "id";
  return !isProductExcludedFromMarket(product, market) &&
    (product.globalAvailability || countryCode === market);
}

async function resolveQuoteLines(
  organizationId: string,
  lines: { variantId: string; quantity: number }[],
  tier: "TIER_1" | "TIER_2",
  requestHeaders: Headers,
) {
  const snapshots: B2BQuoteLine[] = [];
  for (const line of lines) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: line.variantId },
      include: {
        product: true,
        resellerTierPrices: { where: { tier } },
        resellerOrganizationPrices: { where: { organizationId } },
      },
    });
    if (!variant || !variant.published || !variant.product.published || variant.replacementForId ||
        !marketAllows(variant.product, variant.countryCode, requestHeaders)) {
      throw new B2BOrderError("A selected package is not available.", 404, "VARIANT_UNAVAILABLE");
    }
    if (!isSupplierProductCode(variant.supplierSku)) {
      throw new B2BOrderError("A selected package is not connected to the supplier.", 404, "VARIANT_UNAVAILABLE");
    }
    const override = variant.resellerOrganizationPrices[0];
    const tierRule = variant.resellerTierPrices[0];
    const rule = chooseEffectiveRule(override, tierRule);
    const ruleId = override?.id ?? tierRule?.id ?? "";
    if (!rule || !rule.enabled || !ruleId) {
      throw new B2BOrderError("A selected package has no reseller price configured.", 404, "PRICE_NOT_CONFIGURED");
    }

    const supplied = await getSupplierProduct({ productCode: variant.supplierSku!, countryCode: variant.countryCode });
    if (supplied.code !== variant.supplierSku ||
        (supplied.country_code && supplied.country_code.toLowerCase() !== variant.countryCode) ||
        supplied.status.trim().toLowerCase() !== "available") {
      throw new B2BOrderError("A selected package is out of stock. Refresh your catalog.", 503, "SUPPLIER_SKU_UNAVAILABLE");
    }

    let unitPriceIDR: number;
    try {
      unitPriceIDR = calculateResellerPrice(supplied.price, rule);
    } catch {
      throw new B2BOrderError("A selected reseller price needs review. Please contact support.", 503, "PRICE_REVIEW_REQUIRED");
    }
    if (!Number.isSafeInteger(unitPriceIDR * line.quantity) || unitPriceIDR * line.quantity >= 2_147_483_647) {
      throw new B2BOrderError("Order total is out of range.", 400, "TOTAL_OUT_OF_RANGE");
    }
    snapshots.push({
      variantId: variant.id,
      supplierSku: variant.supplierSku!,
      countryCode: variant.countryCode,
      productName: variant.product.name,
      variantName: variant.name,
      quantity: line.quantity,
      unitPriceIDR,
      supplierCostIDR: supplied.price,
      ruleId,
      ruleRevision: override?.revision ?? tierRule?.revision ?? 1,
      mode: rule.mode,
      markupMicros: rule.markupMicros,
      fixedPriceIDR: rule.fixedPriceIDR,
    });
  }
  return snapshots;
}

export async function quoteB2BOrder(params: {
  organizationId: string;
  lines: { variantId: string; quantity: number }[];
  requestHeaders: Headers;
}) {
  const { organization, authenticatedUser } = await requireActiveReseller(params.organizationId);
  requireOrderingEnabled(params.organizationId, organization.orderingEnabled);
  const snapshots = await resolveQuoteLines(params.organizationId, params.lines, organization.tier, params.requestHeaders);
  const totalIDR = snapshots.reduce((sum, line) => sum + line.unitPriceIDR * line.quantity, 0);
  if (!Number.isSafeInteger(totalIDR) || totalIDR >= 2_147_483_647) {
    throw new B2BOrderError("Order total is out of range.", 400, "TOTAL_OUT_OF_RANGE");
  }
  const expiresAt = new Date(Date.now() + B2B_QUOTE_TTL_MINUTES * 60_000);
  const payload: B2BQuotePayload = {
    v: 1,
    ch: "RESELLER_B2B",
    org: params.organizationId,
    user: authenticatedUser.dbUserId,
    fp: "",
    exp: expiresAt.toISOString(),
    totalIDR,
    lines: snapshots,
  };
  return {
    quoteToken: signB2BQuote(payload),
    expiresAt: expiresAt.toISOString(),
    totalIDR,
    lines: snapshots.map(({ supplierCostIDR: _cost, ruleId: _ruleId, ruleRevision: _revision, mode: _mode, markupMicros: _markup, fixedPriceIDR: _fixed, ...line }) => ({
      ...line,
      totalPriceIDR: line.unitPriceIDR * line.quantity,
    })),
  };
}

function publicOrder(order: {
  id: string; orderNumber: string; status: string; totalIDR: bigint; paymentMethod: string;
  paymentUrl: string | null; createdAt: Date; manualReviewReason: string | null; deliveryEmail: string | null;
  lines: { id: string; variantName: string; quantity: number; unitPriceIDR: bigint; status: string; supplierRaw: unknown }[];
}) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    deliveryEmail: order.deliveryEmail,
    totalIDR: Number(order.totalIDR),
    paymentUrl: order.status === "PAYMENT_PENDING" ? order.paymentUrl : null,
    createdAt: order.createdAt.toISOString(),
    manualReviewReason: order.status === "MANUAL_REVIEW" ? order.manualReviewReason : null,
    lines: order.lines.map((line) => {
      const raw = (line.supplierRaw ?? {}) as { voucherCodes?: string[] };
      return {
        id: line.id,
        name: line.variantName,
        quantity: line.quantity,
        unitPriceIDR: Number(line.unitPriceIDR),
        status: line.status,
        voucherCodes: line.status === "FULFILLED" ? raw.voucherCodes ?? [] : [],
      };
    }),
  };
}

const DELIVERY_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PAYMENT_WINDOW_MINUTES = 10;

export async function createB2BOrder(params: {
  organizationId: string;
  quoteToken: string;
  idempotencyKey: string;
  paymentMethod: B2BPaymentMethodValue;
  deliveryEmail?: string | null;
  requestHeaders: Headers;
}) {
  const { authenticatedUser, organization } = await requireActiveReseller(params.organizationId);
  requireOrderingEnabled(params.organizationId, organization.orderingEnabled);
  const ownerTier = organization.tier;

  const deliveryEmail = (params.deliveryEmail ?? "").trim().toLowerCase() || null;
  if (deliveryEmail && !DELIVERY_EMAIL_PATTERN.test(deliveryEmail)) {
    throw new B2BOrderError("Enter a valid email for code delivery.", 400, "INVALID_DELIVERY_EMAIL");
  }

  const payload = verifyB2BQuote(params.quoteToken);
  if (!payload || payload.org !== params.organizationId || payload.user !== authenticatedUser.dbUserId) {
    throw new B2BOrderError("This quote is no longer valid. Refresh prices and try again.", 409, "QUOTE_INVALID");
  }
  const fingerprint = buildRequestFingerprint(
    params.organizationId,
    payload.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
    params.paymentMethod,
  );

  const existing = await prisma.b2BOrder.findUnique({
    where: { organizationId_idempotencyKey: { organizationId: params.organizationId, idempotencyKey: params.idempotencyKey } },
    include: { lines: true },
  });
  if (existing) {
    if (existing.requestFingerprint !== fingerprint || (existing.deliveryEmail ?? null) !== deliveryEmail) {
      throw new B2BOrderError("This order key was already used with different items.", 409, "IDEMPOTENCY_CONFLICT");
    }
    // A DRAFT row without a payment URL means invoice creation failed last time; heal it below.
    if (existing.paymentUrl || existing.status !== "DRAFT") {
      return { order: publicOrder(existing), reused: true };
    }
  }

  // Rule revisions are re-checked so a price edit mid-flow cannot silently apply.
  // The tier filter matters: without it a row from another tier can be compared
  // against the quote and every checkout looks stale.
  for (const line of payload.lines) {
    const [override, tierRule] = await Promise.all([
      prisma.resellerOrganizationSkuPrice.findFirst({
        where: { organizationId: params.organizationId, variantId: line.variantId },
      }),
      prisma.resellerTierSkuPrice.findFirst({
        where: { variantId: line.variantId, tier: ownerTier },
      }),
    ]);
    const currentRule = chooseEffectiveRule(override, tierRule);
    const currentRuleId = override?.id ?? tierRule?.id ?? "";
    const currentRevision = override?.revision ?? tierRule?.revision ?? 1;
    if (!currentRule || currentRuleId !== line.ruleId || currentRevision !== line.ruleRevision || !currentRule.enabled) {
      throw new B2BOrderError("Prices changed while you were checking out. Refresh and try again.", 409, "QUOTE_STALE");
    }
  }

  const rate = await getUsdIdrRate();
  const totalUSDCents = Math.ceil((payload.totalIDR / rate.usdIdrRate) * 100);
  const orderNumber = `B2B-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
  const tier = ownerTier;

  const order = existing ?? await prisma.$transaction(async (tx) => {
    const created = await tx.b2BOrder.create({
      data: {
        orderNumber,
        organizationId: params.organizationId,
        createdByUserId: authenticatedUser.dbUserId,
        paymentMethod: params.paymentMethod,
        status: "DRAFT",
        idempotencyKey: params.idempotencyKey,
        requestFingerprint: fingerprint,
        deliveryEmail,
        quotedAt: new Date(),
        quoteExpiresAt: new Date(payload.exp),
        subtotalIDR: BigInt(payload.totalIDR),
        totalIDR: BigInt(payload.totalIDR),
        totalUSDCents: BigInt(totalUSDCents),
        usdIdrRate: new Prisma.Decimal(rate.usdIdrRate),
        fxSource: rate.source,
        fxQuotedAt: new Date(),
        lines: {
          create: payload.lines.map((line) => ({
            variantId: line.variantId,
            supplierSku: line.supplierSku,
            supplierCountryCode: line.countryCode,
            productName: line.productName,
            variantName: line.variantName,
            quantity: line.quantity,
            unitPriceIDR: BigInt(line.unitPriceIDR),
            totalPriceIDR: BigInt(line.unitPriceIDR * line.quantity),
            supplierCostIDR: BigInt(line.supplierCostIDR),
            resellerTier: tier,
            pricingRuleRevision: line.ruleRevision,
            pricingRuleId: line.ruleId,
            pricingMode: line.mode,
            markupMicros: line.markupMicros,
            fixedPriceIDR: line.fixedPriceIDR === null ? null : BigInt(line.fixedPriceIDR),
          })),
        },
        paymentIntent: {
          create: {
            provider: params.paymentMethod === "CRYPTO" ? "cryptomus" : "pakasir",
            status: "PENDING",
            expiresAt: new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60_000),
            amountIDR: BigInt(payload.totalIDR),
            amountUSDCents: BigInt(totalUSDCents),
            currency: params.paymentMethod === "CRYPTO" ? "USD" : "IDR",
            usdIdrRate: new Prisma.Decimal(rate.usdIdrRate),
            fxSource: rate.source,
          },
        },
      },
      include: { lines: true },
    });
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  // Provider invoices happen outside the DB transaction; failures leave a healable DRAFT.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  if (!appUrl) throw new B2BOrderError("Checkout is not configured.", 503, "CONFIG_MISSING");

  let paymentUrl: string;
  let providerPaymentId: string;
  if (params.paymentMethod === "CRYPTO") {
    const invoice = await createPaymentInvoice({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountUSD: totalUSDCents / 100,
      description: `EZTopUp B2B ${order.orderNumber}`,
      callbackUrl: `${appUrl}/api/payment/b2b/webhook`,
      successUrl: appUrl,
      cancelUrl: appUrl,
    });
    paymentUrl = invoice.paymentUrl;
    providerPaymentId = invoice.providerPaymentId;
  } else {
    const payment = await createPakasirPayment({
      orderId: order.id,
      amountIDR: payload.totalIDR,
      redirectUrl: appUrl,
      appUrl,
    });
    paymentUrl = payment.paymentUrl;
    providerPaymentId = payment.txnId;
  }

  const provider = params.paymentMethod === "CRYPTO" ? "cryptomus" : "pakasir";
  await prisma.$transaction([
    prisma.b2BPaymentIntent.update({
      where: { orderId: order.id },
      data: { provider, providerPaymentId, providerInvoiceId: providerPaymentId, paymentUrl },
    }),
    prisma.b2BOrder.update({
      where: { id: order.id },
      data: { status: "PAYMENT_PENDING", paymentUrl, paymentProvider: provider, paymentProviderPaymentId: providerPaymentId },
    }),
  ]);
  const fresh = await prisma.b2BOrder.findUniqueOrThrow({ where: { id: order.id }, include: { lines: true, paymentIntent: { select: { expiresAt: true } } } });
  return { order: publicOrder(fresh), reused: Boolean(existing) };
}

export async function applyB2BPaymentEvent(params: {
  provider: "cryptomus" | "pakasir";
  providerPaymentId: string;
  eventId: string;
  normalizedStatus: string;
  raw: unknown;
}) {
  const intent = await prisma.b2BPaymentIntent.findFirst({
    where: { provider: params.provider, providerPaymentId: params.providerPaymentId },
  });
  if (!intent) return { applied: false, reason: "INTENT_NOT_FOUND" as const };

  try {
    await prisma.b2BPaymentEvent.create({
      data: {
        provider: params.provider,
        eventId: params.eventId,
        paymentIntentId: intent.id,
        normalizedStatus: mapNormalizedStatus(params.normalizedStatus),
        payload: (params.raw ?? null) as never,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { applied: false, reason: "DUPLICATE" as const };
    }
    throw error;
  }

  const next = mapNormalizedStatus(params.normalizedStatus);
  if (next === "PAID" && intent.status === "EXPIRED") {
    await prisma.b2BPaymentIntent.updateMany({ where: { id: intent.id, status: "EXPIRED" }, data: { status: "REVIEW" } });
    await prisma.b2BOrder.updateMany({
      where: { id: intent.orderId, status: "CANCELLED" },
      data: { status: "MANUAL_REVIEW", manualReviewReason: "Payment received after the 10-minute window closed; reconcile with the buyer." },
    });
    return { applied: true, reason: "LATE_PAYMENT_REVIEW" as const };
  }
  if (!canAdvanceIntent(intent.status, next)) return { applied: false, reason: "STALE" as const };

  const updated = await prisma.b2BPaymentIntent.updateMany({
    where: { id: intent.id, status: intent.status },
    data: { status: next, paidAt: next === "PAID" ? new Date() : null },
  });
  if (!updated.count) return { applied: false, reason: "RACE" as const };

  if (next === "PAID") {
    await prisma.b2BOrder.updateMany({
      where: { id: intent.orderId, status: { in: ["DRAFT", "PAYMENT_PENDING"] } },
      data: { status: "PAID", paidAt: new Date() },
    });
    await fulfillB2BOrder(intent.orderId);
  } else if (next === "FAILED" || next === "EXPIRED") {
    await prisma.b2BOrder.updateMany({
      where: { id: intent.orderId, status: { in: ["DRAFT", "PAYMENT_PENDING"] } },
      data: { status: next === "FAILED" ? "PAYMENT_FAILED" : "CANCELLED" },
    });
  }
  await prisma.b2BPaymentEvent.updateMany({
    where: { provider: params.provider, eventId: params.eventId },
    data: { processedAt: new Date() },
  });
  return { applied: true };
}

/**
 * Provisional inline fulfillment for the controlled rollout. Any ambiguity or
 * partial result parks the order in MANUAL_REVIEW; nothing is auto-refunded.
 */
async function claimFulfillment(orderId: string) {
  const now = new Date();
  const claimed = await prisma.b2BOrder.updateMany({
    where: {
      id: orderId,
      fulfillmentAttempts: { lt: MAX_FULFILLMENT_ATTEMPTS },
      OR: [
        { status: "PAID" },
        { status: "PROCESSING", fulfillmentLeaseUntil: { lt: now } },
      ],
    },
    data: {
      status: "PROCESSING",
      fulfillmentLeaseUntil: new Date(now.getTime() + FULFILLMENT_LEASE_MINUTES * 60_000),
      fulfillmentAttempts: { increment: 1 },
    },
  });
  return claimed.count > 0;
}

export async function fulfillB2BOrder(orderId: string) {
  if (!(await claimFulfillment(orderId))) return { claimed: false };

  const order = await prisma.b2BOrder.findUnique({
    where: { id: orderId },
    include: { lines: true, createdByUser: { select: { email: true } } },
  });
  if (!order) return { claimed: true, completed: false };

  const failures: string[] = [];
  for (const [index, line] of order.lines.entries()) {
    try {
      const submitted = await createSupplierOrder({
        orderNumber: `${order.orderNumber}-${index + 1}`,
        productCode: line.supplierSku,
        quantity: line.quantity,
        unitPriceIDR: Number(line.supplierCostIDR),
        countryCode: line.supplierCountryCode,
      });
      const snapshot = await getSupplierOrderStatus({ tid: submitted.tid }).catch(() => null);
      const status = snapshot?.status?.trim().toLowerCase() ?? "accepted";
      const fulfilled = status === "success";
      if (!fulfilled) failures.push(`${line.supplierSku}:${status}`);
      await prisma.b2BOrderLine.update({
        where: { id: line.id },
        data: {
          supplierTid: submitted.tid,
          supplierStatus: status,
          status: fulfilled ? "FULFILLED" : "REVIEW",
          supplierRaw: {
            submit: submitted.raw ?? null,
            snapshot: snapshot?.raw ?? null,
            voucherCodes: fulfilled ? snapshot?.voucherCodes ?? [] : [],
          } as never,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 140) : "submit_failed";
      failures.push(`${line.supplierSku}:${message}`);
      await prisma.b2BOrderLine.update({ where: { id: line.id }, data: { status: "REVIEW" } }).catch(() => {});
    }
  }

  if (failures.length) {
    await prisma.b2BOrder.update({
      where: { id: orderId },
      data: {
        status: "MANUAL_REVIEW",
        supplierStatus: "review",
        manualReviewReason: failures.join("; ").slice(0, 500),
        fulfillmentLeaseUntil: null,
        lastReconciledAt: new Date(),
      },
    });
    return { claimed: true, completed: false };
  }
  await prisma.b2BOrder.update({
    where: { id: orderId },
    data: { status: "COMPLETED", supplierStatus: "fulfilled", fulfillmentLeaseUntil: null, lastReconciledAt: new Date() },
  });

  // Vouchers are delivered by email only: one standard order-details Excel per order.
  const recipient = order.deliveryEmail || order.createdByUser?.email || null;
  if (recipient) {
    const completed = await prisma.b2BOrder.findUnique({
      where: { id: orderId },
      include: { lines: true, organization: { select: { slug: true } } },
    });
    if (completed) {
      const lines = completed.lines.map((line) => {
        const raw = (line.supplierRaw ?? {}) as { voucherCodes?: string[] };
        return {
          productName: line.variantName,
          quantity: line.quantity,
          supplierTid: line.supplierTid,
          codes: raw.voucherCodes ?? [],
        };
      });
      const attachmentName = orderDetailsFilename(completed.orderNumber);
      const attachmentBase64 = buildOrderDetailsWorkbook({
        reference: completed.organization.slug,
        orderNumber: completed.orderNumber,
        lines,
      });
      const result = await sendB2BDeliveryEmail({
        to: recipient,
        orderNumber: completed.orderNumber,
        attachmentBase64,
        attachmentName,
        voucherCount: lines.reduce((sum, line) => sum + Math.max(1, line.codes.length), 0),
      });
      if (!result.sent) console.warn("[b2b-order] voucher email was not sent", result.error);
    }
  } else {
    console.warn("[b2b-order] no delivery email found for order", order.orderNumber);
  }
  return { claimed: true, completed: true };
}

/** Sweeps expired intents, exhausted leases, and paid-but-unclaimed orders. */
export async function reconcileB2BOrders() {
  const now = new Date();
  const expirable = await prisma.b2BPaymentIntent.findMany({
    where: { status: "PENDING", expiresAt: { lt: now } },
    select: { id: true, orderId: true },
    take: 50,
  });
  let expired = 0;
  for (const intent of expirable) {
    const updated = await prisma.b2BPaymentIntent.updateMany({
      where: { id: intent.id, status: "PENDING" },
      data: { status: "EXPIRED" },
    });
    if (updated.count) {
      expired += 1;
      await prisma.b2BOrder.updateMany({
        where: { id: intent.orderId, status: { in: ["DRAFT", "PAYMENT_PENDING"] } },
        data: { status: "CANCELLED" },
      });
    }
  }

  const stuck = await prisma.b2BOrder.updateMany({
    where: {
      status: "PROCESSING",
      fulfillmentLeaseUntil: { lt: now },
      fulfillmentAttempts: { gte: MAX_FULFILLMENT_ATTEMPTS },
    },
    data: {
      status: "MANUAL_REVIEW",
      supplierStatus: "review",
      manualReviewReason: "Fulfillment retries exhausted; reconcile with the supplier dashboard.",
    },
  });

  const unclaimed = await prisma.b2BOrder.findMany({
    where: { status: "PAID", paidAt: { lt: new Date(now.getTime() - 60_000) } },
    select: { id: true },
    orderBy: { paidAt: "asc" },
    take: 10,
  });
  let retried = 0;
  for (const order of unclaimed) {
    const result = await fulfillB2BOrder(order.id);
    if (result.claimed) retried += 1;
  }
  return { expired, stuck: stuck.count, retried };
}

export async function listAdminB2BOrders(filters: { status?: string; organizationId?: string; q?: string }) {
  const orders = await prisma.b2BOrder.findMany({
    where: {
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
      ...(filters.q ? {
        OR: [
          { orderNumber: { contains: filters.q, mode: "insensitive" as const } },
          { organization: { name: { contains: filters.q, mode: "insensitive" as const } } },
        ],
      } : {}),
    },
    include: {
      organization: { select: { name: true, slug: true } },
      lines: true,
      paymentIntent: { select: { expiresAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return {
    orders: orders.map((order) => ({
      ...publicOrder(order),
      organizationName: order.organization.name,
      organizationSlug: order.organization.slug,
      fulfillmentAttempts: order.fulfillmentAttempts,
      lineDetails: order.lines.map((line) => ({
        id: line.id,
        name: line.variantName,
        supplierSku: line.supplierSku,
        quantity: line.quantity,
        status: line.status,
        supplierTid: line.supplierTid,
        supplierStatus: line.supplierStatus,
      })),
    })),
  };
}

export async function getAdminB2BOrder(orderId: string) {
  const order = await prisma.b2BOrder.findUnique({
    where: { id: orderId },
    include: {
      organization: { select: { id: true, name: true, slug: true, tier: true } },
      lines: true,
      paymentIntent: { include: { events: { orderBy: { createdAt: "desc" }, take: 20 } } },
    },
  });
  if (!order) throw new B2BOrderError("Order not found.", 404, "ORDER_NOT_FOUND");
  return {
    order: {
      ...publicOrder(order),
      organizationId: order.organization.id,
      organizationName: order.organization.name,
      organizationTier: order.organization.tier,
      fulfillmentAttempts: order.fulfillmentAttempts,
      fulfillmentLeaseUntil: order.fulfillmentLeaseUntil?.toISOString() ?? null,
      lastReconciledAt: order.lastReconciledAt?.toISOString() ?? null,
      totalUSDCents: order.totalUSDCents === null ? null : Number(order.totalUSDCents),
      usdIdrRate: order.usdIdrRate === null ? null : Number(order.usdIdrRate),
      paymentIntent: order.paymentIntent ? {
        provider: order.paymentIntent.provider,
        status: order.paymentIntent.status,
        amountIDR: Number(order.paymentIntent.amountIDR),
        providerPaymentId: order.paymentIntent.providerPaymentId,
        expiresAt: order.paymentIntent.expiresAt?.toISOString() ?? null,
        paidAt: order.paymentIntent.paidAt?.toISOString() ?? null,
        events: order.paymentIntent.events.map((event) => ({
          provider: event.provider,
          eventId: event.eventId,
          normalizedStatus: event.normalizedStatus,
          processedAt: event.processedAt?.toISOString() ?? null,
          createdAt: event.createdAt.toISOString(),
        })),
      } : null,
      lineDetails: order.lines.map((line) => ({
        id: line.id,
        name: line.variantName,
        supplierSku: line.supplierSku,
        supplierCountryCode: line.supplierCountryCode,
        quantity: line.quantity,
        unitPriceIDR: Number(line.unitPriceIDR),
        supplierCostIDR: Number(line.supplierCostIDR),
        pricingRuleRevision: line.pricingRuleRevision,
        pricingMode: line.pricingMode,
        status: line.status,
        supplierTid: line.supplierTid,
        supplierStatus: line.supplierStatus,
      })),
    },
  };
}

export async function adminRetryFulfillment(orderId: string) {
  const order = await prisma.b2BOrder.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!order) throw new B2BOrderError("Order not found.", 404, "ORDER_NOT_FOUND");
  if (!["PAID", "PROCESSING", "MANUAL_REVIEW"].includes(order.status)) {
    throw new B2BOrderError("This order cannot be re-submitted to the supplier.", 409, "RETRY_NOT_ALLOWED");
  }
  await prisma.b2BOrderLine.updateMany({ where: { orderId, status: "REVIEW" }, data: { status: "PENDING" } });
  await prisma.b2BOrder.update({
    where: { id: orderId },
    data: {
      status: "PAID",
      fulfillmentAttempts: 0,
      fulfillmentLeaseUntil: null,
      manualReviewReason: null,
    },
  });
  return fulfillB2BOrder(orderId);
}

export async function adminSetOrderStatus(orderId: string, next: B2BAdminStatusTarget, note: string | null) {
  const order = await prisma.b2BOrder.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!order) throw new B2BOrderError("Order not found.", 404, "ORDER_NOT_FOUND");
  if (!canAdminOrderTransition(order.status, next)) {
    throw new B2BOrderError(`Cannot move ${order.status} to ${next}.`, 409, "TRANSITION_NOT_ALLOWED");
  }
  await prisma.b2BOrder.update({
    where: { id: orderId },
    data: {
      status: next,
      lastReconciledAt: new Date(),
      ...(note ? { manualReviewReason: note } : {}),
    },
  });
  return { status: next };
}

export async function listB2BOrders(organizationId: string) {
  await requireActiveReseller(organizationId);
  const orders = await prisma.b2BOrder.findMany({
    where: { organizationId },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return { orders: orders.map(publicOrder) };
}

export async function getB2BOrder(organizationId: string, orderId: string) {
  await requireActiveReseller(organizationId);
  const order = await prisma.b2BOrder.findFirst({
    where: { id: orderId, organizationId },
    include: { lines: true, paymentIntent: { select: { expiresAt: true } } },
  });
  if (!order) throw new B2BOrderError("Order not found.", 404, "ORDER_NOT_FOUND");
  return { order: publicOrder(order) };
}

export function b2bApiError(error: unknown, json: (body: unknown, status?: number) => Response) {
  if (error instanceof B2BOrderError) return json({ error: error.message, code: error.code }, error.status);
  if (error instanceof ResellerPricingError) return json({ error: error.message, code: error.code }, error.status);
  console.error("[b2b-order]", error instanceof Error ? error.message : error);
  return json({ error: "Something went wrong. Please try again." }, 503);
}
