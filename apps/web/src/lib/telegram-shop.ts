import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@kupon/db";
import { isPakasirCheckoutEnabled } from "@kupon/payments";
import { createCheckoutOrder } from "@/lib/checkout-order";
import { createPricingQuote, getUsdIdrRate, signPricingQuote, verifyPricingQuote } from "@/lib/fx";
import { getFreshVariantPricing } from "@/lib/supplier-pricing";
import { findActiveAccessBlock } from "@/lib/access-block";
import { getCryptoMinimumQuantity, MAX_SELF_SERVICE_QUANTITY } from "@/lib/checkout-limits";
import { isProductExcludedFromMarket } from "@/lib/product-availability";
import { shopMessage, shopTelegram, showShopOrder, type ShopButton } from "@/lib/telegram-shop-api";
import { privateShopActor, selectedShopOption, type ShopState, type TelegramUpdate } from "./telegram-shop-protocol.ts";

const PAGE_SIZE = 8;
const button = (text: string, callback_data: string): ShopButton => ({ text, callback_data });
const money = (amount: number) => `Rp${amount.toLocaleString("id-ID")}`;

async function save(chatId: string, state: ShopState) {
  await prisma.telegramShopSession.update({ where: { chatId }, data: { state: state as Prisma.InputJsonObject } });
}

async function choose(chatId: string, state: ShopState, title: string, choices: { id: string; label: string }[], page = 0) {
  state.nonce = randomBytes(4).toString("hex");
  state.options = choices.map((choice) => choice.id);
  const pages = Math.max(1, Math.ceil(choices.length / PAGE_SIZE));
  page = Math.max(0, Math.min(pages - 1, page));
  const rows = choices.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((choice, i) =>
    [button(choice.label.slice(0, 100), `pick:${state.nonce}:${page * PAGE_SIZE + i}`)]);
  const navigation = [];
  if (page > 0) navigation.push(button("← Sebelumnya", `page:${state.nonce}:${page - 1}`));
  if (page + 1 < pages) navigation.push(button("Berikutnya →", `page:${state.nonce}:${page + 1}`));
  if (navigation.length) rows.push(navigation);
  await save(chatId, state);
  await shopMessage(chatId, `${title}${pages > 1 ? ` (${page + 1}/${pages})` : ""}\n${choices.length ? "Pilih lewat tombol di bawah." : "Belum ada pilihan tersedia. Ketik /shop untuk mulai lagi."}`, rows);
}

async function catalog(chatId: string, state: ShopState, page = 0) {
  if (state.stage === "country") {
    const variants = await prisma.productVariant.findMany({ where: { published: true, product: { published: true } }, distinct: ["countryCode"], select: { countryCode: true }, orderBy: { countryCode: "asc" } });
    const names = new Intl.DisplayNames(["id"], { type: "region" });
    return choose(chatId, state, "Selamat datang di EZTopUp. Pilih negara akun/region produk:", variants.map(v => ({ id: v.countryCode, label: `${v.countryCode.toUpperCase()} — ${/^[a-z]{2}$/i.test(v.countryCode) ? names.of(v.countryCode.toUpperCase()) : v.countryCode}` })), page);
  }
  if (state.stage === "product") {
    const products = await prisma.product.findMany({
      where: { published: true, OR: [{ globalAvailability: true }, { variants: { some: { published: true, countryCode: state.market } } }] },
      orderBy: { name: "asc" },
    });
    return choose(chatId, state, "Pilih game atau voucher:", products.filter(p => !isProductExcludedFromMarket(p, state.market)).map(p => ({ id: p.id, label: p.name })), page);
  }
  const product = await prisma.product.findFirst({ where: { id: state.productId, published: true } });
  if (!product || isProductExcludedFromMarket(product, state.market)) throw new Error("Product unavailable");
  const variants = await prisma.productVariant.findMany({
    where: { productId: product.id, published: true, ...(product.globalAvailability ? {} : { countryCode: state.market }) },
    orderBy: [{ priceIDR: "asc" }, { id: "asc" }],
  });
  return choose(chatId, state, `${product.name} — pilih nominal. Harga final dicek sebelum bayar:`, variants.map(v => ({ id: v.id, label: `${v.name} · ${money(v.priceIDR)}` })), page);
}

