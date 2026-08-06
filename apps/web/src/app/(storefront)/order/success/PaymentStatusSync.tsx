"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@kupon/ui";
import {
  ArrowRight,
  CheckCircle,
  House,
  SpinnerGap,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";

const SUCCESS_STATUSES = new Set(["PAID", "PROCESSING", "COMPLETED"]);
const FAILURE_STATUSES = new Set([
  "FAILED",
  "EXPIRED",
  "DISPUTED",
  "REFUNDED",
]);
const REDIRECT_SECONDS = 5;

type PaymentResult = {
  status: string | null;
  message: string;
  orderNumber: string | null;
};

type StatusResponse = {
  status?: string;
  message?: string;
  paymentProvider?: string | null;
  orderNumber?: string;
  error?: string;
};

export default function PaymentStatusSync() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("NP_id");
  const orderId = searchParams.get("orderId");
  const hasReference = Boolean(paymentId || orderId);
  const [result, setResult] = useState<PaymentResult>({
    status: null,
    message: "",
    orderNumber: null,
  });
  const [checking, setChecking] = useState(hasReference);
  const [requestError, setRequestError] = useState("");
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);

  const successful = Boolean(
    result.status && SUCCESS_STATUSES.has(result.status)
  );
  const failed = Boolean(result.status && FAILURE_STATUSES.has(result.status));

  useEffect(() => {
    if (!hasReference) return;

    let cancelled = false;
    let pakasirSyncAttempted = false;
    let timer: number | null = null;

    async function syncPaymentStatus() {
      try {
        const response = orderId
          ? await fetch(
              `/api/payment/status?orderId=${encodeURIComponent(orderId)}`,
              { cache: "no-store" }
            )
          : await fetch("/api/payment/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentId }),
            });
        const data = (await response.json()) as StatusResponse;

        if (!response.ok) {
          throw new Error(
            data.error || "Payment status is temporarily unavailable."
          );
        }

        let verified = data;
        if (
          orderId &&
          data.paymentProvider === "pakasir" &&
          !pakasirSyncAttempted &&
          data.status &&
          !SUCCESS_STATUSES.has(data.status)
        ) {
          pakasirSyncAttempted = true;
          const syncResponse = await fetch("/api/payment/pakasir/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId }),
          });
          const syncData = (await syncResponse.json()) as StatusResponse;
          if (syncResponse.ok && syncData.status) {
            verified = { ...data, ...syncData };
          }
        }

        if (!cancelled && verified.status) {
          setResult({
            status: verified.status,
            message: verified.message || data.message || "",
            orderNumber: verified.orderNumber || data.orderNumber || null,
          });
          setRequestError("");
          setChecking(false);

          if (
            SUCCESS_STATUSES.has(verified.status) ||
            FAILURE_STATUSES.has(verified.status)
          ) {
            if (timer) window.clearInterval(timer);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setRequestError(
            error instanceof Error
              ? error.message
              : "Payment status is temporarily unavailable."
          );
          setChecking(false);
        }
      }
    }

    void syncPaymentStatus();
    timer = window.setInterval(() => void syncPaymentStatus(), 3000);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [hasReference, orderId, paymentId]);

  useEffect(() => {
    if (!successful) return;

    let redirected = false;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(REDIRECT_SECONDS - elapsedSeconds, 0);
      setCountdown(remaining);

      if (remaining === 0 && !redirected) {
        redirected = true;
        window.clearInterval(timer);
        router.replace("/");
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [router, successful]);

  const statusLabel = useMemo(
    () => result.status?.replaceAll("_", " ") || "CHECKING",
    [result.status]
  );

  if (!hasReference) {
    return (
      <ResultCard
        icon={<WarningCircle size={38} weight="fill" />}
        iconClass="bg-amber-400/10 text-amber-300"
        eyebrow="Order return"
        title="Order reference missing"
        description="Open your purchase history to check the latest order and payment status."
      />
    );
  }

  if (successful) {
    return (
      <Card
        variant="glass"
        padding="lg"
        className="relative w-full max-w-lg overflow-hidden border-emerald-400/20 text-center"
      >
        <div className="pointer-events-none absolute inset-x-10 -top-24 h-48 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative space-y-5">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 shadow-[0_0_45px_rgba(52,211,153,0.14)]">
            <CheckCircle size={43} weight="fill" />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
              Payment confirmed
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">
              Payment successful
            </h1>
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-text-secondary">
              {result.message ||
                "Your payment was received and your order is being processed."}
            </p>
          </div>

          <StatusPill status={statusLabel} orderNumber={result.orderNumber} />

          <div className="mx-auto flex w-fit items-center gap-3 rounded-full border border-border bg-bg-card/70 py-2 pl-2 pr-4">
            <CountdownRing value={countdown} />
            <p
              className="text-left text-xs leading-snug text-text-muted"
              aria-live="polite"
            >
              Returning to Home in
              <span className="block font-semibold text-text-primary">
                {countdown} {countdown === 1 ? "second" : "seconds"}
              </span>
            </p>
          </div>

          <HomeActions />
        </div>
      </Card>
    );
  }

  if (failed) {
    return (
      <ResultCard
        icon={<XCircle size={38} weight="fill" />}
        iconClass="bg-red-400/10 text-red-300"
        eyebrow={statusLabel}
        title="Payment not completed"
        description={
          result.message ||
          "This payment could not be completed. You can safely return home or try again."
        }
        orderNumber={result.orderNumber}
        statusDotClass="bg-red-400"
      />
    );
  }

  return (
    <ResultCard
      icon={
        checking ? (
          <SpinnerGap size={36} className="animate-spin" />
        ) : requestError ? (
          <WarningCircle size={38} weight="fill" />
        ) : (
          <SpinnerGap size={36} className="animate-spin" />
        )
      }
      iconClass={
        requestError
          ? "bg-amber-400/10 text-amber-300"
          : "bg-accent/10 text-accent"
      }
      eyebrow={result.status ? statusLabel : "Secure verification"}
      title={requestError ? "Still checking your payment" : "Confirming payment"}
      description={
        requestError ||
        result.message ||
        "Please keep this page open while we verify the payment with the provider."
      }
      orderNumber={result.orderNumber}
    />
  );
}

function ResultCard({
  icon,
  iconClass,
  eyebrow,
  title,
  description,
  orderNumber,
  statusDotClass = "bg-accent",
}: {
  icon: ReactNode;
  iconClass: string;
  eyebrow: string;
  title: string;
  description: string;
  orderNumber?: string | null;
  statusDotClass?: string;
}) {
  return (
    <Card
      variant="glass"
      padding="lg"
      className="w-full max-w-lg text-center"
    >
      <div className="space-y-5">
        <div
          className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${iconClass}`}
        >
          {icon}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">
            {eyebrow}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">
            {title}
          </h1>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-text-secondary">
            {description}
          </p>
        </div>
        {orderNumber ? (
          <StatusPill
            status={eyebrow}
            orderNumber={orderNumber}
            dotClass={statusDotClass}
          />
        ) : null}
        <HomeActions />
      </div>
    </Card>
  );
}

function StatusPill({
  status,
  orderNumber,
  dotClass = "bg-emerald-400",
}: {
  status: string;
  orderNumber: string | null;
  dotClass?: string;
}) {
  return (
    <div className="mx-auto flex w-fit max-w-full items-center gap-2 rounded-full border border-border bg-bg-card/70 px-3 py-1.5 text-xs text-text-secondary">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
      <span className="font-semibold">{status}</span>
      {orderNumber ? (
        <>
          <span className="text-border">•</span>
          <span className="truncate font-mono text-text-muted">
            {orderNumber}
          </span>
        </>
      ) : null}
    </div>
  );
}

function CountdownRing({ value }: { value: number }) {
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const progress = value / REDIRECT_SECONDS;

  return (
    <div className="relative grid h-11 w-11 shrink-0 place-items-center">
      <svg
        className="absolute inset-0 -rotate-90"
        viewBox="0 0 40 40"
        aria-hidden="true"
      >
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-border"
        />
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className="text-emerald-400 transition-[stroke-dashoffset] duration-300"
        />
      </svg>
      <span className="text-sm font-bold tabular-nums text-text-primary">
        {value}
      </span>
    </div>
  );
}

function HomeActions() {
  return (
    <div className="space-y-3 pt-1">
      <Link
        href="/"
        className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-accent px-6 text-base font-medium text-bg-primary shadow-lg shadow-accent/10 transition-all duration-[var(--duration-normal)] ease-[var(--ease-spring)] hover:bg-accent-hover active:scale-[0.98]"
      >
        <House size={17} weight="fill" />
        Back to Home
      </Link>
      <Link
        href="/account/purchases"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted transition-colors hover:text-text-primary"
      >
        View purchase history
        <ArrowRight size={13} />
      </Link>
    </div>
  );
}
