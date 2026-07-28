"use client";

import { useMemo, useState } from "react";
import { Button, Input } from "@kupon/ui";
import {
  MagicWand,
  SpinnerGap,
  ArrowCounterClockwise,
  Clock,
  Play,
  Plus,
  X,
} from "@phosphor-icons/react";
import {
  BLOG_AI_MODEL_SUGGESTIONS,
  DEFAULT_BLOG_AI_BASE_URL,
  DEFAULT_BLOG_AI_COUNTRIES,
  DEFAULT_BLOG_AI_MODEL,
} from "@/lib/blog-ai-defaults";

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
  scheduleEnabled: boolean;
  intervalHours: number;
  articlesPerRun: number;
  autoPublish: boolean;
  lastRunAt: string | null;
  intervalOptions: number[];
  countOptions: number[];
};

/** Quick-add presets (not locked — you can add any ISO-like code). */
const SUGGESTED = [...DEFAULT_BLOG_AI_COUNTRIES];

function normalizeCountryCode(raw: string) {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 12);
}

export default function BlogAiSettingsForm({ initial }: { initial: Initial }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(initial.model);
  const [countryList, setCountryList] = useState<string[]>(() =>
    initial.countries
      .split(",")
      .map((c) => normalizeCountryCode(c))
      .filter(Boolean)
  );
  const [autoCountries, setAutoCountries] = useState<string[]>(
    initial.autoCountries.map(normalizeCountryCode).filter(Boolean)
  );
  const [newCountry, setNewCountry] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(initial.systemPrompt);
  const [hasCustom, setHasCustom] = useState(initial.hasCustomSystemPrompt);
  const [scheduleEnabled, setScheduleEnabled] = useState(
    initial.scheduleEnabled
  );
  const [intervalHours, setIntervalHours] = useState(initial.intervalHours);
  const [articlesPerRun, setArticlesPerRun] = useState(initial.articlesPerRun);
  const [autoPublish, setAutoPublish] = useState(initial.autoPublish);
  const [lastRunAt, setLastRunAt] = useState(initial.lastRunAt);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const presetToAdd = useMemo(
    () => SUGGESTED.filter((c) => !countryList.includes(c)),
    [countryList]
  );

  const addCountry = (raw: string) => {
    const code = normalizeCountryCode(raw);
    if (!code) return;
    setCountryList((prev) => {
      if (prev.includes(code)) return prev;
      return [...prev, code];
    });
    setNewCountry("");
  };

  const removeCountry = (code: string) => {
    setCountryList((prev) => prev.filter((c) => c !== code));
    // Also drop from auto-AI selection
    setAutoCountries((prev) => prev.filter((c) => c !== code));
  };

  const toggleAuto = (code: string) => {
    if (!countryList.includes(code)) return;
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
        // Only keep auto flags for countries that still exist in the list
        autoCountries: autoCountries.filter((c) => countryList.includes(c)),
        scheduleEnabled,
        intervalHours,
        articlesPerRun,
        autoPublish,
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
        lastRunAt?: string | null;
      };
      if (s?.systemPrompt != null) setSystemPrompt(s.systemPrompt);
      if (s?.hasCustomSystemPrompt != null) setHasCustom(s.hasCustomSystemPrompt);
      if (s?.lastRunAt !== undefined) setLastRunAt(s.lastRunAt ?? null);

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

  const runNow = async () => {
    setRunning(true);
    setMessage("");
    setError("");
    try {
      // Persist prefs first so the batch uses the latest count/countries
      const saveRes = await fetch("/api/admin/settings/blog-ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          baseUrl,
          model,
          countries: countryList,
          autoCountries: autoCountries.filter((c) => countryList.includes(c)),
          scheduleEnabled,
          intervalHours,
          articlesPerRun,
          autoPublish,
          systemPrompt,
          ...(apiKey.trim() && !apiKey.includes("•")
            ? { apiKey: apiKey.trim() }
            : {}),
        }),
      });
      if (!saveRes.ok) {
        const d = await saveRes.json().catch(() => ({}));
        throw new Error(d.error || "Could not save settings before run");
      }

      const res = await fetch("/api/admin/blog/auto-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: articlesPerRun,
          publish: autoPublish,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Run failed");

      const created = (data.created || []) as {
        title: string;
        country: string;
      }[];
      const errs = (data.errors || []) as string[];
      if (data.skipped) {
        setMessage(`Skipped: ${data.reason || "not ready"}`);
      } else {
        setMessage(
          `Created ${created.length} article(s)` +
            (created.length
              ? `: ${created
                  .map((c) => `[${c.country}] ${c.title}`)
                  .join(" · ")}`
              : "") +
            (errs.length ? ` · Errors: ${errs.join("; ")}` : "")
        );
        setLastRunAt(new Date().toISOString());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Master + scope */}
      <div className="admin-bento admin-bento-2">
        <div className="admin-tile border-fuchsia-400/15 lg:col-span-1">
          <div className="admin-tile-header">
            <div className="flex items-center gap-2 min-w-0">
              <MagicWand size={16} className="text-fuchsia-300 shrink-0" />
              <div>
                <p className="admin-tile-title">Blog AI</p>
                <p className="admin-tile-desc">
                  Master switch — OFF memblokir generate &amp; cron.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled((v) => !v)}
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
        <div className="admin-tile border-sky-400/15 bg-sky-400/[0.04]">
          <p className="text-xs leading-relaxed text-sky-100/90">
            <strong className="text-sky-300">Scope:</strong> hanya konten{" "}
            <strong>BlogPost</strong> (generate / publish blog). Tidak menyentuh
            payment, order, user, atau admin lain.
          </p>
        </div>
      </div>

      {/* API credentials bento */}
      <div className="admin-tile">
        <div>
          <p className="admin-tile-title">API connection</p>
          <p className="admin-tile-desc">
            OpenAI-compatible endpoint (OpenAI, OpenRouter, Groq, …)
          </p>
        </div>
        <div className="admin-bento admin-bento-3 admin-field-stack !gap-3">
          <div className="lg:col-span-2">
            <Input
              label="Base URL"
              placeholder={DEFAULT_BLOG_AI_BASE_URL}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
          <div>
            <Input
              label="Model"
              list="blog-ai-model-options"
              placeholder={DEFAULT_BLOG_AI_MODEL}
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
            <datalist id="blog-ai-model-options">
              {BLOG_AI_MODEL_SUGGESTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  label={option.label}
                />
              ))}
            </datalist>
            <p className="mt-1.5 text-[11px] leading-relaxed text-text-muted">
              Recommended: <code>{DEFAULT_BLOG_AI_MODEL}</code> untuk
              multilingual article dengan balance intelligence dan cost.
            </p>
          </div>
          <div className="lg:col-span-3">
            <Input
              label={
                initial.hasApiKey
                  ? "API Key (kosongkan = tetap pakai yang tersimpan)"
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
          </div>
        </div>
      </div>

      {/* Countries + schedule side by side on lg */}
      <div className="admin-bento admin-bento-2">
        {/* Countries */}
        <div className="admin-tile">
          <div>
            <p className="admin-tile-title">Negara / market</p>
            <p className="admin-tile-desc">
              Chip editable — dipakai form artikel &amp; jadwal AI.
            </p>
          </div>

          {countryList.length === 0 ? (
            <p className="text-xs text-amber-400">
              Belum ada negara. Tambah minimal satu.
            </p>
          ) : (
            <div className="admin-chip-row">
              {countryList.map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-0.5 rounded-full border border-border bg-bg-elevated/50 pl-2.5 pr-0.5 py-0.5 text-[11px] font-medium text-text-primary"
                >
                  {code}
                  <button
                    type="button"
                    onClick={() => removeCountry(code)}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-400/10 cursor-pointer"
                    aria-label={`Hapus ${code}`}
                  >
                    <X size={10} weight="bold" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex-1 min-w-0">
              <Input
                label="Tambah kode"
                placeholder="ID, MY, BR…"
                value={newCountry}
                onChange={(e) => setNewCountry(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCountry(newCountry);
                  }
                }}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => addCountry(newCountry)}
              disabled={!normalizeCountryCode(newCountry)}
            >
              <Plus size={14} weight="bold" />
              Add
            </Button>
          </div>

          {presetToAdd.length > 0 ? (
            <div className="admin-chip-row">
              {presetToAdd.slice(0, 8).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => addCountry(code)}
                  className="rounded-md border border-dashed border-border px-1.5 py-0.5 text-[10px] text-text-muted hover:text-accent hover:border-accent/40 cursor-pointer"
                >
                  +{code}
                </button>
              ))}
            </div>
          ) : null}

          <div className="pt-2 border-t border-border/80 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-text-secondary">
                Auto-generate aktif
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAutoCountries([...countryList])}
                  disabled={
                    countryList.length === 0 ||
                    autoCountries.length === countryList.length
                  }
                  className="rounded-md border border-fuchsia-400/30 px-2 py-1 text-[10px] font-medium text-fuchsia-200 transition-colors hover:border-fuchsia-400/60 hover:bg-fuchsia-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setAutoCountries([])}
                  disabled={autoCountries.length === 0}
                  className="rounded-md border border-border px-2 py-1 text-[10px] font-medium text-text-muted transition-colors hover:border-white/20 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Unselect all
                </button>
              </div>
            </div>
            <div className="admin-chip-row">
              {countryList.map((code) => {
                const on = autoCountries.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleAuto(code)}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium cursor-pointer ${
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
        </div>

        {/* Schedule */}
        <div className="admin-tile">
          <div className="admin-tile-header">
            <div className="flex items-center gap-2 min-w-0">
              <Clock size={16} className="text-amber-300 shrink-0" />
              <div>
                <p className="admin-tile-title">Jadwal otomatis</p>
                <p className="admin-tile-desc">
                  Cron hourly · throttle by interval
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={scheduleEnabled}
              onClick={() => setScheduleEnabled((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
                scheduleEnabled ? "bg-amber-500/80" : "bg-zinc-600"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  scheduleEnabled ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-text-secondary">
              Interval
            </p>
            <div className="admin-chip-row">
              {(initial.intervalOptions.length
                ? initial.intervalOptions
                : [1, 2, 4, 8, 12]
              ).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setIntervalHours(h)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium cursor-pointer ${
                    intervalHours === h
                      ? "border-amber-400/50 bg-amber-400/15 text-amber-200"
                      : "border-border text-text-muted hover:text-text-primary"
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-text-secondary">
              Artikel / run
            </p>
            <div className="admin-chip-row">
              {(initial.countOptions.length
                ? initial.countOptions
                : [1, 2, 5, 6, 7, 8, 10, 12]
              ).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setArticlesPerRun(n)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium cursor-pointer ${
                    articlesPerRun === n
                      ? "border-fuchsia-400/50 bg-fuchsia-400/15 text-fuchsia-200"
                      : "border-border text-text-muted hover:text-text-primary"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-bg-elevated/30 px-2.5 py-2">
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-text-secondary">
                Auto-publish
              </p>
              <p className="text-[10px] text-text-muted">Live di /blog</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoPublish}
              onClick={() => setAutoPublish((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full cursor-pointer ${
                autoPublish ? "bg-emerald-500/80" : "bg-zinc-600"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  autoPublish ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          <p className="text-[10px] text-text-muted font-mono">
            {lastRunAt
              ? `Last: ${new Date(lastRunAt).toLocaleString()}`
              : "Belum pernah dijalankan"}
          </p>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={runNow}
            disabled={running || saving || !enabled}
            className="w-full sm:w-auto"
          >
            {running ? (
              <SpinnerGap size={14} className="animate-spin" />
            ) : (
              <Play size={14} weight="fill" />
            )}
            {running ? "Running…" : "Run now"}
          </Button>
        </div>
      </div>

      {/* Prompt full width */}
      <div className="admin-tile">
        <div className="admin-tile-header">
          <div>
            <p className="admin-tile-title">System prompt</p>
            <p className="admin-tile-desc">
              Scope lock blog-only ditambah server.{" "}
              {hasCustom ? (
                <span className="text-fuchsia-300">Custom aktif.</span>
              ) : (
                <span>Default bawaan.</span>
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
            Reset
          </Button>
        </div>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={10}
          spellCheck={false}
          className="w-full rounded-xl bg-bg-elevated/40 border border-border px-3 py-2.5 text-xs font-mono text-text-primary leading-relaxed resize-y min-h-[140px] focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
          placeholder={initial.defaultSystemPrompt}
        />
      </div>

      {(message || error) && (
        <div className="space-y-1">
          {message ? (
            <p className="text-xs text-emerald-400 whitespace-pre-wrap">
              {message}
            </p>
          ) : null}
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-0.5">
        <Button onClick={() => save()} disabled={saving || running}>
          {saving ? <SpinnerGap size={16} className="animate-spin" /> : null}
          {saving ? "Saving…" : "Save Blog AI settings"}
        </Button>
      </div>
    </div>
  );
}
