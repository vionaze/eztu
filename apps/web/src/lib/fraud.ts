import type { NextRequest } from "next/server";
import { Prisma, prisma, type User } from "@kupon/db";
import {
  type DiscordFraudAction,
  type DiscordFraudSeverity,
  sendDiscordFraudAlert,
} from "@/lib/discord";
import {
  BULK_PURCHASE_THRESHOLD,
  MAX_SELF_SERVICE_QUANTITY,
} from "@/lib/checkout-limits";

export type FraudSeverity = DiscordFraudSeverity;
export type FraudAction = DiscordFraudAction;

type FraudSignal = {
  code: string;
  reason: string;
  severity: FraudSeverity;
  block: boolean;
};

export type CheckoutFraudInput = {
  productId: string;
  variantId: string;
  gameId: string;
  serverId: string;
  email: string;
  company?: string;
  checkoutStartedAt?: number | null;
  clientSubtotalIDR?: unknown;
  clientSubtotalUSD?: unknown;
  clientTotalIDR?: unknown;
  clientTotalUSD?: unknown;
  clientQuantity?: unknown;
};

export type FraudRequestContext = {
  ip: string;
  userAgent: string;
  origin: string;
  referer: string;
  acceptLanguage: string;
  secFetchSite: string;
  method: string;
  path: string;
};

export type CheckoutFraudAssessment = {
  shouldAlert: boolean;
  blocked: boolean;
  severity: FraudSeverity;
  reasons: string[];
  context: FraudRequestContext;
};

export type SecurityAlertInput = {
  eventType: string;
  severity: FraudSeverity;
  action: FraudAction;
  reasons: string[];
  requestContext: FraudRequestContext;
  email?: string;
  userId?: string;
  clerkUserId?: string;
  orderId?: string;
  productId?: string;
  variantId?: string;
  product?: string;
  variant?: string;
  metadata?: Record<string, unknown>;
};

const disposableEmailDomains = new Set([
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "temp-mail.org",
  "tempmail.com",
  "throwawaymail.com",
  "yopmail.com",
]);

const automationUserAgentPatterns = [
  /\b(bot|crawler|spider|scrapy)\b/i,
  /\b(curl|wget|python-requests|aiohttp|httpx|axios|node-fetch|undici|got)\b/i,
  /\b(postmanruntime|insomnia|okhttp|java|go-http-client|libwww-perl|php|ruby)\b/i,
  /\b(headlesschrome|phantomjs|selenium|playwright|puppeteer)\b/i,
];

const clientControlledMoneyFields = [
  "amount",
  "amountIDR",
  "amountUSD",
  "discountIDR",
  "discountUSD",
  "price",
  "priceIDR",
  "priceUSD",
  "subtotal",
  "subtotalIDR",
  "subtotalUSD",
  "total",
  "totalIDR",
  "totalUSD",
];

const severityRank: Record<FraudSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || "";
}

export function getClientIp(request: NextRequest) {
  return (
    firstHeaderValue(request.headers.get("cf-connecting-ip")) ||
    firstHeaderValue(request.headers.get("x-real-ip")) ||
    firstHeaderValue(request.headers.get("x-forwarded-for")) ||
    "unknown"
  );
}

export function getRequestContext(request: NextRequest): FraudRequestContext {
  return {
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent") || "",
    origin: request.headers.get("origin") || "",
    referer: request.headers.get("referer") || "",
    acceptLanguage: request.headers.get("accept-language") || "",
    secFetchSite: request.headers.get("sec-fetch-site") || "",
    method: request.method,
    path: request.nextUrl.pathname,
  };
}

