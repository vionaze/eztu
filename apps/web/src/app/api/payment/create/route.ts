/**
 * POST /api/payment/create
 *
 * Creates a new order and a Cryptomus or Pakasir hosted payment.
 * Returns the payment URL for client-side redirect.
 */

import { NextRequest, NextResponse } from "next/server";
import { isPakasirCheckoutEnabled } from "@kupon/payments";
import { prisma } from "@kupon/db";
import { getCryptoMinimumQuantity, CRYPTO_MINIMUM_IDR, CRYPTO_MINIMUM_USD_CENTS, MAX_SELF_SERVICE_QUANTITY } from "@/lib/checkout-limits";
import { createCheckoutOrder } from "@/lib/checkout-order";
import {
  evaluateCheckoutBodyTampering,
  evaluateCheckoutFraud,
  notifySecurityEvent,
  recordUserSecurityContext,
  type FraudSeverity,
} from "@/lib/fraud";
import { findActiveAccessBlock } from "@/lib/access-block";
import {
  AccountBannedError,
  AuthenticationRequiredError,
  requireClerkUser,
} from "@/lib/clerk";
import {
  createPricingQuote,
  getUsdIdrRate,
  signPricingQuote,
  verifyPricingQuote,
} from "@/lib/fx";
import { usdCentsToAmount } from "@/lib/money";
import { getFreshVariantPricing } from "@/lib/supplier-pricing";
import {
  getDetectedMarketCode,
  isProductExcludedFromMarket,
} from "@/lib/product-availability";

function getPaymentErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Failed to create payment";
  }

  if (error.message.includes("Cryptomus API error: 401") || error.message.includes("Cryptomus API error: 403")) {
    return "Cryptomus rejected the merchant credentials. Check CRYPTOMUS_MERCHANT_ID and CRYPTOMUS_PAYMENT_API_KEY.";
  }

  if (error.message.includes("CRYPTOMUS_PAYMENT_API_KEY") || error.message.includes("CRYPTOMUS_API_KEY")) {
    return "Cryptomus payment API key is not configured.";
  }

  if (error.message.includes("CRYPTOMUS_MERCHANT_ID")) {
    return "Cryptomus merchant ID is not configured.";
  }

  if (error.message.includes("CRYPTOMUS_API_URL")) {
    return "Cryptomus API URL is invalid.";
  }

  if (error.message.includes("Pakasir") || error.message.includes("PAKASIR_")) {
    return "Pakasir checkout is temporarily unavailable. Please choose crypto or try again.";
  }

  return "Failed to create payment";
}

function getHighestSeverity(severities: FraudSeverity[]): FraudSeverity {
  if (severities.includes("high")) return "high";
  if (severities.includes("medium")) return "medium";
  return "low";
}

