import { createHmac } from "node:crypto";

export const BLOG_VISITOR_COOKIE = "ezt_blog_visitor";
export const BLOG_VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const BLOG_ANALYTICS_TIME_ZONE = "Asia/Jakarta";

const VISITOR_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const BOT_USER_AGENT_PATTERN =
  /bot|crawler|spider|crawling|headless|preview|facebookexternalhit|whatsapp|telegrambot|discordbot|slackbot|bingpreview|googlebot|lighthouse|pagespeed|uptimerobot|curl|wget|python-requests|go-http-client|node-fetch/i;

type DateParts = {
  year: number;
  month: number;
  day: number;
};

export type BlogVisitRow = {
  postId: string;
  visitorHash: string;
  day: Date;
};

export type BlogAnalyticsPeriod = {
  start: Date;
  end: Date;
};

export type BlogAnalyticsMonth = BlogAnalyticsPeriod & {
  key: string;
  label: string;
};

export type BlogVisitorReport = {
  totals: {
    today: number;
    sevenDays: number;
    thirtyDays: number;
    year: number;
  };
  monthlyTotals: Array<BlogAnalyticsMonth & { visitors: number }>;
  selectedMonthVisitors: number;
  selectedMonthByPost: Map<string, number>;
};

function getDateParts(date: Date): DateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BLOG_ANALYTICS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
  };
}

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

export function addReportDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function getJakartaDay(date = new Date()) {
  const parts = getDateParts(date);
  return utcDate(parts.year, parts.month, parts.day);
}

export function isValidBlogVisitorId(value: string | undefined) {
  return Boolean(value && VISITOR_ID_PATTERN.test(value));
}

export function hashBlogVisitorId(visitorId: string, secret: string) {
  if (secret.trim().length < 32) {
    throw new Error("BLOG_VIEW_HASH_SECRET must contain at least 32 characters.");
  }

  return createHmac("sha256", secret).update(visitorId).digest("hex");
}

export function isLikelyBot(userAgent: string | null) {
  if (!userAgent?.trim()) return true;
  return BOT_USER_AGENT_PATTERN.test(userAgent);
}

export function getRecentBlogAnalyticsMonths(
  now = new Date(),
  count = 12
): BlogAnalyticsMonth[] {
  const parts = getDateParts(now);
  const currentMonth = utcDate(parts.year, parts.month, 1);

  return Array.from({ length: count }, (_, index) => {
    const start = new Date(currentMonth);
    start.setUTCMonth(start.getUTCMonth() - index);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const key = `${start.getUTCFullYear()}-${String(
      start.getUTCMonth() + 1
    ).padStart(2, "0")}`;

    return {
      key,
      label: new Intl.DateTimeFormat("id-ID", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(start),
      start,
      end,
    };
  });
}

export function selectBlogAnalyticsMonth(
  requested: string | string[] | undefined,
  months: BlogAnalyticsMonth[]
) {
  const key = Array.isArray(requested) ? requested[0] : requested;
  if (
    key &&
    MONTH_KEY_PATTERN.test(key) &&
    months.some((month) => month.key === key)
  ) {
    return months.find((month) => month.key === key) ?? months[0];
  }
  return months[0];
}

function isWithin(day: Date, period: BlogAnalyticsPeriod) {
  const timestamp = day.getTime();
  return timestamp >= period.start.getTime() && timestamp < period.end.getTime();
}

function countUniqueVisitors(
  rows: BlogVisitRow[],
  period: BlogAnalyticsPeriod
) {
  const visitors = new Set<string>();
  for (const row of rows) {
    if (isWithin(row.day, period)) visitors.add(row.visitorHash);
  }
  return visitors.size;
}

export function buildBlogVisitorReport(
  rows: BlogVisitRow[],
  selectedMonth: BlogAnalyticsMonth,
  months: BlogAnalyticsMonth[],
  now = new Date()
): BlogVisitorReport {
  const today = getJakartaDay(now);
  const tomorrow = addReportDays(today, 1);
  const periods = {
    today: { start: today, end: tomorrow },
    sevenDays: { start: addReportDays(today, -6), end: tomorrow },
    thirtyDays: { start: addReportDays(today, -29), end: tomorrow },
    year: { start: addReportDays(today, -364), end: tomorrow },
  };

  const selectedVisitors = new Set<string>();
  const selectedByPost = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!isWithin(row.day, selectedMonth)) continue;
    selectedVisitors.add(row.visitorHash);
    const postVisitors = selectedByPost.get(row.postId) ?? new Set<string>();
    postVisitors.add(row.visitorHash);
    selectedByPost.set(row.postId, postVisitors);
  }

  return {
    totals: {
      today: countUniqueVisitors(rows, periods.today),
      sevenDays: countUniqueVisitors(rows, periods.sevenDays),
      thirtyDays: countUniqueVisitors(rows, periods.thirtyDays),
      year: countUniqueVisitors(rows, periods.year),
    },
    monthlyTotals: months.map((month) => ({
      ...month,
      visitors: countUniqueVisitors(rows, month),
    })),
    selectedMonthVisitors: selectedVisitors.size,
    selectedMonthByPost: new Map(
      [...selectedByPost].map(([postId, visitors]) => [postId, visitors.size])
    ),
  };
}
