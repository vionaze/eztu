import crypto from "node:crypto";

const DEFAULT_CRYPTOMUS_API_URL = "https://api.cryptomus.com/v1";

export type PaymentProvider = "cryptomus" | "pakasir";

export type NormalizedPaymentStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "expired"
  | "refunded";

export interface CreatePaymentInvoiceParams {
  orderId: string;
  orderNumber: string;
  amountUSD: number;
  description?: string;
  customerEmail?: string;
  payCurrency?: string;
  callbackUrl?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface PaymentInvoice {
  provider: PaymentProvider;
  providerPaymentId: string;
  providerInvoiceId?: string | null;
  paymentUrl: string;
  status: NormalizedPaymentStatus;
  payCurrency?: string | null;
  expiresAt?: Date | null;
  raw: unknown;
}

export interface PaymentWebhookEvent {
  provider: PaymentProvider;
  providerPaymentId: string;
  providerInvoiceId?: string | null;
  orderId: string;
  status: NormalizedPaymentStatus;
  providerStatus: string;
  payCurrency?: string | null;
  payAmount?: number | null;
  actuallyPaid?: number | null;
  txHash?: string | null;
  raw: unknown;
}

type CryptomusApiEnvelope<T> = {
  state?: number;
  result?: T;
  message?: string;
  errors?: Record<string, string[]>;
};

type CryptomusPaymentResult = {
  uuid?: string;
  order_id?: string;
  amount?: string | number;
  payment_amount?: string | number | null;
  payment_amount_usd?: string | number | null;
  payer_amount?: string | number | null;
  payer_currency?: string | null;
  currency?: string | null;
  network?: string | null;
  address?: string | null;
  from?: string | null;
  txid?: string | null;
  payment_status?: string;
  status?: string;
  url?: string;
  expired_at?: number | string;
  is_final?: boolean;
  additional_data?: string | null;
  merchant_amount?: string | number | null;
};

type CryptomusWebhookPayload = CryptomusPaymentResult & {
  type?: string;
  sign?: string;
  is_final?: boolean;
  status?: string;
  payment_status?: string;
};

function getCryptomusMerchantId() {
  const merchantId =
    process.env.CRYPTOMUS_MERCHANT_ID?.trim() ||
    process.env.CRYPTOMUS_MERCHANT_UUID?.trim() ||
    "";

  if (!merchantId) {
    throw new Error(
      "CRYPTOMUS_MERCHANT_ID is required to create crypto payments."
    );
  }

  return merchantId;
}

function getCryptomusPaymentApiKey() {
  const apiKey =
    process.env.CRYPTOMUS_PAYMENT_API_KEY?.trim() ||
    process.env.CRYPTOMUS_API_KEY?.trim() ||
    "";

  if (!apiKey) {
    throw new Error(
      "CRYPTOMUS_PAYMENT_API_KEY is required to create crypto payments."
    );
  }

  return apiKey;
}

function getCryptomusApiUrl() {
  const apiUrl = process.env.CRYPTOMUS_API_URL || DEFAULT_CRYPTOMUS_API_URL;
  const normalizedApiUrl = apiUrl.replace(/\/$/, "");

  if (!normalizedApiUrl.startsWith("https://")) {
    throw new Error("CRYPTOMUS_API_URL must use https.");
  }

  return normalizedApiUrl;
}

function getAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is required to create crypto payment URLs.");
  }

  return appUrl.replace(/\/$/, "");
}

/**
 * Cryptomus sign: md5(base64(jsonBody) + API_KEY)
 * PHP json_encode escapes slashes; Node must escape "/" as "\/" for webhook verify.
 */
export function createCryptomusSign(bodyJson: string, apiKey: string) {
  const base64Body = Buffer.from(bodyJson, "utf8").toString("base64");
  return crypto.createHash("md5").update(base64Body + apiKey).digest("hex");
}

