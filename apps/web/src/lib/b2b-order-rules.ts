import { createHmac, timingSafeEqual } from "node:crypto";

export const B2B_QUOTE_VERSION = 1;
export const B2B_QUOTE_TTL_MINUTES = 15;

/** Provisional safety caps for the controlled Phase 4b rollout. Raise only after supplier-safe bulk validation. */
export const MAX_B2B_ORDER_LINES = 10;
export const MAX_B2B_LINE_QUANTITY = 20;

export type B2BPaymentMethodValue = "CRYPTO" | "PAKASIR";

export type B2BQuoteLine = {
  variantId: string;
  supplierSku: string;
  countryCode: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPriceIDR: number;
  supplierCostIDR: number;
  ruleId: string;
  ruleRevision: number;
  mode: "MARKUP" | "FIXED";
  markupMicros: number | null;
  fixedPriceIDR: number | null;
};

export type B2BQuotePayload = {
  v: number;
  ch: "RESELLER_B2B";
  org: string;
  user: string;
  fp: string;
  exp: string;
  totalIDR: number;
  lines: B2BQuoteLine[];
};

export function validateB2BLines(lines: unknown) {
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > MAX_B2B_ORDER_LINES) {
    return { ok: false as const, error: `An order needs between 1 and ${MAX_B2B_ORDER_LINES} lines.` };
  }
  const seen = new Set<string>();
  const parsed: { variantId: string; quantity: number }[] = [];
  for (const raw of lines) {
    const item = raw as { variantId?: unknown; quantity?: unknown };
    const variantId = typeof item?.variantId === "string" ? item.variantId.trim() : "";
    const quantity = item?.quantity;
    if (!variantId || !Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > MAX_B2B_LINE_QUANTITY) {
      return { ok: false as const, error: `Each line needs a package and a quantity between 1 and ${MAX_B2B_LINE_QUANTITY}.` };
    }
    if (seen.has(variantId)) return { ok: false as const, error: "Duplicate package in one order." };
    seen.add(variantId);
    parsed.push({ variantId, quantity: quantity as number });
  }
  return { ok: true as const, lines: parsed };
}

export function buildRequestFingerprint(
  organizationId: string,
  lines: { variantId: string; quantity: number }[],
  paymentMethod: B2BPaymentMethodValue,
) {
  const normalized = [...lines]
    .map((line) => `${line.variantId}x${line.quantity}`)
    .sort()
    .join("|");
  return createHmac("sha256", "b2b-fingerprint")
    .update(`${organizationId}|${paymentMethod}|${normalized}`)
    .digest("hex");
}

function quoteSecret() {
  const secret = process.env.FX_QUOTE_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("FX_QUOTE_SECRET must be configured with at least 32 characters");
  }
  return secret;
}

export function signB2BQuote(payload: B2BQuotePayload, secret = quoteSecret()) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyB2BQuote(token: string, now = new Date(), secret = quoteSecret()): B2BQuotePayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  let payload: B2BQuotePayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as B2BQuotePayload;
  } catch {
    return null;
  }
  if (payload.v !== B2B_QUOTE_VERSION || payload.ch !== "RESELLER_B2B") return null;
  const expires = Date.parse(payload.exp);
  if (!Number.isFinite(expires) || expires <= now.getTime()) return null;
  if (!Array.isArray(payload.lines) || payload.lines.length < 1) return null;
  return payload;
}

export type B2BIntentStatusValue = "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REVIEW";

/** Payment intent statuses only move forward; PAID and REVIEW never regress. */
export function canAdvanceIntent(current: B2BIntentStatusValue, next: B2BIntentStatusValue) {
  if (current === next) return false;
  if (current === "PAID" || current === "REVIEW") return false;
  if (next === "REVIEW") return true;
  if (current === "PENDING") return next === "PAID" || next === "FAILED" || next === "EXPIRED";
  return false;
}

export function mapNormalizedStatus(status: string): B2BIntentStatusValue {
  switch (status) {
    case "paid":
      return "PAID";
    case "failed":
      return "FAILED";
    case "expired":
      return "EXPIRED";
    case "refunded":
      return "REVIEW";
    default:
      return "PENDING";
  }
}
