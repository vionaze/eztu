import { timingSafeEqual } from "node:crypto";

const PAKASIR_ORIGIN = "https://app.pakasir.com";
const PAKASIR_REQUEST_TIMEOUT_MS = 10_000;
const PAKASIR_MAX_RESPONSE_BYTES = 64 * 1024;

export type PakasirTransactionStatus =
  | "pending"
  | "completed"
  | "canceled"
  | string;

export type PakasirTransaction = {
  txnId: string;
  orderId: string;
  amount: number;
  status: PakasirTransactionStatus;
  isSandbox: boolean;
  completedAt: string | null;
  raw: unknown;
};

export type PakasirWebhookNotification = PakasirTransaction;

function requiredEnv(
  name: "PAKASIR_PROJECT_SLUG" | "PAKASIR_API_KEY"
) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Pakasir payments.`);
  return value;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Pakasir payload must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

function requiredString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Pakasir payload is missing ${key}.`);
  }
  return value.trim();
}

function optionalString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredAmount(row: Record<string, unknown>) {
  const value = row.amount;
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Pakasir payload contains an invalid amount.");
  }
  return amount;
}

function validateOrderId(orderId: string) {
  const cleaned = orderId.trim();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(cleaned)) {
    throw new Error("Pakasir order ID is invalid.");
  }
  return cleaned;
}

function validateProjectSlug(project: string) {
  const cleaned = project.trim();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(cleaned)) {
    throw new Error("PAKASIR_PROJECT_SLUG is invalid.");
  }
  return cleaned;
}

function validateTxnId(txnId: string) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(txnId)) {
    throw new Error("Pakasir transaction ID is invalid.");
  }
  return txnId;
}

function validateAmountIDR(amountIDR: number) {
  if (!Number.isSafeInteger(amountIDR) || amountIDR <= 0) {
    throw new Error("Pakasir amount must be a positive integer in IDR.");
  }
  return amountIDR;
}

function validateRedirectUrl(redirectUrl: string, appUrl: string) {
  const redirect = new URL(redirectUrl);
  const app = new URL(appUrl);
  if (redirect.origin !== app.origin) {
    throw new Error("Pakasir redirect URL must use the application origin.");
  }
  if (app.protocol !== "https:" && app.hostname !== "localhost") {
    throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS outside localhost.");
  }
  return redirect.toString();
}

export function isPakasirEnvironmentEnabled() {
  return process.env.PAKASIR_ENABLED?.trim().toLowerCase() === "true";
}

export function isPakasirConfigured() {
  return Boolean(
    process.env.PAKASIR_PROJECT_SLUG?.trim() &&
      process.env.PAKASIR_API_KEY?.trim()
  );
}

export function isPakasirCheckoutEnabled() {
  return isPakasirEnvironmentEnabled() && isPakasirConfigured();
}

export function getPakasirProjectSlug() {
  return validateProjectSlug(requiredEnv("PAKASIR_PROJECT_SLUG"));
}

export async function createPakasirPayment(params: {
  orderId: string;
  amountIDR: number;
  redirectUrl: string;
  appUrl: string;
}) {
  const project = getPakasirProjectSlug();
  const orderId = validateOrderId(params.orderId);
  const amount = validateAmountIDR(params.amountIDR);
  const redirect = validateRedirectUrl(params.redirectUrl, params.appUrl);
  const row = await requestPakasir(
    `/api/v2/create-transaction/${encodeURIComponent(project)}/${encodeURIComponent(orderId)}`,
    { method: "POST", body: JSON.stringify({ method: "payment_link", amount }) }
  );
  const txnId = validateTxnId(requiredString(row, "txn_id"));
  const url = new URL(requiredString(row, "payment_link"));
  if (url.origin !== PAKASIR_ORIGIN || url.pathname !== `/pay-v2/${txnId}`) {
    throw new Error("Pakasir API returned an invalid payment link.");
  }
  url.searchParams.set("redirect", redirect);
  return { txnId, paymentUrl: url.toString() };
}

