"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowsClockwise,
  CaretLeft,
  MagnifyingGlass,
  Minus,
  Package,
  Plus,
  ShoppingCart,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import ResellerLogoutButton from "./ResellerLogoutButton";
import { CartButton, OrderModal, type CartLine } from "./ResellerOrders";

type Variant = { id: string; name: string; countryCode: string | null; priceIDR: number };
type Product = { id: string; name: string; slug: string; image: string | null; variants: Variant[] };
type Catalog = { products: Product[]; quotedAt: string; orderingEnabled?: boolean; defaultPaymentMethod?: "CRYPTO" | "PAKASIR" };
type Quote = { variantId: string; unitPriceIDR: number; totalIDR: number; quantity: number; quotedAt: string };

const MAX_QUANTITY = 20;
/** Mirrors MAX_B2B_LINE_QUANTITY; the server re-validates every line. */
const MAX_QUANTITY_TOTAL = 20;
const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function timeLabel(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
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
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ product: Product; variant: Variant } | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [showOrder, setShowOrder] = useState(false);
  const quoteController = useRef<AbortController | null>(null);

  function addToCart() {
    if (!selected) return;
    const { variant } = selected;
    setCart((current) => {
      const existing = current[variant.id];
      const nextQuantity = Math.min(MAX_QUANTITY_TOTAL, (existing?.quantity ?? 0) + quantity);
      return { ...current, [variant.id]: { variantId: variant.id, name: variant.name, unitPriceIDR: variant.priceIDR, quantity: nextQuantity } };
    });
    setShowOrder(true);
  }

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setCatalogError("");
      try {
        const query = new URLSearchParams({ organizationId: orgId });
        const response = await fetch(`/api/reseller/catalog?${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Unable to load your catalog. Please refresh or check your reseller access.");
        const body = (await response.json()) as Catalog;
        if (!Array.isArray(body.products)) throw new Error("The catalog response was invalid. Please refresh.");
        if (controller.signal.aborted) return;
        setCatalog(body);
        setSelected((current) => {
          if (!current) return current;
          const product = body.products.find((item) => item.id === current.product.id);
          const variant = product?.variants.find((item) => item.id === current.variant.id);
          return product && variant ? { product, variant } : null;
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

  useEffect(() => () => quoteController.current?.abort(), []);

  async function fetchQuote(variantId: string, amount: number) {
    quoteController.current?.abort();
    const controller = new AbortController();
    quoteController.current = controller;
    setQuoteBusy(true);
    setQuoteError("");
    try {
      const query = new URLSearchParams({ organizationId: orgId, variantId, quantity: String(amount) });
      const response = await fetch(`/api/reseller/pricing/quote?${query}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => ({}))) as Quote & { error?: string };
      if (!response.ok) throw new Error(body.error || "Quote unavailable. Refresh the catalog or try another SKU.");
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

  function selectVariant(product: Product, variant: Variant) {
    setSelected({ product, variant });
    setQuantity(1);
    setQuote(null);
    void fetchQuote(variant.id, 1);
  }

  function changeQuantity(next: number) {
    setQuantity(Math.min(MAX_QUANTITY, Math.max(1, next)));
  }

  const term = search.trim().toLowerCase();
  const products = useMemo(() => {
    const source = catalog?.products ?? [];
    if (!term) return source;
    return source
      .map((product) => ({
        ...product,
        variants: product.variants.filter((variant) =>
          `${product.name} ${product.slug} ${variant.name}`.toLowerCase().includes(term),
        ),
      }))
      .filter((product) => product.variants.length > 0 || product.name.toLowerCase().includes(term));
  }, [catalog, term]);

  const skuCount = useMemo(
    () => (catalog?.products ?? []).reduce((total, product) => total + product.variants.length, 0),
    [catalog],
  );

  const unitPrice = quote?.unitPriceIDR ?? selected?.variant.priceIDR ?? 0;
  const totalPrice = unitPrice * quantity;
  const isLive = Boolean(quote);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-bg-primary text-text-primary">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/80 bg-bg-secondary/70 px-3 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md sm:hidden">
            <Image src="/logo.png" alt="" fill className="object-cover object-left" sizes="28px" priority />
          </div>
          <div className="relative hidden h-7 w-28 shrink-0 sm:block">
            <Image src="/logo.png" alt="EZTopUp" fill className="object-contain object-left" sizes="112px" priority />
          </div>
          <span className="hidden rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent sm:inline">
            Reseller
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{orgName}</p>
            <p className="truncate text-[11px] leading-tight text-text-muted">{email || "—"}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <span className="hidden rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[11px] font-semibold text-emerald-300 sm:px-2.5 md:inline">
            {statusLabel}
          </span>
          <CartButton count={Object.values(cart).reduce((sum, line) => sum + line.quantity, 0)} onClick={() => setShowOrder(true)} />
          <ResellerLogoutButton
            compact
            className="h-9 border border-border px-2.5 text-xs text-text-secondary hover:border-red-400/40 hover:text-red-200 sm:px-3"
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "flex min-h-0 w-full shrink-0 flex-col border-border/80 lg:flex lg:w-[400px] lg:border-r xl:w-[440px]",
            selected ? "hidden" : "flex",
          )}
          aria-label="Wholesale catalog"
        >
          <div className="shrink-0 space-y-2 border-b border-border/60 p-3">
            <label htmlFor="catalog-search" className="sr-only">
              Search wholesale catalog
            </label>
            <div className="relative">
              <MagnifyingGlass
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                aria-hidden="true"
              />
              <input
                id="catalog-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search product or package…"
                autoComplete="off"
                enterKeyHint="search"
                className="h-11 w-full rounded-xl border border-border bg-bg-card pl-9 pr-3 text-base focus-visible:outline-2 focus-visible:outline-accent sm:h-10 sm:text-sm"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-text-muted">
              <span>
                {skuCount} wholesale SKU{skuCount === 1 ? "" : "s"}
                {catalog?.quotedAt ? ` · updated ${timeLabel(catalog.quotedAt)}` : ""}
              </span>
              <button
                type="button"
                disabled={loading}
                onClick={() => setReload((value) => value + 1)}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium text-accent transition hover:bg-accent/10 disabled:opacity-50"
              >
                <ArrowsClockwise size={13} aria-hidden="true" />
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pb-5">
            {loading ? (
              <div className="space-y-2 p-1" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-14 animate-pulse rounded-xl border border-border/60 bg-bg-card/60" />
                ))}
              </div>
            ) : catalogError ? (
              <p role="alert" className="m-2 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
                {catalogError}
              </p>
            ) : products.length === 0 ? (
              <p className="m-2 rounded-xl border border-border bg-bg-card p-4 text-sm text-text-secondary">
                {catalog && catalog.products.length > 0
                  ? "No SKUs match your search."
                  : "No wholesale pricing is available for your organization yet. Contact support if this looks wrong."}
              </p>
            ) : (
              products.map((product) => (
                <section key={product.id} className="mb-2">
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt=""
                        width={20}
                        height={20}
                        unoptimized
                        className="h-5 w-5 rounded object-cover"
                      />
                    ) : (
                      <Package size={16} className="text-text-muted" aria-hidden="true" />
                    )}
                    <h3 className="truncate text-xs font-semibold uppercase tracking-wide text-text-muted">
                      {product.name}
                    </h3>
                  </div>
                  <ul className="space-y-1">
                    {product.variants.map((variant) => {
                      const active = selected?.variant.id === variant.id;
                      return (
                        <li key={variant.id}>
                          <button
                            type="button"
                            onClick={() => selectVariant(product, variant)}
                            aria-pressed={active}
                            className={cn(
                              "group flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition sm:p-2.5",
                              active
                                ? "border-accent bg-accent/10 shadow-[var(--shadow-glow)]"
                                : "border-border bg-bg-card hover:border-accent/40 hover:bg-bg-elevated/40",
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-medium leading-tight text-text-primary">
                                {variant.name}
                              </span>
                              <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-text-muted">
                                {variant.countryCode || "Global"}
                              </span>
                            </span>
                            <span className="shrink-0 font-[family-name:var(--font-geist-mono)] text-[13px] font-semibold text-accent">
                              {money.format(variant.priceIDR)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
          </div>
        </aside>

        <section
          className={cn(
            "min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain lg:flex",
            selected ? "flex" : "hidden",
          )}
          aria-label="Package detail"
        >
          {selected ? (
            <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-6">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="inline-flex h-9 w-fit items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-medium text-text-secondary transition hover:bg-bg-elevated/50 hover:text-text-primary lg:hidden"
              >
                <CaretLeft size={14} aria-hidden="true" />
                Catalog
              </button>

              <div className="flex items-start gap-3">
                {selected.product.image ? (
                  <Image
                    src={selected.product.image}
                    alt=""
                    width={48}
                    height={48}
                    unoptimized
                    className="h-12 w-12 rounded-xl border border-border/60 object-cover"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-text-muted">{selected.product.name}</p>
                  <h2 className="mt-0.5 text-lg font-semibold leading-tight">{selected.variant.name}</h2>
                  <p className="mt-1 text-xs text-text-muted">
                    Supplier region: {selected.variant.countryCode?.toUpperCase() || "Global"}
                  </p>
                </div>
              </div>

              <motion.div
                key={selected.variant.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-2xl border border-border bg-bg-card p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-wide text-text-muted">Unit price</p>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      isLive
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                        : "border-border text-text-muted",
                    )}
                  >
                    {quoteBusy ? "Checking…" : isLive ? `Live · ${timeLabel(quote?.quotedAt)}` : "Indicative"}
                  </span>
                </div>
                <p className="mt-2 font-[family-name:var(--font-geist-mono)] text-3xl font-bold tabular-nums text-text-primary">
                  {money.format(unitPrice)}
                </p>

                <div className="mt-5 flex items-center justify-between rounded-2xl border border-border bg-bg-primary/60 p-2">
                  <button
                    type="button"
                    onClick={() => changeQuantity(quantity - 1)}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-text-secondary transition hover:border-accent/40 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-35 sm:h-10 sm:w-10"
                  >
                    <Minus size={16} weight="bold" />
                  </button>
                  <div className="text-center">
                    <p className="font-[family-name:var(--font-geist-mono)] text-xl font-bold leading-none tabular-nums">
                      {quantity}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-text-muted">units</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => changeQuantity(quantity + 1)}
                    disabled={quantity >= MAX_QUANTITY}
                    aria-label="Increase quantity"
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-text-secondary transition hover:border-accent/40 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-35 sm:h-10 sm:w-10"
                  >
                    <Plus size={16} weight="bold" />
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4">
                  <span className="text-sm text-text-secondary">Total</span>
                  <span className="font-[family-name:var(--font-geist-mono)] text-xl font-bold tabular-nums text-accent">
                    {money.format(totalPrice)}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={quoteBusy}
                    onClick={() => void fetchQuote(selected.variant.id, quantity)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-accent/30 px-3 text-xs font-semibold text-accent transition hover:bg-accent/10 disabled:opacity-50"
                  >
                    <ArrowsClockwise size={13} aria-hidden="true" />
                    {quoteBusy ? "Refreshing…" : "Refresh live quote"}
                  </button>
                  <p className="text-[11px] text-text-muted">Final price follows the live quote at checkout.</p>
                </div>

                {catalog?.orderingEnabled ? (
                  <button
                    type="button"
                    onClick={addToCart}
                    className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-bg-primary transition hover:brightness-110"
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
              </motion.div>

              <p className="rounded-2xl border border-accent/20 bg-accent/5 p-4 text-xs leading-relaxed text-text-secondary">
                Prices update from supplier stock in real time — refresh before committing. Partially deliverable
                orders are reviewed manually before any refund.
              </p>
            </div>
          ) : (
            <div className="hidden flex-1 flex-col items-center justify-center gap-2 p-6 text-center lg:flex">
              <Package size={28} className="text-text-muted" aria-hidden="true" />
              <p className="text-sm text-text-secondary">Select a package to see its wholesale quote.</p>
              <p className="max-w-sm text-xs text-text-muted">
                Your catalog shows {skuCount} SKU{skuCount === 1 ? "" : "s"} configured for your organization.
              </p>
            </div>
          )}
        </section>
      </div>

      {showOrder ? (
        <OrderModal
          orgId={orgId}
          lines={Object.values(cart)}
          defaultMethod={catalog?.defaultPaymentMethod ?? "PAKASIR"}
          onClose={() => setShowOrder(false)}
          onPlaced={() => setCart({})}
        />
      ) : null}
    </div>
  );
}
