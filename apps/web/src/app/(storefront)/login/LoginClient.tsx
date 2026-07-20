"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignIn, useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";

const TOS_STORAGE_KEY = "eztopup_tos_accepted_v1";

/**
 * Clerk does not support injecting a custom Terms checkbox into their hosted
 * SignIn form. We gate the entire SignIn widget: form only mounts after accept,
 * with a short slide-up animation from below.
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
            Accept the Terms below to unlock sign-in. You will return to your
            previous page after login when possible.
          </p>
        </div>

        {/* Clerk form — slides up from bottom only after ToS is accepted */}
        <div className="relative min-h-[120px]">
          <AnimatePresence mode="wait" initial={false}>
            {acceptedTerms ? (
              <motion.div
                key="clerk-sign-in"
                initial={{ opacity: 0, y: 48 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{
                  type: "tween",
                  duration: 0.35,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="flex justify-center [&_.cl-rootBox]:mx-auto"
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
                className="rounded-2xl border border-dashed border-border bg-bg-secondary/40 px-6 py-12 text-center"
              >
                <p className="text-sm text-text-muted leading-relaxed">
                  Sign-in form appears here after you accept the Terms of
                  Service.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Terms checkbox — bottom of login stack (not inside Clerk UI) */}
        <div className="rounded-2xl border border-border bg-bg-card p-4 space-y-2 order-last">
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
                onClick={(e: MouseEvent<HTMLAnchorElement>) => e.stopPropagation()}
              >
                Terms of Service
              </Link>
              . I understand that once a voucher code is delivered, the
              transaction is complete.
            </span>
          </label>
          {!acceptedTerms && (
            <p className="text-xs text-text-muted pl-7">
              Check this box to enable the sign-in form above.
            </p>
          )}
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
