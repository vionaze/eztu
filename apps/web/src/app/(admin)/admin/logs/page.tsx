import Link from "next/link";
import { prisma, type AppLogCategory } from "@kupon/db";
import { Card } from "@kupon/ui";
import { LOG_CATEGORY_META } from "@/lib/app-log";
import { cn, formatAdminDateTime } from "@/lib/utils";

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
  searchParams: Promise<{ category?: string; level?: string }>;
}) {
  const params = await searchParams;
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
    <div className="space-y-6">
      {/* Legend — human-first */}
      <Card padding="md" className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            What am I looking at?
          </h2>
          <p className="text-xs text-text-muted mt-1 max-w-2xl leading-relaxed">
            Every important action in the webapp is recorded here. Titles are
            color-coded by category so you can scan quickly — green for money
            (Sales), blue for payments, purple for delivery, amber for login,
            red for security, pink for blog, orange for admin changes. Times
            are shown in <strong className="text-text-secondary">WIB (GMT+7, Asia/Jakarta)</strong>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/logs"
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
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
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
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
        <div className="flex flex-wrap gap-2 pt-1">
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

      <div className="space-y-2">
        {logs.length === 0 ? (
          <Card padding="lg" className="text-center text-sm text-text-muted">
            No logs yet for this filter. Sales, payments, and admin actions will
            appear here automatically.
          </Card>
        ) : (
          logs.map((log) => {
            const meta = LOG_CATEGORY_META[log.category];
            return (
              <Card
                key={log.id}
                padding="none"
                className="px-4 py-3 flex gap-3 items-start"
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
        <p className="text-xs text-text-muted text-center">
          Showing latest 200 entries. Use category filters to narrow down.
        </p>
      ) : null}
    </div>
  );
}
