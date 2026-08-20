import "server-only";

export const SUPPLIER_PROVIDER = "supplier";

const DEFAULT_COUNTRY_CODE = "id";

export type SupplierTransaction = {
  id?: string;
  product_name?: string;
  note?: string;
  status?: string;
  voucher_code?: string | null;
};

export type SupplierOrderSnapshot = {
  code: string;
  status: string;
  tid: string | null;
  referenceId: string | null;
  transactions: SupplierTransaction[];
  voucherCodes: string[];
  raw: Record<string, unknown>;
};

type SupplierApiResponse<TData> = {
  code: string;
  data: TData | null;
};

type SupplierCreateOrderData = {
  tid?: string;
  total_price?: number | string;
  display_name?: string;
};

type SupplierOrderStatusData = {
  status?: string;
  tid?: string;
  reference_id?: string;
  transactions?: SupplierTransaction[];
};

export type SupplierProduct = {
  code: string;
  category_code?: string;
  name: string;
  provider_code?: string;
  price: number;
  country_code?: string;
  process_time?: number;
  status: string;
};

type SupplierProductsData = {
  products?: SupplierProduct[];
};

export class SupplierApiError extends Error {
  code?: string;
  httpStatus?: number;
  raw?: unknown;

  constructor(
    message: string,
    options: { code?: string; httpStatus?: number; raw?: unknown } = {}
  ) {
    super(message);
    this.name = "SupplierApiError";
    this.code = options.code;
    this.httpStatus = options.httpStatus;
    this.raw = options.raw;
  }
}

function cleanBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function getSupplierApiUrl() {
  const apiUrl = process.env.SUPPLIER_API_URL || "";

  if (!apiUrl.trim()) {
    throw new SupplierApiError("SUPPLIER_API_URL is required.");
  }

  return cleanBaseUrl(apiUrl);
}

function getSupplierSecretKey() {
  const key =
    process.env.SUPPLIER_SECRET_KEY ||
    process.env.SUPPLIER_API_KEY ||
    "";

  if (!key.trim()) {
    throw new SupplierApiError("SUPPLIER_SECRET_KEY is required.");
  }

  return key.trim();
}

function getSupplierCountryCode() {
  return (
    process.env.SUPPLIER_COUNTRY_CODE ||
    DEFAULT_COUNTRY_CODE
  )
    .trim()
    .toLowerCase();
}

export function isSupplierProductCode(value: string | null | undefined) {
  const code = value?.trim();
  if (!code) return false;
  if (/\s/.test(code)) return false;
  return /^[a-z0-9][a-z0-9._-]*$/i.test(code);
}

export function getSupplierOrderCallbackUrl() {
  const explicitUrl =
    process.env.ORDER_STATUS_CALLBACK_URL?.trim() ||
    process.env.SUPPLIER_ORDER_CALLBACK_URL?.trim();
  if (explicitUrl) return explicitUrl;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) {
    throw new SupplierApiError(
      "NEXT_PUBLIC_APP_URL is required to build the order callback URL."
    );
  }

  const callbackUrl = new URL("/api/callback/order", appUrl);
  const callbackToken =
    process.env.ORDER_STATUS_CALLBACK_TOKEN?.trim() ||
    process.env.SUPPLIER_CALLBACK_TOKEN?.trim();
  if (callbackToken) {
    callbackUrl.searchParams.set("token", callbackToken);
  }

  return callbackUrl.toString();
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseJsonBody(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function readResponseCode(raw: unknown) {
  const record = toRecord(raw);
  return typeof record.code === "string" ? record.code : undefined;
}

async function requestSupplier<TData>(
  path: string,
  init: RequestInit = {}
): Promise<SupplierApiResponse<TData>> {
  const response = await fetch(`${getSupplierApiUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${getSupplierSecretKey()}`,
      ...init.headers,
    },
    cache: "no-store",
  });
  const text = await response.text();
  const raw = parseJsonBody(text);
  const code = readResponseCode(raw);

  if (!response.ok) {
    throw new SupplierApiError(
      `Supplier API error: ${response.status}${code ? ` ${code}` : ""}`,
      { code, httpStatus: response.status, raw }
    );
  }

  const record = toRecord(raw);
  if (typeof record.code !== "string") {
    throw new SupplierApiError("Supplier API response is invalid.", {
      raw,
    });
  }

  return {
    code: record.code,
    data: (record.data ?? null) as TData | null,
  };
}

