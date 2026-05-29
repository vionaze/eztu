"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function PaymentStatusSync() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("NP_id");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) return;

    let cancelled = false;

    async function syncPaymentStatus() {
      try {
        const response = await fetch("/api/payment/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ paymentId }),
        });
        const data = (await response.json()) as { status?: string };

        if (!cancelled && response.ok && data.status) {
          setStatus(data.status);
        }
      } catch (error) {
        console.error("[Payment Status Sync]", error);
      }
    }

    void syncPaymentStatus();

    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  if (!paymentId || !status) return null;

  return (
    <p className="text-xs text-text-muted">
      Payment status synced: {status}
    </p>
  );
}
