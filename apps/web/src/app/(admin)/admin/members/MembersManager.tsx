"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@kupon/ui";
import {
  MagnifyingGlass,
  Plus,
  PencilSimple,
  Trash,
  SpinnerGap,
  X,
  FloppyDisk,
  Prohibit,
  CheckCircle,
} from "@phosphor-icons/react";
import { cn, formatAdminDateTime } from "@/lib/utils";

export type MemberRow = {
  id: string;
  clerkId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  walletAddress: string | null;
  role: "USER" | "ADMIN" | "SUPERADMIN";
  lastSeenIp: string | null;
  lastSeenUserAgent: string | null;
  lastSeenAt: string | Date | null;
  bannedAt: string | Date | null;
  banReason: string | null;
  bannedBy: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  _count: { orders: number };
};

const ROLE_STYLES: Record<string, string> = {
  SUPERADMIN: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  ADMIN: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  USER: "border-border bg-white/5 text-text-secondary",
};

export default function MembersManager({
  initialMembers,
  canManageRoles,
  currentUserId,
}: {
  initialMembers: MemberRow[];
  canManageRoles: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"USER" | "ADMIN" | "SUPERADMIN">("USER");

  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editWallet, setEditWallet] = useState("");
  const [editRole, setEditRole] = useState<"USER" | "ADMIN" | "SUPERADMIN">("USER");

  const [deleting, setDeleting] = useState<MemberRow | null>(null);
  const [mergePick, setMergePick] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter !== "ALL" && m.role !== roleFilter) return false;
      if (!needle) return true;
      return (
        (m.email || "").toLowerCase().includes(needle) ||
        (m.name || "").toLowerCase().includes(needle) ||
        m.id.toLowerCase().includes(needle) ||
        m.clerkId.toLowerCase().includes(needle) ||
        (m.lastSeenIp || "").includes(needle)
      );
    });
  }, [members, q, roleFilter]);

  function openEdit(m: MemberRow) {
    setEditing(m);
    setEditName(m.name || "");
    setEditEmail(m.email || "");
    setEditWallet(m.walletAddress || "");
    setEditRole(m.role);
    setError("");
    setMessage("");
  }

  async function createMember() {
    setBusy("create");
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          name: newName,
          role: canManageRoles ? newRole : "USER",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Create failed");
        return;
      }
      setMembers((prev) => [
        {
          ...data.member,
          lastSeenUserAgent: null,
          bannedBy: null,
          _count: { orders: 0 },
        },
        ...prev,
      ]);
      setShowCreate(false);
      setNewEmail("");
      setNewName("");
      setNewRole("USER");
      setMessage("Member created.");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy("save");
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/members/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          walletAddress: editWallet,
          ...(canManageRoles ? { role: editRole } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Update failed");
        return;
      }
      setMembers((prev) =>
        prev.map((m) =>
          m.id === editing.id
            ? { ...m, ...data.member, _count: data.member._count || m._count }
            : m
        )
      );
      setEditing(null);
      setMessage("Member updated.");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  async function clearBan(m: MemberRow) {
    setBusy(`unban-${m.id}`);
    setError("");
    try {
      const res = await fetch(`/api/admin/members/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearBan: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unban failed");
        return;
      }
      setMembers((prev) =>
        prev.map((row) =>
          row.id === m.id
            ? {
                ...row,
                bannedAt: null,
                banReason: null,
                bannedBy: null,
              }
            : row
        )
      );
      setMessage(`Unbanned ${m.email || m.id}`);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  async function mergeInto(survivor: MemberRow, donor: MemberRow) {
    if (
      !confirm(
        `Gabung member?\n\nSurvivor (tetap): ${survivor.email || survivor.name || survivor.id}\nDonor (dihapus, order dipindah): ${donor.email || donor.name || donor.id}`
      )
    ) {
      return;
    }
    setBusy(`merge-${donor.id}`);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/members/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          survivorId: survivor.id,
          donorId: donor.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Merge failed");
        return;
      }
      setMembers((prev) => {
        const withoutDonor = prev.filter((m) => m.id !== donor.id);
        return withoutDonor.map((m) =>
          m.id === survivor.id
            ? {
                ...m,
                ...data.member,
                createdAt: data.member.createdAt || m.createdAt,
                updatedAt: data.member.updatedAt || m.updatedAt,
                bannedAt: data.member.bannedAt ?? m.bannedAt,
                lastSeenAt: data.member.lastSeenAt ?? m.lastSeenAt,
                _count: {
                  orders: m._count.orders + donor._count.orders,
                },
              }
            : m
        );
      });
      setMergePick(null);
      setMessage(
        `Merged. Orders moved into ${data.member.email || data.member.id}.`
      );
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy("delete");
    setError("");
    try {
      const res = await fetch(`/api/admin/members/${deleting.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Delete failed");
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== deleting.id));
      setDeleting(null);
      setMessage("Member deleted.");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="text-xs text-red-400 border border-red-500/30 rounded-md px-2 py-1.5">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-xs text-emerald-400 border border-emerald-500/30 rounded-md px-2 py-1.5">
          {message}
        </p>
      ) : null}

      <Card padding="sm" className="!p-3 space-y-2.5">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center flex-1 min-w-[200px]">
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <MagnifyingGlass
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search email, name, IP…"
                className="w-full rounded-md border border-border bg-background pl-8 pr-2 py-1.5 text-xs text-text-primary"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-text-primary"
            >
              <option value="ALL">All roles</option>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="SUPERADMIN">SUPERADMIN</option>
            </select>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setShowCreate(true);
              setError("");
            }}
          >
            <Plus size={14} className="mr-1" />
            Add member
          </Button>
        </div>
        <p className="text-[11px] text-text-muted">
          {filtered.length} shown · {members.length} total
          {canManageRoles
            ? " · You can change roles (USER / ADMIN / SUPERADMIN)"
            : " · Role changes require SUPERADMIN"}
          {canManageRoles
            ? " · Merge: click Merge on survivor, then pick donor"
            : ""}
        </p>
        {mergePick ? (
          <p className="text-[11px] text-amber-300/90">
            Merge mode: pilih baris kedua (donor) yang mau digabung ke survivor.
            Order akan dipindah, donor dihapus.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => setMergePick(null)}
            >
              Cancel
            </button>
          </p>
        ) : null}
      </Card>

      {showCreate ? (
        <Card padding="sm" className="!p-3 space-y-2 border-accent/30">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold">New member</h3>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-text-muted hover:text-text-primary"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              label="Email *"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="user@email.com"
            />
            <Input
              label="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            {canManageRoles ? (
              <label className="text-[11px] text-text-muted">
                Role
                <select
                  className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-2 text-xs text-text-primary"
                  value={newRole}
                  onChange={(e) =>
                    setNewRole(e.target.value as typeof newRole)
                  }
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="SUPERADMIN">SUPERADMIN</option>
                </select>
              </label>
            ) : null}
          </div>
          <p className="text-[10px] text-text-muted">
            Local profile only. On first Clerk login with the same email, the
            account will link automatically.
          </p>
          <Button
            size="sm"
            disabled={busy === "create" || !newEmail.trim()}
            onClick={createMember}
          >
            {busy === "create" ? (
              <SpinnerGap size={14} className="animate-spin mr-1" />
            ) : (
              <Plus size={14} className="mr-1" />
            )}
            Create
          </Button>
        </Card>
      ) : null}

      {editing ? (
        <Card padding="sm" className="!p-3 space-y-2 border-sky-500/30">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold">
              Edit · {editing.email || editing.id.slice(0, 8)}
            </h3>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-text-muted hover:text-text-primary"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              label="Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <Input
              label="Email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
            />
            <Input
              label="Wallet"
              value={editWallet}
              onChange={(e) => setEditWallet(e.target.value)}
            />
            {canManageRoles ? (
              <label className="text-[11px] text-text-muted">
                Role
                <select
                  className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-2 text-xs text-text-primary"
                  value={editRole}
                  onChange={(e) =>
                    setEditRole(e.target.value as typeof editRole)
                  }
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="SUPERADMIN">SUPERADMIN</option>
                </select>
              </label>
            ) : null}
          </div>
          <div className="text-[10px] text-text-muted font-mono space-y-0.5">
            <div>id: {editing.id}</div>
            <div>clerk: {editing.clerkId}</div>
            <div>orders: {editing._count.orders}</div>
          </div>
          <Button size="sm" disabled={busy === "save"} onClick={saveEdit}>
            {busy === "save" ? (
              <SpinnerGap size={14} className="animate-spin mr-1" />
            ) : (
              <FloppyDisk size={14} className="mr-1" />
            )}
            Save
          </Button>
        </Card>
      ) : null}

      <div className="space-y-1.5">
        {filtered.length === 0 ? (
          <Card padding="md" className="text-center text-sm text-text-muted py-8">
            No members match.
          </Card>
        ) : (
          filtered.map((m) => (
            <Card
              key={m.id}
              padding="none"
              className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold text-text-primary truncate">
                    {m.name || m.email || "—"}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wide rounded border px-1.5 py-0.5",
                      ROLE_STYLES[m.role]
                    )}
                  >
                    {m.role}
                  </span>
                  {m.bannedAt ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wide rounded border border-red-500/40 bg-red-500/10 text-red-300 px-1.5 py-0.5">
                      BANNED
                    </span>
                  ) : null}
                  {m.id === currentUserId ? (
                    <span className="text-[10px] text-accent">you</span>
                  ) : null}
                </div>
                <div className="text-[11px] text-text-secondary mt-0.5 truncate">
                  {m.email || "no email"} · {m._count.orders} orders
                  {m.lastSeenIp ? ` · IP ${m.lastSeenIp}` : ""}
                </div>
                <div className="text-[10px] text-text-muted mt-0.5">
                  Joined {formatAdminDateTime(m.createdAt)}
                  {m.bannedAt && m.banReason
                    ? ` · ban: ${m.banReason}`
                    : ""}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 shrink-0">
                {m.bannedAt ? (
                  <button
                    type="button"
                    disabled={busy === `unban-${m.id}`}
                    onClick={() => clearBan(m)}
                    className="inline-flex items-center gap-1 text-[11px] rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-2 py-1 hover:bg-emerald-500/20 disabled:opacity-40"
                  >
                    <CheckCircle size={12} />
                    Unban
                  </button>
                ) : null}
                {canManageRoles ? (
                  mergePick && mergePick !== m.id ? (
                    <button
                      type="button"
                      disabled={Boolean(busy?.startsWith("merge-"))}
                      onClick={() => {
                        const survivor = members.find((x) => x.id === mergePick);
                        if (survivor) void mergeInto(survivor, m);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] rounded-md border border-violet-500/40 bg-violet-500/10 text-violet-300 px-2 py-1 hover:bg-violet-500/20 disabled:opacity-40"
                    >
                      Merge into selected
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setMergePick(mergePick === m.id ? null : m.id)
                      }
                      className={cn(
                        "inline-flex items-center gap-1 text-[11px] rounded-md border px-2 py-1",
                        mergePick === m.id
                          ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
                          : "border-border text-text-secondary hover:text-text-primary"
                      )}
                    >
                      {mergePick === m.id ? "Survivor ✓" : "Merge"}
                    </button>
                  )
                ) : null}
                <button
                  type="button"
                  onClick={() => openEdit(m)}
                  className="inline-flex items-center gap-1 text-[11px] rounded-md border border-border px-2 py-1 text-text-secondary hover:text-text-primary"
                >
                  <PencilSimple size={12} />
                  Edit
                </button>
                {m.id !== currentUserId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleting(m);
                      setError("");
                    }}
                    className="inline-flex items-center gap-1 text-[11px] rounded-md border border-red-500/30 text-red-300 px-2 py-1 hover:bg-red-500/10"
                  >
                    <Trash size={12} />
                    Delete
                  </button>
                ) : null}
              </div>
            </Card>
          ))
        )}
      </div>

      {deleting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card padding="md" className="max-w-sm w-full space-y-3">
            <div className="flex items-start gap-2">
              <Prohibit className="text-red-400 shrink-0" size={20} />
              <div>
                <h3 className="text-sm font-semibold">Delete member?</h3>
                <p className="text-xs text-text-secondary mt-1">
                  {deleting.email || deleting.id}
                  {deleting._count.orders > 0
                    ? ` — has ${deleting._count.orders} orders (delete will fail; ban instead).`
                    : " — permanent remove of local profile."}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDeleting(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={busy === "delete"}
                onClick={confirmDelete}
                className="!bg-red-500/20 !text-red-300 border border-red-500/40"
              >
                {busy === "delete" ? "…" : "Delete"}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
