"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { Input } from "@kupon/ui";
import { cn } from "@/lib/utils";
import { FunnelSimple, MagnifyingGlass } from "@phosphor-icons/react";

const statuses = [
  "ALL",
  "PENDING",
  "PAID",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
];

export default function OrdersFilterClient({
  initialQ,
  initialStatus,
}: {
  initialQ: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);

  const apply = (nextStatus?: string, nextQ?: string) => {
    const s = nextStatus ?? status;
    const query = nextQ ?? q;
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (s && s !== "ALL") params.set("status", s);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="w-full sm:w-72">
        <Input
          placeholder="Search order #, email, product..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply();
          }}
          icon={<MagnifyingGlass size={16} />}
        />
      </div>
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
        <FunnelSimple size={14} className="text-text-muted flex-shrink-0" />
        {statuses.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setStatus(s);
              apply(s);
            }}
            className={cn(
              "flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
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
  );
}
