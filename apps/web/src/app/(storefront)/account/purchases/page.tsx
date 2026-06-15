import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@kupon/db";
import {
  AuthenticationRequiredError,
  requireClerkUser,
} from "@/lib/clerk";
import { resolvePaymentExpiresAt } from "@/lib/payment-expiry";
import PurchaseHistoryClient, {
  type PurchaseHistoryOrder,
} from "./PurchaseHistoryClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Purchase History",
  description: "View your EZTopUp purchase history and voucher delivery details.",
};

function toIsoString(value: Date | null) {
  return value ? value.toISOString() : null;
}

export default async function PurchaseHistoryPage() {
  let authenticatedUser;

  try {
    authenticatedUser = await requireClerkUser();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/login?redirect_url=/account/purchases");
    }

    throw error;
  }

  const orders = await prisma.order.findMany({
    where: { userId: authenticatedUser.dbUserId },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: {
          product: true,
          variant: true,
        },
      },
      supplierOrder: true,
      promoCode: true,
    },
  });

  const purchaseOrders: PurchaseHistoryOrder[] = orders.map((order) => {
    const expiresAt =
      order.status === "PENDING"
        ? resolvePaymentExpiresAt({
            explicitExpiresAt: order.expiresAt,
            createdAt: order.createdAt,
          })
        : order.expiresAt;

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      email: order.email,
      gameId: order.gameId,
      serverId: order.serverId,
      subtotalIDR: order.subtotalIDR,
      subtotalUSD: order.subtotalUSD,
      discountIDR: order.discountIDR,
      discountUSD: order.discountUSD,
      totalIDR: order.totalIDR,
      totalUSD: order.totalUSD,
      status: order.status,
      paymentProvider: order.paymentProvider,
      paymentProviderPaymentId: order.paymentProviderPaymentId,
      paymentProviderInvoiceId: order.paymentProviderInvoiceId,
      paymentProviderTxHash: order.paymentProviderTxHash,
      paymentCurrency: order.paymentCurrency,
      paymentUrl: order.paymentUrl,
      paidAt: toIsoString(order.paidAt),
      expiresAt: toIsoString(expiresAt),
      createdAt: order.createdAt.toISOString(),
      promoCode: order.promoCode
        ? {
            code: order.promoCode.code,
          }
        : null,
      supplierOrder: order.supplierOrder
        ? {
            provider: order.supplierOrder.provider,
            providerOrderId: order.supplierOrder.providerOrderId,
            status: order.supplierOrder.status,
            voucherCode: order.supplierOrder.voucherCode,
            voucherPin: order.supplierOrder.voucherPin,
            fulfilledAt: toIsoString(order.supplierOrder.fulfilledAt),
          }
        : null,
      items: order.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        priceIDR: item.priceIDR,
        priceUSD: item.priceUSD,
        product: {
          name: item.product.name,
        },
        variant: {
          name: item.variant.name,
        },
      })),
    };
  });

  return (
    <PurchaseHistoryClient
      accountEmail={authenticatedUser.email}
      orders={purchaseOrders}
    />
  );
}