async function selectedVariant(state: ShopState) {
  if (!state.variantId || !state.market) throw new Error("Selection missing");
  const variant = await prisma.productVariant.findUnique({ where: { id: state.variantId }, include: { product: true } });
  if (!variant || !variant.published || !variant.product.published ||
      isProductExcludedFromMarket(variant.product, state.market) ||
      (!variant.product.globalAvailability && variant.countryCode !== state.market)) throw new Error("Product unavailable");
  return variant;
}

async function methods(chatId: string, state: ShopState) {
  state.stage = "payment";
  state.nonce = randomBytes(4).toString("hex");
  delete state.quoteToken;
  delete state.orderId;
  await save(chatId, state);
  const rows = [[button("Crypto · Cryptomus", `pay:${state.nonce}:crypto`)]];
  if (isPakasirCheckoutEnabled()) rows.unshift([button("QRIS / VA · Pakasir", `pay:${state.nonce}:pakasir`)]);
  await shopMessage(chatId, "Pilih pembayaran. Harga dan ketersediaan supplier akan dicek. Untuk crypto, jumlah otomatis dinaikkan sampai minimal Rp45.000 dan $2.50.", rows);
}

async function showQuote(chatId: string, state: ShopState, paymentMethod: "crypto" | "pakasir") {
  if (paymentMethod === "pakasir" && !isPakasirCheckoutEnabled()) return methods(chatId, state);
  const variant = await selectedVariant(state);
  const fresh = await getFreshVariantPricing(variant, paymentMethod);
  const rate = await getUsdIdrRate();
  const quantity = Math.max(state.quantity || 1, paymentMethod === "crypto" ? getCryptoMinimumQuantity(fresh.unitPriceIDR, rate.usdIdrRate) : 1);
  if (quantity > MAX_SELF_SERVICE_QUANTITY) {
    await shopMessage(chatId, "SKU ini perlu lebih dari 20 unit untuk minimum crypto. Pilih Pakasir atau hubungi /support.");
    return methods(chatId, state);
  }
  const quote = createPricingQuote({ variantId: variant.id, quantity, paymentMethod,
    supplierCostIDR: fresh.supplierCostIDR, supplierCountryCode: fresh.countryCode,
    pricingMarkupBps: fresh.markupBps, unitPriceIDR: fresh.unitPriceIDR, rate });
  state.quantity = quantity;
  state.quoteToken = signPricingQuote(quote);
  state.orderId = randomUUID();
  state.stage = "confirm";
  // Store payment method in the server-signed quote, not in callback input.
  await save(chatId, state);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://eztopup.io";
  await shopMessage(chatId, `${variant.product.name}\n${variant.name}\nRegion: ${state.market?.toUpperCase()}\n${variant.product.fulfillmentType === "TOP_UP" ? `ID: ${state.gameId}${state.serverId ? ` (${state.serverId})` : ""}\n` : ""}Email: ${state.email}\nJumlah: ${quantity}\nHarga satuan: ${money(quote.unitPriceIDR)}\nTotal: ${money(quote.totalIDR)} / $${(quote.totalUSDCents / 100).toFixed(2)}\nPembayaran: ${paymentMethod === "crypto" ? "Cryptomus (biaya jaringan terpisah)" : "Pakasir QRIS / VA"}\nBerlaku sampai ${new Date(quote.expiresAt).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" })} WIB.\nPeriksa ID dan jumlah sebelum konfirmasi. Dengan melanjutkan kamu menyetujui ketentuan toko: ${appUrl}/terms`, [
    [button("Konfirmasi & buat pembayaran", `confirm:${state.orderId}`)],
    [button("Ganti pembayaran", `methods:${state.orderId}`)],
  ]);
}

