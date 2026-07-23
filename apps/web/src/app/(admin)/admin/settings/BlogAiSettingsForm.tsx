"use client";

import { useState } from "react";
import { Button, Card, Input } from "@kupon/ui";
import { MagicWand, SpinnerGap, ArrowCounterClockwise } from "@phosphor-icons/react";

type Initial = {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  hasApiKey: boolean;
  model: string;
  countries: string;
  autoCountries: string[];
  systemPrompt: string;
  hasCustomSystemPrompt: boolean;
  defaultSystemPrompt: string;
};

const SUGGESTED = ["GLOBAL", "ID", "MY", "US", "PH", "SG", "TH", "VN"];

export default function BlogAiSettingsForm({ initial }: { initial: Initial }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(initial.model);
  const [countries, setCountries] = useState(initial.countries);
  const [autoCountries, setAutoCountries] = useState<string[]>(
    initial.autoCountries
  );
  const [systemPrompt, setSystemPrompt] = useState(initial.systemPrompt);
  const [hasCustom, setHasCustom] = useState(initial.hasCustomSystemPrompt);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const countryList = countries
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  const toggleAuto = (code: string) => {
    setAutoCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const save = async (opts?: { resetSystemPrompt?: boolean }) => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const body: Record<string, unknown> = {
        enabled,
        baseUrl,
        model,
        countries: countryList,
        autoCountries,
      };
      if (apiKey.trim() && !apiKey.includes("•")) {
        body.apiKey = apiKey.trim();
      }
      if (opts?.resetSystemPrompt) {
        body.resetSystemPrompt = true;
      } else {
        body.systemPrompt = systemPrompt;
      }
      const res = await fetch("/api/admin/settings/blog-ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");

      const s = data.settings as {
        systemPrompt?: string;
        hasCustomSystemPrompt?: boolean;
      };
      if (s?.systemPrompt != null) setSystemPrompt(s.systemPrompt);
      if (s?.hasCustomSystemPrompt != null) setHasCustom(s.hasCustomSystemPrompt);

      setMessage(
        opts?.resetSystemPrompt
          ? "System prompt reset to default and saved."
          : "Blog AI settings saved."
      );
      setApiKey("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="default" padding="lg" className="space-y-5 border-fuchsia-400/15">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MagicWand size={18} className="text-fuchsia-300" />
          <h3 className="text-sm font-semibold text-text-primary">
            Blog AI auto articles
          </h3>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={`relative h-7 w-12 rounded-full transition-colors cursor-pointer ${
            enabled ? "bg-emerald-500/80" : "bg-zinc-600"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      <p className="text-xs text-text-muted leading-relaxed">
        Master switch for AI article generation. When{" "}
        <strong className="text-text-secondary">OFF</strong>, Generate is
        blocked. Configure an OpenAI-compatible endpoint (OpenAI, OpenRouter,
        Groq, Azure, self-hosted, etc.).
      </p>
      <p className="text-xs rounded-xl border border-emerald-400/25 bg-emerald-400/5 px-3 py-2 text-emerald-200/90 leading-relaxed">
        <strong className="text-emerald-300">Scope lock:</strong> AI hanya
        untuk draft artikel blog. Tidak bisa masuk admin, payment, order, user,
        DB, atau sistem webapp lain. Output = JSON artikel saja; publish tetap
        manual oleh admin.
      </p>

      <Input
        label="AI Base URL"
        placeholder="https://api.openai.com/v1"
        value={baseUrl}
        onChange={(e) => setBaseUrl(e.target.value)}
      />
      <Input
        label={
          initial.hasApiKey
            ? "API Key (leave blank to keep current)"
            : "API Key"
        }
        type="password"
        placeholder={
          initial.hasApiKey ? "•••• currently set ••••" : "sk-…"
        }
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        autoComplete="off"
      />
      <Input
        label="Model"
        placeholder="gpt-4o-mini"
        value={model}
        onChange={(e) => setModel(e.target.value)}
      />
      <Input
        label="Available countries (comma-separated)"
        placeholder="ID,MY,US,GLOBAL"
        value={countries}
        onChange={(e) => setCountries(e.target.value)}
      />

      <div className="space-y-2">
        <p className="text-sm font-medium text-text-secondary">
          Enable auto AI for countries
        </p>
        <p className="text-xs text-text-muted">
          Checked countries can be selected when generating articles. Unchecked
          = human-only for that market.
        </p>
        <div className="flex flex-wrap gap-2">
          {(countryList.length ? countryList : SUGGESTED).map((code) => {
            const on = autoCountries.includes(code);
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggleAuto(code)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  on
                    ? "border-fuchsia-400/40 bg-fuchsia-400/15 text-fuchsia-200"
                    : "border-border text-text-muted hover:text-text-primary"
                }`}
              >
                {on ? "✓ " : ""}
                {code}
              </button>
            );
          })}
        </div>
      </div>

      {/* Editable system prompt */}
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium text-text-secondary">
              System prompt (editable)
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              Instruksi utama ke AI saat generate artikel. Topic + negara tetap
              dikirim terpisah. Scope lock immutable (blog-only) selalu ditambah
              otomatis di server — tidak bisa di-override dari sini.{" "}
              {hasCustom ? (
                <span className="text-fuchsia-300">Custom prompt aktif.</span>
              ) : (
                <span className="text-text-muted">Menggunakan default bawaan.</span>
              )}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => {
              setSystemPrompt(initial.defaultSystemPrompt);
              void save({ resetSystemPrompt: true });
            }}
          >
            <ArrowCounterClockwise size={14} />
            Reset default
          </Button>
        </div>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={14}
          spellCheck={false}
          className="w-full rounded-xl bg-bg-card border border-border px-3 py-2.5 text-xs font-mono text-text-primary placeholder:text-text-muted leading-relaxed resize-y min-h-[200px] focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
          placeholder={initial.defaultSystemPrompt}
        />
        <p className="text-[10px] text-text-muted">
          {systemPrompt.length.toLocaleString()} characters · max ~12,000
        </p>
      </div>

      {message ? (
        <p className="text-xs text-emerald-400">{message}</p>
      ) : null}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      <Button onClick={() => save()} disabled={saving}>
        {saving ? (
          <SpinnerGap size={16} className="animate-spin" />
        ) : null}
        {saving ? "Saving…" : "Save Blog AI settings"}
      </Button>
    </Card>
  );
}
