"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Variant = { id: string; name: string; countryCode: string | null; priceIDR: number };
type Catalog = {
  products: Array<{ id: string; name: string; slug: string; image: string | null; variants: Variant[] }>;
  quotedAt: string;
};
type Quote = { variantId: string; unitPriceIDR: number; totalIDR: number; quantity: number; quotedAt: string };

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const buttonClass = "rounded-lg border border-accent/30 px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

function quoteTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString("en-GB");
}

export default function ResellerCatalog({ orgId }: { orgId: string }) {
  // A different organization gets its own request and quote state.
  return <CatalogContent key={orgId} orgId={orgId} />;
}

function CatalogContent({ orgId }: { orgId: string }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const query = new URLSearchParams({ organizationId: orgId });
        const response = await fetch(`/api/reseller/catalog?${query}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Unable to load your catalog. Please try again or check your reseller access.");
        const body = (await response.json()) as Catalog;
        if (!Array.isArray(body.products)) throw new Error("The catalog response was invalid. Please try again.");
        if (!controller.signal.aborted) setCatalog(body);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to connect to the server.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [orgId, reload]);

  function refreshCatalog() {
    setLoading(true);
    setError("");
    setCatalog(null);
    setReload((value) => value + 1);
  }

  const term = search.trim().toLowerCase();
  const products = (catalog?.products ?? []).filter((product) =>
    (!productId || product.id === productId) && (!term || `${product.name} ${product.slug}`.toLowerCase().includes(term)),
  );

  return (
    <section aria-labelledby="reseller-catalog-title" className="mt-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="reseller-catalog-title" className="text-xl font-semibold tracking-tight">Reseller catalog</h2>
          <p className="mt-1 text-sm text-text-secondary">Indicative prices in IDR for one unit. Refresh a SKU for its latest quote.</p>
          <p className="mt-1 text-xs text-text-muted">Prices may change. Ordering and checkout are not available yet.</p>
        </div>
        <button type="button" className={buttonClass} disabled={loading} onClick={refreshCatalog}>
          {loading ? "Loading…" : "Refresh catalog"}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="catalog-search" className="mb-1.5 block text-xs font-medium text-text-secondary">Search products</label>
          <input id="catalog-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Product name" className="w-full rounded-xl border border-border bg-bg-card px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-accent" />
        </div>
        <div>
          <label htmlFor="catalog-product" className="mb-1.5 block text-xs font-medium text-text-secondary">Filter by product</label>
          <select id="catalog-product" value={productId} onChange={(event) => setProductId(event.target.value)} disabled={loading} className="w-full rounded-xl border border-border bg-bg-card px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50">
            <option value="">All products</option>
            {(catalog?.products ?? []).map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
        </div>
      </div>
      {loading ? <p role="status" className="rounded-2xl border border-border bg-bg-card p-5 text-sm text-text-secondary">Loading your catalog…</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p> : null}
      {!loading && !error && catalog ? (
        <>
          <p className="text-xs text-text-muted">Catalog quoted at {quoteTime(catalog.quotedAt)}</p>
          {products.length === 0 ? (
            <p role="status" className="rounded-2xl border border-border bg-bg-card p-5 text-sm text-text-secondary">
              {catalog.products.length === 0 ? "No products are currently available for your organization." : "No products match your search or filter."}
            </p>
          ) : products.map((product) => (
            <article key={product.id} className="overflow-hidden rounded-2xl border border-border bg-bg-card">
              <div className="flex items-center gap-3 border-b border-border p-4">
                {product.image ? <Image src={product.image} alt="" width={48} height={48} unoptimized className="h-12 w-12 rounded-lg object-cover" /> : null}
                <h3 className="font-semibold">{product.name}</h3>
              </div>
              <ul className="divide-y divide-border">
                {product.variants.map((variant) => <VariantQuote key={`${reload}-${variant.id}`} orgId={orgId} variant={variant} quotedAt={catalog.quotedAt} />)}
              </ul>
              {product.variants.length === 0 ? <p className="p-4 text-sm text-text-secondary">No available SKUs for this product.</p> : null}
            </article>
          ))}
        </>
      ) : null}
    </section>
  );
}

function VariantQuote({ orgId, variant, quotedAt }: { orgId: string; variant: Variant; quotedAt: string }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => controllerRef.current?.abort(), []);

  async function refreshQuote() {
    if (busy) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true);
    setError("");
    setQuote(null);
    try {
      const query = new URLSearchParams({ organizationId: orgId, variantId: variant.id, quantity: "1" });
      const response = await fetch(`/api/reseller/pricing/quote?${query}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Quote unavailable. This SKU may no longer be available; refresh the catalog or try again.");
      const body = (await response.json()) as Quote;
      if (body.variantId !== variant.id || body.quantity !== 1 || !Number.isFinite(body.unitPriceIDR)) throw new Error("Unable to read the latest quote. Please try again.");
      if (!controller.signal.aborted) setQuote(body);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to connect to the server.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <li className="p-4" aria-busy={busy}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{variant.name}</p>
          <p className="mt-1 text-xs text-text-muted">{variant.countryCode || "Global"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right">
            <p className="font-semibold tabular-nums text-accent">{error ? "Quote unavailable" : money.format(quote?.unitPriceIDR ?? variant.priceIDR)}</p>
            <p className="text-xs text-text-muted">Indicative · IDR / unit</p>
          </div>
          <button type="button" disabled={busy} onClick={refreshQuote} aria-label={`Refresh quote for ${variant.name}`} className={buttonClass}>{busy ? "Refreshing…" : "Refresh quote"}</button>
        </div>
      </div>
      {error ? <p role="alert" className="mt-3 text-xs text-red-200">{error}</p> : <p role="status" className="mt-2 text-xs text-text-muted">{busy ? "Fetching the latest price…" : `Quoted at ${quoteTime(quote?.quotedAt ?? quotedAt)}`}</p>}
    </li>
  );
}