function parseTransaction(value: unknown): PakasirTransaction {
  const row = asRecord(value);
  if (typeof row.is_sandbox !== "boolean") {
    throw new Error("Pakasir payload contains an invalid is_sandbox.");
  }
  return {
    txnId: validateTxnId(requiredString(row, "txn_id")),
    orderId: requiredString(row, "order_id"),
    amount: requiredAmount(row),
    status: requiredString(row, "status").toLowerCase(),
    isSandbox: row.is_sandbox,
    completedAt: optionalString(row, "completed_at"),
    raw: value,
  };
}

export function parsePakasirWebhook(rawBody: string): PakasirWebhookNotification {
  return parseTransaction(JSON.parse(rawBody) as unknown);
}

export function verifyPakasirWebhookSecret(secret: string | null) {
  const configured = process.env.PAKASIR_WEBHOOK_SECRET?.trim();
  // Without a configured secret, callers must still verify the transaction
  // through the authenticated status API before applying any payment.
  if (!configured) return true;
  const expected = Buffer.from(configured);
  const actual = Buffer.from(secret || "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function getPakasirTransactionStatus(params: {
  txnId: string;
}): Promise<PakasirTransaction> {
  const project = getPakasirProjectSlug();
  const txnId = validateTxnId(params.txnId);
  return parseTransaction(
    await requestPakasir(
      `/api/v2/transaction-status/${encodeURIComponent(project)}/${encodeURIComponent(txnId)}`,
      { method: "GET" }
    )
  );
}

async function requestPakasir(
  path: string,
  options: { method: "GET" | "POST"; body?: string }
) {
  const response = await fetch(new URL(path, PAKASIR_ORIGIN), {
    ...options,
    cache: "no-store",
    redirect: "error",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Api-Key": requiredEnv("PAKASIR_API_KEY"),
    },
    signal: AbortSignal.timeout(PAKASIR_REQUEST_TIMEOUT_MS),
  });
  const declaredLength = Number(response.headers.get("content-length") || "0");
  if (declaredLength > PAKASIR_MAX_RESPONSE_BYTES) {
    throw new Error("Pakasir API response is too large.");
  }
  const responseText = await response.text();
  if (Buffer.byteLength(responseText, "utf8") > PAKASIR_MAX_RESPONSE_BYTES) {
    throw new Error("Pakasir API response is too large.");
  }
  let data: Record<string, unknown> | null = null;
  try {
    data = asRecord(JSON.parse(responseText) as unknown);
  } catch {
    data = null;
  }
  if (!response.ok || !data) {
    const message =
      typeof data?.message === "string" ? data.message : "Unknown API error";
    throw new Error(`Pakasir API error: ${response.status} ${message}`);
  }
  return data;
}

export function assertPakasirTransactionMatches(params: {
  transaction: PakasirTransaction;
  txnId: string;
  orderId: string;
  amountIDR: number;
  requireCompleted?: boolean;
}) {
  const expectedTxnId = validateTxnId(params.txnId);
  const expectedOrderId = validateOrderId(params.orderId);
  const expectedAmount = validateAmountIDR(params.amountIDR);
  const mismatches: string[] = [];
  if (params.transaction.txnId !== expectedTxnId) {
    mismatches.push("txn_id");
  }
  if (params.transaction.orderId !== expectedOrderId) {
    mismatches.push("order_id");
  }
  if (params.transaction.amount !== expectedAmount) {
    mismatches.push("amount");
  }
  if (params.transaction.isSandbox) {
    mismatches.push("is_sandbox");
  }
  if (params.requireCompleted && params.transaction.status !== "completed") {
    mismatches.push("status");
  }
  if (mismatches.length > 0) {
    throw new Error(`Pakasir transaction mismatch: ${mismatches.join(", ")}.`);
  }
}
