"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn, formatAdminDateTime } from "@/lib/utils";

type SecurityEventRow = {
  id: string;
  eventType: string;
  severity: string;
  action: string;
  reasons: string[];
  ip: string | null;
  email: string | null;
  userId: string | null;
  clerkUserId: string | null;
  userAgent: string | null;
  route: string | null;
  createdAt: string | Date;
};

type AccessBlockRow = {
  id: string;
  kind: string;
  value: string;
  reason: string | null;
  createdBy: string | null;
  createdAt: string | Date;
};

export function SecurityBlocksClient({
  events,
  blocks,
}: {
  events: SecurityEventRow[];
  blocks: AccessBlockRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualKind, setManualKind] = useState("EMAIL");
  const [manualValue, setManualValue] = useState("");
  const [manualReason, setManualReason] = useState("");

  async function postAction(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch("/api/admin/security/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Request failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="text-xs text-red-400 border border-red-500/30 rounded-md px-2 py-1.5">
          {error}
        </p>
      ) : null}

      <div className="rounded-lg border border-border bg-surface/40 p-3 space-y-2">
        <h3 className="text-[13px] font-semibold text-text-primary">
          Manual block (preventive)
        </h3>
        <p className="text-[11px] text-text-muted">
          Blocks checkout and account APIs for matching email / IP / user. Does not
          delete Clerk sessions; user cannot complete login-protected actions.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-[11px] text-text-muted">
            Kind
            <select
              className="mt-0.5 block rounded-md border border-border bg-background px-2 py-1 text-xs text-text-primary"
              value={manualKind}
              onChange={(e) => setManualKind(e.target.value)}
            >
              <option value="EMAIL">EMAIL</option>
              <option value="IP">IP</option>
              <option value="USER_ID">USER_ID</option>
              <option value="CLERK_ID">CLERK_ID</option>
            </select>
          </label>
          <label className="text-[11px] text-text-muted flex-1 min-w-[140px]">
            Value
            <input
              className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-text-primary font-mono"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder="user@mail.com or 1.2.3.4"
            />
          </label>
          <label className="text-[11px] text-text-muted flex-1 min-w-[140px]">
            Reason
            <input
              className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-text-primary"
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
              placeholder="Abuse / chargeback / …"
            />
          </label>
          <button
            type="button"
            disabled={busy === "manual" || !manualValue.trim()}
            onClick={() =>
              postAction(
                {
                  action: "block",
                  kind: manualKind,
                  value: manualValue,
                  reason: manualReason || "Blocked by admin",
                },
                "manual"
              )
            }
            className="rounded-md bg-red-500/20 border border-red-500/40 text-red-300 text-xs px-3 py-1.5 font-medium hover:bg-red-500/30 disabled:opacity-40"
          >
            {busy === "manual" ? "…" : "Block"}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">
          Active blocks ({blocks.length})
        </h3>
        {blocks.length === 0 ? (
          <p className="text-xs text-text-muted py-2">No active blocks.</p>
        ) : (
          blocks.map((b) => (
            <div
              key={b.id}
              className="rounded-md border border-border px-3 py-2 flex flex-wrap items-center gap-2 justify-between"
            >
              <div className="min-w-0">
                <div className="text-xs font-mono text-text-primary">
                  <span className="text-amber-400/90">{b.kind}</span> {b.value}
                </div>
                <div className="text-[10px] text-text-muted mt-0.5">
                  {b.reason || "—"} · {b.createdBy || "system"} ·{" "}
                  {formatAdminDateTime(b.createdAt)}
                </div>
              </div>
              <button
                type="button"
                disabled={busy === b.id}
                onClick={() => postAction({ action: "revoke", id: b.id }, b.id)}
                className="text-[11px] rounded-md border border-border px-2 py-1 text-text-secondary hover:text-text-primary disabled:opacity-40"
              >
                Unblock
              </button>
            </div>
          ))
        )}
      </div>

      <div className="space-y-1.5">
        <h3 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">
          Recent security events
        </h3>
        {events.length === 0 ? (
          <p className="text-xs text-text-muted py-2">No security events yet.</p>
        ) : (
          events.map((ev) => (
            <div
              key={ev.id}
              className="rounded-md border border-border px-3 py-2 space-y-1.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wide mr-1.5",
                      ev.action === "BLOCKED"
                        ? "text-red-400"
                        : "text-amber-400"
                    )}
                  >
                    {ev.action}
                  </span>
                  <span className="text-xs font-medium text-text-primary">
                    {ev.eventType}
                  </span>
                  <span className="text-[10px] text-text-muted ml-1.5">
                    {ev.severity}
                  </span>
                </div>
                <time className="text-[10px] text-text-muted font-mono">
                  {formatAdminDateTime(ev.createdAt)}
                </time>
              </div>
              <p className="text-[11px] text-text-secondary leading-snug whitespace-pre-wrap">
                {ev.reasons.join("\n")}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-text-muted font-mono">
                {ev.ip ? <span>ip {ev.ip}</span> : null}
                {ev.email ? <span>{ev.email}</span> : null}
                {ev.route ? <span>{ev.route}</span> : null}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {ev.userId ? (
                  <button
                    type="button"
                    disabled={busy === `ban-${ev.id}`}
                    onClick={() =>
                      postAction(
                        {
                          action: "ban_user",
                          userId: ev.userId,
                          ip: ev.ip,
                          reason: `From security event ${ev.eventType}`,
                        },
                        `ban-${ev.id}`
                      )
                    }
                    className="text-[10px] rounded border border-red-500/40 bg-red-500/10 text-red-300 px-2 py-0.5 hover:bg-red-500/20 disabled:opacity-40"
                  >
                    Ban user
                  </button>
                ) : null}
                {ev.email ? (
                  <button
                    type="button"
                    disabled={busy === `em-${ev.id}`}
                    onClick={() =>
                      postAction(
                        {
                          action: "block",
                          kind: "EMAIL",
                          value: ev.email,
                          reason: `From ${ev.eventType}`,
                        },
                        `em-${ev.id}`
                      )
                    }
                    className="text-[10px] rounded border border-border px-2 py-0.5 text-text-secondary hover:text-text-primary disabled:opacity-40"
                  >
                    Block email
                  </button>
                ) : null}
                {ev.ip && ev.ip !== "unknown" && ev.ip !== "system" ? (
                  <button
                    type="button"
                    disabled={busy === `ip-${ev.id}`}
                    onClick={() =>
                      postAction(
                        {
                          action: "block",
                          kind: "IP",
                          value: ev.ip,
                          reason: `From ${ev.eventType}`,
                        },
                        `ip-${ev.id}`
                      )
                    }
                    className="text-[10px] rounded border border-border px-2 py-0.5 text-text-secondary hover:text-text-primary disabled:opacity-40"
                  >
                    Block IP
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