export function getExpectedOrigins(request: NextRequest) {
  const origins = new Set<string>();
  const host = request.headers.get("host");
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (configuredAppUrl) {
    try {
      origins.add(new URL(configuredAppUrl).origin);
    } catch {
      // Ignore invalid env values here; app startup should validate critical env.
    }
  }

  if (host) {
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const protocol =
      forwardedProto ||
      (host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");
    origins.add(`${protocol}://${host}`);
  }

  return origins;
}

function getHighestSeverity(signals: FraudSignal[]): FraudSeverity {
  return signals.reduce<FraudSeverity>((highest, signal) => {
    return severityRank[signal.severity] > severityRank[highest]
      ? signal.severity
      : highest;
  }, "low");
}

function addSignal(
  signals: FraudSignal[],
  code: string,
  reason: string,
  severity: FraudSeverity,
  block = false
) {
  signals.push({ code, reason, severity, block });
}

function hasUnexpectedClientMoneyFields(body: Record<string, unknown>) {
  return clientControlledMoneyFields.filter((field) => field in body);
}

function parseClientNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Events that are operational noise — store in DB, never spam Discord as "Bot/Fraud". */
const DISCORD_SKIP_EVENTS = new Set([
  "user_context_changed",
  "supplier_callback_unknown_order",
]);

/**
 * Discord only for real risk: checkout blocks, high severity auth abuse, etc.
 * Medium-only flags stay in SecurityEvent / admin logs.
 */
function shouldNotifyDiscord(alert: SecurityAlertInput) {
  if (DISCORD_SKIP_EVENTS.has(alert.eventType)) return false;
  if (alert.action === "blocked") return true;
  if (alert.severity === "high") return true;
  return false;
}

export async function notifySecurityEvent(alert: SecurityAlertInput): Promise<void> {
  const action = alert.action === "blocked" ? "BLOCKED" : "FLAGGED";
  const severity = alert.severity.toUpperCase() as "LOW" | "MEDIUM" | "HIGH";
  const metadata = alert.metadata
    ? (JSON.parse(JSON.stringify(alert.metadata)) as Prisma.InputJsonObject)
    : Prisma.JsonNull;

  const tasks: Promise<unknown>[] = [
    prisma.securityEvent.create({
      data: {
        eventType: alert.eventType,
        severity,
        action,
        reasons: alert.reasons,
        ip: alert.requestContext.ip,
        userAgent: alert.requestContext.userAgent,
        route: alert.requestContext.path,
        method: alert.requestContext.method,
        origin: alert.requestContext.origin || null,
        referer: alert.requestContext.referer || null,
        email: alert.email || null,
        userId: alert.userId || null,
        clerkUserId: alert.clerkUserId || null,
        orderId: alert.orderId || null,
        productId: alert.productId || null,
        variantId: alert.variantId || null,
        metadata,
      },
    }),
  ];

  if (shouldNotifyDiscord(alert)) {
    tasks.push(
      sendDiscordFraudAlert({
        event: alert.eventType,
        severity: alert.severity,
        action: alert.action,
        reasons: alert.reasons,
        ip: alert.requestContext.ip,
        userAgent: alert.requestContext.userAgent,
        route: alert.requestContext.path,
        method: alert.requestContext.method,
        origin: alert.requestContext.origin,
        referer: alert.requestContext.referer,
        email: alert.email,
        productId: alert.productId,
        variantId: alert.variantId,
        product: alert.product,
        variant: alert.variant,
        userId: alert.userId,
        clerkUserId: alert.clerkUserId,
        orderId: alert.orderId,
        metadata: alert.metadata,
      })
    );
  }

  await Promise.allSettled(tasks);
}

export async function recordUserSecurityContext(
  user: Pick<User, "id" | "lastSeenIp" | "lastSeenUserAgent" | "lastSeenAt">,
  requestContext: FraudRequestContext,
  alertBase: Omit<SecurityAlertInput, "eventType" | "severity" | "action" | "reasons" | "requestContext">
) {
  const reasons: string[] = [];
  const currentIp = requestContext.ip;
  const currentUserAgent = requestContext.userAgent;

  if (
    currentIp !== "unknown" &&
    user.lastSeenIp &&
    user.lastSeenIp !== currentIp
  ) {
    reasons.push(`USER_IP_CHANGED: ${user.lastSeenIp} -> ${currentIp}`);
  }

  if (
    currentUserAgent &&
    user.lastSeenUserAgent &&
    user.lastSeenUserAgent !== currentUserAgent
  ) {
    reasons.push("USER_AGENT_CHANGED: user-agent changed since last checkout");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastSeenIp: currentIp,
      lastSeenUserAgent: currentUserAgent || null,
      lastSeenAt: new Date(),
    },
  });

  if (reasons.length === 0) return;

  await notifySecurityEvent({
    ...alertBase,
    eventType: "user_context_changed",
    severity: "medium",
    action: "flagged",
    reasons,
    requestContext,
    metadata: {
      previousIp: user.lastSeenIp,
      currentIp,
      previousUserAgent: user.lastSeenUserAgent,
      currentUserAgent,
      lastSeenAt: user.lastSeenAt?.toISOString() || null,
    },
  });
}

