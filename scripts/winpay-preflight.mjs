#!/usr/bin/env node
/**
 * WinPay credentials preflight.
 *
 * Creates one unused hosted invoice and reads it back, so a bad key, a bad
 * signature, or a wrong base URL fails here instead of at a customer's
 * checkout. No customer is charged: an invoice only becomes paid when someone
 * pays it.
 *
 * Usage (from the repo root):
 *   pnpm winpay:preflight                 # uses apps/web/.env
 *   WINPAY_BASE_URL=https://sandbox-checkout.winpay.id pnpm winpay:preflight
 *
 * Required env: WINPAY_ENABLED, WINPAY_KEY, WINPAY_SECRET_KEY.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Real environment variables win over the file.
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(root, "apps/web/.env"));
loadEnvFile(resolve(root, "apps/web/.env.local"));

const { createWinpayInvoice, findWinpayInvoice, getWinpayBaseUrl, isWinpayCheckoutEnabled } =
  await import("../packages/payments/src/winpay.ts");

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!isWinpayCheckoutEnabled()) {
  fail(
    "WinPay is not configured. Set WINPAY_ENABLED=true, WINPAY_KEY, and WINPAY_SECRET_KEY " +
      "(apps/web/.env or the environment) before running this check.",
  );
}

let baseUrl;
try {
  baseUrl = getWinpayBaseUrl();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`✗ ${message}`);
  if (message.includes("Cloudflare") || message.includes("WinPay API error: 403")) {
    console.error(
      "\nHint: request ini diblokir Cloudflare di sisi WinPay, bukan ditolak API.\n" +
        "Kumpulkan lalu kirim ke support WinPay:\n" +
        "  - IP egress server ini : curl -4 -s https://ifconfig.me\n" +
        "  - waktu (WIB), cf-ray, dan kode Error dari baris di atas\n" +
        "Minta IP tersebut diizinkan (allowlist/WAF) untuk endpoint merchant.\n" +
        "Pelanggan TIDAK bisa checkout sampai blokir ini dibuka.",
    );
  } else if (message.includes("4010100") || message.includes("4010300")) {
    console.error(
      "\nHint: credential ditolak. Pastikan WINPAY_KEY berisi Key (bukan Secret Key),\n" +
        "tanpa spasi di akhir, dan akun aktif untuk produk Checkout Page (bukan hanya SNAP).",
    );
  }
  process.exit(1);
}

const orderId = `preflight-${Date.now()}`;
console.log(`WinPay base URL : ${baseUrl}`);
console.log(`Reference       : ${orderId}`);

try {
  const invoice = await createWinpayInvoice({
    orderId,
    productName: "EZTopUp WinPay preflight",
    amountIDR: 10_000,
    customerName: "EZTopUp Preflight",
    customerEmail: "preflight@eztopup.io",
    // WinPay requires a phone; the storefront does not collect one.
    customerPhone: "08000000000",
    backUrl: "https://eztopup.io/order/success",
    expiryMinutes: 10,
  });
  console.log(`✓ Invoice created : ${invoice.id}`);
  console.log(`  Hosted URL      : ${invoice.redirectUrl}`);

  const found = await findWinpayInvoice({ invoiceId: invoice.id });
  console.log(`✓ Invoice lookup  : ${found.providerStatus} → ${found.status}`);
  console.log(`  Billed IDR      : ${found.amountIDR}`);
  console.log(`  Merchant nett   : ${found.paidAmountIDR ?? "n/a"}`);
  console.log(
    "\nRecord the raw status string above: the adapter normalizes anything it does not " +
      "recognize to \"pending\", and the docs only document \"PAID\".",
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`✗ ${message}`);
  if (message.includes("Cloudflare") || message.includes("WinPay API error: 403")) {
    console.error(
      "\nHint: request ini diblokir Cloudflare di sisi WinPay, bukan ditolak API.\n" +
        "Kumpulkan lalu kirim ke support WinPay:\n" +
        "  - IP egress server ini : curl -4 -s https://ifconfig.me\n" +
        "  - waktu (WIB), cf-ray, dan kode Error dari baris di atas\n" +
        "Minta IP tersebut diizinkan (allowlist/WAF) untuk endpoint merchant.\n" +
        "Pelanggan TIDAK bisa checkout sampai blokir ini dibuka.",
    );
  } else if (message.includes("4010100") || message.includes("4010300")) {
    console.error(
      "\nHint: credential ditolak. Pastikan WINPAY_KEY berisi Key (bukan Secret Key),\n" +
        "tanpa spasi di akhir, dan akun aktif untuk produk Checkout Page (bukan hanya SNAP).",
    );
  }
  process.exit(1);
}
