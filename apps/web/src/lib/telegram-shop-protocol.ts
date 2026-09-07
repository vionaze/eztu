import { timingSafeEqual } from "node:crypto";

export type ShopState = {
  stage?: "country" | "product" | "variant" | "gameId" | "serverId" | "email" | "quantity" | "payment" | "confirm";
  market?: string;
  productId?: string;
  variantId?: string;
  gameId?: string;
  serverId?: string;
  email?: string;
  quantity?: number;
  nonce?: string;
  options?: string[];
  quoteToken?: string;
  orderId?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: { text?: string; from?: { id: number; is_bot?: boolean }; chat?: { id: number; type: string } };
  callback_query?: { id: string; data?: string; from: { id: number; is_bot?: boolean }; message?: { chat?: { id: number; type: string } } };
};

export function validShopSecret(provided: string | null, expected: string | undefined) {
  if (!expected || !provided) return false;
  const a = Buffer.from(provided), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function privateShopActor(update: TelegramUpdate) {
  const message = update.callback_query?.message || update.message;
  const sender = update.callback_query?.from || update.message?.from;
  if (!Number.isSafeInteger(update.update_id) || !sender || sender.is_bot ||
      !Number.isSafeInteger(sender.id) || sender.id <= 0 ||
      message?.chat?.type !== "private" || message.chat.id !== sender.id) return null;
  return String(sender.id);
}

export function selectedShopOption(state: ShopState, data: string) {
  const [action, nonce, value] = data.split(":");
  if (action !== "pick" || !state.nonce || nonce !== state.nonce || !/^\d+$/.test(value || "")) return null;
  return state.options?.[Number(value)] || null;
}
