/**
 * Telegram Bot Notifications
 *
 * Sends order notifications to a Telegram chat/group
 * using the Telegram Bot API.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

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

/**
 * Format price as Indonesian Rupiah
 */
function fmtIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Send a formatted order notification to Telegram
 */
export async function sendOrderNotification(
  order: OrderNotification
): Promise<boolean> {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn("[Telegram] Bot token or chat ID not configured");
    return false;
  }

  const statusEmoji: Record<string, string> = {
    PENDING: "Pending",
    PAID: "Paid",
    PROCESSING: "Processing",
    COMPLETED: "Done",
    FAILED: "Failed",
    EXPIRED: "Expired",
  };

  const message = `
<b>New Order ${statusEmoji[order.status] || order.status}</b>

<b>Order:</b> <code>${order.orderNumber}</code>
<b>Product:</b> ${order.product} — ${order.variant}
<b>Amount:</b> ${fmtIDR(order.amountIDR)} (~$${order.amountUSD.toFixed(2)})
<b>Crypto:</b> ${order.crypto}
<b>Status:</b> ${order.status}
<b>Email:</b> ${order.email}
`.trim();

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: message,
          parse_mode: "HTML",
        }),
      }
    );
    return response.ok;
  } catch (error) {
    console.error("[Telegram] Failed to send notification:", error);
    return false;
  }
}
