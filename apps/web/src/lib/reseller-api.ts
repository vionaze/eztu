import "server-only";

import { NextResponse } from "next/server";
import { AccountBannedError, AuthenticationRequiredError, AuthorizationRequiredError } from "@/lib/clerk";
import { ResellerPricingError } from "@/lib/reseller-pricing-service";

export function resellerJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie, CF-IPCountry" } });
}

export function resellerApiError(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return resellerJson({ error: "Authentication required" }, 401);
  if (error instanceof AuthorizationRequiredError || error instanceof AccountBannedError) {
    return resellerJson({ error: "Access denied" }, 403);
  }
  if (error instanceof ResellerPricingError) return resellerJson({ error: error.message, code: error.code }, error.status);
  if (error && typeof error === "object" && "code" in error && (error.code === "P2034" || error.code === "P2002")) {
    return resellerJson({ error: "This price changed during your edit. Refresh and try again." }, 409);
  }
  console.error("[Reseller pricing] request failed", error instanceof Error ? error.name : "Unknown error");
  return resellerJson({ error: "Pricing is temporarily unavailable. Please try again." }, 503);
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) throw new AuthorizationRequiredError("Origin required.");
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new AuthorizationRequiredError("Invalid origin.");
  }
  if (parsed.host !== host || !["https:", "http:"].includes(parsed.protocol)) {
    throw new AuthorizationRequiredError("Origin mismatch.");
  }
}
