export type DiscordFraudSeverity = "low" | "medium" | "high";
export type DiscordFraudAction = "blocked" | "flagged";

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";
const FRAUD_WEBHOOK_URL = process.env.DISCORD_FRAUD_WEBHOOK_URL || WEBHOOK_URL;

interface OrderNotification {
  orderId: string;
  orderNumber: string;
  product: string;
  variant: string;
  gameId: string;
  amountIDR: number;
  amountUSD: number;
  crypto: string;
  paymentGateway: string;
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

interface FraudAlert {
  event: string;
  severity: DiscordFraudSeverity;
  action: DiscordFraudAction;
  reasons: string[];
  ip: string;
  userAgent: string;
  route: string;
  method: string;
  origin?: string;
  referer?: string;
  email?: string;
  productId?: string;
  variantId?: string;
  product?: string;
  variant?: string;
  userId?: string;
  clerkUserId?: string;
  orderId?: string;
  metadata?: Record<string, unknown>;
}

function fmtIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function truncateDiscordValue(value: string, maxLength = 900): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function fraudColor(severity: FraudAlert["severity"]) {
  if (severity === "high") return 0xef4444;
  if (severity === "medium") return 0xf59e0b;
  return 0x3b82f6;
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
            // Sales channel only — paid revenue events (DISCORD_WEBHOOK_URL)
            title: `💰 Sale · ${order.status}`,
            color: order.status === "PAID" || order.status === "COMPLETED" ? 0x22c55e : 0xf59e0b,
            fields: [
              { name: "Order", value: order.orderNumber, inline: true },
              { name: "Product", value: `${order.product} - ${order.variant}`, inline: true },
              {
                name: "Amount",
                value: `${fmtIDR(order.amountIDR)} (~$${order.amountUSD.toFixed(2)})`,
                inline: true,
              },
              {
                name: "Payment Gateway",
                value: order.paymentGateway,
                inline: true,
              },
              { name: "Crypto", value: order.crypto, inline: true },
              { name: "Email", value: order.email, inline: true },
              { name: "Game ID", value: order.gameId || "—", inline: true },
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

function fraudAlertTitle(alert: FraudAlert): string {
  const event = alert.event;

  if (event === "checkout_create" && alert.action === "blocked") {
    return "Checkout blocked";
  }
  if (event.startsWith("supplier_callback")) {
    return "Supplier callback (ops)";
  }
  if (event === "user_context_changed") {
    return "User context change";
  }
  if (event.includes("invalid_token") || event.includes("unauthorized")) {
    return "Auth / token abuse";
  }
  if (alert.action === "blocked") {
    return "Request blocked";
  }
  if (alert.severity === "high") {
    return "Security alert (high)";
  }
  return "Security flag";
}

export async function sendDiscordFraudAlert(
  alert: FraudAlert
): Promise<boolean> {
  if (!FRAUD_WEBHOOK_URL) {
    console.warn("[Discord] Fraud webhook URL not configured");
    return false;
  }

  const fields = [
    { name: "Event", value: alert.event, inline: true },
    { name: "Severity", value: alert.severity.toUpperCase(), inline: true },
    { name: "Action", value: alert.action.toUpperCase(), inline: true },
    { name: "Route", value: `${alert.method} ${alert.route}`, inline: true },
    { name: "IP", value: alert.ip || "unknown", inline: true },
    {
      name: "Product",
      value:
        alert.product && alert.variant
          ? `${alert.product} - ${alert.variant}`
          : `${alert.productId || "-"} / ${alert.variantId || "-"}`,
      inline: false,
    },
    { name: "Email", value: alert.email || "-", inline: true },
    { name: "User ID", value: alert.userId || "-", inline: true },
    { name: "Clerk ID", value: alert.clerkUserId || "-", inline: true },
    { name: "Order ID", value: alert.orderId || "-", inline: true },
    {
      name: "Reasons",
      value: truncateDiscordValue(alert.reasons.join("\n") || "-"),
      inline: false,
    },
    {
      name: "User Agent",
      value: truncateDiscordValue(alert.userAgent || "missing"),
      inline: false,
    },
    {
      name: "Origin",
      value: truncateDiscordValue(alert.origin || "-"),
      inline: true,
    },
    {
      name: "Referer",
      value: truncateDiscordValue(alert.referer || "-"),
      inline: false,
    },
    {
      name: "Metadata",
      value: alert.metadata
        ? truncateDiscordValue(JSON.stringify(alert.metadata, null, 2))
        : "-",
      inline: false,
    },
  ];

  try {
    const response = await fetch(FRAUD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Kupon Security Watch",
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title: fraudAlertTitle(alert),
            color: fraudColor(alert.severity),
            fields,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("[Discord] Failed to send fraud alert:", error);
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
              {
                name: "Payment Gateway",
                value: order.paymentGateway,
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
            title: "Inventory Balance Replenishment Needed",
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
