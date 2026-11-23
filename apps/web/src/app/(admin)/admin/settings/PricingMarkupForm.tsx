"use client";

import { useMemo, useState } from "react";
import { Button, Input } from "@kupon/ui";
import { FloppyDisk, Percent, WarningCircle } from "@phosphor-icons/react";
import { bpsToPercent, parseMarkupPercent } from "@/lib/pricing-markup-parse";

type Product = {
  slug: string;
  name: string;
  published: boolean;
};

type Initial = {
  globalBps: number;
  overrides: Record<string, number>;
};


/** Uses the exact same parser as the server; empty means "no override". */
function validatePercent(raw: string): string | null {
  if (!raw.trim()) return "Isi persentase.";
  const parsed = parseMarkupPercent(raw);
  return parsed.ok ? null : parsed.error;
}

export default function PricingMarkupForm({
  initial,
  products,
}: {
  initial: Initial;
  products: Product[];
}) {
  const [globalPercent, setGlobalPercent] = useState(
    bpsToPercent(initial.globalBps),
  );
  const [overrides, setOverrides] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const product of products) {
      const bps = initial.overrides[product.slug];
      next[product.slug] = bps === undefined ? "" : bpsToPercent(bps);
    }
    return next;
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const globalError = validatePercent(globalPercent);
  const productErrors = useMemo(() => {
    const errors: Record<string, string | null> = {};
    for (const product of products) {
      const raw = overrides[product.slug] ?? "";
      errors[product.slug] = raw.trim() ? validatePercent(raw) : null;
    }
    return errors;
  }, [overrides, products]);

  const hasErrors =
    Boolean(globalError) ||
    Object.values(productErrors).some((value) => Boolean(value));

  async function save() {
    if (hasErrors) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/settings/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ globalPercent, overrides }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        updatedVariants?: number;
      };
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan.");
      setMessage(
        `Tersimpan. ${data.updatedVariants ?? 0} harga tampil dihitung ulang.`,
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Gagal menyimpan.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-tile space-y-4">
      <div className="flex items-start gap-2">
        <Percent size={16} className="mt-0.5 shrink-0 text-accent" />
        <div>
          <p className="admin-tile-title">Markup harga</p>
          <p className="admin-tile-desc">
            Ditambahkan di atas markup dasar tiap SKU, berlaku untuk retail dan
            reseller. Global berlaku untuk semua produk; isi per produk hanya
            jika ingin berbeda. Nilai tidak boleh negatif. Menyimpan akan
            menghitung ulang harga tampil semua SKU (menggantikan edit harga
            manual).
          </p>
        </div>
      </div>

      <div className="max-w-xs">
        <Input
          label="Markup global (%)"
          type="text"
          inputMode="decimal"
          value={globalPercent}
          onChange={(event) => setGlobalPercent(event.target.value)}
          error={globalError ?? undefined}
          placeholder="0.7"
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-text-secondary">
          Override per produk (%)
        </p>
        <div className="admin-bento admin-bento-2 !gap-3">
          {products.map((product) => (
            <Input
              key={product.slug}
              label={`${product.name}${product.published ? "" : " (draft)"}`}
              type="text"
              inputMode="decimal"
              value={overrides[product.slug] ?? ""}
              onChange={(event) =>
                setOverrides((current) => ({
                  ...current,
                  [product.slug]: event.target.value,
                }))
              }
              error={productErrors[product.slug] ?? undefined}
              placeholder={`Ikut global (${globalPercent || "0"}%)`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={save} disabled={saving || hasErrors}>
          <FloppyDisk size={14} />
          {saving ? "Menyimpan…" : "Simpan markup"}
        </Button>
        {hasErrors ? (
          <span className="flex items-center gap-1 text-xs text-amber-300">
            <WarningCircle size={14} />
            Perbaiki nilai yang ditandai dulu.
          </span>
        ) : null}
        {message ? <p className="text-xs text-emerald-400">{message}</p> : null}
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
      </div>
    </div>
  );
}
