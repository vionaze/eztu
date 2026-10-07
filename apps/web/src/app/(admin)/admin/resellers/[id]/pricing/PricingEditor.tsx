"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";

type PricingItem = {
  variantId: string;
  name: string;
  productName: string;
  countryCode: string | null;
  supplierSku: string | null;
  supplierCostIDR: number | null;
  supplierStatus: string | null;
  source: "ORGANIZATION" | "TIER" | null;
  mode: "MARKUP" | "FIXED" | null;
  markupPercent: string | null;
  fixedPriceIDR: number | null;
  enabled: boolean;
  revision: number | null;
  previewPriceIDR: number | null;
  hasOverride: boolean;
};
type PricingResponse = {
  organization: { id: string; name: string; tier: string };
  items: PricingItem[];
  hasMore: boolean;
};
type Draft = { variantId: string; mode: "MARKUP" | "FIXED"; markupPercent: string; fixedPriceIDR: string; enabled: boolean; expectedRevision: number | null };

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const buttonClass = "rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";
const primaryClass = "rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";
const inputClass = "w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50";

export default function PricingEditor({ orgId }: { orgId: string }) {
  return <EditorContent key={orgId} orgId={orgId} />;
}

function EditorContent({ orgId }: { orgId: string }) {
  const [data, setData] = useState<PricingResponse | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [resetTarget, setResetTarget] = useState<PricingItem | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const mutationRef = useRef<AbortController | null>(null);
  const endpoint = `/api/admin/resellers/${encodeURIComponent(orgId)}/pricing`;
  const disabled = loading || busyId !== null;

  useEffect(() => () => mutationRef.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const query = new URLSearchParams({ search });
        const response = await fetch(`${endpoint}?${query}`, { cache: "no-store", signal: controller.signal });
        const body = await response.json().catch(() => null) as (PricingResponse & { error?: string }) | null;
        if (!response.ok || !body || !Array.isArray(body.items) || body.organization?.id !== orgId) {
          throw new Error(body?.error || "Unable to load pricing. Please try again.");
        }
        if (!controller.signal.aborted) setData(body);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to connect to the server.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [endpoint, orgId, search, reload]);

  function loadAgain(nextSearch = search) {
    setLoading(true);
    setError("");
    setData(null);
    setSearch(nextSearch);
    setReload((value) => value + 1);
  }

  function searchSkus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || draft || resetTarget) return;
    setNotice("");
    loadAgain(searchInput.trim());
  }

  function edit(item: PricingItem) {
    setError("");
    setNotice("");
    setDraft({
      variantId: item.variantId,
      mode: item.mode ?? "MARKUP",
      markupPercent: item.markupPercent ?? "",
      fixedPriceIDR: item.fixedPriceIDR === null ? "" : String(item.fixedPriceIDR),
      enabled: item.enabled,
      expectedRevision: item.hasOverride ? item.revision : null,
    });
  }

  async function mutate(variantId: string, method: "PATCH" | "DELETE", payload: object) {
    if (disabled) return;
    const controller = new AbortController();
    mutationRef.current = controller;
    setBusyId(variantId);
    setError("");
    setNotice("");
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
        cache: "no-store",
      });
      const body = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || body?.ok !== true) throw new Error(body?.error || "Unable to update pricing. Your changes have not been confirmed.");
      if (!controller.signal.aborted) {
        setDraft(null);
        setResetTarget(null);
        setNotice(method === "PATCH" ? "Override saved. Reloading the latest pricing…" : "Override removed. Reloading tier pricing…");
        loadAgain();
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to connect to the server. Please try again.");
    } finally {
      if (!controller.signal.aborted) setBusyId(null);
    }
  }

  function save() {
    if (!draft || disabled) return;
    if (draft.mode === "MARKUP") {
      const value = draft.markupPercent.trim();
      if (!/^\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(Number(value))) {
        setError("Enter a non-negative markup percentage, such as 10 or 12.5.");
        return;
      }
      void mutate(draft.variantId, "PATCH", { variantId: draft.variantId, mode: "MARKUP", markupPercent: value, enabled: draft.enabled, expectedRevision: draft.expectedRevision });
    } else {
      const value = draft.fixedPriceIDR.trim();
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
        setError("Enter a non-negative whole-number fixed price in IDR.");
        return;
      }
      void mutate(draft.variantId, "PATCH", { variantId: draft.variantId, mode: "FIXED", fixedPriceIDR: Number(value), enabled: draft.enabled, expectedRevision: draft.expectedRevision });
    }
  }

  return (
    <section aria-labelledby="pricing-editor-title" className="space-y-4">
      <div className="rounded-2xl border border-border bg-bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="pricing-editor-title" className="font-semibold">SKU pricing overrides</h2>
            <p className="mt-1 text-sm text-text-secondary">Search published catalog SKUs to add an override, or edit an existing rule.</p>
            <p className="mt-1 text-xs text-text-muted">Reset removes the organization override and restores the tier rule. Unconfigured or disabled SKUs are not purchasable.</p>
          </div>
          {data ? <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">{data.organization.tier.replaceAll("_", " ")}</span> : null}
        </div>
        <form onSubmit={searchSkus} className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 basis-64">
            <label htmlFor="pricing-search" className="mb-1.5 block text-xs font-medium text-text-secondary">Find an exact SKU or product</label>
            <input id="pricing-search" type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} disabled={disabled || !!draft || !!resetTarget} placeholder="SKU, variant, or product name" className={inputClass} />
          </div>
          <button type="submit" disabled={disabled || !!draft || !!resetTarget} className={primaryClass}>Search</button>
          <button type="button" disabled={disabled || !!draft || !!resetTarget} onClick={() => { setNotice(""); loadAgain(); }} className={buttonClass}>Refresh</button>
        </form>
        {draft ? <p className="mt-2 text-xs text-text-muted">Save or cancel the current draft before searching another SKU.</p> : null}
      </div>
      {error ? <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p> : null}
      {notice ? <p role="status" className="text-sm text-accent">{notice}</p> : null}
      {loading ? <p role="status" className="rounded-2xl border border-border bg-bg-card p-5 text-sm text-text-secondary">Loading SKU pricing…</p> : null}
      {!loading && data ? (
        <>
          {data.items.length === 0 ? (
            <p role="status" className="rounded-2xl border border-border bg-bg-card p-5 text-sm text-text-secondary">{search ? "No SKUs match your search. Try the exact supplier SKU or a product name." : "No published catalog SKUs are available for pricing."}</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-bg-card">
              <table className="w-full min-w-[780px] text-left text-sm">
                <caption className="sr-only">Organization SKU pricing. Edit a row to create or change an override.</caption>
                <thead className="border-b border-border bg-bg-elevated text-xs text-text-muted">
                  <tr>
                    <th scope="col" className="p-4 font-medium">SKU / supplier</th>
                    <th scope="col" className="p-4 font-medium">Effective rule</th>
                    <th scope="col" className="p-4 font-medium">Indicative IDR / unit</th>
                    <th scope="col" className="p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.items.map((item) => {
                    const editing = draft?.variantId === item.variantId;
                    const resetting = resetTarget?.variantId === item.variantId;
                    const purchasable = item.enabled && item.mode !== null && item.previewPriceIDR !== null;
                    return (
                      <tr key={item.variantId} className="align-top">
                        <th scope="row" className="max-w-64 p-4 font-normal">
                          <p className="font-semibold text-text-primary">{item.name}</p>
                          <p className="mt-1 text-xs text-text-secondary">{item.productName} · {item.countryCode || "Global"}</p>
                          <p className="mt-2 break-all font-mono text-xs text-text-muted">{item.supplierSku || "No supplier SKU"}</p>
                          <p className="mt-1 break-all text-xs text-text-muted">Variant: {item.variantId}</p>
                          <p className="mt-2 text-xs text-text-secondary">Supplier cost: {item.supplierCostIDR === null ? "Unavailable" : money.format(item.supplierCostIDR)}</p>
                          <p className="mt-1 text-xs text-text-muted">Supplier status: {item.supplierStatus || "Unknown"}</p>
                        </th>
                        <td className="w-64 p-4">
                          <p className="text-xs font-medium text-accent">{item.source === "ORGANIZATION" ? "Organization override" : item.source === "TIER" ? "Tier rule" : "Unconfigured"}</p>
                          {editing && draft ? (
                            <fieldset disabled={disabled} className="mt-3 space-y-3">
                              <legend className="sr-only">Draft pricing for {item.name}</legend>
                              <div>
                                <label htmlFor={`mode-${item.variantId}`} className="mb-1 block text-xs text-text-secondary">Pricing mode</label>
                                <select id={`mode-${item.variantId}`} value={draft.mode} onChange={(event) => setDraft({ ...draft, mode: event.target.value as Draft["mode"] })} className={inputClass}>
                                  <option value="MARKUP">Markup percentage</option>
                                  <option value="FIXED">Fixed price (IDR)</option>
                                </select>
                              </div>
                              {draft.mode === "MARKUP" ? (
                                <div>
                                  <label htmlFor={`markup-${item.variantId}`} className="mb-1 block text-xs text-text-secondary">Markup (%)</label>
                                  <input autoFocus id={`markup-${item.variantId}`} type="text" inputMode="decimal" value={draft.markupPercent} onChange={(event) => setDraft({ ...draft, markupPercent: event.target.value })} className={inputClass} />
                                </div>
                              ) : (
                                <div>
                                  <label htmlFor={`fixed-${item.variantId}`} className="mb-1 block text-xs text-text-secondary">Fixed price (whole IDR)</label>
                                  <input autoFocus id={`fixed-${item.variantId}`} type="text" inputMode="numeric" value={draft.fixedPriceIDR} onChange={(event) => setDraft({ ...draft, fixedPriceIDR: event.target.value })} className={inputClass} />
                                </div>
                              )}
                              <label className="flex items-center gap-2 text-xs text-text-secondary">
                                <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} className="accent-accent" />
                                Enable SKU pricing
                              </label>
                            </fieldset>
                          ) : (
                            <p className="mt-2 text-xs text-text-secondary">{item.mode === "MARKUP" ? `${item.markupPercent ?? "—"}% markup` : item.mode === "FIXED" ? `Fixed: ${item.fixedPriceIDR === null ? "—" : money.format(item.fixedPriceIDR)}` : "No pricing rule"}</p>
                          )}
                          <p className="mt-2 text-xs text-text-muted">{item.enabled ? "Enabled" : "Disabled"}{item.revision !== null ? ` · Revision ${item.revision}` : ""}</p>
                        </td>
                        <td className="p-4">
                          <p className="whitespace-nowrap font-semibold tabular-nums text-text-primary">{item.previewPriceIDR === null ? "Unavailable" : money.format(item.previewPriceIDR)}</p>
                          <p className={`mt-2 text-xs ${purchasable ? "text-accent" : "text-amber-200"}`}>{purchasable ? "Pricing configured" : "Not purchasable"}</p>
                          {editing ? <p className="mt-2 text-xs text-text-muted">Saved preview only. Draft is not applied.</p> : null}
                        </td>
                        <td className="w-52 p-4">
                          <div className="flex flex-wrap gap-2">
                            {editing ? (
                              <>
                                <button type="button" disabled={disabled} onClick={save} className={primaryClass}>{busyId === item.variantId ? "Saving…" : "Save"}</button>
                                <button type="button" disabled={disabled} onClick={() => { setDraft(null); setError(""); }} className={buttonClass}>Cancel</button>
                              </>
                            ) : (
                              <button type="button" disabled={disabled || !!draft || !!resetTarget} onClick={() => edit(item)} aria-label={`${item.hasOverride ? "Edit" : "Add"} pricing override for ${item.name} (${item.supplierSku || item.variantId})`} className={buttonClass}>{item.hasOverride ? "Edit" : "Add override"}</button>
                            )}
                            {item.hasOverride && !editing ? <button type="button" disabled={disabled || !!draft || !!resetTarget} onClick={() => { setResetTarget(item); setError(""); setNotice(""); }} aria-label={`Reset pricing for ${item.name} to tier`} className={buttonClass}>Reset to tier</button> : null}
                          </div>
                          {resetting ? (
                            <div role="alertdialog" aria-labelledby={`reset-title-${item.variantId}`} aria-describedby={`reset-description-${item.variantId}`} className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3">
                              <h3 id={`reset-title-${item.variantId}`} className="text-xs font-semibold text-amber-100">Reset {item.name} to tier?</h3>
                              <p id={`reset-description-${item.variantId}`} className="mt-2 text-xs text-text-secondary">This removes the organization override. If no enabled tier rule exists, this SKU will not be purchasable.</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button autoFocus type="button" disabled={disabled} onClick={() => { setResetTarget(null); setError(""); }} className={buttonClass}>Cancel</button>
                                <button type="button" disabled={disabled} onClick={() => void mutate(item.variantId, "DELETE", { variantId: item.variantId, expectedRevision: item.hasOverride ? item.revision : null })} className={primaryClass}>{busyId === item.variantId ? "Resetting…" : "Confirm reset"}</button>
                              </div>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {data.hasMore ? <p role="status" className="text-sm text-amber-200">More SKUs are available. Narrow your search to select an exact SKU; this is not the full catalog.</p> : null}
        </>
      ) : null}
    </section>
  );
}
