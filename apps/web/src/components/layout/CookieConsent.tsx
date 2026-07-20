"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

export const COOKIE_CONSENT_KEY = "eztopup_cookie_consent_v1";

export type CookieConsentValue = "all" | "essential";

function readConsent(): CookieConsentValue | null {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (raw === "all" || raw === "essential") return raw;
  } catch {
    // private mode / blocked storage
  }
  return null;
}

function writeConsent(value: CookieConsentValue) {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch {
    // ignore
  }
  // Allow analytics hooks (if added later) to react
  window.dispatchEvent(
    new CustomEvent("eztopup:cookie-consent", { detail: { value } })
  );
}

/**
 * Bottom cookie notice: Accept all vs essential-only.
 * Essential cookies (auth/session) always run; optional tools should
 * check localStorage / eztopup:cookie-consent before loading.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const existing = readConsent();
    setVisible(existing === null);
    setHydrated(true);
  }, []);

  const choose = (value: CookieConsentValue) => {
    writeConsent(value);
    setVisible(false);
  };

  if (!hydrated) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="dialog"
          aria-labelledby="cookie-consent-title"
          aria-describedby="cookie-consent-desc"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: "tween", duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 bottom-0 z-[70] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6 pointer-events-none"
        >
          <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-border bg-bg-secondary/95 shadow-[var(--shadow-card)] p-4 md:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-6">
              <div className="flex-1 space-y-2 min-w-0">
                <h2
                  id="cookie-consent-title"
                  className="text-sm font-semibold text-text-primary"
                >
                  Cookies & privacy
                </h2>
                <p
                  id="cookie-consent-desc"
                  className="text-xs md:text-sm text-text-secondary leading-relaxed"
                >
                  We use essential cookies for login, security, and checkout.
                  Optional cookies (such as analytics) help us improve the site
                  and only run if you accept all. See our{" "}
                  <Link
                    href="/privacy"
                    className="text-accent hover:text-accent-hover font-medium underline-offset-2 hover:underline"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => choose("essential")}
                  className="h-10 px-4 rounded-xl border border-border bg-bg-card text-sm font-medium text-text-primary hover:border-accent/30 transition-colors cursor-pointer"
                >
                  Essential only
                </button>
                <button
                  type="button"
                  onClick={() => choose("all")}
                  className="h-10 px-4 rounded-xl bg-accent text-bg-primary text-sm font-medium hover:bg-accent-hover transition-colors cursor-pointer"
                >
                  Accept all
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
