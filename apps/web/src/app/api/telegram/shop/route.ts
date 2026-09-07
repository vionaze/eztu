import { handleTelegramShopUpdate } from "@/lib/telegram-shop";
import { validShopSecret, type TelegramUpdate } from "@/lib/telegram-shop-protocol";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  if (process.env.TELEGRAM_SHOP_ENABLED !== "true") {
    return Response.json({ error: "Shop disabled" }, { status: 503 });
  }
  if (!validShopSecret(request.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_SHOP_WEBHOOK_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  let update: TelegramUpdate;
  try {
    update = await request.json();
    if (!update || !Number.isSafeInteger(update.update_id)) throw new Error("Invalid update");
  } catch {
    return Response.json({ error: "Invalid update" }, { status: 400 });
  }
  try {
    await handleTelegramShopUpdate(update);
    return Response.json({ ok: true });
  } catch {
    // Non-2xx asks Telegram to retry a busy chat or a temporary database failure.
    return Response.json({ error: "Retry later" }, { status: 503 });
  }
}

// Hosted payment return only opens the bot. It never marks an order as paid.
export async function GET() {
  const username = process.env.TELEGRAM_SHOP_BOT_USERNAME?.replace(/^@/, "");
  if (process.env.TELEGRAM_SHOP_ENABLED !== "true" || !username || !/^[A-Za-z0-9_]+$/.test(username)) {
    return Response.json({ error: "Shop unavailable" }, { status: 503 });
  }
  return Response.redirect(`https://t.me/${username}?start=orders`, 303);
}