export function evaluateCheckoutFraud(
  request: NextRequest,
  input: CheckoutFraudInput
): CheckoutFraudAssessment {
  const context = getRequestContext(request);
  const signals: FraudSignal[] = [];

  // Block only hard automation UAs (curl/Postman/scrapers). Missing UA alone is flag, not block —
  // some privacy browsers strip headers.
  if (!context.userAgent) {
    addSignal(signals, "MISSING_USER_AGENT", "Request has no user-agent header", "medium", false);
  } else if (automationUserAgentPatterns.some((pattern) => pattern.test(context.userAgent))) {
    addSignal(
      signals,
      "AUTOMATION_USER_AGENT",
      "Automation client (curl/Postman/bot toolkit) blocked from checkout",
      "high",
      true
    );
  }

  if (context.origin) {
    const expectedOrigins = getExpectedOrigins(request);
    if (expectedOrigins.size > 0 && !expectedOrigins.has(context.origin)) {
      addSignal(signals, "UNEXPECTED_ORIGIN", `Unexpected origin: ${context.origin}`, "high", true);
    }
  }
  // Missing Origin: normal for same-origin navigations in some browsers / older WebViews.
  // Do not alert Discord for this alone (medium flag only if combined later).

  if (context.secFetchSite && !["same-origin", "same-site", "none"].includes(context.secFetchSite)) {
    addSignal(signals, "CROSS_SITE_CHECKOUT", `sec-fetch-site=${context.secFetchSite}`, "high", true);
  }

  // Missing Accept-Language is common; ignore unless we already have a hard block signal.

  if (input.company?.trim()) {
    addSignal(signals, "HONEYPOT_FILLED", "Hidden checkout field was filled", "high", true);
  }

  const email = input.email.trim().toLowerCase();
  if (email) {
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      addSignal(signals, "INVALID_EMAIL", "Recipient email is malformed", "high", true);
    }

    const emailDomain = email.split("@")[1] || "";
    if (disposableEmailDomains.has(emailDomain)) {
      addSignal(signals, "DISPOSABLE_EMAIL", `Disposable email domain: ${emailDomain}`, "medium");
    }
  }

  const fieldLimits: Array<[string, string, number]> = [
    ["productId", input.productId, 128],
    ["variantId", input.variantId, 128],
    ["gameId", input.gameId, 128],
    ["serverId", input.serverId, 128],
  ];

  for (const [name, value, maxLength] of fieldLimits) {
    if (value.length > maxLength) {
      addSignal(signals, "FIELD_TOO_LONG", `${name} exceeds ${maxLength} characters`, "high", true);
    }

    if (value.includes("\0")) {
      addSignal(signals, "NULL_BYTE_INPUT", `${name} contains a null byte`, "high", true);
    }
  }

  const clientQuantity = parseClientNumber(input.clientQuantity);
  if (clientQuantity !== null) {
    const block =
      !Number.isInteger(clientQuantity) ||
      clientQuantity <= 0 ||
      clientQuantity >= BULK_PURCHASE_THRESHOLD;

    if (block) {
      const reason =
        clientQuantity >= BULK_PURCHASE_THRESHOLD
          ? `Client sent quantity=${clientQuantity}; self-service checkout is limited to ${MAX_SELF_SERVICE_QUANTITY}`
          : `Client sent invalid quantity=${clientQuantity}`;

      addSignal(
        signals,
        "CLIENT_QUANTITY_POLICY_BLOCK",
        reason,
        clientQuantity < 0 ? "high" : "medium",
        true
      );
    }
  }

  const clientAmounts = [
    ["subtotalIDR", input.clientSubtotalIDR],
    ["subtotalUSD", input.clientSubtotalUSD],
    ["totalIDR", input.clientTotalIDR],
    ["totalUSD", input.clientTotalUSD],
  ] as const;

  for (const [name, rawValue] of clientAmounts) {
    const amount = parseClientNumber(rawValue);
    if (amount === null) continue;

    addSignal(
      signals,
      "CLIENT_PRICE_FIELD",
      `Client attempted to submit ${name}=${amount}; server ignores client prices`,
      amount < 0 ? "high" : "medium",
      amount < 0
    );
  }

  if (typeof input.checkoutStartedAt !== "number" || !Number.isFinite(input.checkoutStartedAt)) {
    // Timer is anti-bot soft signal only — never block legitimate sessions without it
    addSignal(signals, "MISSING_CHECKOUT_TIMER", "Client checkout timer is missing", "low");
  } else {
    const elapsedMs = Date.now() - input.checkoutStartedAt;

    // Instant submit (<400ms) is more suspicious; 750ms was noisy for fast clickers
    if (elapsedMs >= 0 && elapsedMs < 400) {
      addSignal(signals, "TOO_FAST_CHECKOUT", `Checkout submitted in ${elapsedMs}ms`, "medium");
    }

    // Stale timer (hours/days) is almost always test/probe noise — low only, never Discord alone
    if (elapsedMs < -30_000 || elapsedMs > 60 * 60 * 1000) {
      addSignal(signals, "STALE_CHECKOUT_TIMER", `Checkout timer delta is ${elapsedMs}ms`, "low");
    }
  }

  const blocked = signals.some((signal) => signal.block);
  // Alert (DB + maybe Discord) only when we block or have high severity — skip low/medium-only noise
  const severity = getHighestSeverity(signals);
  const shouldAlert =
    blocked || severity === "high" || signals.some((s) => s.severity === "medium" && s.block);

  return {
    shouldAlert,
    blocked,
    severity,
    reasons: signals.map((signal) => `${signal.code}: ${signal.reason}`),
    context,
  };
}

