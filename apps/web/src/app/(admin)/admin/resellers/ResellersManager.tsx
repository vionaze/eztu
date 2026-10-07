"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";
type Tier = "TIER_1" | "TIER_2";

type Organization = {
  id: string;
  name: string;
  slug: string;
  status: Status;
  tier: Tier;
  rejectionReason: string | null;
  suspendedAt: string | null;
  suspendedBy: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { members: number };
  members: Array<{
    id: string;
    role: "OWNER" | "MEMBER";
    user: { email: string | null; name: string | null };
  }>;
};

type Draft = { status: Status; tier: Tier };

export default function ResellersManager({
  initialOrganizations,
}: {
  initialOrganizations: Organization[];
}) {
  const router = useRouter();
  const [organizations, setOrganizations] = useState(initialOrganizations);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);
  const [error, setError] = useState("");

  function startEditing(organization: Organization) {
    setError("");
    setEditingId(organization.id);
    setDrafts((current) => ({
      ...current,
      [organization.id]: { status: organization.status, tier: organization.tier },
    }));
  }

  function cancelEditing(id: string) {
    setEditingId(null);
    setDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function saveOrganization(organization: Organization) {
    const draft = drafts[organization.id];
    if (!draft) return;

    setBusyId(organization.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/resellers/${organization.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: draft.status,
          tier: draft.tier,
          ...(draft.status === "REJECTED" && !organization.rejectionReason
            ? { rejectionReason: "Application was not approved." }
            : {}),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        organization?: Organization;
      };
      if (!response.ok || !body.organization) {
        setError(body.error || "Unable to save reseller.");
        return;
      }

      const updated = body.organization;
      setOrganizations((current) =>
        current.map((item) =>
          item.id === organization.id
            ? {
                ...item,
                ...updated,
                createdAt: String(updated.createdAt),
                updatedAt: String(updated.updatedAt),
                suspendedAt: updated.suspendedAt ? String(updated.suspendedAt) : null,
              }
            : item,
        ),
      );
      cancelEditing(organization.id);
      router.refresh();
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteOrganization() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setBusyId(target.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/resellers/${target.id}`, {
        method: "DELETE",
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(body.error || "Unable to delete reseller.");
        return;
      }
      setOrganizations((current) => current.filter((item) => item.id !== target.id));
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setBusyId(null);
    }
  }

  function getDraft(organization: Organization): Draft {
    return drafts[organization.id] || {
      status: organization.status,
      tier: organization.tier,
    };
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">B2B</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-text-primary">Reseller applications</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Edit status and tier, then save when the changes are ready.
        </p>
      </div>
      {error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>
      ) : null}
      <div className="space-y-3">
        {organizations.length === 0 ? (
          <div className="rounded-2xl border border-border bg-bg-card p-6 text-sm text-text-secondary">
            No reseller applications yet.
          </div>
        ) : organizations.map((organization) => {
          const isEditing = editingId === organization.id;
          const draft = getDraft(organization);
          const isBusy = busyId === organization.id;
          return (
            <article key={organization.id} className="rounded-2xl border border-border bg-bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-text-primary">{organization.name}</h3>
                  <p className="mt-1 text-xs text-text-muted">
                    {organization.slug} · {organization._count.members} member(s)
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">
                    {organization.members[0]?.user.email || "No owner email"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-border px-2.5 py-1 text-xs text-text-secondary">
                    {organization.status}
                  </span>
                  <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs text-accent">
                    {organization.tier.replace("_", " ")}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {isEditing ? (
                  <>
                    <select
                      value={draft.status}
                      disabled={isBusy}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [organization.id]: {
                            ...draft,
                            status: event.target.value as Status,
                          },
                        }))
                      }
                      className="rounded-lg border border-border bg-bg-primary px-3 py-2 text-xs text-text-primary"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="ACTIVE">Active</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="SUSPENDED">Suspended</option>
                    </select>
                    <select
                      value={draft.tier}
                      disabled={isBusy}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [organization.id]: {
                            ...draft,
                            tier: event.target.value as Tier,
                          },
                        }))
                      }
                      className="rounded-lg border border-border bg-bg-primary px-3 py-2 text-xs text-text-primary"
                    >
                      <option value="TIER_1">Tier 1</option>
                      <option value="TIER_2">Tier 2</option>
                    </select>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => saveOrganization(organization)}
                      className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-bg-primary disabled:opacity-50"
                    >
                      {isBusy ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => cancelEditing(organization.id)}
                      className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-secondary disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditing(organization)}
                    className="rounded-lg border border-accent/30 px-3 py-2 text-xs font-semibold text-accent"
                  >
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setDeleteTarget(organization)}
                  className="rounded-lg border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-200 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true" aria-labelledby="delete-reseller-title">
          <div className="w-full max-w-md rounded-2xl border border-red-400/30 bg-bg-elevated p-5 shadow-2xl">
            <h3 id="delete-reseller-title" className="text-lg font-semibold text-text-primary">
              Are you sure you want to delete this reseller?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              This permanently deletes <strong>{deleteTarget.name}</strong> and its reseller membership. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={busyId === deleteTarget.id}
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === deleteTarget.id}
                onClick={deleteOrganization}
                className="rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busyId === deleteTarget.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
