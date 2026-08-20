import { createHmac, timingSafeEqual } from "node:crypto";
import { idrToUsdCentsCeil } from "./money.ts";

export type FxRate = {
  usdIdrRate: number;
  source: "openexchangerates" | "currencyfreaks" | "override";
  quotedAt: Date;
};

export type PricingQuote = {
  version: 2;
  variantId: string;
  quantity: number;
  paymentMethod: "pakasir" | "crypto";
  supplierCostIDR: number;
  supplierCountryCode: string;
  pricingMarkupBps: number;
  unitPriceIDR: number;
  totalIDR: number;
  totalUSDCents: number;
  usdIdrRate: number;
  fxSource: FxRate["source"];
  quotedAt: string;
  expiresAt: string;
};

type CachedRate = FxRate & { cachedAt: number };

let rateCache: CachedRate | null = null;

function positiveNumber(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function maxStaleMs() {
  const minutes = positiveNumber(process.env.FX_MAX_STALE_MINUTES) || 360;
  return minutes * 60_000;
}

function cacheMs() {
  const minutes = positiveNumber(process.env.FX_CACHE_MINUTES) || 10;
  return minutes * 60_000;
}

function quoteLifetimeMs() {
  const minutes = positiveNumber(process.env.FX_QUOTE_LIFETIME_MINUTES) || 10;
  return minutes * 60_000;
}

async function fetchOpenExchangeRates(): Promise<FxRate | null> {
  const appId = process.env.OPEN_EXCHANGE_RATES_APP_ID?.trim();
  if (!appId) return null;
  const response = await fetch(
    `https://openexchangerates.org/api/latest.json?app_id=${encodeURIComponent(appId)}&symbols=IDR`,
    { cache: "no-store", signal: AbortSignal.timeout(5_000) }
  );
  if (!response.ok) throw new Error(`Open Exchange Rates returned ${response.status}`);
  const data = (await response.json()) as {
    timestamp?: number;
    rates?: { IDR?: number | string };
  };
  const rate = positiveNumber(data.rates?.IDR);
  if (!rate) throw new Error("Open Exchange Rates response has no valid IDR rate");
  const quotedAt = data.timestamp ? new Date(data.timestamp * 1000) : new Date();
  return { usdIdrRate: rate, source: "openexchangerates", quotedAt };
}

async function fetchCurrencyFreaks(): Promise<FxRate | null> {
  const apiKey = process.env.CURRENCYFREAKS_API_KEY?.trim();
  if (!apiKey) return null;
  const response = await fetch(
    `https://api.currencyfreaks.com/v2.0/rates/latest?apikey=${encodeURIComponent(apiKey)}&symbols=IDR`,
    { cache: "no-store", signal: AbortSignal.timeout(5_000) }
  );
  if (!response.ok) throw new Error(`CurrencyFreaks returned ${response.status}`);
  const data = (await response.json()) as {
    date?: string;
    rates?: { IDR?: number | string };
  };
  const rate = positiveNumber(data.rates?.IDR);
  if (!rate) throw new Error("CurrencyFreaks response has no valid IDR rate");
  const quotedAt = data.date ? new Date(data.date) : new Date();
  return { usdIdrRate: rate, source: "currencyfreaks", quotedAt };
}

function ensureFresh(rate: FxRate, now = Date.now()) {
  const age = now - rate.quotedAt.getTime();
  if (!Number.isFinite(age) || age < -5 * 60_000 || age > maxStaleMs()) {
    throw new Error(`FX rate from ${rate.source} is stale or has an invalid timestamp`);
  }
  return rate;
}

export async function getUsdIdrRate(): Promise<FxRate> {
  const now = Date.now();
  if (rateCache && now - rateCache.cachedAt <= cacheMs()) {
    return ensureFresh(rateCache, now);
  }

  const override = positiveNumber(process.env.FX_USD_IDR_RATE_OVERRIDE);
  if (override) {
    const result: CachedRate = {
      usdIdrRate: override,
      source: "override",
      quotedAt: new Date(now),
      cachedAt: now,
    };
    rateCache = result;
    return result;
  }

  const errors: string[] = [];
  for (const provider of [fetchOpenExchangeRates, fetchCurrencyFreaks]) {
    try {
      const result = await provider();
      if (!result) continue;
      ensureFresh(result, now);
      rateCache = { ...result, cachedAt: now };
      return result;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (rateCache) {
    try {
      return ensureFresh(rateCache, now);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(
    `No fresh USD/IDR rate is available. Configure OPEN_EXCHANGE_RATES_APP_ID or CURRENCYFREAKS_API_KEY.${errors.length ? ` ${errors.join("; ")}` : ""}`
  );
}

export function createPricingQuote(params: {
  variantId: string;
  quantity: number;
  paymentMethod: "pakasir" | "crypto";
  supplierCostIDR: number;
  supplierCountryCode: string;
  pricingMarkupBps: number;
  unitPriceIDR: number;
  rate: FxRate;
  now?: Date;
}): PricingQuote {
  if (
    !params.variantId ||
    !Number.isSafeInteger(params.quantity) ||
    params.quantity < 1 ||
    !["pakasir", "crypto"].includes(params.paymentMethod) ||
    !Number.isSafeInteger(params.supplierCostIDR) ||
    params.supplierCostIDR < 0 ||
    !params.supplierCountryCode ||
    !Number.isSafeInteger(params.pricingMarkupBps) ||
    params.pricingMarkupBps < 0
  ) {
    throw new Error("Invalid quote product or quantity");
  }
  const now = params.now || new Date();
  const totalIDR = params.unitPriceIDR * params.quantity;
  return {
    version: 2,
    variantId: params.variantId,
    quantity: params.quantity,
    paymentMethod: params.paymentMethod,
    supplierCostIDR: params.supplierCostIDR,
    supplierCountryCode: params.supplierCountryCode,
    pricingMarkupBps: params.pricingMarkupBps,
    unitPriceIDR: params.unitPriceIDR,
    totalIDR,
    totalUSDCents: idrToUsdCentsCeil(totalIDR, params.rate.usdIdrRate),
    usdIdrRate: params.rate.usdIdrRate,
    fxSource: params.rate.source,
    quotedAt: params.rate.quotedAt.toISOString(),
    expiresAt: new Date(now.getTime() + quoteLifetimeMs()).toISOString(),
  };
}

function quoteSecret() {
  const secret = process.env.FX_QUOTE_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("FX_QUOTE_SECRET must be configured with at least 32 characters");
  }
  return secret;
}

export function signPricingQuote(quote: PricingQuote, secret = quoteSecret()): string {
  const payload = Buffer.from(JSON.stringify(quote), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyPricingQuote(
  token: string,
  params: {
    variantId: string;
    quantity: number;
    paymentMethod: "pakasir" | "crypto";
    supplierCostIDR: number;
    supplierCountryCode: string;
    pricingMarkupBps: number;
    unitPriceIDR: number;
    now?: Date;
  },
  secret = quoteSecret()
): PricingQuote {
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) throw new Error("Invalid pricing quote token");
  const expectedSignature = createHmac("sha256", secret).update(payload).digest();
  const supplied = Buffer.from(suppliedSignature, "base64url");
  if (supplied.length !== expectedSignature.length || !timingSafeEqual(supplied, expectedSignature)) {
    throw new Error("Pricing quote signature is invalid");
  }
  const quote = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PricingQuote;
  const now = params.now || new Date();
  if (
    quote.version !== 2 ||
    quote.variantId !== params.variantId ||
    quote.quantity !== params.quantity ||
    quote.paymentMethod !== params.paymentMethod ||
    quote.supplierCostIDR !== params.supplierCostIDR ||
    quote.supplierCountryCode !== params.supplierCountryCode ||
    quote.pricingMarkupBps !== params.pricingMarkupBps ||
    quote.unitPriceIDR !== params.unitPriceIDR ||
    quote.totalIDR !== params.unitPriceIDR * params.quantity
  ) {
    throw new Error("Pricing quote does not match the current product");
  }
  if (new Date(quote.expiresAt).getTime() <= now.getTime()) {
    throw new Error("Pricing quote has expired");
  }
  return quote;
}

export function resetFxCacheForTests() {
  rateCache = null;
}
