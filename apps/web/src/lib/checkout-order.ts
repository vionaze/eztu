import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@kupon/db";
import { createPakasirPaymentUrl, createPaymentInvoice, isPakasirCheckoutEnabled } from "@kupon/payments";
import { sendOrderNotification } from "@/lib/telegram";
import { writeAppLog } from "@/lib/app-log";
import { resolvePaymentExpiresAt } from "@/lib/payment-expiry";
import { usdCentsToAmount } from "@/lib/money";
import type { PricingQuote } from "@/lib/fx";
import type { getFreshVariantPricing } from "@/lib/supplier-pricing";

function telegramReturnUrl() {
  const username = process.env.TELEGRAM_SHOP_BOT_USERNAME?.replace(/^@/, "");
  if (!username || !/^[A-Za-z0-9_]+$/.test(username)) throw new Error("Telegram shop username is not configured");
  return `https://t.me/${username}?start=orders`;
}

function generateOrderNumber(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const random = Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  return `KPN-${random}`;
}

// Called only after channel-specific authentication, availability and quote verification.
export async function createCheckoutOrder(params: {
  userId: string;
  email: string;
  gameId: string;
  serverId: string;
  productId: string;
  variantId: string;
  quantity: number;
  paymentMethod: "crypto" | "pakasir";
  quote: PricingQuote;
  freshPricing: Awaited<ReturnType<typeof getFreshVariantPricing>>;
  variant: { name: string; product: { name: string } };
  orderId?: string;
  telegramChatId?: string;
}) {
  const { userId, email, gameId, serverId, productId, variantId, quantity,
    paymentMethod, quote, freshPricing, variant, orderId } = params;
  const telegramChatId = params.telegramChatId || null;
  const totalIDR = quote.totalIDR;
  const totalUSDCents = quote.totalUSDCents;
  const totalUSD = usdCentsToAmount(totalUSDCents);
  const isFree = totalUSDCents <= 0;
  const now = new Date();
  if (
    !isFree &&
    paymentMethod === "pakasir" &&
    !isPakasirCheckoutEnabled()
  ) {
    throw new Error("Pakasir is currently unavailable. Please choose Crypto.");
  }

  if (telegramChatId) telegramReturnUrl();

  // Create order
  const orderNumber = orderId ? `T-${orderId}` : generateOrderNumber();
  const order = await prisma.order.upsert({
    where: { id: orderId || randomUUID() },
    update: {},
    create: {
      orderNumber,
      userId,
      ...(orderId ? { id: orderId } : {}),
      telegramChatId,
      email,
      gameId,
      serverId: serverId || null,
      subtotalIDR: quote.unitPriceIDR * quantity,
      subtotalUSD: totalUSD,
      subtotalUSDCents: totalUSDCents,
      discountIDR: 0,
      discountUSD: 0,
      discountUSDCents: 0,
      totalIDR,
      totalUSD,
      totalUSDCents,
      pricingTier: paymentMethod === "crypto" ? "CRYPTO" : "NON_CRYPTO",
      supplierCountryCode: freshPricing.countryCode,
      supplierCostIDR: freshPricing.supplierCostIDR,
      pricingMarkupBps: freshPricing.markupBps,
      pricingVerifiedAt: freshPricing.verifiedAt,
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
          priceIDR: quote.unitPriceIDR,
          priceUSD: totalUSD / quantity,
          priceUSDCents: Math.ceil(totalUSDCents / quantity),
          supplierCostIDR: freshPricing.supplierCostIDR,
          supplierCountryCode: freshPricing.countryCode,
          pricingMarkupBps: freshPricing.markupBps,
        },
      },
    },
  });

  if (order.userId !== userId || order.telegramChatId !== telegramChatId) {
    throw new Error("Order owner mismatch");
  }
  if (order.paymentUrl) {
    return { orderId: order.id, orderNumber: order.orderNumber, paymentUrl: order.paymentUrl,
      checkout: { type: "redirect" as const, url: order.paymentUrl }, paymentMethod, isFree };
  }
  if (order.totalIDR !== totalIDR || order.totalUSDCents !== totalUSDCents ||
      order.email !== email || order.gameId !== gameId ||
      order.paymentProvider !== (isFree ? null : paymentMethod === "pakasir" ? "pakasir" : "cryptomus")) {
    throw new Error("Order quote mismatch");
  }
  if (order.expiresAt && order.expiresAt <= new Date()) throw new Error("Order expired");
  if (order.status !== "PENDING" && !isFree) throw new Error("Order is no longer payable");
  let paymentUrl: string | null = null;
  let checkout: { type: "redirect"; url: string } | null = null;

  if (!isFree && paymentMethod === "crypto") {
    const invoice = await createPaymentInvoice({
      orderId: order.id,
      orderNumber,
      amountUSD: totalUSD,
      description: `${variant.product.name} - ${variant.name}`,
      customerEmail: email,
      ...(telegramChatId ? { successUrl: telegramReturnUrl(), cancelUrl: telegramReturnUrl() } : {}),
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
      redirectUrl: telegramChatId ? `${appUrl}/api/telegram/shop` : `${appUrl}/order/success?orderId=${encodeURIComponent(order.id)}`,
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

  return {
    orderId: order.id,
    orderNumber,
    paymentUrl: isFree ? `${process.env.NEXT_PUBLIC_APP_URL}/order/success` : paymentUrl,
    checkout,
    paymentMethod: isFree ? "free" : paymentMethod,
    isFree,
  };
}
