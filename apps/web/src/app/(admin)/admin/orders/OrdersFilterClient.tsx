"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { Input } from "@kupon/ui";
import { cn } from "@/lib/utils";
import { FunnelSimple, MagnifyingGlass } from "@phosphor-icons/react";

const statuses = [
  "ALL",
  "PENDING",
  "UNDERPAID",
  "PAYMENT_REVIEW",
  "PAID",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
  "DISPUTED",
];

export default function OrdersFilterClient({
  initialQ,
  initialStatus,
  initialGateway,
}: {
  initialQ: string;
  initialStatus: string;
  initialGateway: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);
  const [gateway, setGateway] = useState(initialGateway);

  const apply = (
    nextStatus?: string,
    nextQ?: string,
    nextGateway?: string
  ) => {
    const s = nextStatus ?? status;
    const query = nextQ ?? q;
    const gatewayValue = nextGateway ?? gateway;
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (s && s !== "ALL") params.set("status", s);
    if (gatewayValue && gatewayValue !== "all") {
      params.set("gateway", gatewayValue);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="w-full sm:w-64">
          <Input
            placeholder="Search order #, email, product..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") apply();
            }}
            icon={<MagnifyingGlass size={15} />}
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
          <FunnelSimple size={13} className="text-text-muted flex-shrink-0" />
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatus(s);
                apply(s);
              }}
              className={cn(
                "flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer",
                status === s
                  ? "bg-accent text-bg-primary"
                  : "bg-bg-card text-text-secondary hover:text-text-primary border border-border"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-text-muted">Gateway:</span>
        {[
          ["all", "All"],
          ["cryptomus", "Cryptomus"],
          ["pakasir", "Pakasir"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setGateway(value);
              apply(undefined, undefined, value);
            }}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-[11px] font-medium",
              gateway === value
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-text-secondary"
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="admin-hint">
        Klik baris → preview (package, qty, email, User ID/Zone, payment)
      </p>
    </div>
  );
}
