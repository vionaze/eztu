"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@kupon/ui";
import { FadeUp } from "@/components/motion/StaggerReveal";
import { categories } from "@/lib/dummy-data";
import {
  ArrowLeft,
  Plus,
  Trash,
  ImageSquare,
} from "@phosphor-icons/react";
import Link from "next/link";

export default function NewProductPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [featured, setFeatured] = useState(false);
  const [variants, setVariants] = useState([
    { name: "", priceIDR: "", priceUSD: "" },
  ]);

  const addVariant = () => {
    setVariants([...variants, { name: "", priceIDR: "", priceUSD: "" }]);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (
    index: number,
    field: string,
    value: string
  ) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    setVariants(updated);
  };

  // Auto-generate slug from name
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
      </FadeUp>

      {/* Basic Info */}
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
              className="w-full rounded-xl bg-bg-card border border-border px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-all focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 hover:border-white/20 resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl bg-bg-card border border-border px-3 h-10 text-sm text-text-primary transition-all focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 hover:border-white/20 cursor-pointer"
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFeatured(!featured)}
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                featured ? "bg-accent" : "bg-bg-elevated"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  featured ? "translate-x-5" : ""
                }`}
              />
            </button>
            <span className="text-sm text-text-secondary">Featured product</span>
          </div>
        </Card>
      </FadeUp>

      {/* Image */}
      <FadeUp delay={0.15}>
        <Card variant="default" padding="lg" className="space-y-5">
          <h3 className="text-sm font-semibold text-text-primary">
            Product Image
          </h3>
          <Input
            label="Image URL"
            placeholder="https://example.com/image.jpg"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            icon={<ImageSquare size={16} />}
          />
          {imageUrl && (
            <div className="w-32 h-40 rounded-xl overflow-hidden border border-border relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <p className="text-xs text-text-muted">
            Drag & drop upload will be available after Cloudinary integration.
          </p>
        </Card>
      </FadeUp>

      {/* Variants */}
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
                className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-bg-secondary/50 border border-border"
              >
                <div className="sm:col-span-2">
                  <Input
                    placeholder="e.g. 86 Diamonds"
                    value={variant.name}
                    onChange={(e) =>
                      updateVariant(i, "name", e.target.value)
                    }
                    label={i === 0 ? "Name" : undefined}
                  />
                </div>
                <div>
                  <Input
                    placeholder="19000"
                    value={variant.priceIDR}
                    onChange={(e) =>
                      updateVariant(i, "priceIDR", e.target.value)
                    }
                    label={i === 0 ? "Price (IDR)" : undefined}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="1.20"
                      value={variant.priceUSD}
                      onChange={(e) =>
                        updateVariant(i, "priceUSD", e.target.value)
                      }
                      label={i === 0 ? "Price (USD)" : undefined}
                    />
                  </div>
                  {variants.length > 1 && (
                    <button
                      onClick={() => removeVariant(i)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-400/5 transition-all cursor-pointer flex-shrink-0 ${
                        i === 0 ? "mt-6" : ""
                      }`}
                    >
                      <Trash size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </FadeUp>

      {/* Actions */}
      <FadeUp delay={0.25}>
        <div className="flex items-center gap-3">
          <Button size="lg">Save Product</Button>
          <Button variant="ghost" size="lg" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </FadeUp>
    </div>
  );
}
