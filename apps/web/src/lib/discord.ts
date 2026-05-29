const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";

interface OrderNotification {
  orderId: string;
  orderNumber: string;
  product: string;
  variant: string;
  gameId: string;
  amountIDR: number;
  amountUSD: number;
  crypto: string;
  status: string;
  email: string;
}

interface FulfillmentNotification extends OrderNotification {
  supplierStatus: string;
  providerOrderId?: string | null;
}

interface ReplenishmentAlert {
  currentBalanceIDR: number;
  thresholdIDR: number;
  targetBalanceIDR: number;
  requestedAmountIDR: number;
}

function fmtIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export async function sendDiscordOrderNotification(
  order: OrderNotification
): Promise<boolean> {
  if (!WEBHOOK_URL) {
    console.warn("[Discord] Webhook URL not configured");
    return false;
  }

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: `Order ${order.status}`,
            color: order.status === "PAID" ? 0x22c55e : 0xf59e0b,
            fields: [
              { name: "Order", value: order.orderNumber, inline: true },
              { name: "Product", value: `${order.product} - ${order.variant}`, inline: true },
              {
                name: "Amount",
                value: `${fmtIDR(order.amountIDR)} (~$${order.amountUSD.toFixed(2)})`,
                inline: true,
              },
              { name: "Crypto", value: order.crypto, inline: true },
              { name: "Email", value: order.email, inline: true },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("[Discord] Failed to send notification:", error);
    return false;
  }
}

export async function sendDiscordFulfillmentNotification(
  order: FulfillmentNotification
): Promise<boolean> {
  if (!WEBHOOK_URL) {
    console.warn("[Discord] Webhook URL not configured");
    return false;
  }

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: `Voucher ${order.supplierStatus}`,
            color: order.supplierStatus === "FULFILLED" ? 0x22c55e : 0xf59e0b,
            fields: [
              { name: "Order", value: order.orderNumber, inline: true },
              { name: "Product", value: `${order.product} - ${order.variant}`, inline: true },
              { name: "Provider Order", value: order.providerOrderId || "-", inline: true },
              {
                name: "Amount",
                value: `${fmtIDR(order.amountIDR)} (~$${order.amountUSD.toFixed(2)})`,
                inline: true,
              },
              { name: "Email", value: order.email, inline: true },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("[Discord] Failed to send fulfillment notification:", error);
    return false;
  }
}

export async function sendDiscordReplenishmentAlert(
  alert: ReplenishmentAlert
): Promise<boolean> {
  if (!WEBHOOK_URL) {
    console.warn("[Discord] Webhook URL not configured");
    return false;
  }

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: "FlexaGift Balance Replenishment Needed",
            color: 0xf59e0b,
            fields: [
              {
                name: "Current Balance",
                value: fmtIDR(alert.currentBalanceIDR),
                inline: true,
              },
              {
                name: "Threshold",
                value: fmtIDR(alert.thresholdIDR),
                inline: true,
              },
              {
                name: "Top Up Needed",
                value: fmtIDR(alert.requestedAmountIDR),
                inline: true,
              },
              {
                name: "Target Balance",
                value: fmtIDR(alert.targetBalanceIDR),
                inline: true,
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("[Discord] Failed to send replenishment alert:", error);
    return false;
  }
}
