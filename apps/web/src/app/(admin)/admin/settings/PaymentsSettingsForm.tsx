"use client";

import { useState } from "react";
import { Button, Input } from "@kupon/ui";
import { CurrencyBtc, FloppyDisk, WarningCircle } from "@phosphor-icons/react";

type Initial = {
  enabled: boolean;
  disabledCountries: string;
  disabledUntil: string | null;
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function daysFromNow(days: number) {
  return toLocalInput(new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString());
}

export default function PaymentsSettingsForm({ initial }: { initial: Initial }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [countries, setCountries] = useState(initial.disabledCountries);
  const [until, setUntil] = useState(toLocalInput(initial.disabledUntil));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/settings/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          disabledCountries: countries,
          disabledUntil: until ? new Date(until).toISOString() : "",
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        settings?: { disabledCountries?: string[] };
      };
      if (!response.ok) throw new Error(data.error || "Save failed");
      setCountries((data.settings?.disabledCountries || []).join(","));
      setMessage("Payment settings saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="admin-bento admin-bento-2">
        <div className="admin-tile border-emerald-400/15">
          <div className="admin-tile-header">
            <div className="flex items-center gap-2 min-w-0">
              <CurrencyBtc size={16} className="text-emerald-300 shrink-0" />
              <div>
                <p className="admin-tile-title">Crypto checkout</p>
                <p className="admin-tile-desc">
                  Master switch — OFF memblokir crypto untuk semua negara.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled((value) => !value)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
                enabled ? "bg-emerald-500/80" : "bg-zinc-600"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  enabled ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>
        </div>
        <div className="admin-tile border-amber-400/15 bg-amber-400/[0.04]">
          <p className="text-xs leading-relaxed text-amber-100/90 flex gap-2">
            <WarningCircle size={14} className="mt-0.5 shrink-0 text-amber-300" />
            <span>
              Blokir per negara hanya berlaku sampai waktu batas. Setelah lewat,
              crypto otomatis aktif kembali tanpa perlu diubah manual.
            </span>
          </p>
        </div>
      </div>

      <div className="admin-tile">
        <div>
          <p className="admin-tile-title">Pembatasan regional</p>
          <p className="admin-tile-desc">
            Kode negara 2 huruf, dipisah koma (contoh: ID). Kosongkan untuk tidak
            membatasi negara mana pun.
          </p>
        </div>
        <div className="admin-bento admin-bento-2 admin-field-stack !gap-3">
          <Input
            label="Negara yang diblokir"
            placeholder="ID"
            value={countries}
            onChange={(event) => setCountries(event.target.value)}
          />
          <Input
            label="Berakhir pada (opsional)"
            type="datetime-local"
            value={until}
            onChange={(event) => setUntil(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setUntil(daysFromNow(3))}>
            3 hari
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setUntil(daysFromNow(1))}>
            1 hari
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setUntil("")}>
            Tanpa batas
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={saving}>
            <FloppyDisk size={14} />
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
        {message ? <p className="text-xs text-emerald-400">{message}</p> : null}
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
      </div>
    </div>
  );
}