function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeTransactions(value: unknown): SupplierTransaction[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => {
      return Boolean(item && typeof item === "object" && !Array.isArray(item));
    })
    .map((item) => ({
      id: getString(item.id) || undefined,
      product_name: getString(item.product_name) || undefined,
      note: getString(item.note) || undefined,
      status: getString(item.status) || undefined,
      voucher_code: getString(item.voucher_code),
    }));
}

export function extractSupplierVoucherCodes(
  transactions: SupplierTransaction[]
) {
  const uniqueCodes = new Set<string>();

  for (const transaction of transactions) {
    const code = transaction.voucher_code?.trim();
    if (code) uniqueCodes.add(code);
  }

  return [...uniqueCodes];
}

export function redactSupplierSnapshot(snapshot: SupplierOrderSnapshot) {
  return {
    code: snapshot.code,
    status: snapshot.status,
    tid: snapshot.tid,
    referenceId: snapshot.referenceId,
    voucherCodeCount: snapshot.voucherCodes.length,
    transactionCount: snapshot.transactions.length,
    transactions: snapshot.transactions.map((transaction) => ({
      id: transaction.id,
      product_name: transaction.product_name,
      status: transaction.status,
      hasVoucherCode: Boolean(transaction.voucher_code),
    })),
  };
}

