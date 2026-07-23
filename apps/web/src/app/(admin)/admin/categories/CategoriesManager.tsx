"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Input } from "@kupon/ui";
import {
  Plus,
  PencilSimple,
  Trash,
  SpinnerGap,
  Warning,
  X,
  FloppyDisk,
} from "@phosphor-icons/react";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  productCount: number;
};

export default function CategoriesManager({
  initialCategories,
  uncategorizedCount,
}: {
  initialCategories: CategoryRow[];
  uncategorizedCount: number;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [uncategorized, setUncategorized] = useState(uncategorizedCount);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const slugifyLocal = (val: string) =>
    val
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const refresh = () => router.refresh();

  const createCategory = async () => {
    setError("");
    setMessage("");
    if (!newName.trim()) {
      setError("Nama kategori wajib diisi.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          slug: newSlug.trim() || slugifyLocal(newName),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Create failed");
      setCategories((prev) =>
        [
          ...prev,
          {
            id: data.category.id,
            name: data.category.name,
            slug: data.category.slug,
            image: data.category.image,
            productCount: 0,
          },
        ].sort((a, b) => a.name.localeCompare(b.name))
      );
      setNewName("");
      setNewSlug("");
      setShowCreate(false);
      setMessage(`Kategori “${data.category.name}” ditambahkan.`);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (cat: CategoryRow) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditSlug(cat.slug);
    setError("");
    setMessage("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/categories/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          slug: editSlug.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Update failed");
      setCategories((prev) =>
        prev
          .map((c) =>
            c.id === editingId
              ? {
                  ...c,
                  name: data.category.name,
                  slug: data.category.slug,
                }
              : c
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingId(null);
      setMessage("Kategori diperbarui.");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/categories/${deleting.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");

      setCategories((prev) => prev.filter((c) => c.id !== deleting.id));
      setUncategorized((n) => n + (data.productsUncategorized || 0));
      setMessage(
        data.productsUncategorized > 0
          ? `“${deleting.name}” dihapus. ${data.productsUncategorized} produk jadi Uncategorized — assign ulang di halaman Products.`
          : `“${deleting.name}” dihapus.`
      );
      setDeleting(null);
      setConfirmName("");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  };

  const nameMatches =
    deleting != null && confirmName.trim() === deleting.name;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">
            {categories.length} categor
            {categories.length === 1 ? "y" : "ies"}
            {uncategorized > 0
              ? ` · ${uncategorized} uncategorized product(s)`
              : ""}
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            Contoh: <strong className="text-text-secondary">Top-up</strong>,{" "}
            <strong className="text-text-secondary">Game Vouchers</strong> /
            kode voucher. Edit nama &amp; slug; hapus butuh konfirmasi nama.
          </p>
        </div>
        <Button type="button" onClick={() => setShowCreate(true)}>
          <Plus size={16} weight="bold" />
          Add category
        </Button>
      </div>

      {message ? (
        <p className="text-sm text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-xl px-4 py-3">
          {message}
        </p>
      ) : null}
      {error && !deleting ? (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
          {error}
        </p>
      ) : null}

      {uncategorized > 0 ? (
        <Card
          padding="md"
          className="border-amber-400/25 bg-amber-400/5 text-sm text-amber-100/90"
        >
          <strong className="text-amber-300">{uncategorized} product(s)</strong>{" "}
          tanpa kategori. Buka{" "}
          <a href="/admin/products" className="text-accent underline">
            Products
          </a>{" "}
          → edit produk → pilih kategori lagi.
        </Card>
      ) : null}

      {/* Create panel */}
      {showCreate ? (
        <Card variant="default" padding="lg" className="space-y-4 border-accent/20">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              Kategori baru
            </h3>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-text-muted hover:text-text-primary cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
          <Input
            label="Nama kategori"
            placeholder="e.g. Top-up, Game Vouchers"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              if (!newSlug || newSlug === slugifyLocal(newName)) {
                setNewSlug(slugifyLocal(e.target.value));
              }
            }}
          />
          <Input
            label="Slug (URL)"
            placeholder="top-up"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={createCategory} disabled={creating}>
              {creating ? (
                <SpinnerGap size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              {creating ? "Saving…" : "Create"}
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      {/* List */}
      <div className="space-y-3">
        {categories.length === 0 ? (
          <Card padding="lg" className="text-center text-sm text-text-muted">
            Belum ada kategori. Klik <strong>Add category</strong> untuk mulai
            (mis. Top-up, Game Vouchers).
          </Card>
        ) : (
          categories.map((cat) => {
            const isEditing = editingId === cat.id;
            return (
              <Card
                key={cat.id}
                padding="md"
                className="space-y-3 hover:border-white/10 transition-colors"
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <Input
                      label="Nama"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <Input
                      label="Slug"
                      value={editSlug}
                      onChange={(e) => setEditSlug(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={saveEdit} disabled={saving}>
                        {saving ? (
                          <SpinnerGap size={14} className="animate-spin" />
                        ) : (
                          <FloppyDisk size={14} />
                        )}
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-text-primary">
                          {cat.name}
                        </h3>
                        <Badge variant="muted">
                          {cat.productCount} product
                          {cat.productCount === 1 ? "" : "s"}
                        </Badge>
                      </div>
                      <p className="text-xs text-text-muted font-mono mt-0.5">
                        {cat.slug}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(cat)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-text-muted hover:text-accent hover:bg-accent/10 cursor-pointer"
                        title="Edit"
                      >
                        <PencilSimple size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleting(cat);
                          setConfirmName("");
                          setError("");
                        }}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-400/10 cursor-pointer"
                        title="Delete"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Delete modal */}
      {deleting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
            aria-label="Close"
            onClick={() => {
              setDeleting(null);
              setConfirmName("");
              setError("");
            }}
          />
          <Card
            variant="default"
            padding="lg"
            className="relative w-full max-w-md space-y-4 border-red-400/30"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-400/15 flex items-center justify-center shrink-0">
                <Warning size={22} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary">
                  Hapus kategori?
                </h3>
                <p className="text-sm text-text-secondary mt-1 leading-relaxed">
                  Kamu akan menghapus{" "}
                  <strong className="text-text-primary">
                    “{deleting.name}”
                  </strong>
                  .
                  {deleting.productCount > 0 ? (
                    <>
                      {" "}
                      <strong className="text-amber-300">
                        {deleting.productCount} produk
                      </strong>{" "}
                      di dalamnya akan menjadi{" "}
                      <strong className="text-amber-300">Uncategorized</strong>{" "}
                      (bisa di-assign lagi di Products).
                    </>
                  ) : (
                    <> Tidak ada produk yang terpengaruh.</>
                  )}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-bg-elevated/40 px-3 py-2 text-xs text-text-muted">
              Slug:{" "}
              <span className="font-mono text-text-secondary">
                {deleting.slug}
              </span>
            </div>

            <Input
              label={`Ketik nama kategori persis: ${deleting.name}`}
              placeholder={deleting.name}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              autoComplete="off"
            />
            {!nameMatches && confirmName.length > 0 ? (
              <p className="text-xs text-red-400">
                Nama belum cocok. Harus sama persis (huruf besar/kecil).
              </p>
            ) : null}
            {error ? <p className="text-xs text-red-400">{error}</p> : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant="secondary"
                className="!bg-red-500/20 !text-red-300 !border-red-400/30 hover:!bg-red-500/30"
                disabled={!nameMatches || deleteLoading}
                onClick={confirmDelete}
              >
                {deleteLoading ? (
                  <SpinnerGap size={16} className="animate-spin" />
                ) : (
                  <Trash size={16} />
                )}
                {deleteLoading ? "Deleting…" : "Delete permanently"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setDeleting(null);
                  setConfirmName("");
                  setError("");
                }}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
