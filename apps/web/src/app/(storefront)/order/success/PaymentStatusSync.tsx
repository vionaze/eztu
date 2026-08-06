"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function PaymentStatusSync() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("NP_id");
  const orderId = searchParams.get("orderId");
  const [status, setStatus] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!paymentId && !orderId) return;

    let cancelled = false;
    let pakasirSyncAttempted = false;

    async function syncPaymentStatus() {
      try {
        const response = orderId
          ? await fetch(
              `/api/payment/status?orderId=${encodeURIComponent(orderId)}`,
              { cache: "no-store" }
            )
          : await fetch("/api/payment/sync", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ paymentId }),
            });
        const data = (await response.json()) as {
          status?: string;
          message?: string;
          paymentProvider?: string | null;
        };

        if (
          orderId &&
          response.ok &&
          data.paymentProvider === "pakasir" &&
          !pakasirSyncAttempted &&
          data.status !== "PAID" &&
          data.status !== "PROCESSING" &&
          data.status !== "COMPLETED"
        ) {
          pakasirSyncAttempted = true;
          const syncResponse = await fetch("/api/payment/pakasir/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId }),
          });
          const syncData = (await syncResponse.json()) as { status?: string };
          if (!cancelled && syncResponse.ok && syncData.status) {
            setStatus(syncData.status);
            return;
          }
        }

        if (!cancelled && response.ok && data.status) {
          setStatus(data.status);
          setMessage(data.message || "");
        }
      } catch (error) {
        console.error("[Payment Status Sync]", error);
      }
    }

    void syncPaymentStatus();
    const timer = orderId
      ? window.setInterval(() => void syncPaymentStatus(), 3000)
      : null;

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [orderId, paymentId]);

  if ((!paymentId && !orderId) || !status) {
    return (
      <p className="text-xs text-text-muted">
        Waiting for secure payment confirmation…
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-bg-card/70 p-3">
      <p className="text-sm font-semibold text-text-primary">
        {status.replaceAll("_", " ")}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-text-muted">
        {message || `Payment status: ${status}`}
      </p>
    </div>
  );
}
