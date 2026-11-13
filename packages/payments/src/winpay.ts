import { createHmac } from "node:crypto";

const WINPAY_PRODUCTION_ORIGIN = "https://checkout.winpay.id";
const WINPAY_SANDBOX_ORIGIN = "https://sandbox-checkout.winpay.id";
const WINPAY_ALLOWED_ORIGINS = [WINPAY_PRODUCTION_ORIGIN, WINPAY_SANDBOX_ORIGIN];
const WINPAY_REQUEST_TIMEOUT_MS = 10_000;
const WINPAY_MAX_RESPONSE_BYTES = 64 * 1024;
// WinPay sits behind Cloudflare, which flags requests that carry no user agent.
const WINPAY_USER_AGENT = "EZTopUp/1.0 (+https://eztopup.io)";
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const WINPAY_ID_PATTERN = /^[A-Za-z0-9_-]{3,64}$/;
const WINPAY_REF_PATTERN = /^[A-Za-z0-9_-]{3,64}$/;
const MAX_INVOICE_IDR = 99_999_999_999;

export type WinpayInvoiceStatus =
  | "pending"
  | "paid"
  | "expired"
  | "failed"
  | "refunded";

export type WinpayInvoice = {
  id: string;
  ref: string;
  providerStatus: string;
  status: WinpayInvoiceStatus;
  redirectUrl: string | null;
  amountIDR: number;
  paidAmountIDR: number | null;
  channel: string | null;
  raw: unknown;
};

export type WinpayCallbackNotification = {
  ref: string | null;
  invoiceRef: string | null;
  invoiceId: string | null;
  amountIDR: number | null;
  channel: string | null;
  raw: unknown;
};