function parseCheckoutQuantity(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return 1;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    const variantId = typeof body.variantId === "string" ? body.variantId.trim() : "";
    const gameId = typeof body.gameId === "string" ? body.gameId.trim() : "voucher";
    const serverId = typeof body.serverId === "string" ? body.serverId.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const quantity = parseCheckoutQuantity(body.quantity);
    const company = typeof body.company === "string" ? body.company.trim() : "";
    const checkoutStartedAt =
      typeof body.checkoutStartedAt === "number" ? body.checkoutStartedAt : null;
    const quoteToken =
      typeof body.quoteToken === "string" ? body.quoteToken.trim() : "";
    const paymentMethod =
      body.paymentMethod === "crypto" || body.paymentMethod === "pakasir"
        ? body.paymentMethod
        : null;
    const marketCode =
      typeof body.marketCode === "string"
        ? body.marketCode.trim().toLowerCase()
        : "";
    const fraudAssessment = evaluateCheckoutFraud(request, {
      productId,
      variantId,
      gameId,
      serverId,
      email,
      company,
      checkoutStartedAt,
      clientSubtotalIDR: body.subtotalIDR,
      clientSubtotalUSD: body.subtotalUSD,
      clientTotalIDR: body.totalIDR,
      clientTotalUSD: body.totalUSD,
      clientQuantity: body.quantity,
    });
    const tamperingAssessment = evaluateCheckoutBodyTampering(body);
    const shouldAlert =
      fraudAssessment.shouldAlert || tamperingAssessment.shouldAlert;
    const blocked = fraudAssessment.blocked || tamperingAssessment.blocked;
    const severity = getHighestSeverity([
      fraudAssessment.severity,
      tamperingAssessment.severity,
    ]);
    const reasons = [
      ...fraudAssessment.reasons,
      ...tamperingAssessment.reasons,
    ];

    // Preventive admin ban (email / IP) — before heavier processing
    const requestCtx = fraudAssessment.context;
    const accessBlock = await findActiveAccessBlock({
      email: email || null,
      ip: requestCtx.ip,
    });
    if (accessBlock) {
      await notifySecurityEvent({
        eventType: "checkout_create",
        severity: "high",
        action: "blocked",
        reasons: [
          `ACCESS_BLOCKED: ${accessBlock.kind}=${accessBlock.value}`,
          accessBlock.reason || "Admin access block",
        ],
        requestContext: requestCtx,
        email,
        productId,
        variantId,
      });

      return NextResponse.json(
        { error: "Checkout is not available for this account. Contact support." },
        { status: 403 }
      );
    }

    if (blocked) {
      // Only alert when we actually block (hard signals) or high severity
      await notifySecurityEvent({
        eventType: "checkout_create",
        severity,
        action: "blocked",
        reasons,
        requestContext: fraudAssessment.context,
        email,
        productId,
        variantId,
      });

      return NextResponse.json(
        { error: "Checkout could not be processed. Please contact support." },
        { status: 403 }
      );
    }

    // Validation
    if (!productId || !variantId || !email || !quoteToken) {
      return NextResponse.json(
        { error: "A fresh pricing quote is required. Please refresh the price." },
        { status: 400 }
      );
    }

    if (!paymentMethod) {
      return NextResponse.json(
        { error: "Please choose Crypto or Pakasir as your payment method." },
        { status: 400 },
      );
    }

    if (
      quantity === null ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      quantity > MAX_SELF_SERVICE_QUANTITY
    ) {
      return NextResponse.json(
        {
          error: `Quantity must be between 1 and ${MAX_SELF_SERVICE_QUANTITY}.`,
        },
        { status: 400 }
      );
    }

    let authenticatedUser;
    try {
      authenticatedUser = await requireClerkUser();
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        return NextResponse.json(
          { error: "Please log in before checkout." },
          { status: 401 }
        );
      }
      if (error instanceof AccountBannedError) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }

      console.error("[Payment Auth]", error);
      return NextResponse.json(
        { error: "Unable to verify your login. Please try again." },
        { status: 500 }
      );
    }

    // Fetch product & variant
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });

    if (
      !variant ||
      !variant.published ||
      !variant.product.published ||
      variant.productId !== productId
    ) {
      return NextResponse.json(
        { error: "Product or variant not found" },
        { status: 404 }
      );
    }
    const detectedMarketCode = getDetectedMarketCode(request.headers);
    if (
      isProductExcludedFromMarket(variant.product, marketCode) ||
      isProductExcludedFromMarket(variant.product, detectedMarketCode)
    ) {
      return NextResponse.json(
        { error: "Product is not available in this market" },
        { status: 404 },
      );
    }

    let freshPricing;
    try {
      freshPricing = await getFreshVariantPricing(variant, paymentMethod);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "The supplier price is temporarily unavailable.",
          code: "SUPPLIER_PRICE_UNAVAILABLE",
        },
        { status: 503 },
      );
    }

    let quote;
    try {
      quote = verifyPricingQuote(quoteToken, {
        variantId: variant.id,
        quantity,
        paymentMethod,
        supplierCostIDR: freshPricing.supplierCostIDR,
        supplierCountryCode: freshPricing.countryCode,
        pricingMarkupBps: freshPricing.markupBps,
        unitPriceIDR: freshPricing.unitPriceIDR,
      });
    } catch (error) {
      const isExpired =
        error instanceof Error && error.message.includes("expired");
      const rate = await getUsdIdrRate();
      const replacementQuantity = paymentMethod === "crypto"
        ? Math.max(quantity, getCryptoMinimumQuantity(freshPricing.unitPriceIDR, rate.usdIdrRate))
        : quantity;
      if (replacementQuantity > MAX_SELF_SERVICE_QUANTITY) {
        return NextResponse.json(
          { error: "This SKU needs more than 20 units to reach the crypto minimum. Choose Pakasir or contact sales.", code: "CRYPTO_MINIMUM_EXCEEDS_LIMIT" },
          { status: 400 },
        );
      }
      const replacementQuote = createPricingQuote({
        variantId: variant.id,
        quantity: replacementQuantity,
        paymentMethod,
        supplierCostIDR: freshPricing.supplierCostIDR,
        supplierCountryCode: freshPricing.countryCode,
        pricingMarkupBps: freshPricing.markupBps,
        unitPriceIDR: freshPricing.unitPriceIDR,
        rate,
      });
      return NextResponse.json(
        {
          error: isExpired
            ? "The price quote expired. Please confirm the refreshed price."
            : "The supplier price changed. Please confirm the refreshed price.",
          code: isExpired ? "QUOTE_EXPIRED" : "PRICE_CHANGED",
          quote: {
            quantity: replacementQuote.quantity,
            quoteToken: signPricingQuote(replacementQuote),
            paymentMethod,
            unitPriceIDR: replacementQuote.unitPriceIDR,
            totalIDR: replacementQuote.totalIDR,
            totalUSDCents: replacementQuote.totalUSDCents,
            totalUSD: usdCentsToAmount(replacementQuote.totalUSDCents).toFixed(2),
            usdIdrRate: replacementQuote.usdIdrRate,
            fxSource: replacementQuote.fxSource,
            quotedAt: replacementQuote.quotedAt,
            expiresAt: replacementQuote.expiresAt,
            supplierPriceVerifiedAt: freshPricing.verifiedAt.toISOString(),
          },
        },
        { status: 409 }
      );
    }

    if (
      paymentMethod === "crypto" && quote.totalUSDCents > 0 &&
      (quote.totalIDR < CRYPTO_MINIMUM_IDR || quote.totalUSDCents < CRYPTO_MINIMUM_USD_CENTS)
    ) {
      return NextResponse.json(
        { error: "Crypto requires at least Rp45,000 and $2.50. Refresh the price to adjust quantity before paying.", code: "CRYPTO_MINIMUM_NOT_MET" },
        { status: 400 },
      );
    }

    // Enforce top-up account fields from product config (server-side)
    if (variant.product.fulfillmentType === "TOP_UP") {
      if (!gameId || gameId === "voucher") {
        return NextResponse.json(
          {
            error: `Please enter your ${variant.product.gameIdLabel || "User ID"}.`,
          },
          { status: 400 }
        );
      }
      if (variant.product.requiresServerId && !serverId) {
        return NextResponse.json(
          {
            error: `Please enter your ${variant.product.serverIdLabel || "Zone / Server ID"}.`,
          },
          { status: 400 }
        );
      }
    }

    // Soft flags after successful auth: only persist high-severity (Discord gated inside notify)
    if (shouldAlert && severity === "high") {
      await notifySecurityEvent({
        eventType: "checkout_create",
        severity,
        action: "flagged",
        reasons,
        requestContext: fraudAssessment.context,
        email,
        productId,
        variantId,
        product: variant.product.name,
        variant: variant.name,
        userId: authenticatedUser.dbUserId,
        clerkUserId: authenticatedUser.clerkUserId,
        metadata: {
          submittedFields: Object.keys(body).sort(),
        },
      });
    }

    await recordUserSecurityContext(authenticatedUser.dbUser, fraudAssessment.context, {
      email,
      productId,
      variantId,
      product: variant.product.name,
      variant: variant.name,
      userId: authenticatedUser.dbUserId,
      clerkUserId: authenticatedUser.clerkUserId,
    });

    if (quote.totalUSDCents > 0 && paymentMethod === "pakasir" && !isPakasirCheckoutEnabled()) {
      return NextResponse.json({ error: "Pakasir is currently unavailable. Please choose Crypto." }, { status: 503 });
    }
    return NextResponse.json(await createCheckoutOrder({
      userId: authenticatedUser.dbUserId, email, gameId, serverId, productId,
      variantId, quantity, paymentMethod, quote, freshPricing, variant,
    }));
  } catch (error) {
    console.error("[Payment Create]", error);
    return NextResponse.json(
      { error: getPaymentErrorMessage(error) },
      { status: 500 }
    );
  }
}