function encodeCryptomusJson(payload: unknown) {
  // Match PHP json_encode default slash escaping for signature compatibility.
  return JSON.stringify(payload).replace(/\//g, "\\/");
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Cryptomus payment_status / status values → normalized.
 * @see https://doc.cryptomus.com/merchant-api/payments/payment-statuses
 */
export function normalizeCryptomusStatus(
  status: string | undefined,
  isFinal?: boolean
): NormalizedPaymentStatus {
  const value = (status || "").toLowerCase();

  switch (value) {
    case "paid":
    case "paid_over":
      return "paid";
    case "confirm_check":
    case "process":
    case "confirming":
    case "wrong_amount_waiting":
    case "wrong_amount":
    case "check":
      return "processing";
    case "refund_process":
      return "processing";
    case "refund_paid":
      return "refunded";
    case "fail":
    case "system_fail":
    case "refund_fail":
      return "failed";
    case "cancel":
    case "cancelled":
    case "canceled":
      return isFinal === false ? "pending" : "expired";
    case "locked":
      return "processing";
    default:
      return isFinal ? "failed" : "pending";
  }
}

function resolveLifetimeSeconds() {
  const minutes = Number(process.env.PAYMENT_INVOICE_EXPIRY_MINUTES || "60");
  const seconds = Math.round(
    (Number.isFinite(minutes) && minutes > 0 ? minutes : 60) * 60
  );
  return Math.min(43200, Math.max(300, seconds));
}

function buildAllowedCurrencies() {
  const raw =
    process.env.CRYPTOMUS_CURRENCIES?.trim() ||
    process.env.CRYPTOMUS_ALLOWED_CURRENCIES?.trim() ||
    "USDT,USDC";

  return raw
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean)
    .map((currency) => {
      const [code, network] = currency.split(":");
      if (network) {
        return { currency: code, network: network.toLowerCase() };
      }
      return { currency: code };
    });
}

async function cryptomusRequest<T>(
  path: string,
  payload: Record<string, unknown>
): Promise<T> {
  const bodyJson = encodeCryptomusJson(payload);
  const sign = createCryptomusSign(bodyJson, getCryptomusPaymentApiKey());

  const response = await fetch(`${getCryptomusApiUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      merchant: getCryptomusMerchantId(),
      sign,
    },
    body: bodyJson,
  });

  const data = (await response.json().catch(() => null)) as
    | CryptomusApiEnvelope<T>
    | null;

  if (!response.ok || !data || data.state !== 0 || data.result == null) {
    const message =
      data?.message ||
      (data?.errors ? JSON.stringify(data.errors) : null) ||
      "Unknown Cryptomus API error";
    throw new Error(
      `Cryptomus API error: ${response.status} ${message}`.trim()
    );
  }

  return data.result;
}

function mapExpiresAt(expiredAt: number | string | undefined): Date | null {
  if (typeof expiredAt === "number" && Number.isFinite(expiredAt)) {
    // Cryptomus expired_at is unix timestamp (seconds)
    return new Date(expiredAt * 1000);
  }
  if (typeof expiredAt === "string" && expiredAt.trim()) {
    const asNumber = Number(expiredAt);
    if (Number.isFinite(asNumber) && asNumber > 1_000_000_000) {
      return new Date(asNumber * 1000);
    }
    const parsed = new Date(expiredAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export async function createPaymentInvoice(
  params: CreatePaymentInvoiceParams
): Promise<PaymentInvoice> {
  const appUrl = getAppUrl();
  const amount = params.amountUSD.toFixed(2);
  const lifetime = resolveLifetimeSeconds();

  const payload: Record<string, unknown> = {
    amount,
    currency: "USD",
    order_id: params.orderId,
    url_return: params.cancelUrl || `${appUrl}/order/failed`,
    url_success: params.successUrl || `${appUrl}/order/success`,
    url_callback: params.callbackUrl || `${appUrl}/api/payment/webhook`,
    lifetime,
    is_payment_multiple: false,
    additional_data: params.description || `EZTopUp ${params.orderNumber}`,
  };

  // Prefer stablecoins: either force to_currency or restrict currencies list
  const toCurrency =
    params.payCurrency?.trim().toUpperCase() ||
    process.env.CRYPTOMUS_TO_CURRENCY?.trim().toUpperCase() ||
    "";

  if (toCurrency) {
    payload.to_currency = toCurrency;
  } else {
    const currencies = buildAllowedCurrencies();
    if (currencies.length > 0) {
      payload.currencies = currencies;
    }
  }

  const result = await cryptomusRequest<CryptomusPaymentResult>(
    "/payment",
    payload
  );

  if (!result.uuid || !result.url) {
    throw new Error(
      "Cryptomus API response did not include a payment uuid or url."
    );
  }

  const providerStatus = result.payment_status || result.status || "check";

  return {
    provider: "cryptomus",
    providerPaymentId: result.uuid,
    providerInvoiceId: result.uuid,
    paymentUrl: result.url,
    status: normalizeCryptomusStatus(providerStatus, result.is_final),
    payCurrency: result.payer_currency || result.currency || toCurrency || null,
    expiresAt: mapExpiresAt(result.expired_at),
    raw: result,
  };
}

export async function getPaymentStatus(
  paymentId: string
): Promise<PaymentWebhookEvent> {
  const uuid = paymentId.trim();
  if (!uuid) {
    throw new Error("paymentId is required.");
  }

  const result = await cryptomusRequest<CryptomusPaymentResult>(
    "/payment/info",
    { uuid }
  );

  return mapCryptomusPaymentEvent(result);
}

/**
 * Verify Cryptomus webhook body signature (sign field inside JSON).
 */
export function verifyPaymentWebhook(
  rawBody: string,
  _signatureHeader?: string | null
): boolean {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return false;
  }

  const sign = typeof parsed.sign === "string" ? parsed.sign : null;
  if (!sign) return false;

  const { sign: _sign, ...rest } = parsed;
  const encoded = encodeCryptomusJson(rest);
  let apiKey: string;
  try {
    apiKey = getCryptomusPaymentApiKey();
  } catch {
    return false;
  }

  const calculated = createCryptomusSign(encoded, apiKey);

  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculated, "utf8"),
      Buffer.from(sign, "utf8")
    );
  } catch {
    return calculated === sign;
  }
}

export function parsePaymentWebhook(rawBody: string): PaymentWebhookEvent {
  const body = JSON.parse(rawBody) as CryptomusWebhookPayload;
  return mapCryptomusPaymentEvent(body);
}

function mapCryptomusPaymentEvent(
  body: CryptomusPaymentResult | CryptomusWebhookPayload
): PaymentWebhookEvent {
  const providerPaymentId = body.uuid?.toString();
  const orderId = body.order_id?.toString();
  const providerStatus =
    body.status || body.payment_status || "unknown";

  if (!providerPaymentId || !orderId) {
    throw new Error(
      "Cryptomus webhook payload is missing uuid or order_id."
    );
  }

  const isFinal =
    typeof body.is_final === "boolean" ? body.is_final : undefined;

  return {
    provider: "cryptomus",
    providerPaymentId,
    providerInvoiceId: body.uuid?.toString() || null,
    orderId,
    status: normalizeCryptomusStatus(providerStatus, isFinal),
    providerStatus,
    payCurrency: body.payer_currency || body.currency || null,
    payAmount: toNumber(body.payer_amount ?? body.amount),
    actuallyPaid: toNumber(
      body.payment_amount_usd ?? body.payment_amount
    ),
    txHash: body.txid || null,
    raw: body,
  };
}

export {
  assertPakasirTransactionMatches,
  createPakasirPaymentUrl,
  getPakasirProjectSlug,
  getPakasirTransactionDetail,
  isPakasirConfigured,
  isPakasirEnvironmentEnabled,
  parsePakasirWebhook,
  type PakasirTransaction,
  type PakasirWebhookNotification,
} from "./pakasir";
