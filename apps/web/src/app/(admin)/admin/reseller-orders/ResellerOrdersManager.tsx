"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type LineDetail = {
  id: string; name: string; supplierSku: string; quantity: number;
  status: string; supplierTid: string | null; supplierStatus: string | null;
};
type OrderRow = {
  id: string; orderNumber: string; status: string; paymentMethod: string; totalIDR: number;
  createdAt: string; manualReviewReason: string | null; organizationName: string; organizationSlug: string;
  fulfillmentAttempts: number; lineDetails: LineDetail[];
};
type OrderDetail = OrderRow & {
  organizationTier: string;
  paymentIntent: { provider: string; status: string; amountIDR: number; providerPaymentId: string | null; events: { eventId: string; normalizedStatus: string; createdAt: string }[] } | null;
};

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const STATUSES = ["", "PAYMENT_PENDING", "PAID", "PROCESSING", "COMPLETED", "MANUAL_REVIEW", "PAYMENT_FAILED", "CANCELLED", "REFUND_PENDING", "REFUNDED"];
const STATUS_STYLE: Record<string, string> = {
  PAYMENT_PENDING: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  PAID: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  PROCESSING: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  COMPLETED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  MANUAL_REVIEW: "border-orange-400/30 bg-orange-400/10 text-orange-200",
  PAYMENT_FAILED: "border-red-400/30 bg-red-400/10 text-red-200",
  REFUND_PENDING: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  REFUNDED: "border-border text-text-muted",
  CANCELLED: "border-border text-text-muted",
};
const buttonClass = "rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-secondary transition hover:border-accent/40 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50";
const primaryClass = "rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-bg-primary disabled:cursor-not-allowed disabled:opacity-50";

