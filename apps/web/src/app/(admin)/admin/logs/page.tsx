import Link from "next/link";
import { prisma, type AppLogCategory } from "@kupon/db";
import { Card } from "@kupon/ui";
import { LOG_CATEGORY_META } from "@/lib/app-log";
import { cn, formatAdminDateTime } from "@/lib/utils";
import { SecurityBlocksClient } from "./SecurityBlocksClient";

export const dynamic = "force-dynamic";

const ALL_CATEGORIES = Object.keys(LOG_CATEGORY_META) as AppLogCategory[];

const LEVEL_STYLES: Record<string, string> = {
  INFO: "text-zinc-400",
  SUCCESS: "text-emerald-400",
  WARNING: "text-amber-400",
  ERROR: "text-red-400",
};

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; level?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const tab = (params.tab || "activity").toLowerCase();
  const categoryRaw = (params.category || "ALL").toUpperCase();
  const levelRaw = (params.level || "ALL").toUpperCase();

  const category =
    categoryRaw !== "ALL" && ALL_CATEGORIES.includes(categoryRaw as AppLogCategory)
      ? (categoryRaw as AppLogCategory)
      : null;
  const level =
    levelRaw !== "ALL" &&
    ["INFO", "SUCCESS", "WARNING", "ERROR"].includes(levelRaw)
      ? levelRaw
      : null;

  if (tab === "security") {
    const [events, blocks] = await Promise.all([
      prisma.securityEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 80,
      }),
      prisma.accessBlock.findMany({
        where: { active: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    return (
      <>
        <Card padding="sm" className="space-y-2.5 !p-3 sm:!p-3.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-[13px] font-semibold text-text-primary">
                Security & access blocks
              </h2>
              <p className="admin-hint mt-0.5 max-w-3xl">
                Fraud/automation signals and preventive bans.{" "}
                <strong className="text-text-secondary">Block</strong> stops
                checkout + account APIs for that email/IP/user. Not a DNS/site-wide
                wall — Clerk may still show login UI until session ends.
              </p>
            </div>
            <div className="flex gap-1.5">
              <Link
                href="/admin/logs"
                className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-text-muted hover:text-text-primary"
              >
                Activity
              </Link>
              <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[11px] text-text-primary">
                Security
              </span>
            </div>
          </div>
        </Card>

        <SecurityBlocksClient
          events={events.map((e) => ({
            ...e,
            createdAt: e.createdAt.toISOString(),
          }))}
          blocks={blocks.map((b) => ({
            ...b,
            createdAt: b.createdAt.toISOString(),
          }))}
        />
      </>
    );
  }

  const [logs, counts] = await Promise.all([
    prisma.appLog.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(level ? { level: level as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.appLog.groupBy({
      by: ["category"],
      _count: { _all: true },
    }),
  ]);

  const countMap = Object.fromEntries(
    counts.map((c) => [c.category, c._count._all])
  ) as Partial<Record<AppLogCategory, number>>;

  const total = counts.reduce((sum, c) => sum + c._count._all, 0);

  return (
    <>
      <Card padding="sm" className="space-y-2.5 !p-3 sm:!p-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[13px] font-semibold text-text-primary">
              What am I looking at?
            </h2>
            <p className="admin-hint mt-0.5 max-w-3xl">
              Color-coded activity — Sales, Payment, Fulfillment, Auth, Security,
              Blog, Admin. Times in{" "}
              <strong className="text-text-secondary">WIB (GMT+7)</strong>.
            </p>
          </div>
          <div className="flex gap-1.5">
            <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[11px] text-text-primary">
              Activity
            </span>
            <Link
              href="/admin/logs?tab=security"
              className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-text-muted hover:text-text-primary"
            >
              Security
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Link
            href="/admin/logs"
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
              !category
                ? "border-white/20 bg-white/10 text-text-primary"
                : "border-border text-text-muted hover:text-text-primary"
            )}
          >
            All ({total})
          </Link>
          {ALL_CATEGORIES.map((cat) => {
            const meta = LOG_CATEGORY_META[cat];
            const active = category === cat;
            return (
              <Link
                key={cat}
                href={`/admin/logs?category=${cat}${level ? `&level=${level}` : ""}`}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                  meta.badge,
                  active ? "ring-1 ring-white/30" : "opacity-80 hover:opacity-100"
                )}
              >
                {meta.label}
                {countMap[cat] != null ? ` (${countMap[cat]})` : ""}
              </Link>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["ALL", "INFO", "SUCCESS", "WARNING", "ERROR"].map((lv) => {
            const href =
              lv === "ALL"
                ? category
                  ? `/admin/logs?category=${category}`
                  : "/admin/logs"
                : `/admin/logs?${category ? `category=${category}&` : ""}level=${lv}`;
            const active = (level || "ALL") === lv;
            return (
              <Link
                key={lv}
                href={href}
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-md border transition-colors",
                  active
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border text-text-muted hover:text-text-primary"
                )}
              >
                {lv}
              </Link>
            );
          })}
        </div>
      </Card>

      <div className="space-y-1.5">
        {logs.length === 0 ? (
          <Card padding="md" className="text-center text-[13px] text-text-muted py-5">
            No logs yet for this filter.
          </Card>
        ) : (
          logs.map((log) => {
            const meta = LOG_CATEGORY_META[log.category];
            return (
              <Card
                key={log.id}
                padding="none"
                className="px-3 py-2 flex gap-2.5 items-start"
              >
                <div className="pt-0.5 shrink-0">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      meta.badge
                    )}
                  >
                    {meta.label}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <h3
                      className={cn(
                        "text-sm font-semibold leading-snug",
                        meta.color
                      )}
                    >
                      {log.title}
                    </h3>
                    <time
                      className="text-[11px] text-text-muted font-mono shrink-0"
                      title="Asia/Jakarta (GMT+7)"
                    >
                      {formatAdminDateTime(log.createdAt)}
                    </time>
                  </div>
                  {log.message ? (
                    <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                      {log.message}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[10px] text-text-muted">
                    <span className={LEVEL_STYLES[log.level] || ""}>
                      {log.level}
                    </span>
                    {log.actor ? <span>by {log.actor}</span> : null}
                    {log.route ? (
                      <span className="font-mono truncate max-w-[200px]">
                        {log.route}
                      </span>
                    ) : null}
                    {log.orderId ? (
                      <Link
                        href={`/admin/orders?q=${log.orderId}`}
                        className="text-accent hover:underline font-mono"
                      >
                        order
                      </Link>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {logs.length >= 200 ? (
        <p className="admin-hint text-center">
          Showing latest 200 entries. Use category filters to narrow down.
        </p>
      ) : null}
    </>
  );
}
