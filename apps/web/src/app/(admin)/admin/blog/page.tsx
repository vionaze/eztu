import Link from "next/link";
import Image from "next/image";
import { prisma } from "@kupon/db";
import { Badge, Button, Card } from "@kupon/ui";
import { Plus, Article } from "@phosphor-icons/react/dist/ssr";
import BlogDeleteButton from "./BlogDeleteButton";
import { formatAdminDateTimeShort } from "@/lib/utils";
import BlogPromptBackfillButton from "./BlogPromptBackfillButton";
import {
  addReportDays,
  buildBlogVisitorReport,
  getJakartaDay,
  getRecentBlogAnalyticsMonths,
  selectBlogAnalyticsMonth,
} from "@/lib/blog-analytics";

export const dynamic = "force-dynamic";

interface AdminBlogPageProps {
  searchParams: Promise<{ month?: string | string[] }>;
}

function formatVisitors(value: number) {
  return value.toLocaleString("id-ID");
}

export default async function AdminBlogPage({
  searchParams,
}: AdminBlogPageProps) {
  const now = new Date();
  const months = getRecentBlogAnalyticsMonths(now);
  const requestedMonth = (await searchParams).month;
  const selectedMonth = selectBlogAnalyticsMonth(requestedMonth, months);
  const analyticsStart = months.at(-1)?.start ?? selectedMonth.start;
  const analyticsEnd = addReportDays(getJakartaDay(now), 1);

  const [posts, visitRows] = await Promise.all([
    prisma.blogPost.findMany({
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      include: {
        imageGenerations: {
          orderBy: { createdAt: "desc" },
          take: 6,
        },
      },
    }),
    prisma.blogPostDailyVisit.findMany({
      where: {
        day: {
          gte: analyticsStart,
          lt: analyticsEnd,
        },
      },
      select: {
        postId: true,
        visitorHash: true,
        day: true,
      },
    }),
  ]);

  const report = buildBlogVisitorReport(
    visitRows,
    selectedMonth,
    months,
    now
  );
  const publishedPostsByMonthViews = posts
    .filter((post) => post.published)
    .map((post) => ({
      id: post.id,
      title: post.title,
      countryCode: post.countryCode,
      visitors: report.selectedMonthByPost.get(post.id) ?? 0,
    }))
    .sort(
      (left, right) =>
        right.visitors - left.visitors ||
        left.title.localeCompare(right.title)
    );

  return (
    <>
      <div className="admin-page-toolbar">
        <div>
          <p className="text-[13px] text-text-secondary">
            {posts.length} post{posts.length === 1 ? "" : "s"}
          </p>
          <p className="admin-hint">
            Manual form default · AI helper opsional di New Post
          </p>
        </div>
        <div className="flex flex-wrap items-start justify-end gap-2">
          <BlogPromptBackfillButton />
          <Link href="/admin/blog/new">
            <Button size="sm">
              <Plus size={15} weight="bold" />
              New Post
            </Button>
          </Link>
        </div>
      </div>

      <section className="mb-5 space-y-3" aria-labelledby="visitor-report-title">
        <div>
          <h2
            id="visitor-report-title"
            className="text-sm font-semibold text-text-primary"
          >
            Laporan pengunjung artikel
          </h2>
          <p className="admin-hint">
            Browser unik yang memilih Accept all. Bot dan refresh berulang tidak
            dihitung.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            { label: "Hari ini", value: report.totals.today },
            { label: "7 hari", value: report.totals.sevenDays },
            { label: "30 hari", value: report.totals.thirtyDays },
            { label: "365 hari", value: report.totals.year },
          ].map((metric) => (
            <Card key={metric.label} padding="md" className="min-w-0">
              <p className="text-[11px] text-text-muted">{metric.label}</p>
              <p className="mt-1 font-mono text-xl font-semibold text-text-primary sm:text-2xl">
                {formatVisitors(metric.value)}
              </p>
              <p className="mt-0.5 text-[10px] text-text-muted">
                pengunjung unik
              </p>
            </Card>
          ))}
        </div>

        <Card padding="md" className="space-y-3">
          <div>
            <h3 className="text-[13px] font-semibold text-text-primary">
              Total per bulan
            </h3>
            <p className="text-[11px] text-text-muted">
              Dua belas bulan terakhir berdasarkan zona waktu Jakarta.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {report.monthlyTotals.map((month) => (
              <div
                key={month.key}
                className="rounded-xl border border-border bg-bg-elevated px-3 py-2.5"
              >
                <p className="truncate text-[10px] text-text-muted">
                  {month.label}
                </p>
                <p className="mt-1 font-mono text-base font-semibold text-text-primary">
                  {formatVisitors(month.visitors)}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card padding="md" className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-[13px] font-semibold text-text-primary">
                Rincian artikel per bulan
              </h3>
              <p className="text-[11px] text-text-muted">
                {formatVisitors(report.selectedMonthVisitors)} pengunjung unik
                pada {selectedMonth.label}.
              </p>
            </div>
            <form
              method="get"
              className="flex w-full items-end gap-2 sm:w-auto"
            >
              <label className="min-w-0 flex-1 sm:w-52">
                <span className="mb-1 block text-[10px] font-medium text-text-muted">
                  Pilih bulan
                </span>
                <select
                  name="month"
                  defaultValue={selectedMonth.key}
                  className="h-9 w-full rounded-lg border border-border bg-bg-elevated px-2.5 text-xs text-text-primary outline-none focus:border-accent"
                >
                  {months.map((month) => (
                    <option key={month.key} value={month.key}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" size="sm" variant="secondary">
                Tampilkan
              </Button>
            </form>
          </div>

          {publishedPostsByMonthViews.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-xs text-text-muted">
              Belum ada artikel terbit.
            </p>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border">
              {publishedPostsByMonthViews.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-text-primary">
                      {post.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-text-muted">
                      Market {post.countryCode}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-semibold text-text-primary">
                      {formatVisitors(post.visitors)}
                    </p>
                    <p className="text-[9px] text-text-muted">unik</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] leading-relaxed text-text-muted">
            Data periode mulai terkumpul setelah fitur ini di-deploy. Satu orang
            yang membaca beberapa artikel tetap dihitung satu pada total periode,
            tetapi muncul satu kali di setiap rincian artikel yang dibacanya.
          </p>
        </Card>
      </section>

      {posts.length === 0 ? (
        <Card padding="md" className="text-center py-6 space-y-2.5">
          <p className="text-[13px] text-text-muted">
            Belum ada artikel. Buat manual — AI tidak wajib.
          </p>
          <Link href="/admin/blog/new">
            <Button variant="secondary" size="sm">
              Tulis artikel
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => {
            const thumb = post.thumbnailImage || post.coverImage;
            const missingHero = !post.coverImage?.trim();
            const missingThumbnail = !post.thumbnailImage?.trim();
            const missingImages = missingHero || missingThumbnail;
            const latestImageGenerations = post.imageGenerations.filter(
              (generation, index, all) =>
                all.findIndex((item) => item.kind === generation.kind) === index
            );
            const imageGenerationActive = latestImageGenerations.some(
              (generation) =>
                ["SUBMITTING", "PROCESSING", "DOWNLOADING"].includes(
                  generation.status
                )
            );
            const imageGenerationFailed = latestImageGenerations.some(
              (generation) => generation.status === "FAILED"
            );
            return (
              <Card
                key={post.id}
                padding="none"
                className="flex flex-col items-stretch justify-between gap-3 px-3 py-3 sm:flex-row sm:items-center sm:py-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-bg-elevated shrink-0">
                    {thumb ? (
                      <Image
                        src={thumb}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="44px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Article size={16} className="text-text-muted" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-text-primary truncate">
                      {post.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <Badge variant={post.published ? "accent" : "muted"}>
                        {post.published ? "published" : "draft"}
                      </Badge>
                      {post.aiGenerated ? (
                        <Badge variant="muted">AI</Badge>
                      ) : null}
                      {post.heroImagePrompt && post.thumbnailImagePrompt ? (
                        <Badge variant="muted">prompts ready</Badge>
                      ) : null}
                      {imageGenerationActive ? (
                        <Badge variant="muted">KIE generating</Badge>
                      ) : null}
                      {imageGenerationFailed ? (
                        <Badge variant="muted">KIE failed</Badge>
                      ) : null}
                      {missingHero ? (
                        <Badge variant="muted">hero missing</Badge>
                      ) : null}
                      {missingThumbnail ? (
                        <Badge variant="muted">thumbnail missing</Badge>
                      ) : null}
                      <span className="text-[11px] text-text-muted">
                        {post.category || "—"} · {post.countryCode} ·{" "}
                        {formatAdminDateTimeShort(
                          post.publishedAt || post.createdAt
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border pt-2 sm:border-0 sm:pt-0">
                  <span className="text-[11px] font-mono text-text-muted hidden sm:block">
                    {post.views} legacy views
                  </span>
                  {post.published ? (
                    <Link
                      href={`/blog/${post.slug}`}
                      target="_blank"
                      className="text-[11px] text-accent hover:underline"
                    >
                      View
                    </Link>
                  ) : null}
                  <Link
                    href={`/admin/blog/${post.id}/edit`}
                    className={
                      missingImages
                        ? "rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
                        : "text-[11px] text-text-secondary hover:text-accent"
                    }
                  >
                    {imageGenerationActive
                      ? "Image status"
                      : imageGenerationFailed
                        ? "Retry images"
                        : missingImages
                          ? "Add images"
                          : "Edit"}
                  </Link>
                  <BlogDeleteButton id={post.id} title={post.title} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
