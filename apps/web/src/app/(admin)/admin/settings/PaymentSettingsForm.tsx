"use client";

import { useState } from "react";
import { Button } from "@kupon/ui";
import { CheckCircle, FloppyDisk, Warning } from "@phosphor-icons/react";

type PaymentSettings = {
  adminEnabled: boolean;
  environmentEnabled: boolean;
  configured: boolean;
  effectiveEnabled: boolean;
  projectSlug: string;
  hasApiKey: boolean;
};

export default function PaymentSettingsForm({
  initial,
}: {
  initial: PaymentSettings;
}) {
  const [settings, setSettings] = useState(initial);
  const [enabled, setEnabled] = useState(initial.adminEnabled);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/settings/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pakasirEnabled: enabled }),
      });
      const data = (await response.json()) as {
        settings?: PaymentSettings;
        error?: string;
      };
      if (!response.ok || !data.settings) {
        throw new Error(data.error || "Payment settings could not be saved.");
      }
      setSettings(data.settings);
      setEnabled(data.settings.adminEnabled);
      setMessage("Payment settings saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const ready = settings.environmentEnabled && settings.configured;

  return (
    <section className="admin-section">
      <div className="admin-section-header">
        <div>
          <p className="admin-eyebrow">Payments</p>
          <h2 className="admin-section-title">Payment methods</h2>
          <p className="admin-section-subtitle">
            Control new checkout availability. Existing paid orders are still
            verified even when a method is disabled.
          </p>
        </div>
      </div>

      <div className="admin-tile space-y-4">
        <label className="flex cursor-pointer items-start justify-between gap-4">
          <span>
            <span className="block text-sm font-semibold text-text-primary">
              Pakasir
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-text-muted">
              Hosted QRIS and Indonesian Virtual Account checkout.
            </span>
          </span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="mt-1 h-5 w-5 accent-accent"
          />
        </label>

        <div className="grid gap-2 text-xs sm:grid-cols-3">
          <Status label="Environment gate" ok={settings.environmentEnabled} />
          <Status label="Credentials" ok={settings.configured} />
          <Status label="Checkout active" ok={settings.effectiveEnabled} />
        </div>

        <p className="text-xs text-text-muted">
          Project: <code>{settings.projectSlug || "not configured"}</code> · API
          key: {settings.hasApiKey ? "configured" : "missing"}
        </p>
        {!ready && enabled ? (
          <p className="flex items-start gap-2 text-xs text-amber-300">
            <Warning size={16} className="mt-0.5 shrink-0" />
            Admin switch is on, but checkout remains unavailable until
            PAKASIR_ENABLED=true, PAKASIR_PROJECT_SLUG, and PAKASIR_API_KEY are
            configured on the server.
          </p>
        ) : null}
        {message ? <p className="text-xs text-emerald-300">{message}</p> : null}
        {error ? <p className="text-xs text-red-300">{error}</p> : null}
        <Button onClick={save} disabled={saving} size="sm">
          <FloppyDisk size={16} />
          {saving ? "Saving…" : "Save payment settings"}
        </Button>
      </div>
    </section>
  );
}

function Status({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-card/70 p-2">
      {ok ? (
        <CheckCircle size={15} weight="fill" className="text-emerald-400" />
      ) : (
        <Warning size={15} weight="fill" className="text-amber-400" />
      )}
      <span className="text-text-secondary">
        {label}: {ok ? "yes" : "no"}
      </span>
    </div>
  );
}
