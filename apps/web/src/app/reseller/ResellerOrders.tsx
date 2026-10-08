"use client";

import { useCallback, useEffect, useState } from "react";
import { ShoppingCart, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type CartLine = { variantId: string; name: string; unitPriceIDR: number; quantity: number };
type OrderLine = { id: string; name: string; quantity: number; unitPriceIDR: number; status: string; voucherCodes: string[] };
export type ResellerOrder = {
  id: string; orderNumber: string; status: string; paymentMethod: string; totalIDR: number;
  paymentUrl: string | null; createdAt: string; manualReviewReason: string | null; lines: OrderLine[];
};

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const primaryClass = "inline-flex h-11 items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-bg-primary transition disabled:cursor-not-allowed disabled:opacity-50";
const subtleClass = "inline-flex h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary transition hover:border-accent/40 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50";

const STATUS_STYLE: Record<string, string> = {
  PAYMENT_PENDING: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  PAID: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  PROCESSING: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  COMPLETED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  MANUAL_REVIEW: "border-orange-400/30 bg-orange-400/10 text-orange-200",
  PAYMENT_FAILED: "border-red-400/30 bg-red-400/10 text-red-200",
  CANCELLED: "border-border text-text-muted",
};

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-bg-elevated shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 p-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-text-secondary hover:text-text-primary">
            <X size={16} weight="bold" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
      </div>
    </div>
  );
}

