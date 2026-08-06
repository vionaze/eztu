const PAKASIR_ORIGIN = "https://app.pakasir.com";
const PAKASIR_DETAIL_PATH = "/api/transactiondetail";
const PAKASIR_REQUEST_TIMEOUT_MS = 10_000;
const PAKASIR_MAX_RESPONSE_BYTES = 64 * 1024;

export type PakasirTransactionStatus =
  | "pending"
  | "completed"
  | "failed"
  | "expired"
  | "cancelled"
  | "refunded"
  | string;

export type PakasirTransaction = {
  project: string;
  orderId: string;
  amount: number;
  status: PakasirTransactionStatus;
  paymentMethod: string | null;
  completedAt: string | null;
  raw: unknown;
};

export type PakasirWebhookNotification = {
  project: string;
  orderId: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
  completedAt: string | null;
  raw: unknown;
};

type PakasirTransactionEnvelope = {
  transaction?: unknown;
  message?: unknown;
};

function requiredEnv(name: "PAKASIR_PROJECT_SLUG" | "PAKASIR_API_KEY") {
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

export function createPakasirPaymentUrl(params: {
  orderId: string;
  amountIDR: number;
  redirectUrl: string;
  appUrl: string;
}) {
  const project = getPakasirProjectSlug();
  const orderId = validateOrderId(params.orderId);
  const amount = validateAmountIDR(params.amountIDR);
  const redirect = validateRedirectUrl(params.redirectUrl, params.appUrl);
  const url = new URL(
    `/pay/${encodeURIComponent(project)}/${amount}`,
    PAKASIR_ORIGIN
  );
  url.searchParams.set("order_id", orderId);
  url.searchParams.set("redirect", redirect);
  return url.toString();
}

function parseTransaction(value: unknown): PakasirTransaction {
  const row = asRecord(value);
  return {
    project: requiredString(row, "project"),
    orderId: requiredString(row, "order_id"),
    amount: requiredAmount(row),
    status: requiredString(row, "status").toLowerCase(),
    paymentMethod: optionalString(row, "payment_method"),
    completedAt: optionalString(row, "completed_at"),
    raw: value,
  };
}

export function parsePakasirWebhook(rawBody: string): PakasirWebhookNotification {
  const row = asRecord(JSON.parse(rawBody) as unknown);
  return {
    project: requiredString(row, "project"),
    orderId: requiredString(row, "order_id"),
    amount: requiredAmount(row),
    status: requiredString(row, "status").toLowerCase(),
    paymentMethod: optionalString(row, "payment_method"),
    completedAt: optionalString(row, "completed_at"),
    raw: row,
  };
}

export async function getPakasirTransactionDetail(params: {
  orderId: string;
  amountIDR: number;
}): Promise<PakasirTransaction> {
  const project = getPakasirProjectSlug();
  const apiKey = requiredEnv("PAKASIR_API_KEY");
  const orderId = validateOrderId(params.orderId);
  const amount = validateAmountIDR(params.amountIDR);
  const url = new URL(PAKASIR_DETAIL_PATH, PAKASIR_ORIGIN);
  url.searchParams.set("project", project);
  url.searchParams.set("amount", String(amount));
  url.searchParams.set("order_id", orderId);
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    redirect: "error",
    headers: { Accept: "application/json" },
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
  let data: PakasirTransactionEnvelope | null = null;
  try {
    data = JSON.parse(responseText) as PakasirTransactionEnvelope;
  } catch {
    data = null;
  }
  if (!response.ok || !data?.transaction) {
    const message =
      typeof data?.message === "string" ? data.message : "Unknown API error";
    throw new Error(`Pakasir API error: ${response.status} ${message}`);
  }
  return parseTransaction(data.transaction);
}

export function assertPakasirTransactionMatches(params: {
  transaction: PakasirTransaction | PakasirWebhookNotification;
  project: string;
  orderId: string;
  amountIDR: number;
  requireCompleted?: boolean;
}) {
  const expectedProject = validateProjectSlug(params.project);
  const expectedOrderId = validateOrderId(params.orderId);
  const expectedAmount = validateAmountIDR(params.amountIDR);
  const mismatches: string[] = [];
  if (params.transaction.project !== expectedProject) {
    mismatches.push("project");
  }
  if (params.transaction.orderId !== expectedOrderId) {
    mismatches.push("order_id");
  }
  if (params.transaction.amount !== expectedAmount) {
    mismatches.push("amount");
  }
  if (params.requireCompleted && params.transaction.status !== "completed") {
    mismatches.push("status");
  }
  if (mismatches.length > 0) {
    throw new Error(`Pakasir transaction mismatch: ${mismatches.join(", ")}.`);
  }
}
