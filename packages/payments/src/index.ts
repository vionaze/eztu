import crypto from "node:crypto";

const DEFAULT_NOWPAYMENTS_API_URL = "https://api.nowpayments.io/v1";

export type PaymentProvider = "nowpayments";

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

type NowPaymentsInvoiceResponse = {
  id?: string | number;
  invoice_id?: string | number;
  order_id?: string;
  token_id?: string;
  invoice_url?: string;
  payment_url?: string;
  success_url?: string;
  cancel_url?: string;
  partially_paid_url?: string;
  price_amount?: number;
  price_currency?: string;
  pay_currency?: string;
  payment_status?: string;
  created_at?: string;
  updated_at?: string;
};

type NowPaymentsIpnPayload = {
  payment_id?: string | number;
  invoice_id?: string | number;
  order_id?: string;
  payment_status?: string;
  pay_currency?: string;
  pay_amount?: number | string;
  actually_paid?: number | string;
  outcome_amount?: number | string;
  outcome_currency?: string;
  purchase_id?: string;
  price_amount?: number | string;
  price_currency?: string;
  pay_address?: string;
  tx_hash?: string;
  updated_at?: string;
};

type NowPaymentsPaymentResponse = {
  payment_id?: string | number;
  invoice_id?: string | number;
  order_id?: string;
  payment_status?: string;
  pay_currency?: string;
  pay_amount?: number | string;
  actually_paid?: number | string;
  outcome_amount?: number | string;
  outcome_currency?: string;
  purchase_id?: string;
  price_amount?: number | string;
  price_currency?: string;
  pay_address?: string;
  tx_hash?: string;
  updated_at?: string;
};

function getNowPaymentsApiKey() {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;

  if (!apiKey) {
    throw new Error("NOWPAYMENTS_API_KEY is required to create crypto payments.");
  }

  return apiKey;
}

function getNowPaymentsApiUrl() {
  const apiUrl = process.env.NOWPAYMENTS_API_URL || DEFAULT_NOWPAYMENTS_API_URL;
  const normalizedApiUrl = apiUrl.replace(/\/$/, "");

  if (!normalizedApiUrl.startsWith("https://")) {
    throw new Error("NOWPAYMENTS_API_URL must use https.");
  }

  return normalizedApiUrl;
}

function getNowPaymentsIpnSecret() {
  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;

  if (!ipnSecret) {
    throw new Error("NOWPAYMENTS_IPN_SECRET is required to verify crypto payment webhooks.");
  }

  return ipnSecret;
}

function getAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is required to create crypto payment URLs.");
  }

  return appUrl.replace(/\/$/, "");
}