export async function createSupplierOrder(params: {
  orderNumber: string;
  productCode: string;
  quantity: number;
  unitPriceIDR?: number | null;
  gameId?: string | null;
  serverId?: string | null;
  endUserIpAddress?: string | null;
  countryCode?: string | null;
}) {
  const productCode = params.productCode.trim();
  if (!isSupplierProductCode(productCode)) {
    throw new SupplierApiError("Supplier product_code is missing or invalid.");
  }

  const payload: Record<string, unknown> = {
    count_order: params.quantity,
    product_code: productCode,
    country_code: params.countryCode?.trim().toLowerCase() || getSupplierCountryCode(),
    partner_reference_id: params.orderNumber,
    override_callback_url: getSupplierOrderCallbackUrl(),
  };

  if (params.unitPriceIDR && params.unitPriceIDR > 0) {
    payload.price = params.unitPriceIDR;
  }

  const gameId = params.gameId?.trim();
  if (gameId && gameId !== "voucher") {
    payload.user_id = gameId;
  }

  const serverId = params.serverId?.trim();
  if (serverId) {
    payload.additional_id = serverId;
  }

  const ip = params.endUserIpAddress?.trim();
  if (ip && !["unknown", "system", "provider"].includes(ip)) {
    payload.end_user_ip_address = ip;
  }

  const result = await requestSupplier<SupplierCreateOrderData>(
    "/api/order",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
  const accepted = result.code === "SUCCESS" || result.code === "TRANSACTION_EXIST";
  const tid = getString(result.data?.tid);
  const totalPrice = getNumber(result.data?.total_price);

  if (!accepted || !tid) {
    throw new SupplierApiError(
      `Supplier order was not accepted: ${result.code}`,
      { code: result.code, raw: result }
    );
  }

  return {
    code: result.code,
    tid,
    totalPrice,
    raw: result as unknown as Record<string, unknown>,
  };
}

function normalizeSupplierProduct(value: unknown): SupplierProduct | null {
  const product = toRecord(value);
  const code = getString(product.code);
  const name = getString(product.name);
  const price = getNumber(product.price);
  const status = getString(product.status);
  if (!code || !name || price === null || price <= 0 || !status) return null;

  return {
    code,
    name,
    price: Math.round(price),
    status: status.toLowerCase(),
    category_code: getString(product.category_code) || undefined,
    provider_code: getString(product.provider_code) || undefined,
    country_code: getString(product.country_code)?.toLowerCase() || undefined,
    process_time: getNumber(product.process_time) || undefined,
  };
}

function normalizeSupplierProducts(value: unknown) {
  const products = toRecord(value).products;
  if (!Array.isArray(products)) return [];
  return products
    .map(normalizeSupplierProduct)
    .filter((product): product is SupplierProduct => Boolean(product));
}

export async function getSupplierProduct(params: {
  productCode: string;
  countryCode: string;
}) {
  const productCode = params.productCode.trim();
  if (!isSupplierProductCode(productCode)) {
    throw new SupplierApiError("Supplier product_code is missing or invalid.");
  }
  const search = new URLSearchParams({
    product_code: productCode,
    country_code: params.countryCode.trim().toLowerCase(),
  });
  const result = await requestSupplier<SupplierProductsData>(
    `/api/product?${search.toString()}`,
  );
  if (result.code !== "SUCCESS") {
    throw new SupplierApiError(`Supplier product lookup failed: ${result.code}`, {
      code: result.code,
      raw: result,
    });
  }
  const product = normalizeSupplierProducts(result.data).find(
    (candidate) => candidate.code === productCode,
  );
  if (!product) {
    throw new SupplierApiError(`Supplier product not found: ${productCode}`, {
      code: "PRODUCT_NOT_FOUND",
      raw: result,
    });
  }
  return product;
}

export async function getSupplierProducts(countryCode: string) {
  const search = new URLSearchParams({
    country_code: countryCode.trim().toLowerCase(),
  });
  const result = await requestSupplier<SupplierProductsData>(
    `/api/all-products?${search.toString()}`,
  );
  if (result.code !== "SUCCESS") {
    throw new SupplierApiError(`Supplier catalog refresh failed: ${result.code}`, {
      code: result.code,
      raw: result,
    });
  }
  return normalizeSupplierProducts(result.data);
}

export async function getSupplierOrderStatus(params: {
  tid?: string | null;
  partnerReferenceId?: string | null;
}): Promise<SupplierOrderSnapshot> {
  const searchParams = new URLSearchParams();
  if (params.tid?.trim()) searchParams.set("tid", params.tid.trim());
  if (params.partnerReferenceId?.trim()) {
    searchParams.set("partner_reference_id", params.partnerReferenceId.trim());
  }

  if (searchParams.size === 0) {
    throw new SupplierApiError(
      "Supplier order status requires tid or partner_reference_id."
    );
  }

  const result = await requestSupplier<SupplierOrderStatusData>(
    `/api/order_status?${searchParams.toString()}`
  );

  return parseSupplierSnapshot(result);
}

export function parseSupplierCallbackPayload(
  body: unknown
): SupplierOrderSnapshot {
  const record = toRecord(body);
  const code = getString(record.code) || "UNKNOWN";
  const data = toRecord(record.data);
  const transactions = normalizeTransactions(data.transactions);

  return {
    code,
    status: getString(data.status) || code,
    tid: getString(data.tid),
    referenceId: getString(data.reference_id),
    transactions,
    voucherCodes: extractSupplierVoucherCodes(transactions),
    raw: record,
  };
}

function parseSupplierSnapshot(
  response: SupplierApiResponse<SupplierOrderStatusData>
): SupplierOrderSnapshot {
  const data = toRecord(response.data);
  const transactions = normalizeTransactions(data.transactions);

  return {
    code: response.code,
    status: getString(data.status) || response.code,
    tid: getString(data.tid),
    referenceId: getString(data.reference_id),
    transactions,
    voucherCodes: extractSupplierVoucherCodes(transactions),
    raw: response as unknown as Record<string, unknown>,
  };
}