async function processUpdate(chatId: string, update: TelegramUpdate) {
  const session = await prisma.telegramShopSession.findUniqueOrThrow({ where: { chatId } });
  let state = session.state as ShopState;
  const text = update.message?.text?.trim() || "";
  const data = update.callback_query?.data || "";
  if (update.callback_query) {
    await shopTelegram("answerCallbackQuery", { callback_query_id: update.callback_query.id }).catch(() => {});
  }
  // Existing local_* identities are supported by EZTopUp. Never link by an unverified email.
  const user = await prisma.user.upsert({ where: { clerkId: `local_telegram_${chatId}` }, update: {}, create: { clerkId: `local_telegram_${chatId}`, name: `Telegram ${chatId}` } });
  if (user.bannedAt || await findActiveAccessBlock({ userId: user.id, clerkUserId: user.clerkId })) {
    return shopMessage(chatId, "Akun tidak dapat bertransaksi. Hubungi sales@eztopup.io.");
  }
  if (text === "/support" || text === "/help") return shopMessage(chatId, "Bantuan: sales@eztopup.io\n/shop — katalog\n/orders — pesanan dan voucher\n/cancel — batalkan pilihan (invoice yang sudah dibuat tidak dibatalkan)");
  if (text === "/orders" || text === "/start orders") {
    const orders = await prisma.order.findMany({ where: { telegramChatId: chatId }, orderBy: { createdAt: "desc" }, take: 5 });
    return shopMessage(chatId, orders.length ? "Lima pesanan terakhir. Pilih untuk melihat status/voucher:" : "Belum ada pesanan. Ketik /shop.", orders.map(o => [button(`${o.orderNumber} · ${o.status}`, `status:${o.id}`)]));
  }
  if (data.startsWith("status:")) return showShopOrder(chatId, data.slice(7));
  if (text === "/start" || text === "/shop" || text === "/cancel" || !state.stage) {
    state = { stage: "country", email: state.email };
    return catalog(chatId, state);
  }
  if (data.startsWith("page:")) {
    const [, nonce, page] = data.split(":");
    if (nonce === state.nonce && /^\d+$/.test(page) && ["country", "product", "variant"].includes(state.stage)) return catalog(chatId, state, Number(page));
  }
  const selected = selectedShopOption(state, data);
  if (selected && state.stage === "country") {
    state = { stage: "product", market: selected, email: state.email };
    return catalog(chatId, state);
  }
  if (selected && state.stage === "product") {
    state.productId = selected; state.stage = "variant";
    return catalog(chatId, state);
  }
  if (selected && state.stage === "variant") {
    delete state.options;
    delete state.nonce;
    state.variantId = selected;
    const variant = await selectedVariant(state);
    state.gameId = "voucher"; state.serverId = ""; state.quantity = 1;
    state.stage = variant.product.fulfillmentType === "TOP_UP" ? "gameId" : "email";
    await save(chatId, state);
    return shopMessage(chatId, state.stage === "gameId" ? `Kirim ${variant.product.gameIdLabel || "User ID"} tujuan:` : "Kirim email penerima voucher:");
  }
  if (text && state.stage === "gameId") {
    if (!/^[A-Za-z0-9_.@+ -]{1,100}$/.test(text) || text === "voucher") return shopMessage(chatId, "ID tidak valid. Kirim ID akun tujuan (maksimal 100 karakter).");
    const variant = await selectedVariant(state);
    state.gameId = text;
    state.stage = variant.product.requiresServerId ? "serverId" : "email";
    await save(chatId, state);
    return shopMessage(chatId, state.stage === "serverId" ? `Kirim ${variant.product.serverIdLabel || "Server ID"}:` : "Kirim email penerima pesanan:");
  }
  if (text && state.stage === "serverId") {
    if (!/^[A-Za-z0-9_. -]{1,100}$/.test(text)) return shopMessage(chatId, "Server ID tidak valid. Kirim ulang.");
    state.serverId = text; state.stage = "email";
    await save(chatId, state);
    return shopMessage(chatId, "Kirim email penerima pesanan:");
  }
  if (text && state.stage === "email") {
    if (text.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return shopMessage(chatId, "Email tidak valid. Kirim ulang.");
    state.email = text.toLowerCase(); state.stage = "quantity";
    await save(chatId, state);
    return shopMessage(chatId, `Kirim jumlah pembelian (1–${MAX_SELF_SERVICE_QUANTITY}):`);
  }
  if (text && state.stage === "quantity") {
    if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > MAX_SELF_SERVICE_QUANTITY) return shopMessage(chatId, "Jumlah harus 1–20.");
    state.quantity = Number(text);
    return methods(chatId, state);
  }
  if (state.stage === "payment" && data.startsWith(`pay:${state.nonce}:`)) {
    const method = data.split(":")[2];
    if (method === "crypto" || method === "pakasir") return showQuote(chatId, state, method);
  }
  if (state.stage === "confirm" && data === `methods:${state.orderId}`) return methods(chatId, state);
  if (state.stage === "confirm" && data === `confirm:${state.orderId}` && state.quoteToken && state.orderId) {
    if (await findActiveAccessBlock({ email: state.email, userId: user.id })) return shopMessage(chatId, "Pesanan tidak dapat diproses. Hubungi /support.");
    const existing = await prisma.order.findFirst({ where: { id: state.orderId, telegramChatId: chatId } });
    if (existing?.paymentUrl || (existing && existing.status !== "PENDING")) return showShopOrder(chatId, existing.id);
    const variant = await selectedVariant(state);
    if (!state.email || (variant.product.fulfillmentType === "TOP_UP" && (!state.gameId || state.gameId === "voucher" || (variant.product.requiresServerId && !state.serverId)))) throw new Error("Missing checkout fields");
    // Decode only to select the pricing tier. Verification below authenticates every field.
    const rawQuote = JSON.parse(Buffer.from(state.quoteToken.split(".")[0], "base64url").toString());
    const method = rawQuote.paymentMethod;
    if (method !== "crypto" && method !== "pakasir") throw new Error("Invalid method");
    const fresh = await getFreshVariantPricing(variant, method);
    let quote;
    try {
      quote = verifyPricingQuote(state.quoteToken, { variantId: variant.id, quantity: state.quantity || 1,
        paymentMethod: method, supplierCostIDR: fresh.supplierCostIDR, supplierCountryCode: fresh.countryCode,
        pricingMarkupBps: fresh.markupBps, unitPriceIDR: fresh.unitPriceIDR });
    } catch {
      await shopMessage(chatId, "Harga berubah atau quote kedaluwarsa. Periksa total terbaru lalu konfirmasi lagi.");
      return showQuote(chatId, state, method);
    }
    const result = await createCheckoutOrder({ userId: user.id, telegramChatId: chatId, orderId: state.orderId,
      email: state.email, gameId: state.gameId || "voucher", serverId: state.serverId || "",
      productId: variant.productId, variantId: variant.id, quantity: quote.quantity, paymentMethod: method,
      quote, freshPricing: fresh, variant });
    return showShopOrder(chatId, result.orderId);
  }
  return shopMessage(chatId, "Gunakan tombol pada pesan terbaru, atau /shop untuk mulai lagi.");
}

