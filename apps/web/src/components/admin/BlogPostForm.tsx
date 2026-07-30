"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, Input } from "@kupon/ui";
import RichEditor from "@/components/ui/RichEditor";
import BlogImageUploader from "@/components/admin/BlogImageUploader";
import {
  ArrowLeft,
  Copy,
  MagicWand,
  SpinnerGap,
} from "@phosphor-icons/react";

export type BlogFormValues = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  thumbnailImage: string;
  heroImagePrompt: string;
  thumbnailImagePrompt: string;
  category: string;
  countryCode: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  published: boolean;
  aiGenerated: boolean;
  aiModel: string;
  faq: { question: string; answer: string }[];
};

type ImageGeneration = {
  id: string;
  kind: "hero" | "thumbnail";
  status: "SUBMITTING" | "PROCESSING" | "DOWNLOADING" | "SUCCEEDED" | "FAILED";
  error: string | null;
  storedImagePath: string | null;
  updatedAt: string;
};

const blogCategories = [
  "Guide",
  "News",
  "Tips",
  "Payments",
  "Tutorial",
  "Review",
  "List",
];

const defaultCountries = ["GLOBAL", "ID", "MY", "US", "PH", "SG", "TH", "VN"];

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const emptyValues: BlogFormValues = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImage: "",
  thumbnailImage: "",
  heroImagePrompt: "",
  thumbnailImagePrompt: "",
  category: "Guide",
  countryCode: "GLOBAL",
  metaTitle: "",
  metaDescription: "",
  focusKeyword: "",
  canonicalUrl: "",
  ogTitle: "",
  ogDescription: "",
  published: false,
  aiGenerated: false,
  aiModel: "",
  faq: [],
};

