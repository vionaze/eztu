"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@kupon/ui";
import { FadeUp } from "@/components/motion/StaggerReveal";
import {
  ArrowLeft,
  Plus,
  Trash,
  ImageSquare,
  SpinnerGap,
} from "@phosphor-icons/react";
import Link from "next/link";

type CategoryOption = { id: string; name: string };

type VariantRow = {
  name: string;
  priceIDR: string;
  priceUSD: string;
  supplierSku: string;
  supplierCostIDR: string;
};

export default function NewProductForm({
  categories,
}: {
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [imageUrl, setImageUrl] = useState("");
  const [featured, setFeatured] = useState(false);
  const [published, setPublished] = useState(true);
  const [fulfillmentType, setFulfillmentType] = useState<"TOP_UP" | "VOUCHER">(
    "VOUCHER"
  );
  const [requiresServerId, setRequiresServerId] = useState(false);
  const [gameIdLabel, setGameIdLabel] = useState("User ID");
  const [serverIdLabel, setServerIdLabel] = useState("Zone / Server ID");
  const [variants, setVariants] = useState<VariantRow[]>([
    {
      name: "",
      priceIDR: "",
      priceUSD: "",
      supplierSku: "",
      supplierCostIDR: "",
    },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addVariant = () => {
    setVariants([
      ...variants,
      {
        name: "",
        priceIDR: "",
        priceUSD: "",
        supplierSku: "",
        supplierCostIDR: "",
      },
    ]);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof VariantRow, value: string) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    setVariants(updated);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(
      val
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
    );
  };

  const save = async () => {
    setError("");
    if (!name.trim()) {
      setError("Product name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          description,
          image: imageUrl || undefined,
          categoryId,
          featured,
          published,
          fulfillmentType,
          requiresServerId:
            fulfillmentType === "TOP_UP" ? requiresServerId : false,
          gameIdLabel,
          serverIdLabel,
          variants: variants.map((v) => ({
            name: v.name,
            priceIDR: v.priceIDR,
            priceUSD: v.priceUSD || String(Number(v.priceIDR) / 15500),
            supplierSku: v.supplierSku || null,
            supplierCostIDR: v.supplierCostIDR || null,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      router.push("/admin/products");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <FadeUp>
        <Link
          href="/admin/products"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent transition-colors group"
        >
          <ArrowLeft
            size={14}
            className="transition-transform group-hover:-translate-x-1"
          />
          Back to products
        </Link>
      </FadeUp>

      <FadeUp delay={0.05}>
        <h2 className="text-2xl font-bold tracking-tight text-text-primary">
          New Product
        </h2>
        <p className="text-xs text-text-muted mt-1">
          Pilih tipe fulfillment: <strong>Top-up</strong> (butuh User ID / Zone)
          atau <strong>Kode voucher</strong> (kirim kode saja).
        </p>
      </FadeUp>

      {error ? (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
          {error}
        </p>
      ) : null}

      {/* Fulfillment type */}
      <FadeUp delay={0.08}>
        <Card variant="default" padding="lg" className="space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">
            Tipe produk
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFulfillmentType("TOP_UP")}
              className={`rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer ${
                fulfillmentType === "TOP_UP"
                  ? "border-accent/50 bg-accent/10 text-text-primary"
                  : "border-border text-text-muted hover:text-text-primary"
              }`}
            >
              <p className="text-sm font-semibold">Top-up (akun game)</p>
              <p className="text-xs mt-1 opacity-80">
                Customer isi User ID (± Zone). Disimpan di order sebagai gameId /
                serverId.
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                setFulfillmentType("VOUCHER");
                setRequiresServerId(false);
              }}
              className={`rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer ${
                fulfillmentType === "VOUCHER"
                  ? "border-accent/50 bg-accent/10 text-text-primary"
                  : "border-border text-text-muted hover:text-text-primary"
              }`}
            >
              <p className="text-sm font-semibold">Kode voucher</p>
              <p className="text-xs mt-1 opacity-80">
                Tidak minta User ID/Zone. Kirim kode voucher ke email.
              </p>
            </button>
          </div>

          {fulfillmentType === "TOP_UP" ? (
            <div className="space-y-3 pt-2 border-t border-border">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresServerId}
                  onChange={(e) => setRequiresServerId(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm text-text-secondary">
                  Wajib Zone / Server ID (contoh MLBB)
                </span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Label field ID"
                  value={gameIdLabel}
                  onChange={(e) => setGameIdLabel(e.target.value)}
                  placeholder="User ID"
                />
                {requiresServerId ? (
                  <Input
                    label="Label field Zone"
                    value={serverIdLabel}
                    onChange={(e) => setServerIdLabel(e.target.value)}
                    placeholder="Zone / Server ID"
                  />
                ) : null}
              </div>
            </div>
          ) : null}
        </Card>
      </FadeUp>

      <FadeUp delay={0.1}>
        <Card variant="default" padding="lg" className="space-y-5">
          <h3 className="text-sm font-semibold text-text-primary">
            Basic Information
          </h3>
          <Input
            label="Product Name"
            placeholder="e.g. Mobile Legends"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
          />
          <Input
            label="Slug"
            placeholder="mobile-legends"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Product description..."
              rows={3}
              className="w-full rounded-xl bg-bg-card border border-border px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl bg-bg-card border border-border px-3 h-10 text-sm text-text-primary"
            >
              <option value="">Uncategorized</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-muted">
              Kelola daftar kategori di{" "}
              <a href="/admin/categories" className="text-accent underline">
                Categories
              </a>
              .
            </p>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                onClick={() => setFeatured(!featured)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  featured ? "bg-accent" : "bg-bg-elevated"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    featured ? "translate-x-5" : ""
                  }`}
                />
              </button>
              <span className="text-sm text-text-secondary">Featured</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                onClick={() => setPublished(!published)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  published ? "bg-accent" : "bg-bg-elevated"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    published ? "translate-x-5" : ""
                  }`}
                />
              </button>
              <span className="text-sm text-text-secondary">Published</span>
            </label>
          </div>
        </Card>
      </FadeUp>

      <FadeUp delay={0.15}>
        <Card variant="default" padding="lg" className="space-y-5">
          <h3 className="text-sm font-semibold text-text-primary">
            Product Image
          </h3>
          <Input
            label="Image URL"
            placeholder="https://example.com/image.jpg or /images/…"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            icon={<ImageSquare size={16} />}
          />
          {imageUrl ? (
            <div className="w-32 h-40 rounded-xl overflow-hidden border border-border relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
          ) : null}
        </Card>
      </FadeUp>

      <FadeUp delay={0.2}>
        <Card variant="default" padding="lg" className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              Variants ({variants.length})
            </h3>
            <Button variant="ghost" size="sm" onClick={addVariant}>
              <Plus size={14} />
              Add variant
            </Button>
          </div>

          <div className="space-y-4">
            {variants.map((variant, i) => (
              <div
                key={i}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-bg-secondary/50 border border-border"
              >
                <Input
                  placeholder="e.g. 86 Diamonds / IDR 50K"
                  value={variant.name}
                  onChange={(e) => updateVariant(i, "name", e.target.value)}
                  label={i === 0 ? "Variant name" : undefined}
                />
                <Input
                  placeholder="ML15_2-S121"
                  value={variant.supplierSku}
                  onChange={(e) =>
                    updateVariant(i, "supplierSku", e.target.value)
                  }
                  label={i === 0 ? "Supplier SKU" : undefined}
                />
                <Input
                  placeholder="19000"
                  value={variant.priceIDR}
                  onChange={(e) => updateVariant(i, "priceIDR", e.target.value)}
                  label={i === 0 ? "Price (IDR)" : undefined}
                />
                <Input
                  placeholder="1.20"
                  value={variant.priceUSD}
                  onChange={(e) => updateVariant(i, "priceUSD", e.target.value)}
                  label={i === 0 ? "Price (USD)" : undefined}
                />
                <Input
                  placeholder="optional cost"
                  value={variant.supplierCostIDR}
                  onChange={(e) =>
                    updateVariant(i, "supplierCostIDR", e.target.value)
                  }
                  label={i === 0 ? "Supplier cost IDR" : undefined}
                />
                {variants.length > 1 ? (
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removeVariant(i)}
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-400/5 cursor-pointer"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      </FadeUp>

      <FadeUp delay={0.25}>
        <div className="flex items-center gap-3">
          <Button size="lg" onClick={save} disabled={saving}>
            {saving ? (
              <SpinnerGap size={16} className="animate-spin" />
            ) : null}
            {saving ? "Saving…" : "Save Product"}
          </Button>
          <Button variant="ghost" size="lg" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </FadeUp>
    </div>
  );
}