export async function handleTelegramShopUpdate(update: TelegramUpdate) {
  const chatId = privateShopActor(update);
  if (!chatId) return;
  const previous = await prisma.telegramShopSession.upsert({ where: { chatId }, create: { chatId }, update: {} });
  const lockToken = randomUUID();
  const claimed = await prisma.telegramShopSession.updateMany({
    where: { chatId, OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }] },
    data: { lockToken, lockedUntil: new Date(Date.now() + 120_000) },
  });
  if (!claimed.count) throw new Error("Chat is busy; retry update");
  try {
    const session = await prisma.telegramShopSession.findUniqueOrThrow({ where: { chatId } });
    if (session.lastUpdateId >= update.update_id && previous.updatedAt.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000) return;
    try {
      await processUpdate(chatId, update);
    } catch (error) {
      // Keep technical/supplier details out of customer messages.
      console.error("[Telegram Shop] Update failed", update.update_id, error instanceof Error ? error.name : "Error");
      await shopMessage(chatId, "Permintaan belum berhasil. Harga/stok atau layanan pembayaran mungkin sedang tidak tersedia. Coba tombol terbaru lagi, /orders untuk cek pesanan, atau /shop untuk pilih SKU lain.");
    }
    await prisma.telegramShopSession.update({ where: { chatId }, data: { lastUpdateId: update.update_id } });
  } finally {
    await prisma.telegramShopSession.updateMany({ where: { chatId, lockToken }, data: { lockToken: null, lockedUntil: null } });
  }
}
