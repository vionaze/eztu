/**
 * POST /api/payment/create
 *
 * Creates a new order and generates a NOWPayments crypto invoice.
 * Returns the payment URL for client-side redirect.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@kupon/db";
import { createPaymentInvoice } from "@kupon/payments";
import { sendOrderNotification } from "@/lib/telegram";
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

  if (error.message.includes("NOWPayments API error: 403")) {
    return "NOWPayments rejected the API key. Use sandbox credentials for sandbox mode.";
  }

  if (error.message.includes("NOWPAYMENTS_API_KEY")) {
    return "NOWPayments API key is not configured.";
  }

  if (error.message.includes("NOWPAYMENTS_API_URL")) {
    return "NOWPayments API URL is invalid.";
  }

  return "Failed to create payment";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    const variantId = typeof body.variantId === "string" ? body.variantId.trim() : "";
    const gameId = typeof body.gameId === "string" ? body.gameId.trim() : "voucher";
    const serverId = typeof body.serverId === "string" ? body.serverId.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    // Validation
    if (!productId || !variantId || !email) {
      return NextResponse.json(
        { error: "Missing required fields: productId, variantId, email" },
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

    const totalIDR = variant.priceIDR;
    const totalUSD = variant.priceUSD;
    const isFree = totalUSD <= 0;

    // Create order
    const orderNumber = generateOrderNumber();
    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: authenticatedUser.dbUserId,
        email,
        gameId,
        serverId: serverId || null,
        subtotalIDR: variant.priceIDR,
        subtotalUSD: variant.priceUSD,
        discountIDR: 0,
        discountUSD: 0,
        totalIDR,
        totalUSD,
        promoCodeId: null,
        status: isFree ? "PAID" : "PENDING",
        paidAt: isFree ? new Date() : null,
        items: {
          create: {
            productId,
            variantId,
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
      });

      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentProvider: invoice.provider,
          paymentProviderPaymentId: invoice.providerPaymentId,
          paymentProviderInvoiceId: invoice.providerInvoiceId,
          paymentCurrency: invoice.payCurrency,
          paymentUrl: invoice.paymentUrl,
          expiresAt: invoice.expiresAt,
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