function requiredEnv(name: "WINPAY_KEY" | "WINPAY_SECRET_KEY") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for WinPay payments.`);
  return value;
}

export function isWinpayEnvironmentEnabled() {
  return process.env.WINPAY_ENABLED?.trim().toLowerCase() === "true";
}

export function isWinpayConfigured() {
  return Boolean(
    process.env.WINPAY_KEY?.trim() && process.env.WINPAY_SECRET_KEY?.trim(),
  );
}

export function isWinpayCheckoutEnabled() {
  return isWinpayEnvironmentEnabled() && isWinpayConfigured();
}

export function getWinpayBaseUrl() {
  const raw = process.env.WINPAY_BASE_URL?.trim() || WINPAY_PRODUCTION_ORIGIN;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("WINPAY_BASE_URL is invalid.");
  }
  if (url.protocol !== "https:" || !WINPAY_ALLOWED_ORIGINS.includes(url.origin)) {
    throw new Error("WINPAY_BASE_URL must be the WinPay checkout origin.");
  }
  return url.origin;
}

/**
 * WinPay signs the literal `X-Winpay-Timestamp` header value, and requires that
 * value to be Jakarta wall-clock time with an explicit +07:00 offset. Jakarta
 * has no DST, so a fixed +7h shift is exact and keeps this pure/testable.
 */
export function formatWinpayTimestamp(date: Date = new Date()) {
  const shifted = new Date(date.getTime() + JAKARTA_OFFSET_MS);
  return `${shifted.toISOString().slice(0, 19)}+07:00`;
}

/** PHP equivalent: hash_hmac('sha256', $timestamp, $secretKey) */
export function createWinpaySignature(timestamp: string, secretKey: string) {
  return createHmac("sha256", secretKey).update(timestamp).digest("hex");
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("WinPay payload must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

function optionalString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredString(row: Record<string, unknown>, key: string) {
  const value = optionalString(row, key);
  if (!value) throw new Error(`WinPay payload is missing ${key}.`);
  return value;
}

function toIntegerIDR(value: unknown) {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("WinPay payload contains an invalid amount.");
  }
  return amount;
}

function validateAmountIDR(amountIDR: number) {
  if (
    !Number.isSafeInteger(amountIDR) ||
    amountIDR <= 0 ||
    amountIDR > MAX_INVOICE_IDR
  ) {
    throw new Error("WinPay amount must be a positive integer in IDR.");
  }
  return amountIDR;
}

function validateRef(ref: string) {
  const cleaned = ref.trim();
  if (!WINPAY_REF_PATTERN.test(cleaned)) {
    throw new Error("WinPay invoice ref is invalid.");
  }
  return cleaned;
}

function validateInvoiceId(id: string) {
  const cleaned = id.trim();
  if (!WINPAY_ID_PATTERN.test(cleaned)) {
    throw new Error("WinPay invoice ID is invalid.");
  }
  return cleaned;
}

function sanitizeText(value: string, maxLength: number) {
  const cleaned = value.replace(/\s+/g, " ").trim().slice(0, maxLength);
  if (!cleaned) throw new Error("WinPay customer name is required.");
  return cleaned;
}

function sanitizePhone(value: string) {
  const cleaned = value.replace(/[^\d+]/g, "").slice(0, 20);
  if (!cleaned) throw new Error("WinPay customer phone is required.");
  return cleaned;
}

export function normalizeWinpayStatus(status: string | undefined): WinpayInvoiceStatus {
  switch ((status || "").trim().toUpperCase()) {
    case "PAID":
    case "SUCCESS":
    case "SETTLED":
      return "paid";
    case "EXPIRED":
      return "expired";
    case "CANCELLED":
    case "CANCELED":
    case "FAILED":
    case "DENIED":
      return "failed";
    case "REFUNDED":
      return "refunded";
    default:
      return "pending";
  }
}

async function requestWinpay(
  path: string,
  options: { method: "GET" | "POST"; body?: string },
) {
  const timestamp = formatWinpayTimestamp();
  const response = await fetch(new URL(path, getWinpayBaseUrl()), {
    method: options.method,
    ...(options.body ? { body: options.body } : {}),
    cache: "no-store",
    redirect: "error",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": WINPAY_USER_AGENT,
      "X-Winpay-Timestamp": timestamp,
      "X-Winpay-Signature": createWinpaySignature(
        timestamp,
        requiredEnv("WINPAY_SECRET_KEY"),
      ),
      "X-Winpay-Key": requiredEnv("WINPAY_KEY"),
    },
    signal: AbortSignal.timeout(WINPAY_REQUEST_TIMEOUT_MS),
  });

  const declaredLength = Number(response.headers.get("content-length") || "0");
  if (declaredLength > WINPAY_MAX_RESPONSE_BYTES) {
    throw new Error("WinPay API response is too large.");
  }
  const responseText = await response.text();
  if (Buffer.byteLength(responseText, "utf8") > WINPAY_MAX_RESPONSE_BYTES) {
    throw new Error("WinPay API response is too large.");
  }

  let data: Record<string, unknown> | null = null;
  try {
    data = asRecord(JSON.parse(responseText) as unknown);
  } catch {
    data = null;
  }
  if (!response.ok || !data) {
    // Keep a short body snippet: an edge block (Cloudflare) answers with HTML,
    // while a real API rejection answers with a responseCode JSON envelope.
    const snippet = responseText.replace(/\s+/g, " ").trim().slice(0, 160);
    const cfRay = response.headers.get("cf-ray");
    const code = data ? optionalString(data, "responseCode") : null;
    const message = data ? optionalString(data, "responseMessage") : null;
    const detail = data
      ? `${code || response.status} ${message || "Unknown API error"}`
      : `${response.status} ${snippet || "empty body"}${cfRay ? ` (cf-ray ${cfRay})` : ""}`;
    throw new Error(`WinPay API error: ${detail}`);
  }
  const responseCode = optionalString(data, "responseCode") || "";
  if (!responseCode.startsWith("2")) {
    const message = optionalString(data, "responseMessage") || "Unknown API error";
    throw new Error(`WinPay API error: ${responseCode || response.status} ${message}`);
  }
  return asRecord(data.responseData);
}

function assertWinpayCheckoutUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("WinPay API returned an invalid redirect URL.");
  }
  if (url.protocol !== "https:" || !WINPAY_ALLOWED_ORIGINS.includes(url.origin)) {
    throw new Error("WinPay API returned an invalid redirect URL.");
  }
  return url.toString();
}

export async function createWinpayInvoice(params: {
  orderId: string;
  productName: string;
  amountIDR: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  backUrl: string;
  expiryMinutes: number;
}) {
  const ref = validateRef(params.orderId);
  const amountIDR = validateAmountIDR(params.amountIDR);
  const interval = Math.min(1440, Math.max(5, Math.trunc(params.expiryMinutes) || 60));
  const body = JSON.stringify({
    customer: {
      name: sanitizeText(params.customerName, 50),
      email: params.customerEmail.trim().slice(0, 100),
      phone: sanitizePhone(params.customerPhone),
    },
    invoice: {
      ref,
      products: [
        {
          name: sanitizeText(params.productName, 100),
          qty: 1,
          price: amountIDR,
        },
      ],
    },
    back_url: params.backUrl,
    interval,
  });

  const row = await requestWinpay("/api/create", { method: "POST", body });
  const id = validateInvoiceId(requiredString(row, "id"));
  const redirectUrl = assertWinpayCheckoutUrl(requiredString(row, "redirect_url"));

  return { id, ref, redirectUrl, amountIDR };
}

function sumProductAmounts(row: Record<string, unknown>) {
  const products = row.products;
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error("WinPay payload is missing products.");
  }
  let total = 0;
  for (const entry of products) {
    const product = asRecord(entry);
    const qty = Number(product.qty);
    const price = Number(product.price);
    if (
      !Number.isSafeInteger(qty) ||
      qty <= 0 ||
      !Number.isSafeInteger(price) ||
      price <= 0
    ) {
      throw new Error("WinPay payload contains an invalid product line.");
    }
    total += qty * price;
  }
  return total;
}

function parseInvoice(value: unknown): WinpayInvoice {
  const row = asRecord(value);
  const payment = row.payment ? asRecord(row.payment) : null;
  const providerStatus = (optionalString(row, "status") || "PENDING").toUpperCase();
  // `nett` is what the merchant receives; `paid_amount` may include the fee.
  const nett = payment ? optionalString(payment, "nett") : null;
  const rawRedirect = optionalString(row, "redirect_url");

  return {
    id: validateInvoiceId(requiredString(row, "id")),
    ref: requiredString(row, "ref"),
    providerStatus,
    status: normalizeWinpayStatus(providerStatus),
    redirectUrl: rawRedirect ? assertWinpayCheckoutUrl(rawRedirect) : null,
    amountIDR: sumProductAmounts(row),
    paidAmountIDR: nett ? toIntegerIDR(nett) : null,
    channel: payment ? optionalString(payment, "channel") : null,
    raw: value,
  };
}

export async function findWinpayInvoice(params: {
  invoiceId: string;
}): Promise<WinpayInvoice> {
  const id = validateInvoiceId(params.invoiceId);
  return parseInvoice(
    await requestWinpay(`/api/find/${encodeURIComponent(id)}`, { method: "GET" }),
  );
}

export function parseWinpayCallback(rawBody: string): WinpayCallbackNotification {
  const body = asRecord(JSON.parse(rawBody) as unknown);
  const invoice = body.invoice ? asRecord(body.invoice) : null;
  const amount = body.amount;
  const parsedAmount =
    typeof amount === "number"
      ? amount
      : typeof amount === "string" && amount.trim()
        ? Number(amount)
        : Number.NaN;

  return {
    ref: optionalString(body, "ref"),
    invoiceRef: invoice ? optionalString(invoice, "ref") : null,
    invoiceId:
      optionalString(body, "uuid") ||
      (invoice ? optionalString(invoice, "uuid") : null),
    amountIDR:
      Number.isSafeInteger(parsedAmount) && parsedAmount > 0 ? parsedAmount : null,
    channel: optionalString(body, "channel"),
    raw: body,
  };
}

export function assertWinpayInvoiceMatches(params: {
  invoice: WinpayInvoice;
  orderId: string;
  amountIDR: number;
  requirePaid?: boolean;
}) {
  const expectedOrderId = validateRef(params.orderId);
  const expectedAmount = validateAmountIDR(params.amountIDR);
  const mismatches: string[] = [];
  if (params.invoice.ref !== expectedOrderId) mismatches.push("ref");
  if (params.invoice.amountIDR !== expectedAmount) mismatches.push("amount");
  if (params.requirePaid && params.invoice.status !== "paid") mismatches.push("status");
  if (mismatches.length > 0) {
    throw new Error(`WinPay invoice mismatch: ${mismatches.join(", ")}.`);
  }
}
