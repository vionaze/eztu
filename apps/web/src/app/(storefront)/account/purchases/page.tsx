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

function mapOrdersToPurchaseHistory(
  orders: Awaited<ReturnType<typeof loadOrders>>
): PurchaseHistoryOrder[] {
  return orders.map((order) => {
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
      actualPaidUSDCents: order.actualPaidUSDCents,
      underpaidUSDCents: order.underpaidUSDCents,
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
      fulfillment: order.supplierOrder
        ? {
            status: order.supplierOrder.status,
            voucherCode: order.supplierOrder.voucherCode,
            voucherPin: order.supplierOrder.voucherPin,
            fulfilledAt: toIsoString(order.supplierOrder.fulfilledAt),
          }
        : null,
      items: order.items
        .filter((item) => item.product && item.variant)
        .map((item) => ({
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
}

async function loadOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
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
}

export default async function PurchaseHistoryPage() {
  let accountEmail: string | null = null;
  let purchaseOrders: PurchaseHistoryOrder[] = [];

  try {
    let authenticatedUser;
    try {
      authenticatedUser = await requireClerkUser();
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        redirect("/login?redirect_url=/account/purchases");
      }
      console.error("[PurchaseHistory] auth/sync failed", error);
      // Authenticated session may exist but DB sync failed — still show empty shell
      return (
        <PurchaseHistoryClient accountEmail={null} orders={[]} />
      );
    }

    accountEmail = authenticatedUser.email;

    try {
      const orders = await loadOrders(authenticatedUser.dbUserId);
      purchaseOrders = mapOrdersToPurchaseHistory(orders);
    } catch (error) {
      console.error("[PurchaseHistory] order query failed", error);
      purchaseOrders = [];
    }
  } catch (error) {
    // Never surface a hard 500 for this account page — empty state is preferred.
    console.error("[PurchaseHistory] unexpected failure", error);
    return <PurchaseHistoryClient accountEmail={null} orders={[]} />;
  }

  return (
    <PurchaseHistoryClient
      accountEmail={accountEmail}
      orders={purchaseOrders}
    />
  );
}
