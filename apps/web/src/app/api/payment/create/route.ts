/**
 * POST /api/payment/create
 *
 * Creates a new order and a Cryptomus or Pakasir hosted payment.
 * Returns the payment URL for client-side redirect.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kupon/db";
import {
  createPakasirPaymentUrl,
  createPaymentInvoice,
} from "@kupon/payments";
import { sendOrderNotification } from "@/lib/telegram";
import { writeAppLog } from "@/lib/app-log";
import { MAX_SELF_SERVICE_QUANTITY } from "@/lib/checkout-limits";
import { resolvePaymentExpiresAt } from "@/lib/payment-expiry";
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
import { verifyPricingQuote } from "@/lib/fx";
import { usdCentsToAmount } from "@/lib/money";
import { getPakasirPaymentSettings } from "@/lib/settings";

function generateOrderNumber(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const random = Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  return `KPN-${random}`;
}

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

    if (!variant || variant.productId !== productId) {
      return NextResponse.json(
        { error: "Product or variant not found" },
        { status: 404 }
      );
    }

    let quote;
    try {
      quote = verifyPricingQuote(quoteToken, {
        variantId: variant.id,
        quantity,
        unitPriceIDR: variant.priceIDR,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error && error.message.includes("expired")
              ? "The exchange-rate quote expired. Please refresh the price and try again."
              : "The pricing quote is invalid. Please refresh the page.",
        },
        { status: 409 }
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

    const totalIDR = quote.totalIDR;
    const totalUSDCents = quote.totalUSDCents;
    const totalUSD = usdCentsToAmount(totalUSDCents);
    const isFree = totalUSDCents <= 0;
    const now = new Date();
    if (!isFree && !paymentMethod) {
      return NextResponse.json(
        { error: "Please choose Crypto or Pakasir as your payment method." },
        { status: 400 }
      );
    }
    const pakasirSettings =
      !isFree && paymentMethod === "pakasir"
        ? await getPakasirPaymentSettings()
        : null;
    if (pakasirSettings && !pakasirSettings.effectiveEnabled) {
      return NextResponse.json(
        { error: "Pakasir is currently unavailable. Please choose Crypto." },
        { status: 503 }
      );
    }

    // Create order
    const orderNumber = generateOrderNumber();
    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: authenticatedUser.dbUserId,
        email,
        gameId,
        serverId: serverId || null,
        subtotalIDR: variant.priceIDR * quantity,
        subtotalUSD: totalUSD,
        subtotalUSDCents: totalUSDCents,
        discountIDR: 0,
        discountUSD: 0,
        discountUSDCents: 0,
        totalIDR,
        totalUSD,
        totalUSDCents,
        usdIdrRate: quote.usdIdrRate,
        fxSource: quote.fxSource,
        fxQuotedAt: new Date(quote.quotedAt),
        fxQuoteExpiresAt: new Date(quote.expiresAt),
        promoCodeId: null,
        status: isFree ? "PAID" : "PENDING",
        paymentProvider:
          isFree ? null : paymentMethod === "pakasir" ? "pakasir" : "cryptomus",
        paidAt: isFree ? now : null,
        expiresAt: isFree ? null : resolvePaymentExpiresAt({ createdAt: now }),
        items: {
          create: {
            productId,
            variantId,
            quantity,
            priceIDR: variant.priceIDR,
            priceUSD: totalUSD / quantity,
            priceUSDCents: Math.ceil(totalUSDCents / quantity),
          },
        },
      },
    });

    let paymentUrl: string | null = null;
    let checkout: { type: "redirect"; url: string } | null = null;

    if (!isFree && paymentMethod === "crypto") {
      const invoice = await createPaymentInvoice({
        orderId: order.id,
        orderNumber,
        amountUSD: totalUSD,
        description: `${variant.product.name} - ${variant.name}`,
        customerEmail: email,
        // URLs default to NEXT_PUBLIC_APP_URL inside @kupon/payments when omitted
      });

      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentProvider: invoice.provider,
          paymentProviderPaymentId: invoice.providerPaymentId,
          paymentProviderInvoiceId: invoice.providerInvoiceId,
          paymentCurrency: invoice.payCurrency,
          paymentUrl: invoice.paymentUrl,
          expiresAt: resolvePaymentExpiresAt({
            explicitExpiresAt: invoice.expiresAt,
            createdAt: order.createdAt,
          }),
        },
      });
      paymentUrl = invoice.paymentUrl;
      checkout = { type: "redirect", url: invoice.paymentUrl };
    } else if (!isFree && paymentMethod === "pakasir") {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
      if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is required.");
      const pakasirUrl = createPakasirPaymentUrl({
        orderId: order.id,
        amountIDR: totalIDR,
        redirectUrl: `${appUrl}/order/success?orderId=${encodeURIComponent(order.id)}`,
        appUrl,
      });
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentProvider: "pakasir",
          paymentProviderPaymentId: order.id,
          paymentProviderInvoiceId: order.id,
          paymentCurrency: "IDR",
          paymentUrl: pakasirUrl,
        },
      });
      paymentUrl = pakasirUrl;
      checkout = { type: "redirect", url: pakasirUrl };
    }

    // Send Telegram notification
    await sendOrderNotification({
      orderId: order.id,
      orderNumber,
      product: variant.product.name,
      variant: variant.name,
      gameId,
      amountIDR: totalIDR,
      amountUSD: totalUSD,
      crypto:
        isFree
          ? "FREE/VOUCHER"
          : paymentMethod === "pakasir"
            ? "IDR"
            : "pending",
      status: isFree ? "PAID" : "PENDING",
      email,
    });

    await writeAppLog({
      category: isFree ? "SALES" : "PAYMENT",
      level: isFree ? "SUCCESS" : "INFO",
      title: isFree
        ? `Free/voucher sale ${orderNumber}`
        : `Checkout started ${orderNumber}`,
      message: `${variant.product.name} · ${variant.name} · $${totalUSD.toFixed(2)}`,
      actor: email,
      orderId: order.id,
      route: "/api/payment/create",
      metadata: {
        isFree,
        gameId,
        paymentGateway:
          isFree ? null : paymentMethod === "pakasir" ? "pakasir" : "cryptomus",
      },
    });

    return NextResponse.json({
      orderId: order.id,
      orderNumber,
      paymentUrl: isFree ? `${process.env.NEXT_PUBLIC_APP_URL}/order/success` : paymentUrl,
      checkout,
      paymentMethod: isFree ? "free" : paymentMethod,
      isFree,
    });
  } catch (error) {
    console.error("[Payment Create]", error);
    return NextResponse.json(
      { error: getPaymentErrorMessage(error) },
      { status: 500 }
    );
  }
}
