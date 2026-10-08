"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowsClockwise,
  CaretLeft,
  CaretRight,
  Clock,
  List,
  MagnifyingGlass,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  SquaresFour,
  X,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import ResellerLogoutButton from "./ResellerLogoutButton";
import { CartButton, OrderModal, OrdersPanel, type CartLine, type ResellerOrder } from "./ResellerOrders";

type Variant = { id: string; name: string; countryCode: string | null; priceIDR: number };
type Product = { id: string; name: string; slug: string; image: string | null; variants: Variant[] };
type Catalog = { products: Product[]; quotedAt: string; orderingEnabled?: boolean; defaultPaymentMethod?: "CRYPTO" | "PAKASIR" };
type Quote = { variantId: string; unitPriceIDR: number; totalIDR: number; quantity: number; quotedAt: string };

const MAX_QUANTITY = 20;
const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const ACTIVE_ORDER_STATUSES = ["PAYMENT_PENDING", "PAID", "PROCESSING", "MANUAL_REVIEW", "REFUND_PENDING"];

function timeLabel(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-bg-card p-5">
      <p className="text-[13px] font-medium text-text-secondary">{label}</p>
      <p className="mt-3 font-[family-name:var(--font-geist-mono)] text-3xl font-bold tracking-tight text-text-primary">{value}</p>
      {hint ? <p className="mt-2 text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

export default function ResellerDashboard({
  orgId,
  orgName,
  statusLabel,
  email,
}: {
  orgId: string;
  orgName: string;
  statusLabel: string;
  email: string | null;
}) {
  const [view, setView] = useState<"catalog" | "orders">("catalog");
  const [navOpen, setNavOpen] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selected, setSelected] = useState<Variant | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [showOrder, setShowOrder] = useState(false);
  const [orders, setOrders] = useState<ResellerOrder[] | null>(null);
  const quoteController = useRef<AbortController | null>(null);

  const orderingEnabled = Boolean(catalog?.orderingEnabled);
  const cartCount = Object.values(cart).reduce((sum, line) => sum + line.quantity, 0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setCatalogError("");
      try {
        const query = new URLSearchParams({ organizationId: orgId });
        const response = await fetch(`/api/reseller/catalog?${query}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Unable to load your catalog. Please refresh or check your reseller access.");
        const body = (await response.json()) as Catalog;
        if (!Array.isArray(body.products)) throw new Error("The catalog response was invalid. Please refresh.");
        if (controller.signal.aborted) return;
        setCatalog(body);
        setSelected((current) => {
          if (!current) return current;
          const stillAvailable = body.products.some((product) => product.variants.some((variant) => variant.id === current.id));
          return stillAvailable ? current : null;
        });
      } catch (cause) {
        if (!controller.signal.aborted) {
          setCatalogError(cause instanceof Error ? cause.message : "Unable to connect to the server.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [orgId, reload]);

  useEffect(() => {
    if (!orderingEnabled) return;
    const controller = new AbortController();
    async function loadOrders() {
      try {
        const response = await fetch(`/api/reseller/orders?organizationId=${encodeURIComponent(orgId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => ({}))) as { orders?: ResellerOrder[] };
        if (!controller.signal.aborted && Array.isArray(body.orders)) setOrders(body.orders);
      } catch {
        // OrdersPanel renders its own error state; the header count stays quiet.
      }
    }
    void loadOrders();
    return () => controller.abort();
  }, [orgId, orderingEnabled, showOrder, reload]);

  useEffect(() => () => quoteController.current?.abort(), []);

  async function fetchQuote(variantId: string, amount: number) {
    quoteController.current?.abort();
    const controller = new AbortController();
    quoteController.current = controller;
    setQuoteBusy(true);
    setQuoteError("");
    try {
      const query = new URLSearchParams({ organizationId: orgId, variantId, quantity: String(amount) });
      const response = await fetch(`/api/reseller/pricing/quote?${query}`, { cache: "no-store", signal: controller.signal });
      const body = (await response.json().catch(() => ({}))) as Quote & { error?: string };
      if (!response.ok) throw new Error(body.error || "Quote unavailable. Refresh the catalog or try another package.");
      if (controller.signal.aborted) return;
      setQuote(body);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setQuote(null);
        setQuoteError(cause instanceof Error ? cause.message : "Unable to connect to the server.");
      }
    } finally {
      if (!controller.signal.aborted) setQuoteBusy(false);
    }
  }

  function openProduct(product: Product) {
    setSelectedProduct(product);
    setSelected(product.variants[0] ?? null);
    setQuantity(1);
    setQuote(null);
    if (product.variants[0]) void fetchQuote(product.variants[0].id, 1);
  }

  function selectVariant(variant: Variant) {
    setSelected(variant);
    setQuantity(1);
    setQuote(null);
    void fetchQuote(variant.id, 1);
  }

  function changeCartQuantity(variantId: string, next: number) {
    setCart((current) => {
      const line = current[variantId];
      if (!line) return current;
      const qty = Math.max(1, Math.min(MAX_QUANTITY, next));
      if (qty === line.quantity) return current;
      return { ...current, [variantId]: { ...line, quantity: qty } };
    });
  }

  function addToCart() {
    if (!selected) return;
    setCart((current) => {
      const existing = current[selected.id];
      const nextQuantity = Math.min(MAX_QUANTITY, (existing?.quantity ?? 0) + quantity);
      return { ...current, [selected.id]: { variantId: selected.id, name: selected.name, unitPriceIDR: selected.priceIDR, quantity: nextQuantity } };
    });
    setShowOrder(true);
  }

  const term = search.trim().toLowerCase();
  const products = useMemo(() => {
    const source = catalog?.products ?? [];
    if (!term) return source;
    return source.filter((product) =>
      `${product.name} ${product.slug} ${product.variants.map((variant) => variant.name).join(" ")}`.toLowerCase().includes(term),
    );
  }, [catalog, term]);

  const skuCount = useMemo(
    () => (catalog?.products ?? []).reduce((total, product) => total + product.variants.length, 0),
    [catalog],
  );
  const activeOrders = (orders ?? []).filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status)).length;
  const completedOrders = (orders ?? []).filter((order) => order.status === "COMPLETED").length;

  const unitPrice = quote?.unitPriceIDR ?? selected?.priceIDR ?? 0;
  const totalPrice = unitPrice * quantity;
  const isLive = Boolean(quote);

  const navItems: { key: "catalog" | "orders"; label: string; icon: typeof SquaresFour }[] = [
    { key: "catalog", label: "Catalog", icon: SquaresFour },
    { key: "orders", label: "Orders", icon: Clock },
  ];

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-4">
        <div className="relative h-7 w-28 shrink-0">
          <Image src="/logo.png" alt="EZTopUp" fill className="object-contain object-left" sizes="112px" priority />
        </div>
        <span className="ml-auto rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
          Reseller
        </span>
      </div>

      <div className="border-b border-border/70 p-3">
        <div className="rounded-xl border border-border bg-bg-card px-3 py-2.5">
          <p className="truncate text-sm font-semibold leading-tight">{orgName}</p>
          <p className="truncate text-[11px] leading-tight text-text-muted">{email || "—"}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 p-2.5" aria-label="Reseller console">
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setView(item.key);
              setSelectedProduct(null);
              setNavOpen(false);
            }}
            aria-current={view === item.key ? "page" : undefined}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition",
              view === item.key
                ? "border border-accent/20 bg-accent/10 text-accent"
                : "border border-transparent text-text-secondary hover:bg-white/[0.04] hover:text-text-primary",
            )}
          >
            <item.icon size={18} weight={view === item.key ? "fill" : "regular"} className="shrink-0" aria-hidden="true" />
            {item.label}
            {item.key === "orders" && orders ? <span className="ml-auto text-[11px] text-text-muted">{orders.length}</span> : null}
          </button>
        ))}
        {orderingEnabled ? (
          <button
            type="button"
            onClick={() => setShowOrder(true)}
            className="flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-[13px] font-medium text-text-secondary transition hover:bg-white/[0.04] hover:text-text-primary"
          >
            <ShoppingCart size={18} className="shrink-0" aria-hidden="true" />
            Cart
            {cartCount > 0 ? (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-bg-primary">{cartCount}</span>
            ) : null}
          </button>
        ) : null}
      </nav>

      <div className="space-y-2 border-t border-border/70 p-2.5">
        <span className="block px-2.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">{statusLabel}</span>
        <ResellerLogoutButton className="flex h-9 w-full items-center justify-center rounded-lg border border-border text-xs font-medium text-text-secondary transition hover:border-red-400/40 hover:text-red-200" />
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-bg-primary text-text-primary">
      <aside className="hidden w-[236px] shrink-0 border-r border-border/80 bg-bg-secondary/50 md:block">{sidebar}</aside>

      {navOpen ? (
        <div className="fixed inset-0 z-[70] md:hidden" role="dialog" aria-modal="true" aria-label="Reseller menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/60" onClick={() => setNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[250px] border-r border-border/80 bg-bg-secondary">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/80 bg-bg-secondary/50 px-3 sm:px-5">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary hover:text-text-primary md:hidden"
          >
            <List size={18} />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{orgName}</p>
            <p className="text-[11px] leading-tight text-text-muted">Wholesale console</p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {orderingEnabled ? (
              <CartButton count={cartCount} onClick={() => setShowOrder(true)} />
            ) : (
              <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-text-muted">Ordering not enabled</span>
            )}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {view === "orders" ? (
            <div className="mx-auto max-w-4xl p-4 sm:p-6">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Orders</h1>
              <p className="mt-1 text-sm text-text-secondary">Payments and delivery status for your organization.</p>
              <div className="mt-5">
                {orderingEnabled ? (
                  <OrdersPanel orgId={orgId} />
                ) : (
                  <p className="rounded-2xl border border-border bg-bg-card p-5 text-sm text-text-secondary">
                    Wholesale ordering is not enabled for your organization yet.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-5xl p-4 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Welcome back</h1>
                  <p className="mt-1 text-sm text-text-secondary">
                    {selectedProduct ? selectedProduct.name : "Pick a product below, then a package to price it."}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setReload((value) => value + 1)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-medium text-text-secondary transition hover:border-accent/40 hover:text-text-primary disabled:opacity-50"
                >
                  <ArrowsClockwise size={14} aria-hidden="true" />
                  {loading ? "Refreshing…" : "Refresh catalog"}
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <StatCard label="Wholesale SKUs" value={String(skuCount)} hint={`${catalog?.products.length ?? 0} products configured`} />
                <StatCard label="Active orders" value={orders ? String(activeOrders) : "—"} hint="Pending payment, processing, or review" />
                <StatCard label="Completed orders" value={orders ? String(completedOrders) : "—"} hint={`Catalog updated ${timeLabel(catalog?.quotedAt) || "—"}`} />
              </div>

              {catalogError ? (
                <p role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
                  {catalogError}
                </p>
              ) : null}

              {selectedProduct ? (
                <section className="mt-6" aria-label="Package detail">
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-medium text-text-secondary transition hover:text-text-primary"
                  >
                    <CaretLeft size={14} aria-hidden="true" />
                    All products
                  </button>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
                    <div className="rounded-2xl border border-border bg-bg-card p-4">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Packages</h2>
                      <ul className="mt-3 space-y-1.5">
                        {selectedProduct.variants.map((variant) => {
                          const active = selected?.id === variant.id;
                          return (
                            <li key={variant.id}>
                              <button
                                type="button"
                                onClick={() => selectVariant(variant)}
                                aria-pressed={active}
                                className={cn(
                                  "flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition",
                                  active
                                    ? "border-accent bg-accent/10 shadow-[var(--shadow-glow)]"
                                    : "border-border bg-bg-primary/40 hover:border-accent/40",
                                )}
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-[13px] font-medium leading-tight">{variant.name}</span>
                                  <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-text-muted">{variant.countryCode || "Global"}</span>
                                </span>
                                <span className="shrink-0 font-[family-name:var(--font-geist-mono)] text-[13px] font-semibold text-accent">
                                  {money.format(variant.priceIDR)}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-border bg-bg-card p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-wide text-text-muted">Unit price</p>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            isLive ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-border text-text-muted",
                          )}
                        >
                          {quoteBusy ? "Checking…" : isLive ? `Live · ${timeLabel(quote?.quotedAt)}` : "Indicative"}
                        </span>
                      </div>
                      <p className="mt-2 font-[family-name:var(--font-geist-mono)] text-3xl font-bold tabular-nums">{money.format(unitPrice)}</p>

                      <div className="mt-5 flex items-center justify-between rounded-2xl border border-border bg-bg-primary/50 p-2">
                        <button
                          type="button"
                          onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                          disabled={quantity <= 1}
                          aria-label="Decrease quantity"
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-text-secondary transition hover:border-accent/40 hover:text-text-primary disabled:opacity-35"
                        >
                          <Minus size={15} weight="bold" />
                        </button>
                        <div className="text-center">
                          <p className="font-[family-name:var(--font-geist-mono)] text-xl font-bold leading-none tabular-nums">{quantity}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-text-muted">units</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setQuantity((value) => Math.min(MAX_QUANTITY, value + 1))}
                          disabled={quantity >= MAX_QUANTITY}
                          aria-label="Increase quantity"
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-text-secondary transition hover:border-accent/40 hover:text-text-primary disabled:opacity-35"
                        >
                          <Plus size={15} weight="bold" />
                        </button>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4">
                        <span className="text-sm text-text-secondary">Total</span>
                        <span className="font-[family-name:var(--font-geist-mono)] text-xl font-bold tabular-nums text-accent">{money.format(totalPrice)}</span>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          disabled={quoteBusy || !selected}
                          onClick={() => selected && void fetchQuote(selected.id, quantity)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-accent/30 px-3 text-xs font-semibold text-accent transition hover:bg-accent/10 disabled:opacity-50"
                        >
                          <ArrowsClockwise size={13} aria-hidden="true" />
                          {quoteBusy ? "Refreshing…" : "Refresh live quote"}
                        </button>
                        <p className="text-[11px] text-text-muted">Final price follows the live quote at checkout.</p>
                      </div>

                      {orderingEnabled ? (
                        <button
                          type="button"
                          onClick={addToCart}
                          disabled={!selected}
                          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-bg-primary transition hover:brightness-110 disabled:opacity-50"
                        >
                          <ShoppingCart size={16} weight="bold" aria-hidden="true" />
                          Add {quantity} to order
                        </button>
                      ) : null}

                      {quoteError ? (
                        <p role="alert" className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-200">
                          {quoteError}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </section>
              ) : (
                <section className="mt-6" aria-label="Product catalog">
                  <div className="relative min-w-0">
                    <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search products or packages…"
                      aria-label="Search wholesale catalog"
                      autoComplete="off"
                      enterKeyHint="search"
                      className="h-11 w-full rounded-xl border border-border bg-bg-card pl-9 pr-3 text-base sm:h-10 sm:text-sm"
                    />
                  </div>

                  {loading ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="h-32 animate-pulse rounded-2xl border border-border/60 bg-bg-card/60" />
                      ))}
                    </div>
                  ) : products.length === 0 ? (
                    <p className="mt-4 rounded-2xl border border-border bg-bg-card p-5 text-sm text-text-secondary">
                      {catalog && catalog.products.length > 0
                        ? "No products match your search."
                        : "No wholesale pricing is available for your organization yet. Contact support if this looks wrong."}
                    </p>
                  ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {products.map((product) => {
                        const cheapest = product.variants.reduce((min, variant) => Math.min(min, variant.priceIDR), Number.POSITIVE_INFINITY);
                        return (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => openProduct(product)}
                            className="group flex flex-col rounded-2xl border border-border bg-bg-card p-4 text-left transition hover:border-accent/40 hover:bg-bg-elevated/40"
                          >
                            <div className="flex items-center gap-3">
                              {product.image ? (
                                <Image src={product.image} alt="" width={36} height={36} unoptimized className="h-9 w-9 rounded-lg object-cover" />
                              ) : (
                                <Package size={20} className="text-text-muted" aria-hidden="true" />
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{product.name}</p>
                                <p className="text-[11px] text-text-muted">
                                  {product.variants.length} package{product.variants.length === 1 ? "" : "s"}
                                </p>
                              </div>
                              <CaretRight
                                size={14}
                                className="ml-auto shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-accent"
                                aria-hidden="true"
                              />
                            </div>
                            <p className="mt-4 text-[11px] uppercase tracking-wide text-text-muted">From</p>
                            <p className="font-[family-name:var(--font-geist-mono)] text-lg font-bold text-accent">
                              {Number.isFinite(cheapest) ? money.format(cheapest) : "—"}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </main>
      </div>

      {showOrder ? (
        <OrderModal
          key={Object.entries(cart).map(([id, line]) => `${id}x${line.quantity}`).sort().join("|") || "empty"}
          orgId={orgId}
          lines={Object.values(cart)}
          defaultMethod={catalog?.defaultPaymentMethod ?? "PAKASIR"}
          onClose={() => setShowOrder(false)}
          onPlaced={() => setCart({})}
          onChangeQuantity={changeCartQuantity}
          onRemove={(variantId) =>
            setCart((current) => {
              const next = { ...current };
              delete next[variantId];
              return next;
            })
          }
          onClear={() => setCart({})}
        />
      ) : null}

      {navOpen ? (
        <button
          type="button"
          onClick={() => setNavOpen(false)}
          aria-label="Close menu"
          className="fixed right-4 top-4 z-[80] flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-bg-secondary text-text-secondary md:hidden"
        >
          <X size={16} weight="bold" />
        </button>
      ) : null}
    </div>
  );
}
