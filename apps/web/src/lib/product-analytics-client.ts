"use client";

import type { ProductAnalyticsEventName } from "@/lib/product-analytics";

const COOKIE_CONSENT_KEY = "eztopup_cookie_consent_v1";

export function trackProductEvent(payload: {
  productId: string;
  variantId?: string | null;
  eventType: ProductAnalyticsEventName;
  countryCode?: string | null;
  paymentMethod?: string | null;
  reason?: string | null;
}) {
  try {
    if (localStorage.getItem(COOKIE_CONSENT_KEY) !== "all") return;
  } catch {
    return;
  }

  void fetch("/api/products/analytics", {
    method: "POST",
    credentials: "same-origin",
    keepalive: true,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Analytics-Consent": "all",
    },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Analytics must never interrupt browsing or checkout.
  });
}
