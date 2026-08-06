"use client";

import { useMemo, useState } from "react";
import { formatPrice, cn, formatAdminDateTime } from "@/lib/utils";
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
  paymentProviderPaymentId: string | null;
  paymentUrl: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  paymentReviewReason: string | null;
  paymentReviewRequiredAt: string | null;
  paymentReviewApprovedAt: string | null;
  paymentReviewApprovedBy: string | null;
  paymentReviewNote: string | null;
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
  UNDERPAID: "bg-red-500/10 text-red-300",
  PAYMENT_REVIEW: "bg-amber-500/10 text-amber-300",
  PAID: "bg-blue-500/10 text-blue-400",
  PROCESSING: "bg-orange-500/10 text-orange-400",
  COMPLETED: "bg-emerald-500/10 text-emerald-400",
  FAILED: "bg-red-500/10 text-red-400",
  EXPIRED: "bg-zinc-500/10 text-zinc-400",
  REFUNDED: "bg-violet-500/10 text-violet-400",
  DISPUTED: "bg-red-700/20 text-red-300",
};

function gatewayLabel(provider: string | null) {
  if (provider === "cryptomus") return "Cryptomus";
  if (provider === "pakasir") return "Pakasir";
  return "—";
}

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
                  "Gateway",
                  "Method",
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
                    colSpan={9}
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
                      {gatewayLabel(order.paymentProvider)}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-text-muted uppercase">
                      {order.paymentCurrency || "—"}
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
            aria-label="Close"
            onClick={() => setSelectedId(null)}
          />
          <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-bg-secondary shadow-2xl">
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border">
              <div className="min-w-0">
                <p className="text-[10px] text-text-muted uppercase tracking-wide">
                  Order detail
                </p>
                <h2 className="text-base font-bold font-mono text-text-primary">
                  {selected.orderNumber}
                </h2>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full",
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
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 cursor-pointer shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Product */}
              <div className="rounded-xl border border-border bg-bg-card/80 p-3 space-y-1.5 sm:col-span-2">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">
                  Product
                </p>
                <p className="text-sm font-semibold text-text-primary">
                  {selected.productName || "—"}
                  {selected.variantName ? (
                    <span className="font-normal text-text-secondary">
                      {" "}
                      · {selected.variantName}
                    </span>
                  ) : null}
                </p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-text-muted">Qty</p>
                    <p className="font-mono text-text-primary">
                      {selected.quantity}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted">Unit</p>
                    <p className="font-mono text-text-primary">
                      {selected.unitPriceIDR != null
                        ? formatPrice(selected.unitPriceIDR)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted">Total</p>
                    <p className="font-mono font-semibold text-accent">
                      {formatPrice(selected.totalIDR)}
                    </p>
                    <p className="text-[10px] text-text-muted">
                      ${selected.totalUSD.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Customer */}
              <div className="rounded-xl border border-border bg-bg-card/80 p-3 space-y-1.5">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">
                  Customer inputs
                </p>
                <div>
                  <p className="text-[10px] text-text-muted">Email</p>
                  <p className="text-xs text-text-primary break-all">
                    {selected.email}
                  </p>
                </div>
                {showAccount ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-text-muted">
                        {selected.gameIdLabel || "User ID"}
                      </p>
                      <p className="text-xs font-mono text-text-primary">
                        {selected.gameId || "—"}
                      </p>
                    </div>
                    {(selected.requiresServerId || selected.serverId) && (
                      <div>
                        <p className="text-[10px] text-text-muted">
                          {selected.serverIdLabel || "Zone / Server ID"}
                        </p>
                        <p className="text-xs font-mono text-text-primary">
                          {selected.serverId || "—"}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-text-muted">
                    Voucher — no User ID / Zone
                  </p>
                )}
              </div>

              {/* Payment */}
              <div className="rounded-xl border border-border bg-bg-card/80 p-3 space-y-1.5">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">
                  Payment
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[10px] text-text-muted">Gateway</p>
                    <p className="text-text-secondary">
                      {gatewayLabel(selected.paymentProvider)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted">Method / currency</p>
                    <p className="text-text-secondary uppercase">
                      {selected.paymentCurrency || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted">Paid at</p>
                    <p className="text-text-secondary text-[11px] font-mono">
                      {selected.paidAt
                        ? formatAdminDateTime(selected.paidAt)
                        : "—"}
                    </p>
                  </div>
                </div>
                {selected.paymentUrl ? (
                  <a
                    href={selected.paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-accent hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open payment URL
                  </a>
                ) : null}
                {selected.paymentProviderPaymentId ? (
                  <p className="break-all text-[10px] font-mono text-text-muted">
                    Provider ID: {selected.paymentProviderPaymentId}
                  </p>
                ) : null}
              </div>

              {/* Fulfillment — always show row for consistency */}
              <div className="rounded-xl border border-border bg-bg-card/80 p-3 space-y-1 sm:col-span-2">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">
                  Fulfillment
                </p>
                {selected.voucherCode ? (
                  <p className="text-xs font-mono text-emerald-300">
                    Code: {selected.voucherCode}
                  </p>
                ) : null}
                {selected.supplierError ? (
                  <p className="text-xs text-red-400 break-words">
                    {selected.supplierError}
                  </p>
                ) : !selected.voucherCode ? (
                  <p className="text-[11px] text-text-muted">
                    Status: {selected.supplierStatus || "—"}
                  </p>
                ) : null}
                <p className="text-[10px] text-text-muted font-mono pt-0.5">
                  Created {formatAdminDateTime(selected.createdAt)}
                </p>
              </div>
            </div>

            <div className="px-4 pb-3">
              <Button
                variant="secondary"
                size="sm"
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
