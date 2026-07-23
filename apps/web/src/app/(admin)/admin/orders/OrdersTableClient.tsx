"use client";

import { useMemo, useState } from "react";
import { formatPrice, cn } from "@/lib/utils";
import { Badge, Button, Card } from "@kupon/ui";
import { X } from "@phosphor-icons/react";

export type AdminOrderRow = {
  id: string;
  orderNumber: string;
  email: string;
  gameId: string;
  serverId: string | null;
  status: string;
  totalIDR: number;
  totalUSD: number;
  paymentCurrency: string | null;
  paymentProvider: string | null;
  paymentUrl: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  subtotalIDR: number;
  discountIDR: number;
  productName: string | null;
  variantName: string | null;
  quantity: number;
  unitPriceIDR: number | null;
  unitPriceUSD: number | null;
  fulfillmentType: "TOP_UP" | "VOUCHER" | null;
  requiresServerId: boolean;
  gameIdLabel: string | null;
  serverIdLabel: string | null;
  supplierStatus: string | null;
  voucherCode: string | null;
  supplierError: string | null;
};

const statusStyles: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400",
  PAID: "bg-blue-500/10 text-blue-400",
  PROCESSING: "bg-orange-500/10 text-orange-400",
  COMPLETED: "bg-emerald-500/10 text-emerald-400",
  FAILED: "bg-red-500/10 text-red-400",
  EXPIRED: "bg-zinc-500/10 text-zinc-400",
  REFUNDED: "bg-violet-500/10 text-violet-400",
};

function isRealGameId(gameId: string, fulfillmentType: string | null) {
  if (fulfillmentType === "VOUCHER") return false;
  const g = (gameId || "").trim().toLowerCase();
  if (!g || g === "voucher" || g === "-" || g === "n/a") return false;
  return true;
}

