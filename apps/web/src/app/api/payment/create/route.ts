/**
 * POST /api/payment/create
 *
 * Creates a new order and generates a Cryptomus crypto invoice.
 * Returns the payment URL for client-side redirect.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kupon/db";
import { createPaymentInvoice } from "@kupon/payments";
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
import {
  AuthenticationRequiredError,
  requireClerkUser,
} from "@/lib/clerk";

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

    if (blocked) {
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
    if (!productId || !variantId || !email) {
      return NextResponse.json(
        { error: "Missing required fields: productId, variantId, email" },
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

    if (shouldAlert) {
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

    const totalIDR = variant.priceIDR * quantity;
    const totalUSD = Number((variant.priceUSD * quantity).toFixed(2));
    const isFree = totalUSD <= 0;
    const now = new Date();

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
        subtotalUSD: Number((variant.priceUSD * quantity).toFixed(2)),
        discountIDR: 0,
        discountUSD: 0,
        totalIDR,
        totalUSD,
        promoCodeId: null,
        status: isFree ? "PAID" : "PENDING",
        paidAt: isFree ? now : null,
        expiresAt: isFree ? null : resolvePaymentExpiresAt({ createdAt: now }),
        items: {
          create: {
            productId,
            variantId,
            quantity,
            priceIDR: variant.priceIDR,
            priceUSD: variant.priceUSD,
          },
        },
      },
    });

    let paymentUrl = null;

    if (!isFree) {
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
      crypto: isFree ? "FREE/VOUCHER" : "pending",
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
      metadata: { isFree, gameId },
    });

    return NextResponse.json({
      orderId: order.id,
      orderNumber,
      paymentUrl: isFree ? `${process.env.NEXT_PUBLIC_APP_URL}/order/success` : paymentUrl,
      isFree
    });
  } catch (error) {
    console.error("[Payment Create]", error);
    return NextResponse.json(
      { error: getPaymentErrorMessage(error) },
      { status: 500 }
    );
  }
}