function toNumber(value: number | string | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeNowPaymentsStatus(status: string | undefined): NormalizedPaymentStatus {
  switch ((status || "").toLowerCase()) {
    case "finished":
    case "confirmed":
    case "sending":
      return "paid";
    case "confirming":
    case "partially_paid":
      return "processing";
    case "failed":
      return "failed";
    case "expired":
      return "expired";
    case "refunded":
      return "refunded";
    case "waiting":
    default:
      return "pending";
  }
}

function mapPaymentUrl(data: NowPaymentsInvoiceResponse) {
  return data.invoice_url || data.payment_url;
}

function mapProviderPaymentId(data: NowPaymentsInvoiceResponse) {
  return data.id?.toString() || data.invoice_id?.toString();
}

function resolvePayCurrency(value?: string | null) {
  const payCurrency = value?.trim().toLowerCase();

  if (!payCurrency || payCurrency === "all") {
    return null;
  }

  return payCurrency;
}

export async function createPaymentInvoice(
  params: CreatePaymentInvoiceParams
): Promise<PaymentInvoice> {
  const appUrl = getAppUrl();
  const payCurrency = resolvePayCurrency(
    params.payCurrency || process.env.NOWPAYMENTS_PAY_CURRENCY
  );
  const body: Record<string, string | number | boolean> = {
    price_amount: Number(params.amountUSD.toFixed(2)),
    price_currency: "usd",
    order_id: params.orderId,
    order_description: params.description || `EZTopUp order ${params.orderNumber}`,
    ipn_callback_url: params.callbackUrl || `${appUrl}/api/payment/webhook`,
    success_url: params.successUrl || `${appUrl}/order/success`,
    cancel_url: params.cancelUrl || `${appUrl}/order/failed`,
    partially_paid_url: params.cancelUrl || `${appUrl}/order/failed`,
    is_fixed_rate: true,
    is_fee_paid_by_user: false,
  };

  if (payCurrency) {
    body.pay_currency = payCurrency;
  }

  const response = await fetch(`${getNowPaymentsApiUrl()}/invoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getNowPaymentsApiKey(),
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => null)) as
    | NowPaymentsInvoiceResponse
    | { message?: string; error?: string }
    | null;

  if (!response.ok) {
    const message =
      data && "message" in data
        ? data.message
        : data && "error" in data
          ? data.error
          : "Unknown NOWPayments API error";
    throw new Error(`NOWPayments API error: ${response.status} ${message || ""}`.trim());
  }

  if (!data || !("invoice_url" in data || "payment_url" in data)) {
    throw new Error("NOWPayments API response did not include a payment URL.");
  }

  const providerPaymentId = mapProviderPaymentId(data);
  const paymentUrl = mapPaymentUrl(data);

  if (!providerPaymentId || !paymentUrl) {
    throw new Error("NOWPayments API response did not include a usable invoice ID.");
  }

  return {
    provider: "nowpayments",
    providerPaymentId,
    providerInvoiceId: data.invoice_id?.toString() || null,
    paymentUrl,
    status: normalizeNowPaymentsStatus(data.payment_status),
    payCurrency: data.pay_currency || payCurrency,
    expiresAt: null,
    raw: data,
  };
}

export async function getPaymentStatus(paymentId: string): Promise<PaymentWebhookEvent> {
  const response = await fetch(`${getNowPaymentsApiUrl()}/payment/${paymentId}`, {
    headers: {
      "x-api-key": getNowPaymentsApiKey(),
    },
  });

  const data = (await response.json().catch(() => null)) as
    | NowPaymentsPaymentResponse
    | { message?: string; error?: string }
    | null;

  if (!response.ok) {
    const message =
      data && "message" in data
        ? data.message
        : data && "error" in data
          ? data.error
          : "Unknown NOWPayments API error";
    throw new Error(`NOWPayments API error: ${response.status} ${message || ""}`.trim());
  }

  if (!data || !("payment_id" in data || "invoice_id" in data)) {
    throw new Error("NOWPayments payment response did not include a usable payment ID.");
  }

  return mapNowPaymentsPaymentEvent(data);
}

function sortForSignature(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForSignature);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((sorted, key) => {
        sorted[key] = sortForSignature((value as Record<string, unknown>)[key]);
        return sorted;
      }, {});
  }

  return value;
}

export function verifyPaymentWebhook(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return false;
  }

  const sortedBody = JSON.stringify(sortForSignature(parsed));
  const calculated = crypto
    .createHmac("sha512", getNowPaymentsIpnSecret())
    .update(sortedBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculated, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

export function parsePaymentWebhook(rawBody: string): PaymentWebhookEvent {
  const body = JSON.parse(rawBody) as NowPaymentsIpnPayload;
  return mapNowPaymentsPaymentEvent(body);
}

function mapNowPaymentsPaymentEvent(
  body: NowPaymentsIpnPayload | NowPaymentsPaymentResponse
): PaymentWebhookEvent {
  const providerPaymentId = body.payment_id?.toString() || body.invoice_id?.toString();
  const orderId = body.order_id;
  const providerStatus = body.payment_status || "unknown";

  if (!providerPaymentId || !orderId) {
    throw new Error("NOWPayments webhook payload is missing payment_id or order_id.");
  }

  return {
    provider: "nowpayments",
    providerPaymentId,
    providerInvoiceId: body.invoice_id?.toString() || null,
    orderId,
    status: normalizeNowPaymentsStatus(providerStatus),
    providerStatus,
    payCurrency: body.pay_currency || body.outcome_currency || null,
    payAmount: toNumber(body.pay_amount),
    actuallyPaid: toNumber(body.actually_paid ?? body.outcome_amount),
    txHash: body.tx_hash || null,
    raw: body,
  };
}
