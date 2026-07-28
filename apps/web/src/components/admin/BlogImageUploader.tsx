"use client";

import { useRef, useState, type DragEvent } from "react";
import {
  ArrowClockwise,
  CheckCircle,
  Copy,
  ImageSquare,
  SpinnerGap,
  UploadSimple,
} from "@phosphor-icons/react";

type ImageKind = "hero" | "thumbnail";

type UploadedImage = {
  path: string;
  url: string;
  format: "webp";
  width: number;
  height: number;
  bytes: number;
  sourceBytes: number;
};

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png"]);

const imageCopy: Record<
  ImageKind,
  {
    title: string;
    ratio: string;
    description: string;
  }
> = {
  hero: {
    title: "Hero image",
    ratio: "16:9 recommended",
    description: "Wide cover for the article and social preview.",
  },
  thumbnail: {
    title: "Thumbnail image",
    ratio: "4:3 recommended",
    description: "Compact card image that stays clear on mobile.",
  },
};

function formatBytes(bytes: number) {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${Math.round(bytes / 1_024)} KB`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} MB`;
}

function absoluteImageUrl(value: string) {
  if (!value) return "";
  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return value;
  }
}

export default function BlogImageUploader({
  kind,
  value,
  onUploaded,
}: {
  kind: ImageKind;
  value: string;
  onUploaded: (path: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [uploaded, setUploaded] = useState<UploadedImage | null>(null);
  const copy = imageCopy[kind];

  const upload = async (file?: File) => {
    if (!file || uploading) return;
    setError("");
    setCopied(false);

    if (!ACCEPTED_TYPES.has(file.type)) {
      setError("Only JPG, JPEG, and PNG files are accepted.");
      return;
    }
    if (file.size === 0) {
      setError("The selected image is empty.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("The image is larger than 12 MB.");
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.set("kind", kind);
      body.set("file", file);

      const response = await fetch("/api/admin/blog/uploads", {
        method: "POST",
        body,
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        image?: UploadedImage;
      };

      if (!response.ok || !data.image) {
        throw new Error(data.error || "Image upload failed.");
      }

      setUploaded(data.image);
      onUploaded(data.image.path);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Image upload failed."
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void upload(event.dataTransfer.files[0]);
  };

  const copyUrl = async () => {
    const url = uploaded?.url || absoluteImageUrl(value);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setError("Unable to copy the URL. Copy it from the field below.");
    }
  };

  const compression =
    uploaded && uploaded.sourceBytes > uploaded.bytes
      ? Math.round((1 - uploaded.bytes / uploaded.sourceBytes) * 100)
      : 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-bg-elevated/35">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-text-primary">
              {copy.title}
            </h4>
            <span className="rounded-full border border-border bg-bg-card px-2 py-0.5 text-[10px] font-medium text-text-muted">
              {copy.ratio}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            {copy.description}
          </p>
        </div>
        {value ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
            <CheckCircle size={12} weight="fill" />
            Ready
          </span>
        ) : null}
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        {value ? (
          <div
            className={`relative overflow-hidden rounded-xl border border-border bg-bg-card ${
              kind === "hero" ? "aspect-video" : "aspect-[4/3]"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={`${copy.title} preview`}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-3 pb-3 pt-8">
              <button
                type="button"
                onClick={copyUrl}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/20 bg-black/45 px-3 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/65"
              >
                <Copy size={14} />
                {copied ? "Copied" : "Copy URL"}
              </button>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-60"
              >
                <ArrowClockwise size={14} />
                Replace
              </button>
            </div>
          </div>
        ) : (
          <div
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setDragging(false);
              }
            }}
            onDrop={handleDrop}
            className={`rounded-xl border border-dashed px-4 py-7 text-center transition-colors sm:px-6 ${
              dragging
                ? "border-accent bg-accent/10"
                : "border-border bg-bg-card/60 hover:border-accent/45"
            }`}
          >
            <div className="mx-auto flex size-11 items-center justify-center rounded-xl border border-border bg-bg-elevated text-accent">
              {uploading ? (
                <SpinnerGap size={22} className="animate-spin" />
              ) : (
                <ImageSquare size={22} />
              )}
            </div>
            <p className="mt-3 text-sm font-medium text-text-primary">
              {uploading ? "Converting to WebP…" : "Drop image here"}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              JPG, JPEG, or PNG · maximum 12 MB
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {uploading ? (
                <SpinnerGap size={15} className="animate-spin" />
              ) : (
                <UploadSimple size={15} weight="bold" />
              )}
              {uploading ? "Uploading…" : "Choose image"}
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          className="sr-only"
          aria-label={`Upload ${copy.title.toLowerCase()}`}
          onChange={(event) => void upload(event.target.files?.[0])}
        />

        {uploaded ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-2.5 text-[11px] text-emerald-200">
            <span className="font-semibold">Converted to WebP</span>
            <span>
              {uploaded.width}×{uploaded.height}
            </span>
            <span>{formatBytes(uploaded.bytes)}</span>
            {compression > 0 ? <span>{compression}% smaller</span> : null}
          </div>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-400/20 bg-red-400/[0.08] px-3 py-2.5 text-xs text-red-300"
          >
            {error}
          </p>
        ) : null}

        <p className="text-[11px] leading-relaxed text-text-muted">
          Only the converted WebP is written to disk. Save the article after
          uploading to apply this URL.
        </p>
      </div>
    </section>
  );
}