export default function OrdersTableClient({ orders }: { orders: AdminOrderRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => orders.find((o) => o.id === selectedId) || null,
    [orders, selectedId]
  );

  const showAccount =
    selected &&
    (selected.fulfillmentType === "TOP_UP" ||
      isRealGameId(selected.gameId, selected.fulfillmentType));

  return (
    <>
      <Card variant="default" padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                {[
                  "Order",
                  "Customer",
                  "Product",
                  "Amount",
                  "Pay",
                  "Status",
                  "Fulfillment",
                  "Date",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-sm text-text-muted"
                  >
                    No orders match this filter.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedId(order.id)}
                    className="hover:bg-white/[0.04] cursor-pointer transition-colors"
                    title="Klik untuk detail lengkap"
                  >
                    <td className="px-5 py-3.5 text-sm font-mono text-accent">
                      {order.orderNumber}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-text-secondary">
                      {order.email}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-text-secondary max-w-[220px] truncate">
                      {order.productName
                        ? `${order.productName} · ${order.variantName || ""}`
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-text-primary">
                      {formatPrice(order.totalIDR)}
                      <span className="block text-[11px] text-text-muted">
                        ${order.totalUSD.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-text-muted uppercase">
                      {order.paymentCurrency || order.paymentProvider || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "text-[10px] font-semibold uppercase px-2 py-1 rounded-full",
                          statusStyles[order.status]
                        )}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-text-muted">
                      {order.supplierStatus || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-text-muted whitespace-nowrap">
                      {new Date(order.createdAt).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Jakarta",
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
            aria-label="Close"
            onClick={() => setSelectedId(null)}
          />
          <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-bg-secondary shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-border bg-bg-secondary/95 backdrop-blur">
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wide">
                  Order detail
                </p>
                <h2 className="text-lg font-bold font-mono text-text-primary">
                  {selected.orderNumber}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="flex flex-wrap gap-2">
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase px-2 py-1 rounded-full",
                    statusStyles[selected.status]
                  )}
                >
                  {selected.status}
                </span>
                {selected.supplierStatus ? (
                  <Badge variant="muted">{selected.supplierStatus}</Badge>
                ) : null}
                {selected.fulfillmentType ? (
                  <Badge variant="muted">
                    {selected.fulfillmentType === "TOP_UP"
                      ? "Top-up"
                      : "Voucher"}
                  </Badge>
                ) : null}
              </div>

              {/* Product summary — mirrors storefront card */}
              <Card variant="default" padding="md" className="space-y-2">
                <p className="text-xs font-semibold text-text-muted uppercase">
                  Product
                </p>
                <p className="text-sm font-semibold text-text-primary">
                  {selected.productName || "—"}
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-text-muted">Package</p>
                    <p className="text-text-secondary">
                      {selected.variantName || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Quantity</p>
                    <p className="text-text-secondary font-mono">
                      {selected.quantity}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Unit price</p>
                    <p className="text-text-secondary font-mono">
                      {selected.unitPriceIDR != null
                        ? formatPrice(selected.unitPriceIDR)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Total</p>
                    <p className="text-accent font-semibold font-mono">
                      {formatPrice(selected.totalIDR)}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      ${selected.totalUSD.toFixed(2)}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Customer inputs — same fields as product checkout */}
              <Card variant="default" padding="md" className="space-y-3">
                <p className="text-xs font-semibold text-text-muted uppercase">
                  Customer inputs
                </p>
                <div>
                  <p className="text-xs text-text-muted">Recipient Email</p>
                  <p className="text-sm text-text-primary break-all">
                    {selected.email}
                  </p>
                </div>
                {showAccount ? (
                  <>
                    <div>
                      <p className="text-xs text-text-muted">
                        {selected.gameIdLabel || "User ID"}
                      </p>
                      <p className="text-sm font-mono text-text-primary">
                        {selected.gameId || "—"}
                      </p>
                    </div>
                    {(selected.requiresServerId || selected.serverId) && (
                      <div>
                        <p className="text-xs text-text-muted">
                          {selected.serverIdLabel || "Zone / Server ID"}
                        </p>
                        <p className="text-sm font-mono text-text-primary">
                          {selected.serverId || "—"}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-text-muted">
                    Produk voucher — tidak ada User ID / Zone (hanya email).
                  </p>
                )}
              </Card>

              <Card variant="default" padding="md" className="space-y-2">
                <p className="text-xs font-semibold text-text-muted uppercase">
                  Payment
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-text-muted">Method</p>
                    <p className="text-text-secondary uppercase">
                      {selected.paymentCurrency ||
                        selected.paymentProvider ||
                        "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Paid at</p>
                    <p className="text-text-secondary text-xs">
                      {selected.paidAt
                        ? new Date(selected.paidAt).toLocaleString()
                        : "—"}
                    </p>
                  </div>
                  {selected.discountIDR > 0 ? (
                    <div>
                      <p className="text-xs text-text-muted">Discount</p>
                      <p className="text-text-secondary font-mono">
                        {formatPrice(selected.discountIDR)}
                      </p>
                    </div>
                  ) : null}
                </div>
                {selected.paymentUrl ? (
                  <a
                    href={selected.paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:underline break-all"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open payment URL
                  </a>
                ) : null}
              </Card>

              {(selected.voucherCode || selected.supplierError) && (
                <Card variant="default" padding="md" className="space-y-2">
                  <p className="text-xs font-semibold text-text-muted uppercase">
                    Fulfillment detail
                  </p>
                  {selected.voucherCode ? (
                    <div>
                      <p className="text-xs text-text-muted">Voucher code</p>
                      <p className="text-sm font-mono text-emerald-300">
                        {selected.voucherCode}
                      </p>
                    </div>
                  ) : null}
                  {selected.supplierError ? (
                    <div>
                      <p className="text-xs text-text-muted">Error</p>
                      <p className="text-sm text-red-400">
                        {selected.supplierError}
                      </p>
                    </div>
                  ) : null}
                </Card>
              )}

              <p className="text-[11px] text-text-muted">
                Created:{" "}
                {new Date(selected.createdAt).toLocaleString("en-US", {
                  dateStyle: "full",
                  timeStyle: "medium",
                  timeZone: "Asia/Jakarta",
                })}{" "}
                (WIB)
              </p>

              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setSelectedId(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