export default function BlogPostForm({
  initial,
  countries = defaultCountries,
}: {
  initial?: Partial<BlogFormValues>;
  countries?: string[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<BlogFormValues>({
    ...emptyValues,
    ...initial,
    faq: initial?.faq || [],
  });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [imageGenerations, setImageGenerations] = useState<ImageGeneration[]>([]);
  const [imageRefreshNonce, setImageRefreshNonce] = useState(0);
  const [copiedPrompt, setCopiedPrompt] = useState<"hero" | "thumbnail" | null>(
    null
  );
  const [aiTopic, setAiTopic] = useState("");
  const [showAiHelper, setShowAiHelper] = useState(false);
  const [error, setError] = useState("");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));

  useEffect(() => {
    if (!form.id) return;
    let cancelled = false;
    let timer: number | undefined;

    const refresh = async () => {
      try {
        const response = await fetch(
          `/api/admin/blog/${encodeURIComponent(form.id!)}/images`,
          { cache: "no-store" }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok || cancelled) return;

        const generations = Array.isArray(data.generations)
          ? (data.generations as ImageGeneration[])
          : [];
        setImageGenerations(generations);
        setForm((current) => ({
          ...current,
          coverImage: data.images?.hero || current.coverImage,
          thumbnailImage:
            data.images?.thumbnail || current.thumbnailImage,
        }));

        if (
          generations.some((item) =>
            ["SUBMITTING", "PROCESSING", "DOWNLOADING"].includes(item.status)
          )
        ) {
          timer = window.setTimeout(refresh, 4_000);
        }
      } catch {
        // Status refresh is best-effort; explicit generate errors remain visible.
      }
    };

    void refresh();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [form.id, imageRefreshNonce]);

  const set = <K extends keyof BlogFormValues>(key: K, value: BlogFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleTitleChange = (val: string) => {
    set("title", val);
    if (!slugTouched) set("slug", slugify(val));
    if (!form.metaTitle) set("metaTitle", val.slice(0, 60));
  };

  const payload = () => ({
    title: form.title,
    slug: form.slug,
    excerpt: form.excerpt,
    content: form.content,
    coverImage: form.coverImage || null,
    thumbnailImage: form.thumbnailImage || null,
    heroImagePrompt: form.heroImagePrompt || null,
    thumbnailImagePrompt: form.thumbnailImagePrompt || null,
    category: form.category || null,
    countryCode: form.countryCode,
    metaTitle: form.metaTitle || null,
    metaDescription: form.metaDescription || null,
    focusKeyword: form.focusKeyword || null,
    canonicalUrl: form.canonicalUrl || null,
    ogTitle: form.ogTitle || null,
    ogDescription: form.ogDescription || null,
    faq: form.faq.filter((f) => f.question.trim()),
    published: form.published,
    aiGenerated: form.aiGenerated,
    aiModel: form.aiModel || null,
  });

  const save = async (publish: boolean) => {
    setError("");
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    try {
      const body = { ...payload(), published: publish };
      const url = form.id ? `/api/admin/blog/${form.id}` : "/api/admin/blog";
      const method = form.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      router.push("/admin/blog");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const generateAi = async (publish: boolean) => {
    setError("");
    if (!aiTopic.trim()) {
      setError("Enter a topic for AI generation.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/blog/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: aiTopic,
          countryCode: form.countryCode,
          publish,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "AI generation failed");

      if (publish && data.post) {
        router.push("/admin/blog");
        router.refresh();
        return;
      }

      const d = data.draft as {
        title: string;
        slug: string;
        excerpt: string;
        contentHtml: string;
        metaTitle: string;
        metaDescription: string;
        focusKeyword: string;
        category: string;
        faq: { question: string; answer: string }[];
        heroImagePrompt: string;
        thumbnailImagePrompt: string;
        aiModel?: string;
      };
      setForm((prev) => ({
        ...prev,
        title: d.title,
        slug: d.slug,
        excerpt: d.excerpt,
        content: d.contentHtml,
        metaTitle: d.metaTitle,
        metaDescription: d.metaDescription,
        focusKeyword: d.focusKeyword,
        category: d.category || prev.category,
        faq: d.faq || [],
        heroImagePrompt: d.heroImagePrompt || "",
        thumbnailImagePrompt: d.thumbnailImagePrompt || "",
        aiGenerated: true,
        aiModel: d.aiModel || "",
        ogTitle: d.metaTitle,
        ogDescription: d.metaDescription,
        published: false,
      }));
      setSlugTouched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const copyPrompt = async (
    kind: "hero" | "thumbnail",
    value: string
  ) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedPrompt(kind);
      window.setTimeout(() => setCopiedPrompt(null), 1500);
    } catch {
      setError("Unable to copy prompt. Select and copy it manually.");
    }
  };

  const generateMissingPrompts = async () => {
    if (!form.id) return;
    setGeneratingPrompts(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/blog/${encodeURIComponent(form.id)}/image-prompts`,
        { method: "POST" }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Prompt generation failed.");
      }
      setForm((current) => ({
        ...current,
        heroImagePrompt:
          data.prompts?.heroImagePrompt || current.heroImagePrompt,
        thumbnailImagePrompt:
          data.prompts?.thumbnailImagePrompt ||
          current.thumbnailImagePrompt,
      }));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Prompt generation failed."
      );
    } finally {
      setGeneratingPrompts(false);
    }
  };

  const generateArticleImages = async () => {
    if (!form.id) return;
    if (!form.heroImagePrompt.trim() || !form.thumbnailImagePrompt.trim()) {
      setError("Hero and thumbnail image prompts are required.");
      return;
    }

    setGeneratingImages(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/blog/${encodeURIComponent(form.id)}/images`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            heroPrompt: form.heroImagePrompt,
            thumbnailPrompt: form.thumbnailImagePrompt,
            force: Boolean(
              form.coverImage.trim() && form.thumbnailImage.trim()
            ),
          }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "KIE image generation failed to start.");
      }
      setImageGenerations(
        Array.isArray(data.generations) ? data.generations : []
      );
      setImageRefreshNonce((current) => current + 1);
      setForm((current) => ({
        ...current,
        coverImage: data.images?.hero || current.coverImage,
        thumbnailImage:
          data.images?.thumbnail || current.thumbnailImage,
      }));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "KIE image generation failed to start."
      );
    } finally {
      setGeneratingImages(false);
    }
  };

  const imageGenerationByKind = Object.fromEntries(
    imageGenerations.map((item) => [item.kind, item])
  ) as Partial<Record<"hero" | "thumbnail", ImageGeneration>>;
  const imageGenerationActive = imageGenerations.some((item) =>
    ["SUBMITTING", "PROCESSING", "DOWNLOADING"].includes(item.status)
  );
  const hasBothImages = Boolean(
    form.coverImage.trim() && form.thumbnailImage.trim()
  );

  return (
    <div className="admin-form-stack-wide admin-form-stack">
      <div className="admin-page-toolbar">
        <Link
          href="/admin/blog"
          className="inline-flex items-center gap-1 text-[12px] text-text-secondary hover:text-accent transition-colors"
        >
          <ArrowLeft size={13} />
          Back to posts
        </Link>
        <div className="flex items-center gap-1.5">
          {form.aiGenerated ? (
            <Badge variant="muted">AI draft</Badge>
          ) : (
            <Badge variant="muted">Manual</Badge>
          )}
          <Badge variant={form.published ? "accent" : "muted"}>
            {form.published ? "published" : "draft"}
          </Badge>
        </div>
      </div>
      <p className="admin-hint -mt-1">
        Manual default · isi title, konten, gambar, SEO · AI helper di bawah
        (opsional)
      </p>

      {error ? (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
          {error}
        </p>
      ) : null}

      {/* Primary: manual article form */}
      <Card variant="default" padding="md" className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Post details (manual)
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Tulis sendiri seperti editor biasa — tidak perlu nyalakan AI.
            </p>
          </div>
          <Input
            label="Title"
            placeholder="Your blog post title"
            value={form.title}
            onChange={(e) => handleTitleChange(e.target.value)}
          />
          <Input
            label="Slug"
            placeholder="url-safe-slug"
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", e.target.value);
            }}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">
              Excerpt
            </label>
            <textarea
              value={form.excerpt}
              onChange={(e) => set("excerpt", e.target.value)}
              placeholder="Short summary for cards & social…"
              rows={2}
              className="w-full rounded-xl bg-bg-card border border-border px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent/50"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className="w-full rounded-xl bg-bg-card border border-border px-3 h-10 text-sm text-text-primary"
              >
                {blogCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">
                Country / market
              </label>
              <select
                value={form.countryCode}
                onChange={(e) => set("countryCode", e.target.value)}
                className="w-full rounded-xl bg-bg-card border border-border px-3 h-10 text-sm text-text-primary"
              >
                {(countries.length ? countries : defaultCountries).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

      {/* Images — local WebP uploader or external URL */}
      <Card variant="default" padding="md" className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Article images
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              Upload JPG, JPEG, or PNG. EZTopUp converts it to WebP and stores
              only the optimized result. You can still paste an external CDN
              URL below.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BlogImageUploader
              kind="hero"
              value={form.coverImage}
              onUploaded={(path) => set("coverImage", path)}
            />
            <BlogImageUploader
              kind="thumbnail"
              value={form.thumbnailImage}
              onUploaded={(path) => set("thumbnailImage", path)}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 border-t border-border pt-4 lg:grid-cols-2">
          <Input
            label="Hero / cover image URL"
            placeholder="/media/blog/hero/…webp or https://…"
            value={form.coverImage}
            onChange={(e) => set("coverImage", e.target.value)}
          />
          <Input
            label="Thumbnail image URL"
            placeholder="/media/blog/thumbnail/…webp or https://…"
            value={form.thumbnailImage}
            onChange={(e) => set("thumbnailImage", e.target.value)}
          />
          </div>
          <div className="grid grid-cols-1 gap-3 border-t border-border pt-4 lg:grid-cols-2">
            {[
              {
                kind: "hero" as const,
                label: "Hero image prompt (16:9)",
                key: "heroImagePrompt" as const,
                value: form.heroImagePrompt,
              },
              {
                kind: "thumbnail" as const,
                label: "Thumbnail image prompt (4:3)",
                key: "thumbnailImagePrompt" as const,
                value: form.thumbnailImagePrompt,
              },
            ].map((prompt) => (
              <div key={prompt.kind} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm font-medium text-text-secondary">
                    {prompt.label}
                  </label>
                  <button
                    type="button"
                    onClick={() => copyPrompt(prompt.kind, prompt.value)}
                    disabled={!prompt.value}
                    className="inline-flex items-center gap-1 text-xs text-accent disabled:opacity-40"
                  >
                    <Copy size={13} />
                    {copiedPrompt === prompt.kind ? "Copied" : "Copy"}
                  </button>
                </div>
                <textarea
                  value={prompt.value}
                  onChange={(event) => set(prompt.key, event.target.value)}
                  rows={9}
                  maxLength={5000}
                  placeholder="Generated English prompt will appear here."
                  className="w-full resize-y rounded-xl border border-border bg-bg-card px-3 py-2.5 font-mono text-xs leading-relaxed text-text-primary focus:border-accent/50 focus:outline-none"
                />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-bg-elevated/40 p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-text-primary">
                    KIE Z-Image
                  </p>
                  {(["hero", "thumbnail"] as const).map((kind) => {
                    const generation = imageGenerationByKind[kind];
                    const label = generation
                      ? generation.status === "DOWNLOADING"
                        ? "saving"
                        : generation.status.toLowerCase()
                      : "not started";
                    return (
                      <span
                        key={kind}
                        title={generation?.error || undefined}
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          generation?.status === "SUCCEEDED"
                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                            : generation?.status === "FAILED"
                              ? "border-red-400/30 bg-red-400/10 text-red-300"
                              : generation
                                ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                                : "border-border text-text-muted"
                        }`}
                      >
                        {kind} · {label}
                      </span>
                    );
                  })}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">
                  Two paid calls: hero 16:9 and thumbnail 4:3. Results are
                  downloaded, converted to WebP, and stored on this VPS.
                </p>
                {imageGenerations
                  .filter((item) => item.status === "FAILED" && item.error)
                  .map((item) => (
                    <p
                      key={item.id}
                      className="mt-1 text-[11px] leading-relaxed text-red-300"
                    >
                      {item.kind}: {item.error}
                    </p>
                  ))}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={generateArticleImages}
                disabled={
                  !form.id ||
                  !form.heroImagePrompt.trim() ||
                  !form.thumbnailImagePrompt.trim() ||
                  generatingImages ||
                  imageGenerationActive
                }
                className="w-full shrink-0 sm:w-auto"
              >
                {generatingImages || imageGenerationActive ? (
                  <SpinnerGap size={15} className="animate-spin" />
                ) : (
                  <MagicWand size={15} />
                )}
                {!form.id
                  ? "Save post first"
                  : imageGenerationActive
                    ? "Generating images"
                    : hasBothImages
                      ? "Regenerate both"
                      : "Generate both images"}
              </Button>
            </div>
          </div>
          {form.id &&
          (!form.heroImagePrompt || !form.thumbnailImagePrompt) ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={generateMissingPrompts}
              disabled={generatingPrompts}
            >
              {generatingPrompts ? (
                <SpinnerGap size={15} className="animate-spin" />
              ) : (
                <MagicWand size={15} />
              )}
              Generate missing prompts
            </Button>
          ) : null}
        </Card>

      {/* SEO */}
      <Card variant="default" padding="md" className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">
            SEO (Google Search 2026)
          </h3>
          <Input
            label="Meta title (≤60)"
            value={form.metaTitle}
            onChange={(e) => set("metaTitle", e.target.value.slice(0, 70))}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">
              Meta description (≤155)
            </label>
            <textarea
              value={form.metaDescription}
              onChange={(e) =>
                set("metaDescription", e.target.value.slice(0, 160))
              }
              rows={2}
              className="w-full rounded-xl bg-bg-card border border-border px-3 py-2.5 text-sm text-text-primary resize-none focus:outline-none focus:border-accent/50"
            />
            <p className="text-[10px] text-text-muted">
              {form.metaDescription.length}/160
            </p>
          </div>
          <Input
            label="Focus keyword"
            value={form.focusKeyword}
            onChange={(e) => set("focusKeyword", e.target.value)}
          />
          <Input
            label="Canonical URL (optional)"
            placeholder="https://eztopup.io/blog/…"
            value={form.canonicalUrl}
            onChange={(e) => set("canonicalUrl", e.target.value)}
          />
          <Input
            label="OG title"
            value={form.ogTitle}
            onChange={(e) => set("ogTitle", e.target.value)}
          />
          <Input
            label="OG description"
            value={form.ogDescription}
            onChange={(e) => set("ogDescription", e.target.value)}
          />
        </Card>

      {/* FAQ for schema */}
      <Card variant="default" padding="md" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              FAQ (JSON-LD FAQPage)
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                set("faq", [...form.faq, { question: "", answer: "" }])
              }
            >
              Add Q&A
            </Button>
          </div>
          {form.faq.length === 0 ? (
            <p className="text-xs text-text-muted">
              Optional. Helps rich results when questions match real search
              intent.
            </p>
          ) : (
            form.faq.map((item, i) => (
              <div
                key={i}
                className="space-y-2 p-3 rounded-xl border border-border bg-bg-elevated/40"
              >
                <Input
                  label={`Question ${i + 1}`}
                  value={item.question}
                  onChange={(e) => {
                    const next = [...form.faq];
                    next[i] = { ...next[i], question: e.target.value };
                    set("faq", next);
                  }}
                />
                <textarea
                  value={item.answer}
                  onChange={(e) => {
                    const next = [...form.faq];
                    next[i] = { ...next[i], answer: e.target.value };
                    set("faq", next);
                  }}
                  placeholder="Answer"
                  rows={2}
                  className="w-full rounded-xl bg-bg-card border border-border px-3 py-2.5 text-sm text-text-primary resize-none"
                />
                <button
                  type="button"
                  className="text-xs text-red-400 hover:underline"
                  onClick={() =>
                    set(
                      "faq",
                      form.faq.filter((_, idx) => idx !== i)
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </Card>

      <Card variant="default" padding="md" className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Content</h3>
          <RichEditor
            content={form.content}
            onChange={(html) => set("content", html)}
            placeholder="Write your article (H2/H3, lists, practical steps)…"
          />
        </Card>

      <div className="flex items-center gap-3 flex-wrap">
          <Button size="lg" onClick={() => save(true)} disabled={saving}>
            {saving ? "Saving…" : "Publish"}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => save(false)}
            disabled={saving}
          >
            Save draft
          </Button>
          <Button variant="ghost" size="lg" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>

      {/* Optional AI helper — never required for manual posts */}
      <Card
          variant="default"
          padding="md"
          className="space-y-4 border-fuchsia-400/15 border-dashed"
        >
          <button
            type="button"
            onClick={() => setShowAiHelper((v) => !v)}
            className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <MagicWand size={18} className="text-fuchsia-300" />
              <div>
                <h3 className="text-sm font-semibold text-text-primary">
                  Optional: AI draft helper (blog only)
                </h3>
                <p className="text-xs text-text-muted">
                  Scope: isi form artikel di atas saja. AI tidak publish, tidak
                  akses admin/payment/DB. Review manual sebelum Publish.
                </p>
              </div>
            </div>
            <span className="text-xs text-text-muted shrink-0">
              {showAiHelper ? "Hide" : "Show"}
            </span>
          </button>

          {showAiHelper ? (
            <div className="space-y-4 pt-2 border-t border-border">
              <p className="text-xs text-text-muted">
                Butuh AI on + base URL + API key di Settings. Model membuat
                artikel dan dua prompt gambar; file gambar tetap dibuat dan
                diunggah manual.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-3">
                <Input
                  label="Topic"
                  placeholder="e.g. Cara top up MLBB dengan USDT di Indonesia"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                />
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-text-secondary">
                    Country
                  </label>
                  <select
                    value={form.countryCode}
                    onChange={(e) => set("countryCode", e.target.value)}
                    className="w-full rounded-xl bg-bg-card border border-border px-3 h-10 text-sm text-text-primary"
                  >
                    {(countries.length ? countries : defaultCountries).map(
                      (c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div className="flex items-end gap-2 flex-wrap sm:flex-nowrap">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => generateAi(false)}
                    disabled={generating}
                  >
                    {generating ? (
                      <SpinnerGap size={16} className="animate-spin" />
                    ) : (
                      <MagicWand size={16} />
                    )}
                    {generating ? "…" : "Draft"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => generateAi(true)}
                    disabled={generating}
                  >
                    {generating ? (
                      <SpinnerGap size={16} className="animate-spin" />
                    ) : (
                      <MagicWand size={16} weight="fill" />
                    )}
                    {generating ? "…" : "Generate & publish"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </Card>
    </div>
  );
}
