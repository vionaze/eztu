"use client";

import Link from "next/link";
import { Button } from "@kupon/ui";
import { FadeUp } from "@/components/motion/StaggerReveal";
import { useLocale } from "@/context/LocaleContext";
import { cn, formatPrice } from "@/lib/utils";
import CopyVoucherButton from "./CopyVoucherButton";
import {
  ArrowSquareOut,
  CalendarBlank,
  CheckCircle,
  Clock,
  CurrencyBtc,
  EnvelopeSimple,
  Hash,
  Package,
  Receipt,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";

type PurchaseOrderStatus =
  | "PENDING"
  | "PAID"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED"
  | "REFUNDED";

type PurchaseFulfillmentStatus =
  | "PENDING"
  | "PROCESSING"
  | "FULFILLED"
  | "FAILED"
  | "MANUAL_REVIEW";

export type PurchaseHistoryOrder = {
  id: string;
  orderNumber: string;
  email: string;
  gameId: string;
  serverId: string | null;
  subtotalIDR: number;
  subtotalUSD: number;
  discountIDR: number;
  discountUSD: number;
  totalIDR: number;
  totalUSD: number;
  status: PurchaseOrderStatus;
  paymentProvider: string | null;
  paymentProviderPaymentId: string | null;
  paymentProviderInvoiceId: string | null;
  paymentProviderTxHash: string | null;
  paymentCurrency: string | null;
  paymentUrl: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  promoCode: {
    code: string;
  } | null;
  fulfillment: {
    status: PurchaseFulfillmentStatus;
    voucherCode: string | null;
    voucherPin: string | null;
    fulfilledAt: string | null;
  } | null;
  items: {
    id: string;
    quantity: number;
    priceIDR: number;
    priceUSD: number;
    product: {
      name: string;
    };
    variant: {
      name: string;
    };
  }[];
};

type Labels = {
  account: string;
  title: string;
  introBeforeEmail: string;
  introAfterEmail: string;
  total: string;
  completed: string;
  active: string;
  emptyTitle: string;
  emptyBody: string;
  browseProducts: string;
  orderTotal: string;
  pay: string;
  orderItems: string;
  unitPrice: string;
  lineTotal: string;
  recipient: string;
  email: string;
  accountId: string;
  server: string;
  payment: string;
  provider: string;
  currency: string;
  paidAt: string;
  fulfillmentDetails: string;
  voucher: string;
  pin: string;
  voucherUnavailableTitle: string;
  voucherUnavailableBody: string;
  orderId: string;
  paymentId: string;
  invoiceId: string;
  txHash: string;
  expires: string;
  promo: string;
  fulfillmentProvider: string;
  copiedAria: string;
};

const labelsByLocale: Record<"id" | "en", Labels> = {
  id: {
    account: "Akun",
    title: "Riwayat Pembelian",
    introBeforeEmail: "Detail lengkap pesanan, pembayaran, dan pengiriman voucher untuk",
    introAfterEmail: ".",
    total: "Total",
    completed: "Selesai",
    active: "Aktif",
    emptyTitle: "Belum ada pembelian",
    emptyBody:
      "Pesanan akan muncul di sini setelah kamu memulai checkout. Detail voucher yang selesai hanya ditampilkan untuk akun yang sedang login.",
    browseProducts: "Lihat Produk",
    orderTotal: "Total pesanan",
    pay: "Bayar",
    orderItems: "Item pesanan",
    unitPrice: "Harga satuan",
    lineTotal: "Subtotal item",
    recipient: "Penerima",
    email: "Email",
    accountId: "ID Akun",
    server: "Server",
    payment: "Pembayaran",
    provider: "Provider",
    currency: "Mata uang",
    paidAt: "Dibayar",
    fulfillmentDetails: "Detail fulfillment",
    voucher: "Voucher",
    pin: "PIN",
    voucherUnavailableTitle: "Voucher belum tersedia",
    voucherUnavailableBody:
      "Kode voucher akan muncul di sini setelah pembayaran terkonfirmasi dan proses fulfillment selesai.",
    orderId: "Order ID",
    paymentId: "Payment ID",
    invoiceId: "Invoice ID",
    txHash: "TX hash",
    expires: "Kedaluwarsa",
    promo: "Promo",
    fulfillmentProvider: "Fulfillment",
    copiedAria: "Salin kode voucher",
  },
  en: {
    account: "Account",
    title: "Purchase History",
    introBeforeEmail: "Complete order, payment, and voucher delivery details for",
    introAfterEmail: ".",
    total: "Total",
    completed: "Completed",
    active: "Active",
    emptyTitle: "No purchases yet",
    emptyBody:
      "Orders will appear here after you start checkout. Completed voucher details are shown in this page for your signed-in account only.",
    browseProducts: "Browse Products",
    orderTotal: "Order total",
    pay: "Pay",
    orderItems: "Order items",
    unitPrice: "Unit price",
    lineTotal: "Line total",
    recipient: "Recipient",
    email: "Email",
    accountId: "Account ID",
    server: "Server",
    payment: "Payment",
    provider: "Provider",
    currency: "Currency",
    paidAt: "Paid at",
    fulfillmentDetails: "Fulfillment details",
    voucher: "Voucher",
    pin: "PIN",
    voucherUnavailableTitle: "Voucher not available yet",
    voucherUnavailableBody:
      "Voucher codes appear here after payment is confirmed and fulfillment is completed.",
    orderId: "Order ID",
    paymentId: "Payment ID",
    invoiceId: "Invoice ID",
    txHash: "TX hash",
    expires: "Expires",
    promo: "Promo",
    fulfillmentProvider: "Fulfillment",
    copiedAria: "Copy voucher code",
  },
};

const orderStatusStyles: Record<PurchaseOrderStatus, string> = {
  PENDING: "border-yellow-400/25 bg-yellow-400/10 text-yellow-300",
  PAID: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  PROCESSING: "border-orange-400/25 bg-orange-400/10 text-orange-300",
  COMPLETED: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  FAILED: "border-red-400/25 bg-red-400/10 text-red-300",
  EXPIRED: "border-zinc-400/25 bg-zinc-400/10 text-zinc-300",
  REFUNDED: "border-violet-400/25 bg-violet-400/10 text-violet-300",
};

const fulfillmentStatusStyles: Record<PurchaseFulfillmentStatus, string> = {
  PENDING: "border-yellow-400/25 bg-yellow-400/10 text-yellow-300",
  PROCESSING: "border-orange-400/25 bg-orange-400/10 text-orange-300",
  FULFILLED: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  FAILED: "border-red-400/25 bg-red-400/10 text-red-300",
  MANUAL_REVIEW: "border-amber-400/25 bg-amber-400/10 text-amber-300",
};

function formatDate(value: string | null, locale: "id" | "en") {
  if (!value) return "-";

  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function formatNullable(value: string | null | undefined) {
  return value && value.trim() ? value : "-";
}

function shortValue(value: string | null | undefined) {
  if (!value) return "-";
  if (value.length <= 28) return value;
  return `${value.slice(0, 14)}...${value.slice(-10)}`;
}

function getVoucherCodes(value: string | null | undefined) {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((code) => code.trim())
    .filter(Boolean);
}

function formatStatus(label: string, locale: "id" | "en") {
  const normalized = label.replaceAll("_", " ");
  if (locale === "en") return normalized;

  const statusMap: Record<string, string> = {
    PENDING: "MENUNGGU",
    PAID: "DIBAYAR",
    PROCESSING: "DIPROSES",
    COMPLETED: "SELESAI",
    FAILED: "GAGAL",
    EXPIRED: "KEDALUWARSA",
    REFUNDED: "DIREFUND",
    FULFILLED: "TERKIRIM",
    MANUAL_REVIEW: "REVIEW MANUAL",
  };

  return statusMap[label] || normalized;
}

function getDisplayStatus(order: PurchaseHistoryOrder): PurchaseOrderStatus {
  if (
    order.status === "PENDING" &&
    order.expiresAt &&
    new Date(order.expiresAt) <= new Date()
  ) {
    return "EXPIRED";
  }

  return order.status;
}

function StatusBadge({
  label,
  className,
  locale,
}: {
  label: string;
  className: string;
  locale: "id" | "en";
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-semibold uppercase",
        className
      )}
    >
      {formatStatus(label, locale)}
    </span>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex min-h-9 items-start justify-between gap-4 border-b border-white/[0.06] py-2.5 last:border-b-0">
      <dt className="text-xs font-medium uppercase text-text-muted">
        {label}
      </dt>
      <dd
        className={cn(
          "max-w-[65%] text-right text-sm text-text-primary",
          mono && "font-[family-name:var(--font-geist-mono)] text-xs"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function EmptyState({ labels }: { labels: Labels }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-bg-card p-8 text-center shadow-[var(--shadow-card)]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-bg-elevated text-accent">
        <Receipt size={28} weight="bold" />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-text-primary">
        {labels.emptyTitle}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-secondary">
        {labels.emptyBody}
      </p>
      <Link href="/products" className="mt-6 inline-flex">
        <Button>
          {labels.browseProducts}
          <ArrowSquareOut size={16} weight="bold" />
        </Button>
      </Link>
    </div>
  );
}

export default function PurchaseHistoryClient({
  accountEmail,
  orders,
}: {
  accountEmail: string | null;
  orders: PurchaseHistoryOrder[];
}) {
  const { locale } = useLocale();
  const labels = labelsByLocale[locale];
  const completedOrders = orders.filter((order) => order.status === "COMPLETED").length;
  const pendingOrders = orders.filter((order) =>
    ["PENDING", "PAID", "PROCESSING"].includes(order.status)
  ).length;

  return (
    <div className="min-h-[100dvh] pt-28 pb-20">
      <div className="mx-auto max-w-[1200px] px-4 md:px-8">
        <FadeUp>
          <div className="mb-8 flex flex-col gap-5 border-b border-white/[0.08] pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase text-accent">
                <Receipt size={14} weight="bold" />
                {labels.account}
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
                {labels.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
                {labels.introBeforeEmail}{" "}
                <span className="text-text-primary">
                  {accountEmail || (locale === "id" ? "akun kamu" : "your account")}
                </span>
                {labels.introAfterEmail}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 md:min-w-80">
              <div className="rounded-xl border border-white/[0.08] bg-bg-card px-3 py-3">
                <div className="text-xl font-bold text-text-primary">
                  {orders.length}
                </div>
                <div className="text-[11px] uppercase text-text-muted">
                  {labels.total}
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-bg-card px-3 py-3">
                <div className="text-xl font-bold text-accent">
                  {completedOrders}
                </div>
                <div className="text-[11px] uppercase text-text-muted">
                  {labels.completed}
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-bg-card px-3 py-3">
                <div className="text-xl font-bold text-yellow-300">
                  {pendingOrders}
                </div>
                <div className="text-[11px] uppercase text-text-muted">
                  {labels.active}
                </div>
              </div>
            </div>
          </div>
        </FadeUp>

        {orders.length === 0 ? (
          <FadeUp delay={0.08}>
            <EmptyState labels={labels} />
          </FadeUp>
        ) : (
          <div className="space-y-5">
            {orders.map((order, index) => {
              const displayStatus = getDisplayStatus(order);
              const voucherCodes = getVoucherCodes(order.fulfillment?.voucherCode);
              const showVouchers =
                order.status === "COMPLETED" &&
                order.fulfillment?.status === "FULFILLED" &&
                voucherCodes.length > 0;
              const hasPaymentAction =
                order.status === "PENDING" &&
                order.paymentUrl &&
                displayStatus !== "EXPIRED";

              return (
                <FadeUp key={order.id} delay={Math.min(index * 0.03, 0.18)}>
                  <article className="overflow-hidden rounded-2xl border border-white/[0.08] bg-bg-card shadow-[var(--shadow-card)]">
                    <div className="flex flex-col gap-4 border-b border-white/[0.08] bg-bg-secondary/60 p-5 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <StatusBadge
                            label={displayStatus}
                            className={orderStatusStyles[displayStatus]}
                            locale={locale}
                          />
                          {order.fulfillment && (
                            <StatusBadge
                              label={order.fulfillment.status}
                              className={fulfillmentStatusStyles[order.fulfillment.status]}
                              locale={locale}
                            />
                          )}
                        </div>
                        <h2 className="font-[family-name:var(--font-geist-mono)] text-lg font-semibold text-text-primary">
                          {order.orderNumber}
                        </h2>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                          <span className="inline-flex items-center gap-1">
                            <CalendarBlank size={13} />
                            {formatDate(order.createdAt, locale)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <EnvelopeSimple size={13} />
                            {order.email}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3 md:text-right">
                        <div>
                          <div className="text-xs uppercase text-text-muted">
                            {labels.orderTotal}
                          </div>
                          <div className="font-[family-name:var(--font-geist-mono)] text-xl font-bold text-accent">
                            {formatPrice(order.totalIDR)}
                          </div>
                          <div className="font-[family-name:var(--font-geist-mono)] text-xs text-text-muted">
                            {formatPrice(order.totalUSD, "USD")}
                          </div>
                        </div>
                        {hasPaymentAction && (
                          <a
                            href={order.paymentUrl || "#"}
                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-bg-primary transition-transform active:scale-[0.98]"
                          >
                            {labels.pay}
                            <ArrowSquareOut size={15} weight="bold" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
                      <div className="border-b border-white/[0.08] p-5 lg:border-b-0 lg:border-r">
                        <div className="mb-4 flex items-center gap-2">
                          <Package size={18} weight="bold" className="text-accent" />
                          <h3 className="text-sm font-semibold uppercase text-text-primary">
                            {labels.orderItems}
                          </h3>
                        </div>

                        <div className="space-y-3">
                          {order.items.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-xl border border-white/[0.08] bg-bg-primary/35 p-4"
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <div className="text-base font-semibold text-text-primary">
                                    {item.product.name}
                                  </div>
                                  <div className="mt-1 text-sm text-text-secondary">
                                    {item.variant.name}
                                  </div>
                                </div>
                                <div className="font-[family-name:var(--font-geist-mono)] text-sm text-text-primary">
                                  x{item.quantity}
                                </div>
                              </div>
                              <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                                <div>
                                  <dt className="text-[11px] uppercase text-text-muted">
                                    {labels.unitPrice}
                                  </dt>
                                  <dd className="font-[family-name:var(--font-geist-mono)] text-sm text-text-primary">
                                    {formatPrice(item.priceIDR)}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] uppercase text-text-muted">
                                    {labels.lineTotal}
                                  </dt>
                                  <dd className="font-[family-name:var(--font-geist-mono)] text-sm text-text-primary">
                                    {formatPrice(item.priceIDR * item.quantity)}
                                  </dd>
                                </div>
                              </dl>
                            </div>
                          ))}
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-white/[0.08] bg-bg-primary/35 p-4">
                            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-primary">
                              <Hash size={16} weight="bold" className="text-accent" />
                              {labels.recipient}
                            </div>
                            <dl>
                              <DetailRow label={labels.email} value={order.email} />
                              <DetailRow label={labels.accountId} value={order.gameId} mono />
                              <DetailRow
                                label={labels.server}
                                value={formatNullable(order.serverId)}
                                mono
                              />
                            </dl>
                          </div>

                          <div className="rounded-xl border border-white/[0.08] bg-bg-primary/35 p-4">
                            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-primary">
                              <CurrencyBtc
                                size={16}
                                weight="bold"
                                className="text-accent"
                              />
                              {labels.payment}
                            </div>
                            <dl>
                              <DetailRow
                                label={labels.provider}
                                value={formatNullable(order.paymentProvider)}
                              />
                              <DetailRow
                                label={labels.currency}
                                value={formatNullable(order.paymentCurrency)}
                                mono
                              />
                              <DetailRow
                                label={labels.paidAt}
                                value={formatDate(order.paidAt, locale)}
                              />
                            </dl>
                          </div>
                        </div>
                      </div>

                      <div className="p-5">
                        <div className="mb-4 flex items-center gap-2">
                          {showVouchers ? (
                            <CheckCircle
                              size={18}
                              weight="bold"
                              className="text-accent"
                            />
                          ) : displayStatus === "FAILED" || displayStatus === "EXPIRED" ? (
                            <XCircle
                              size={18}
                              weight="bold"
                              className="text-red-300"
                            />
                          ) : (
                            <Clock
                              size={18}
                              weight="bold"
                              className="text-yellow-300"
                            />
                          )}
                          <h3 className="text-sm font-semibold uppercase text-text-primary">
                            {labels.fulfillmentDetails}
                          </h3>
                        </div>

                        {showVouchers ? (
                          <div className="space-y-3">
                            {voucherCodes.map((code, codeIndex) => (
                              <div
                                key={`${order.id}-${code}`}
                                className="rounded-xl border border-accent/20 bg-accent/5 p-4"
                              >
                                <div className="mb-2 flex items-center justify-between gap-3">
                                  <span className="text-xs font-semibold uppercase text-accent">
                                    {labels.voucher} {codeIndex + 1}
                                  </span>
                                  <CopyVoucherButton
                                    value={code}
                                    ariaLabel={labels.copiedAria}
                                  />
                                </div>
                                <div className="break-all font-[family-name:var(--font-geist-mono)] text-sm font-semibold text-text-primary">
                                  {code}
                                </div>
                                {order.fulfillment?.voucherPin && (
                                  <div className="mt-2 text-xs text-text-secondary">
                                    {labels.pin}:{" "}
                                    <span className="font-[family-name:var(--font-geist-mono)] text-text-primary">
                                      {order.fulfillment.voucherPin}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-white/[0.08] bg-bg-primary/35 p-4">
                            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-primary">
                              <WarningCircle
                                size={16}
                                weight="bold"
                                className="text-yellow-300"
                              />
                              {labels.voucherUnavailableTitle}
                            </div>
                            <p className="text-sm leading-relaxed text-text-secondary">
                              {labels.voucherUnavailableBody}
                            </p>
                          </div>
                        )}

                        <dl className="mt-5 rounded-xl border border-white/[0.08] bg-bg-primary/35 p-4">
                          <DetailRow
                            label={labels.orderId}
                            value={shortValue(order.id)}
                            mono
                          />
                          <DetailRow
                            label={labels.paymentId}
                            value={shortValue(order.paymentProviderPaymentId)}
                            mono
                          />
                          <DetailRow
                            label={labels.invoiceId}
                            value={shortValue(order.paymentProviderInvoiceId)}
                            mono
                          />
                          <DetailRow
                            label={labels.txHash}
                            value={shortValue(order.paymentProviderTxHash)}
                            mono
                          />
                          <DetailRow
                            label={labels.expires}
                            value={formatDate(order.expiresAt, locale)}
                          />
                          <DetailRow
                            label={labels.promo}
                            value={order.promoCode?.code || "-"}
                            mono
                          />
                          <DetailRow
                            label={labels.fulfillmentProvider}
                            value={order.fulfillment ? "Automated delivery" : "-"}
                          />
                        </dl>
                      </div>
                    </div>
                  </article>
                </FadeUp>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