export function evaluateCheckoutBodyTampering(
  body: Record<string, unknown>
): Pick<CheckoutFraudAssessment, "shouldAlert" | "blocked" | "severity" | "reasons"> {
  const signals: FraudSignal[] = [];
  const unexpectedMoneyFields = hasUnexpectedClientMoneyFields(body);

  if (unexpectedMoneyFields.length > 0) {
    addSignal(
      signals,
      "CLIENT_MONEY_FIELDS",
      `Client sent server-owned money fields: ${unexpectedMoneyFields.join(", ")}`,
      "medium"
    );
  }

  if ("quantity" in body) {
    const quantity = parseClientNumber(body.quantity);
    if (quantity === null) {
      addSignal(signals, "INVALID_QUANTITY", "Client quantity is not numeric", "high", true);
    } else if (!Number.isInteger(quantity) || quantity <= 0) {
      addSignal(signals, "INVALID_QUANTITY", `Client quantity=${quantity}`, "high", true);
    } else if (quantity >= BULK_PURCHASE_THRESHOLD) {
      addSignal(
        signals,
        "BULK_QUANTITY_BLOCKED",
        `Client attempted self-service checkout for ${quantity} vouchers`,
        "medium",
        true
      );
    }
  }

  for (const field of unexpectedMoneyFields) {
    const amount = parseClientNumber(body[field]);
    if (amount !== null && amount < 0) {
      addSignal(signals, "NEGATIVE_AMOUNT", `${field}=${amount}`, "high", true);
    }
  }

  return {
    shouldAlert: signals.length > 0,
    blocked: signals.some((signal) => signal.block),
    severity: getHighestSeverity(signals),
    reasons: signals.map((signal) => `${signal.code}: ${signal.reason}`),
  };
}