export default function ResellerOrdersManager() {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [confirmRetry, setConfirmRetry] = useState<{ id: string; orderNumber: string; input: string } | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (search) params.set("q", search);
      const response = await fetch(`/api/admin/reseller-orders?${params}`, { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as { orders?: OrderRow[]; error?: string };
      if (!response.ok || !Array.isArray(body.orders)) throw new Error(body.error || "Unable to load orders.");
      setOrders(body.orders);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to connect to the server.");
    }
  }, [status, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function openDetail(id: string) {
    setBusyId(id);
    setError("");
    try {
      const response = await fetch(`/api/admin/reseller-orders/${encodeURIComponent(id)}`, { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as { order?: OrderDetail; error?: string };
      if (!response.ok || !body.order) throw new Error(body.error || "Unable to load the order.");
      setDetail(body.order);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to connect to the server.");
    } finally {
      setBusyId(null);
    }
  }

  async function post(id: string, payload: Record<string, unknown>) {
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/reseller-orders/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; status?: string; error?: string };
      if (!response.ok || body.ok !== true) throw new Error(body.error || "Action failed.");
      setNotice(body.status ? `Order marked ${body.status}.` : "Fulfillment re-submitted to the supplier.");
      setConfirmRetry(null);
      setDetail(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to connect to the server.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">B2B</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-text-primary">Reseller orders</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Refunds and cancellations record bookkeeping only — move the money in the provider dashboard first.
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(query.trim());
        }}
      >
        <div className="min-w-0 flex-1 basis-56">
          <label htmlFor="b2b-search" className="mb-1.5 block text-xs font-medium text-text-secondary">Order number or organization</label>
          <input id="b2b-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 w-full rounded-xl border border-border bg-bg-card px-3 text-sm" />
        </div>
        <div>
          <label htmlFor="b2b-status" className="mb-1.5 block text-xs font-medium text-text-secondary">Status</label>
          <select id="b2b-status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-border bg-bg-card px-3 text-sm">
            {STATUSES.map((value) => <option key={value || "all"} value={value}>{value ? value.replaceAll("_", " ") : "All statuses"}</option>)}
          </select>
        </div>
        <button type="submit" className={primaryClass}>Search</button>
        <button type="button" onClick={() => { setQuery(""); setSearch(""); void load(); }} className={buttonClass}>Refresh</button>
      </form>

      {error ? <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}
      {notice ? <p role="status" className="text-sm text-accent">{notice}</p> : null}

      {!orders && !error ? <p role="status" className="text-sm text-text-secondary">Loading orders…</p> : null}
      {orders && orders.length === 0 ? <p className="rounded-2xl border border-border bg-bg-card p-5 text-sm text-text-secondary">No B2B orders match this filter.</p> : null}

      <div className="space-y-2">
        {orders?.map((order) => (
          <article key={order.id} className="rounded-2xl border border-border bg-bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-[family-name:var(--font-geist-mono)] text-sm font-semibold">{order.orderNumber}</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {order.organizationName} · {new Date(order.createdAt).toLocaleString("en-GB")} · {order.paymentMethod === "CRYPTO" ? "Crypto" : "Pakasir"}
                </p>
                {order.manualReviewReason ? (
                  <p className="mt-1 break-words text-xs text-orange-200">Review: {order.manualReviewReason}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", STATUS_STYLE[order.status] ?? "border-border text-text-muted")}>
                  {order.status.replaceAll("_", " ")}
                </span>
                <span className="font-[family-name:var(--font-geist-mono)] text-sm font-semibold text-accent">{money.format(order.totalIDR)}</span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busyId === order.id} onClick={() => void openDetail(order.id)} className={buttonClass}>View detail</button>
              {["PAID", "PROCESSING", "MANUAL_REVIEW"].includes(order.status) ? (
                <button type="button" disabled={busyId === order.id} onClick={() => setConfirmRetry({ id: order.id, orderNumber: order.orderNumber, input: "" })} className={buttonClass}>Re-submit to supplier</button>
              ) : null}
              {["MANUAL_REVIEW", "PAYMENT_FAILED"].includes(order.status) ? (
                <button type="button" disabled={busyId === order.id} onClick={() => void post(order.id, { status: "REFUND_PENDING", note: "Provider refund started." })} className={buttonClass}>Mark refund pending</button>
              ) : null}
              {order.status === "REFUND_PENDING" ? (
                <button type="button" disabled={busyId === order.id} onClick={() => void post(order.id, { status: "REFUNDED", note: "Provider refund confirmed." })} className={buttonClass}>Mark refunded</button>
              ) : null}
              {["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(order.status) ? (
                <button type="button" disabled={busyId === order.id} onClick={() => void post(order.id, { status: "CANCELLED" })} className={buttonClass}>Cancel</button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {confirmRetry ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="retry-title">
          <div className="w-full max-w-md rounded-2xl border border-border bg-bg-elevated p-5">
            <h3 id="retry-title" className="text-base font-semibold text-text-primary">Re-submit {confirmRetry.orderNumber}?</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Supplier references are deterministic, so the supplier should de-duplicate an already accepted purchase. Type the order number to confirm.
            </p>
            <input
              value={confirmRetry.input}
              onChange={(event) => setConfirmRetry({ ...confirmRetry, input: event.target.value })}
              className="mt-3 h-10 w-full rounded-xl border border-border bg-bg-card px-3 font-[family-name:var(--font-geist-mono)] text-sm"
              placeholder={confirmRetry.orderNumber}
              aria-label={`Type ${confirmRetry.orderNumber} to confirm`}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={buttonClass} onClick={() => setConfirmRetry(null)}>Cancel</button>
              <button
                type="button"
                className={primaryClass}
                disabled={confirmRetry.input !== confirmRetry.orderNumber || busyId === confirmRetry.id}
                onClick={() => void post(confirmRetry.id, { action: "retry", confirmOrderNumber: confirmRetry.input, note: "Admin re-submitted to supplier." })}
              >
                {busyId === confirmRetry.id ? "Submitting…" : "Re-submit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detail ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="detail-title">
          <div className="max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-bg-elevated p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="detail-title" className="font-[family-name:var(--font-geist-mono)] text-base font-semibold">{detail.orderNumber}</h3>
                <p className="mt-0.5 text-xs text-text-muted">{detail.organizationName} · {detail.organizationTier.replaceAll("_", " ")} · attempts {detail.fulfillmentAttempts}</p>
              </div>
              <button type="button" onClick={() => setDetail(null)} className={buttonClass}>Close</button>
            </div>

            <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-text-muted">Lines</h4>
            <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
              {detail.lineDetails.map((line) => (
                <li key={line.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{line.quantity} × {line.name}</p>
                    <p className="mt-0.5 break-all text-xs text-text-muted">{line.supplierSku} · tid {line.supplierTid ?? "—"} · {line.supplierStatus ?? "—"}</p>
                  </div>
                  <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", line.status === "FULFILLED" ? STATUS_STYLE.COMPLETED : line.status === "REVIEW" ? STATUS_STYLE.MANUAL_REVIEW : "border-border text-text-muted")}>
                    {line.status}
                  </span>
                </li>
              ))}
            </ul>

            {detail.paymentIntent ? (
              <>
                <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-text-muted">Payment</h4>
                <p className="mt-2 text-sm text-text-secondary">
                  {detail.paymentIntent.provider} · {detail.paymentIntent.status} · {money.format(detail.paymentIntent.amountIDR)} · id {detail.paymentIntent.providerPaymentId ?? "—"}
                </p>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-text-muted">
                  {detail.paymentIntent.events.map((event) => (
                    <li key={event.eventId} className="break-all">{event.createdAt} · {event.normalizedStatus} · {event.eventId}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
