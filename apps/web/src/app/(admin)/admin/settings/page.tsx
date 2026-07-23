import {
  DEFAULT_BLOG_AI_SYSTEM_PROMPT,
  getBlogAiSettings,
} from "@/lib/settings";
import BlogAiSettingsForm from "./BlogAiSettingsForm";
import { Card } from "@kupon/ui";
import { Key, Bell, Globe } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const ai = await getBlogAiSettings();
  const key = ai.apiKey;
  const masked =
    key.length > 8
      ? `${key.slice(0, 4)}${"•".repeat(Math.min(key.length - 8, 12))}${key.slice(-4)}`
      : key
        ? "••••••••"
        : "";

  return (
    <div className="max-w-2xl space-y-6">
      <BlogAiSettingsForm
        initial={{
          enabled: ai.enabled,
          baseUrl: ai.baseUrl,
          apiKey: masked,
          hasApiKey: Boolean(key),
          model: ai.model,
          countries: ai.countries.join(","),
          autoCountries: ai.autoCountries,
          systemPrompt: ai.systemPrompt,
          hasCustomSystemPrompt: ai.hasCustomSystemPrompt,
          defaultSystemPrompt: DEFAULT_BLOG_AI_SYSTEM_PROMPT,
          scheduleEnabled: ai.scheduleEnabled,
          intervalHours: ai.intervalHours,
          articlesPerRun: ai.articlesPerRun,
          autoPublish: ai.autoPublish,
          lastRunAt: ai.lastRunAt,
          intervalOptions: [1, 2, 4, 8, 12],
          countOptions: [1, 2, 5, 6, 7, 8, 10, 12],
        }}
      />

      {/* Payments — env only (security) */}
      <Card variant="default" padding="lg" className="space-y-3">
        <div className="flex items-center gap-2">
          <Key size={18} className="text-accent" />
          <h3 className="text-sm font-semibold text-text-primary">
            Cryptomus (env only)
          </h3>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Payment secrets stay in server environment variables — not editable
          from the browser. Set{" "}
          <code className="text-text-secondary">CRYPTOMUS_MERCHANT_ID</code>,{" "}
          <code className="text-text-secondary">CRYPTOMUS_PAYMENT_API_KEY</code>
          , and{" "}
          <code className="text-text-secondary">CRYPTOMUS_CURRENCIES</code> on
          the VPS.
        </p>
      </Card>

      {/* Discord sales */}
      <Card variant="default" padding="lg" className="space-y-3">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-emerald-400" />
          <h3 className="text-sm font-semibold text-text-primary">
            Sales → Discord
          </h3>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Paid orders are sent to{" "}
          <code className="text-text-secondary">DISCORD_WEBHOOK_URL</code>{" "}
          (sales channel only). Fraud uses{" "}
          <code className="text-text-secondary">DISCORD_FRAUD_WEBHOOK_URL</code>
          . Also logged under{" "}
          <span className="text-emerald-300 font-medium">Sales</span> on the
          Logs page.
        </p>
      </Card>

      <Card variant="glass" padding="md">
        <div className="flex items-center gap-2 mb-2">
          <Globe size={18} className="text-accent" />
          <h3 className="text-sm font-semibold text-text-primary">Site</h3>
        </div>
        <p className="text-xs text-text-muted">
          Public site URL:{" "}
          <code className="text-text-secondary">
            {process.env.NEXT_PUBLIC_APP_URL || "not set"}
          </code>
        </p>
      </Card>
    </div>
  );
}
