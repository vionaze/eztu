import {
  DEFAULT_BLOG_AI_SYSTEM_PROMPT,
  getBlogAiSettings,
} from "@/lib/settings";
import BlogAiSettingsForm from "./BlogAiSettingsForm";
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
    <>
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

      {/* Infra info bento */}
      <div className="admin-bento admin-bento-3">
        <div className="admin-tile">
          <div className="flex items-center gap-2">
            <Key size={16} className="text-accent shrink-0" />
            <p className="admin-tile-title">Cryptomus</p>
          </div>
          <p className="admin-tile-desc">
            Secrets hanya di env VPS:{" "}
            <code className="text-text-secondary">CRYPTOMUS_*</code> — tidak
            diedit dari browser.
          </p>
        </div>
        <div className="admin-tile">
          <div className="flex items-center gap-2">
            <Key size={16} className="text-accent shrink-0" />
            <p className="admin-tile-title">Pakasir</p>
          </div>
          <p className="admin-tile-desc">
            Dikontrol hanya dari env VPS: {" "}
            <code className="text-text-secondary">PAKASIR_ENABLED</code>, {" "}
            <code className="text-text-secondary">PAKASIR_PROJECT_SLUG</code>,
            dan <code className="text-text-secondary">PAKASIR_API_KEY</code>.
          </p>
        </div>
        <div className="admin-tile">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-emerald-400 shrink-0" />
            <p className="admin-tile-title">Sales → Discord</p>
          </div>
          <p className="admin-tile-desc">
            Paid orders →{" "}
            <code className="text-text-secondary">DISCORD_WEBHOOK_URL</code>.
            Fraud →{" "}
            <code className="text-text-secondary">DISCORD_FRAUD_WEBHOOK_URL</code>
            .
          </p>
        </div>
        <div className="admin-tile">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-accent shrink-0" />
            <p className="admin-tile-title">Site URL</p>
          </div>
          <p className="admin-tile-desc font-mono break-all">
            {process.env.NEXT_PUBLIC_APP_URL || "not set"}
          </p>
        </div>
      </div>
    </>
  );
}