export function OrderModal({ orgId, lines, defaultMethod, onClose, onPlaced }: { orgId: string; lines: CartLine[]; defaultMethod: "CRYPTO" | "PAKASIR"; onClose: () => void; onPlaced: () => void }) {
  const [tab, setTab] = useState<"cart" | "orders">("cart");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = lines.reduce((sum, line) => sum + line.unitPriceIDR * line.quantity, 0);

  async function placeOrder(method: "CRYPTO" | "PAKASIR") {
    if (busy || lines.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const quoteResponse = await fetch("/api/reseller/orders/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, lines: lines.map(({ variantId, quantity }) => ({ variantId, quantity })) }),
      });
      const quote = (await quoteResponse.json().catch(() => ({}))) as { quoteToken?: string; error?: string };
      if (!quoteResponse.ok || !quote.quoteToken) throw new Error(quote.error || "Unable to prepare a quote.");

      const orderResponse = await fetch("/api/reseller/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          quoteToken: quote.quoteToken,
          idempotencyKey: crypto.randomUUID(),
          paymentMethod: method,
        }),
      });
      const order = (await orderResponse.json().catch(() => ({}))) as { order?: ResellerOrder; error?: string };
      if (!orderResponse.ok || !order.order) throw new Error(order.error || "Unable to create the order.");
      onPlaced();
      if (order.order.paymentUrl) {
        window.location.assign(order.order.paymentUrl);
        return;
      }
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to connect to the server.");
      setBusy(false);
    }
  }

  const orderedMethods: ("CRYPTO" | "PAKASIR")[] =
    defaultMethod === "CRYPTO" ? ["CRYPTO", "PAKASIR"] : ["PAKASIR", "CRYPTO"];
  const methodButtons = (
    <div className="grid gap-2 sm:grid-cols-2">
      {orderedMethods.map((method) => (
          <button
            key={method}
            type="button"
            disabled={busy || lines.length === 0}
            onClick={() => void placeOrder(method)}
            className={method === defaultMethod ? primaryClass : cn(subtleClass, "border-accent/30 text-accent")}
          >
            {busy ? "Creating…" : method === "CRYPTO" ? "Pay with Crypto" : "Pay with Pakasir"}
            {method === defaultMethod ? <span className="ml-1 text-[10px] font-normal opacity-80">(default)</span> : null}
          </button>
        ))}
    </div>
  );

  return (
    <Shell title="Wholesale order" onClose={onClose}>
      <div role="tablist" aria-label="Order tabs" className="mb-4 flex gap-1 rounded-xl border border-border bg-bg-primary/40 p-1">
        {(["cart", "orders"] as const).map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition",
              tab === value ? "bg-accent text-bg-primary" : "text-text-secondary hover:text-text-primary",
            )}
          >
            {value === "cart" ? `Cart${lines.length ? ` (${lines.length})` : ""}` : "Order history"}
          </button>
        ))}
      </div>

      {tab === "orders" ? <OrdersTab orgId={orgId} /> : lines.length === 0 ? (
        <p className="text-sm text-text-secondary">Your cart is empty. Add packages from the catalog.</p>
      ) : (
        <div className="space-y-4">
          <ul className="divide-y divide-border rounded-xl border border-border">
            {lines.map((line) => (
              <li key={line.variantId} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{line.name}</p>
                  <p className="text-xs text-text-muted">{line.quantity} × {money.format(line.unitPriceIDR)}</p>
                </div>
                <p className="shrink-0 font-[family-name:var(--font-geist-mono)] text-sm font-semibold text-accent">
                  {money.format(line.unitPriceIDR * line.quantity)}
                </p>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between rounded-xl border border-border bg-bg-primary/40 p-3">
            <span className="text-sm text-text-secondary">Total</span>
            <span className="font-[family-name:var(--font-geist-mono)] text-lg font-bold text-accent">{money.format(total)}</span>
          </div>
          <p className="text-xs leading-relaxed text-text-muted">
            Final price is re-verified when the order is created. Parts of an order that the supplier cannot deliver
            completely are reviewed manually before anything is refunded.
          </p>
          {error ? <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}
          {methodButtons}
        </div>
      )}
    </Shell>
  );
}

function OrdersTab({ orgId }: { orgId: string }) {
  const [orders, setOrders] = useState<ResellerOrder[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/reseller/orders?organizationId=${encodeURIComponent(orgId)}`, { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as { orders?: ResellerOrder[]; error?: string };
      if (!response.ok || !Array.isArray(body.orders)) throw new Error(body.error || "Unable to load orders.");
      setOrders(body.orders);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to connect to the server.");
    }
  }, [orgId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <div>
      {error ? <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}
      {!orders && !error ? <p role="status" className="text-sm text-text-secondary">Loading orders…</p> : null}
      {orders && orders.length === 0 ? <p className="text-sm text-text-secondary">No orders yet.</p> : null}
      <div className="space-y-3">
        {orders?.map((order) => (
          <article key={order.id} className="rounded-xl border border-border bg-bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-[family-name:var(--font-geist-mono)] text-sm font-semibold">{order.orderNumber}</p>
                <p className="text-xs text-text-muted">
                  {new Date(order.createdAt).toLocaleString("en-GB")} · {order.paymentMethod === "CRYPTO" ? "Crypto" : "Pakasir"}
                </p>
              </div>
              <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", STATUS_STYLE[order.status] ?? "border-border text-text-muted")}>
                {order.status.replaceAll("_", " ")}
              </span>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-text-secondary">
              {order.lines.map((line) => (
                <li key={line.id}>
                  {line.quantity} × {line.name} — {money.format(line.unitPriceIDR * line.quantity)}
                  {line.voucherCodes.length > 0 ? (
                    <span className="mt-1 block break-all font-[family-name:var(--font-geist-mono)] text-accent">
                      {line.voucherCodes.join(", ")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="font-[family-name:var(--font-geist-mono)] text-sm font-semibold text-accent">{money.format(order.totalIDR)}</span>
              {order.paymentUrl ? (
                <a href={order.paymentUrl} className="text-xs font-semibold text-accent hover:underline">Complete payment →</a>
              ) : null}
            </div>
            {order.manualReviewReason ? (
              <p className="mt-2 rounded-lg border border-orange-400/30 bg-orange-400/5 p-2 text-xs text-orange-200">
                Under manual review: {order.manualReviewReason}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

export function CartButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={`Open cart (${count})`} className="relative inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-2.5 text-xs font-medium text-text-secondary transition hover:border-accent/40 hover:text-text-primary sm:px-3">
      <ShoppingCart size={15} aria-hidden="true" />
      <span className="hidden sm:inline">Cart</span>
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-bg-primary">{count}</span>
      ) : null}
    </button>
  );
}
