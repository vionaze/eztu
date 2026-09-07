import "server-only";
import { prisma } from "@kupon/db";

export type ShopButton = { text: string; callback_data?: string; url?: string };

export async function shopTelegram(method: string, body: Record<string, unknown>) {
  const token = process.env.TELEGRAM_SHOP_BOT_TOKEN;
  if (!token) throw new Error("Telegram shop is not configured");
  // Never log the request URL: it contains the bot token.
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
    });
  } catch { throw new Error("Telegram shop connection failed"); }
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(`Telegram shop request failed (${response.status})`);
  return result.result;
}

export async function shopMessage(chatId: string, text: string, buttons: ShopButton[][] = []) {
  return shopTelegram("sendMessage", {
    chat_id: chatId, text, protect_content: true,
    link_preview_options: { is_disabled: true },
    ...(buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
}

export async function showShopOrder(chatId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, telegramChatId: chatId },
    include: { items: { include: { product: true, variant: true } }, supplierOrder: true },
  });
  if (!order) return shopMessage(chatId, "Pesanan tidak ditemukan. Ketik /orders untuk pesananmu.");
  const item = order.items[0];
  const status: Record<string, string> = {
    PENDING: "Menunggu pembayaran", PAID: "Pembayaran diterima", PROCESSING: "Sedang diproses",
    COMPLETED: "Selesai", FAILED: "Gagal — hubungi support", EXPIRED: "Kedaluwarsa",
    UNDERPAID: "Pembayaran kurang — hubungi support", PAYMENT_REVIEW: "Pembayaran sedang diperiksa",
    REFUNDED: "Dikembalikan", DISPUTED: "Dalam sengketa",
  };
  const expired = order.status === "PENDING" && order.expiresAt && order.expiresAt <= new Date();
  const buttons: ShopButton[][] = [];
  if (order.status === "PENDING" && !expired && order.paymentUrl) buttons.push([{ text: "Buka pembayaran", url: order.paymentUrl }]);
  buttons.push([{ text: "Cek status", callback_data: `status:${order.id}` }]);
  await shopMessage(chatId, `${order.orderNumber}\n${item?.product.name || ""} — ${item?.variant.name || ""}\nJumlah: ${item?.quantity || 1}\nTotal: Rp${order.totalIDR.toLocaleString("id-ID")} / $${(order.totalUSDCents / 100).toFixed(2)}\nStatus: ${expired ? "Waktu pembayaran habis" : status[order.status] || order.status}\n${order.gameId !== "voucher" ? `ID tujuan: ${order.gameId}${order.serverId ? ` (${order.serverId})` : ""}\n` : ""}Bantuan: /support`, buttons);
  if (order.status === "COMPLETED" && order.supplierOrder?.status === "FULFILLED" && order.supplierOrder.voucherCode) {
    const delivery = `Voucher ${order.orderNumber}:\n${order.supplierOrder.voucherCode}${order.supplierOrder.voucherPin ? `\nPIN: ${order.supplierOrder.voucherPin}` : ""}`;
    for (let offset = 0; offset < delivery.length; offset += 3500) {
      await shopMessage(chatId, delivery.slice(offset, offset + 3500));
    }
  }
}

export async function notifyTelegramShopOrder(orderId: string) {
  if (process.env.TELEGRAM_SHOP_ENABLED !== "true") return;
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { telegramChatId: true } });
    if (order?.telegramChatId) await showShopOrder(order.telegramChatId, orderId);
  } catch {
    // Payment/fulfillment must still finish when Telegram is unavailable.
    // The customer can retrieve the durable result with /orders.
    console.error("[Telegram Shop] Order notification failed", orderId);
  }
}
