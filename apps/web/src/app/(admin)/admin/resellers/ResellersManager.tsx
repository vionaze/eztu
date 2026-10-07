"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Organization = {
  id: string;
  name: string;
  slug: string;
  status: "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";
  tier: "TIER_1" | "TIER_2";
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

export default function ResellersManager({
  initialOrganizations,
}: {
  initialOrganizations: Organization[];
}) {
  const router = useRouter();
  const [organizations, setOrganizations] = useState(initialOrganizations);
  const [pendingTiers, setPendingTiers] = useState<Record<string, Organization["tier"]>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function updateOrganization(id: string, data: Record<string, string>) {
    setBusyId(id);
    setError("");
    try {
      const response = await fetch(`/api/admin/resellers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; organization?: Organization };
      if (!response.ok || !body.organization) {
        setError(body.error || "Unable to update reseller.");
        return;
      }
      const organization = body.organization;
      setOrganizations((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                ...organization,
                createdAt: String(organization.createdAt),
                updatedAt: String(organization.updatedAt),
                suspendedAt: organization.suspendedAt ? String(organization.suspendedAt) : null,
              }
            : item,
        ),
      );
      setPendingTiers((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      router.refresh();
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setBusyId(null);
    }
  }

  function selectedTier(organization: Organization) {
    return pendingTiers[organization.id] || organization.tier;
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">B2B</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-text-primary">Reseller applications</h2>
        <p className="mt-1 text-sm text-text-secondary">Approve organizations and assign their Phase 2 pricing tier.</p>
      </div>
      {error ? <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}
      <div className="space-y-3">
        {organizations.length === 0 ? (
          <div className="rounded-2xl border border-border bg-bg-card p-6 text-sm text-text-secondary">No reseller applications yet.</div>
        ) : organizations.map((organization) => (
          <article key={organization.id} className="rounded-2xl border border-border bg-bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-text-primary">{organization.name}</h3>
                <p className="mt-1 text-xs text-text-muted">{organization.slug} · {organization._count.members} member(s)</p>
                <p className="mt-2 text-sm text-text-secondary">{organization.members[0]?.user.email || "No owner email"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-border px-2.5 py-1 text-xs text-text-secondary">{organization.status}</span>
                <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs text-accent">{organization.tier.replace("_", " ")}</span>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {organization.status === "PENDING" ? (
                <button disabled={busyId === organization.id} onClick={() => updateOrganization(organization.id, { status: "ACTIVE" })} className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-bg-primary disabled:opacity-50">Approve</button>
              ) : null}
              {organization.status !== "SUSPENDED" ? (
                <button disabled={busyId === organization.id} onClick={() => updateOrganization(organization.id, { status: "SUSPENDED" })} className="rounded-lg border border-amber-400/30 px-3 py-2 text-xs font-semibold text-amber-200 disabled:opacity-50">Suspend</button>
              ) : (
                <button disabled={busyId === organization.id} onClick={() => updateOrganization(organization.id, { status: "ACTIVE" })} className="rounded-lg border border-accent/30 px-3 py-2 text-xs font-semibold text-accent disabled:opacity-50">Reactivate</button>
              )}
              {organization.status === "PENDING" ? (
                <button disabled={busyId === organization.id} onClick={() => updateOrganization(organization.id, { status: "REJECTED", rejectionReason: "Application was not approved." })} className="rounded-lg border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-200 disabled:opacity-50">Reject</button>
              ) : null}
              <select
                value={selectedTier(organization)}
                disabled={busyId === organization.id}
                onChange={(event) =>
                  setPendingTiers((current) => ({
                    ...current,
                    [organization.id]: event.target.value as Organization["tier"],
                  }))
                }
                className="rounded-lg border border-border bg-bg-primary px-3 py-2 text-xs text-text-primary"
              >
                <option value="TIER_1">Tier 1</option>
                <option value="TIER_2">Tier 2</option>
              </select>
              {selectedTier(organization) !== organization.tier ? (
                <button
                  type="button"
                  disabled={busyId === organization.id}
                  onClick={() =>
                    updateOrganization(organization.id, {
                      tier: selectedTier(organization),
                    })
                  }
                  className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-bg-primary disabled:opacity-50"
                >
                  {busyId === organization.id ? "Saving…" : "Save"}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
