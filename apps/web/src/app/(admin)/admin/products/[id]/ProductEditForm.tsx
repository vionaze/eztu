"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, Input } from "@kupon/ui";
import { FadeUp } from "@/components/motion/StaggerReveal";
import {
  ArrowLeft,
  Plus,
  Trash,
  SpinnerGap,
  Eye,
  EyeSlash,
  Star,
  FloppyDisk,
  Storefront,
} from "@phosphor-icons/react";
import { formatPrice } from "@/lib/utils";

type CategoryOption = { id: string; name: string };

type VariantRow = {
  id?: string;
  name: string;
  priceIDR: string;
  priceUSD: string;
  supplierSku: string;
  supplierCostIDR: string;
  _delete?: boolean;
};

type ProductInitial = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  categoryId: string | null;
  featured: boolean;
  published: boolean;
  fulfillmentType: "TOP_UP" | "VOUCHER";
  requiresServerId: boolean;
  gameIdLabel: string;
  serverIdLabel: string;
  orderCount: number;
  categoryName: string;
  variants: VariantRow[];
};

export default function ProductEditForm({
  product: initial,
  categories,
}: {
  product: ProductInitial;
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [description, setDescription] = useState(initial.description);
  const [categoryId, setCategoryId] = useState(initial.categoryId || "");
  const [imageUrl, setImageUrl] = useState(initial.image);
  const [featured, setFeatured] = useState(initial.featured);
  const [published, setPublished] = useState(initial.published);
  const [fulfillmentType, setFulfillmentType] = useState<"TOP_UP" | "VOUCHER">(
    initial.fulfillmentType
  );
  const [requiresServerId, setRequiresServerId] = useState(
    initial.requiresServerId
  );
  const [gameIdLabel, setGameIdLabel] = useState(initial.gameIdLabel);
  const [serverIdLabel, setServerIdLabel] = useState(initial.serverIdLabel);
  const [variants, setVariants] = useState<VariantRow[]>(initial.variants);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const visibleVariants = variants.filter((v) => !v._delete);

  const updateVariant = (
    index: number,
    field: keyof VariantRow,
    value: string
  ) => {
    setVariants((prev) => {
      const vis = prev.filter((v) => !v._delete);
      const target = vis[index];
      if (!target) return prev;
      return prev.map((v) =>
        v === target ? { ...v, [field]: value } : v
      );
    });
  };

  const addVariant = () => {
    setVariants((prev) => [
      ...prev,
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
    setVariants((prev) => {
      const vis = prev.filter((v) => !v._delete);
      const target = vis[index];
      if (!target) return prev;
      if (target.id) {
        // mark delete
        return prev.map((v) =>
          v === target ? { ...v, _delete: true } : v
        );
      }
      return prev.filter((v) => v !== target);
    });
  };

  const togglePublished = async () => {
    setToggling(true);
    setError("");
    setMessage("");
    try {
      const next = !published;
      const res = await fetch(`/api/admin/products/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Toggle failed");
      setPublished(next);
      setMessage(
        next
          ? "Produk sekarang tampil di storefront (Published)."
          : "Produk disembunyikan dari storefront (Hidden)."
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Toggle failed");
    } finally {
      setToggling(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/products/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          description,
          image: imageUrl,
          categoryId,
          featured,
          published,
          fulfillmentType,
          requiresServerId:
            fulfillmentType === "TOP_UP" ? requiresServerId : false,
          gameIdLabel,
          serverIdLabel,
          variants: variants.map((v) => ({
            id: v.id,
            name: v.name,
            priceIDR: v.priceIDR,
            priceUSD: v.priceUSD || String(Number(v.priceIDR) / 15500),
            supplierSku: v.supplierSku || null,
            supplierCostIDR: v.supplierCostIDR || null,
            _delete: v._delete || false,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMessage("Perubahan disimpan.");
      // sync variant ids from server
      if (data.product?.variants) {
        setVariants(
          data.product.variants.map(
            (v: {
              id: string;
              name: string;
              priceIDR: number;
              priceUSD: number;
              supplierSku: string | null;
              supplierCostIDR: number | null;
            }) => ({
              id: v.id,
              name: v.name,
              priceIDR: String(v.priceIDR),
              priceUSD: String(v.priceUSD),
              supplierSku: v.supplierSku || "",
              supplierCostIDR:
                v.supplierCostIDR != null ? String(v.supplierCostIDR) : "",
            })
          )
        );
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
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

      {/* Header */}
      <FadeUp delay={0.05}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant={published ? "accent" : "muted"}>
                {published ? "Published" : "Hidden"}
              </Badge>
              {featured ? <Badge variant="muted">Featured</Badge> : null}
              <Badge variant="muted">
                {fulfillmentType === "TOP_UP" ? "Top-up" : "Voucher"}
              </Badge>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-text-primary truncate">
              {name || "Product"}
            </h2>
            <p className="text-xs text-text-muted mt-1">
              {initial.categoryName || "No category"} ·{" "}
              {initial.orderCount} order item(s) · {visibleVariants.length}{" "}
              variant(s)
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              type="button"
              variant={published ? "secondary" : "primary"}
              onClick={togglePublished}
              disabled={toggling || saving}
            >
              {toggling ? (
                <SpinnerGap size={16} className="animate-spin" />
              ) : published ? (
                <EyeSlash size={16} />
              ) : (
                <Eye size={16} />
              )}
              {published ? "Hide from store" : "Show on store"}
            </Button>
            <Link href={`/products/${slug}`} target="_blank">
              <Button type="button" variant="ghost">
                <Storefront size={16} />
                Preview
              </Button>
            </Link>
          </div>
        </div>
      </FadeUp>

      {/* Quick help */}
      <FadeUp delay={0.07}>
        <Card
          variant="glass"
          padding="md"
          className="text-xs text-text-muted leading-relaxed space-y-1"
        >
          <p>
            <strong className="text-text-secondary">Show / Hide:</strong> tombol
            di atas langsung mengubah status storefront (Published / Hidden).
          </p>
          <p>
            <strong className="text-text-secondary">Variants:</strong> edit
            harga &amp; SKU di bawah, lalu{" "}
            <strong className="text-text-secondary">Save changes</strong>.
            Varian yang sudah punya order tidak bisa dihapus.
          </p>
        </Card>
      </FadeUp>

      {message ? (
        <p className="text-sm text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-xl px-4 py-3">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
          {error}
        </p>
      ) : null}

      {/* Type */}
      <FadeUp delay={0.08}>
        <Card variant="default" padding="lg" className="space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">
            Tipe produk
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFulfillmentType("TOP_UP")}
              className={`rounded-xl border px-4 py-3 text-left cursor-pointer ${
                fulfillmentType === "TOP_UP"
                  ? "border-accent/50 bg-accent/10"
                  : "border-border"
              }`}
            >
              <p className="text-sm font-semibold text-text-primary">Top-up</p>
              <p className="text-xs text-text-muted mt-0.5">
                Customer isi User ID (± Zone)
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                setFulfillmentType("VOUCHER");
                setRequiresServerId(false);
              }}
              className={`rounded-xl border px-4 py-3 text-left cursor-pointer ${
                fulfillmentType === "VOUCHER"
                  ? "border-accent/50 bg-accent/10"
                  : "border-border"
              }`}
            >
              <p className="text-sm font-semibold text-text-primary">
                Kode voucher
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                Tanpa User ID — kirim kode ke email
              </p>
            </button>
          </div>
          {fulfillmentType === "TOP_UP" ? (
            <div className="space-y-3 pt-2 border-t border-border">
              <label className="flex items-center gap-3 cursor-pointer text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={requiresServerId}
                  onChange={(e) => setRequiresServerId(e.target.checked)}
                />
                Wajib Zone / Server ID
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input
                  label="Label User ID"
                  value={gameIdLabel}
                  onChange={(e) => setGameIdLabel(e.target.value)}
                />
                {requiresServerId ? (
                  <Input
                    label="Label Zone"
                    value={serverIdLabel}
                    onChange={(e) => setServerIdLabel(e.target.value)}
                  />
                ) : null}
              </div>
            </div>
          ) : null}
        </Card>
      </FadeUp>

      {/* Basics */}
      <FadeUp delay={0.1}>
        <Card variant="default" padding="lg" className="space-y-5">
          <h3 className="text-sm font-semibold text-text-primary">
            Informasi produk
          </h3>
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Slug (URL)"
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
              rows={3}
              className="w-full rounded-xl bg-bg-card border border-border px-3 py-2.5 text-sm text-text-primary resize-none focus:outline-none focus:border-accent/50"
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
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-muted">
              Kelola kategori di{" "}
              <a href="/admin/categories" className="text-accent underline">
                Categories
              </a>
              .
            </p>
          </div>
          <Input
            label="Image URL"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="w-24 h-28 rounded-xl object-cover border border-border"
            />
          ) : null}

          <label className="flex items-center gap-3 cursor-pointer">
            <button
              type="button"
              onClick={() => setFeatured(!featured)}
              className={`relative w-10 h-5 rounded-full ${
                featured ? "bg-accent" : "bg-bg-elevated"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  featured ? "translate-x-5" : ""
                }`}
              />
            </button>
            <span className="text-sm text-text-secondary inline-flex items-center gap-1">
              <Star size={14} /> Featured di homepage
            </span>
          </label>
        </Card>
      </FadeUp>

      {/* Variants */}
      <FadeUp delay={0.15}>
        <Card variant="default" padding="lg" className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Variants ({visibleVariants.length})
              </h3>
              <p className="text-xs text-text-muted">
                Edit package / harga / SKU supplier
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={addVariant}>
              <Plus size={14} />
              Add
            </Button>
          </div>

          <div className="space-y-4">
            {visibleVariants.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">
                Belum ada variant. Klik Add.
              </p>
            ) : (
              visibleVariants.map((v, i) => (
                <div
                  key={v.id || `new-${i}`}
                  className="rounded-xl border border-border bg-bg-elevated/30 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-mono text-text-muted">
                      {v.id ? `ID · ${v.id.slice(0, 8)}…` : "New variant"}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeVariant(i)}
                      className="text-xs text-red-400 hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <Trash size={12} />
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Name"
                      value={v.name}
                      onChange={(e) => updateVariant(i, "name", e.target.value)}
                      placeholder="17 Diamonds (15+2)"
                    />
                    <Input
                      label="Supplier SKU"
                      value={v.supplierSku}
                      onChange={(e) =>
                        updateVariant(i, "supplierSku", e.target.value)
                      }
                      placeholder="ML15_2-S121"
                    />
                    <Input
                      label="Price IDR"
                      value={v.priceIDR}
                      onChange={(e) =>
                        updateVariant(i, "priceIDR", e.target.value)
                      }
                      placeholder="4800"
                    />
                    <Input
                      label="Price USD"
                      value={v.priceUSD}
                      onChange={(e) =>
                        updateVariant(i, "priceUSD", e.target.value)
                      }
                      placeholder="0.31"
                    />
                    <Input
                      label="Supplier cost IDR"
                      value={v.supplierCostIDR}
                      onChange={(e) =>
                        updateVariant(i, "supplierCostIDR", e.target.value)
                      }
                      placeholder="optional"
                    />
                    {v.priceIDR ? (
                      <p className="text-xs text-text-muted self-end pb-2">
                        Preview: {formatPrice(Number(v.priceIDR) || 0)}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </FadeUp>

      <FadeUp delay={0.2}>
        <div className="flex flex-wrap gap-3 sticky bottom-4 z-10">
          <Button size="lg" onClick={save} disabled={saving || toggling}>
            {saving ? (
              <SpinnerGap size={16} className="animate-spin" />
            ) : (
              <FloppyDisk size={16} />
            )}
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => router.push("/admin/products")}
          >
            Back to list
          </Button>
        </div>
      </FadeUp>
    </div>
  );
}
