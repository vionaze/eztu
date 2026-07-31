"use client";

import { useEffect } from "react";

const COOKIE_CONSENT_KEY = "eztopup_cookie_consent_v1";

export default function BlogViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    let sent = false;

    const track = () => {
      if (sent) return;
      sent = true;
      void fetch(`/api/blog/${encodeURIComponent(slug)}/view`, {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
        headers: { Accept: "application/json" },
      }).catch(() => {
        // Analytics must never interfere with reading the article.
      });
    };

    const readConsent = () => {
      try {
        return localStorage.getItem(COOKIE_CONSENT_KEY);
      } catch {
        return null;
      }
    };

    if (readConsent() === "all") track();

    const onConsent = (event: Event) => {
      const detail = (
        event as CustomEvent<{ value?: "all" | "essential" }>
      ).detail;
      if (detail?.value === "all") track();
    };

    window.addEventListener("eztopup:cookie-consent", onConsent);
    return () => {
      window.removeEventListener("eztopup:cookie-consent", onConsent);
    };
  }, [slug]);

  return null;
}
