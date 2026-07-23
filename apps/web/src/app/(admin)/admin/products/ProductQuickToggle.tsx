"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeSlash, SpinnerGap } from "@phosphor-icons/react";

export default function ProductQuickToggle({
  id,
  published,
}: {
  id: string;
  published: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isPublished, setIsPublished] = useState(published);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      const next = !isPublished;
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to update visibility");
        return;
      }
      setIsPublished(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      title={isPublished ? "Hide from storefront" : "Show on storefront"}
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50 ${
        isPublished
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15"
          : "border-border text-text-muted hover:text-text-primary hover:bg-white/5"
      }`}
    >
      {loading ? (
        <SpinnerGap size={14} className="animate-spin" />
      ) : isPublished ? (
        <Eye size={14} />
      ) : (
        <EyeSlash size={14} />
      )}
      <span className="hidden sm:inline">
        {isPublished ? "Visible" : "Hidden"}
      </span>
    </button>
  );
}
