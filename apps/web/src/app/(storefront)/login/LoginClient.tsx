"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignIn, useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";

const TOS_STORAGE_KEY = "eztopup_tos_accepted_v1";

/**
 * Clerk does not support injecting a custom Terms checkbox into their hosted
 * SignIn form. We gate the SignIn widget: form only mounts after accept.
 * ToS sits ABOVE the form so the flow is obvious: check → form appears.
 */
export default function LoginClient({ redirectUrl }: { redirectUrl: string }) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(TOS_STORAGE_KEY);
      if (stored === "1") {
        setAcceptedTerms(true);
      }
    } catch {
      // ignore storage errors (private mode, etc.)
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace(redirectUrl);
    }
  }, [isLoaded, isSignedIn, redirectUrl, router]);

  const handleAcceptChange = (checked: boolean) => {
    setAcceptedTerms(checked);
    try {
      if (checked) {
        sessionStorage.setItem(TOS_STORAGE_KEY, "1");
      } else {
        sessionStorage.removeItem(TOS_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-[70dvh] pt-28 pb-16 flex items-center justify-center px-4">
      <div className="w-full max-w-md flex flex-col gap-5">
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-text-primary">
            Sign in to EZTopUp
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            Accept the Terms, then sign in with email or Google. You will return
            to your previous page when possible.
          </p>
        </div>

        {/* ToS first — unlocks Clerk form below */}
        <div className="rounded-2xl border border-border bg-bg-card p-4 space-y-2">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => handleAcceptChange(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 rounded border-border accent-[var(--accent)]"
              disabled={!hydrated}
              id="login-accept-tos"
            />
            <span className="text-sm text-text-secondary leading-relaxed">
              I have read and agree to the{" "}
              <Link
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-accent-hover font-medium underline-offset-2 hover:underline"
                onClick={(e: MouseEvent<HTMLAnchorElement>) =>
                  e.stopPropagation()
                }
              >
                Terms of Service
              </Link>
              . I understand that once a voucher code is delivered, the
              transaction is complete.
            </span>
          </label>
          {!acceptedTerms && (
            <p className="text-xs text-amber-400/90 pl-7">
              Centang dulu — form login Clerk muncul di bawah setelah accept.
            </p>
          )}
        </div>

        {/* Clerk form — only after ToS */}
        <div className="relative min-h-[140px]">
          <AnimatePresence mode="wait" initial={false}>
            {acceptedTerms ? (
              <motion.div
                key="clerk-sign-in"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{
                  type: "tween",
                  duration: 0.3,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="flex justify-center [&_.cl-rootBox]:mx-auto w-full"
              >
                <SignIn
                  routing="hash"
                  fallbackRedirectUrl={redirectUrl}
                  forceRedirectUrl={redirectUrl}
                />
              </motion.div>
            ) : (
              <motion.div
                key="clerk-locked"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border border-dashed border-border bg-bg-secondary/40 px-6 py-10 text-center"
              >
                <p className="text-sm text-text-muted leading-relaxed">
                  Form email / Google sign-in akan muncul di sini setelah Terms
                  di-centang.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-xs text-text-muted">
          Need help?{" "}
          <Link href="/contact" className="text-accent hover:text-accent-hover">
            Contact support
          </Link>
        </p>
      </div>
    </div>
  );
}
