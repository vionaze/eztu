"use client";

import { useState } from "react";
import { Button, Card, Input } from "@kupon/ui";
import {
  MagicWand,
  SpinnerGap,
  ArrowCounterClockwise,
  Clock,
  Play,
} from "@phosphor-icons/react";

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
          autoCountries,
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
        <strong className="text-text-secondary">OFF</strong>, manual generate
        and scheduled jobs are blocked.
      </p>
      <p className="text-xs rounded-xl border border-sky-400/25 bg-sky-400/5 px-3 py-2 text-sky-100/90 leading-relaxed">
        <strong className="text-sky-300">Scope:</strong> AI hanya membuat konten{" "}
        <strong>BlogPost</strong> (generate + optional auto-publish ke storefront
        blog). Tidak menyentuh payment, order, user, atau admin lain.
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
        placeholder={initial.hasApiKey ? "•••• currently set ••••" : "sk-…"}
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
          Negara / bahasa untuk AI (centang)
        </p>
        <p className="text-xs text-text-muted">
          Artikel otomatis di-rotate ke negara yang dicentang (bahasa mengikuti
          negara: ID→Indonesia, MY→EN-MY, dll.).
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

      {/* Schedule */}
      <div className="space-y-4 pt-2 border-t border-border">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-amber-300" />
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Jadwal artikel otomatis
              </p>
              <p className="text-xs text-text-muted">
                Cron hit hourly; sistem jalan sesuai interval di bawah.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={scheduleEnabled}
            onClick={() => setScheduleEnabled((v) => !v)}
            className={`relative h-7 w-12 rounded-full transition-colors cursor-pointer ${
              scheduleEnabled ? "bg-amber-500/80" : "bg-zinc-600"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                scheduleEnabled ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-text-secondary">
            Interval
          </p>
          <div className="flex flex-wrap gap-2">
            {(initial.intervalOptions.length
              ? initial.intervalOptions
              : [1, 2, 4, 8, 12]
            ).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setIntervalHours(h)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                  intervalHours === h
                    ? "border-amber-400/50 bg-amber-400/15 text-amber-200"
                    : "border-border text-text-muted hover:text-text-primary"
                }`}
              >
                Setiap {h} jam
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-text-secondary">
            Jumlah artikel per run
          </p>
          <div className="flex flex-wrap gap-2">
            {(initial.countOptions.length
              ? initial.countOptions
              : [1, 2, 5, 6, 7, 8, 10, 12]
            ).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setArticlesPerRun(n)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                  articlesPerRun === n
                    ? "border-fuchsia-400/50 bg-fuchsia-400/15 text-fuchsia-200"
                    : "border-border text-text-muted hover:text-text-primary"
                }`}
              >
                {n} artikel
              </button>
            ))}
          </div>
          <p className="text-[11px] text-text-muted">
            Contoh: 6 artikel + negara ID,MY → dirotasi ID, MY, ID, MY, ID, MY.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-elevated/40 px-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-text-secondary">
              Auto-publish
            </p>
            <p className="text-xs text-text-muted">
              ON = langsung live di /blog. OFF = simpan sebagai draft.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoPublish}
            onClick={() => setAutoPublish((v) => !v)}
            className={`relative h-7 w-12 rounded-full transition-colors cursor-pointer ${
              autoPublish ? "bg-emerald-500/80" : "bg-zinc-600"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                autoPublish ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>

        {lastRunAt ? (
          <p className="text-[11px] text-text-muted font-mono">
            Last run: {new Date(lastRunAt).toLocaleString()}
          </p>
        ) : (
          <p className="text-[11px] text-text-muted">Belum pernah dijalankan.</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={runNow}
            disabled={running || saving || !enabled}
          >
            {running ? (
              <SpinnerGap size={16} className="animate-spin" />
            ) : (
              <Play size={16} weight="fill" />
            )}
            {running ? "Running…" : "Run now"}
          </Button>
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
              Scope lock blog-only tetap ditambah di server.{" "}
              {hasCustom ? (
                <span className="text-fuchsia-300">Custom prompt aktif.</span>
              ) : (
                <span className="text-text-muted">Default bawaan.</span>
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
          rows={12}
          spellCheck={false}
          className="w-full rounded-xl bg-bg-card border border-border px-3 py-2.5 text-xs font-mono text-text-primary placeholder:text-text-muted leading-relaxed resize-y min-h-[180px] focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
          placeholder={initial.defaultSystemPrompt}
        />
      </div>

      {message ? (
        <p className="text-xs text-emerald-400 whitespace-pre-wrap">{message}</p>
      ) : null}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      <Button onClick={() => save()} disabled={saving || running}>
        {saving ? <SpinnerGap size={16} className="animate-spin" /> : null}
        {saving ? "Saving…" : "Save Blog AI settings"}
      </Button>
    </Card>
  );
}
