import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBlogVisitorReport,
  getJakartaDay,
  getRecentBlogAnalyticsMonths,
  hashBlogVisitorId,
  isLikelyBot,
  isValidBlogVisitorId,
  selectBlogAnalyticsMonth,
  type BlogVisitRow,
} from "./blog-analytics.ts";

test("uses Jakarta calendar boundaries for visit days", () => {
  assert.equal(
    getJakartaDay(new Date("2026-07-30T16:59:59.000Z")).toISOString(),
    "2026-07-30T00:00:00.000Z"
  );
  assert.equal(
    getJakartaDay(new Date("2026-07-30T17:00:00.000Z")).toISOString(),
    "2026-07-31T00:00:00.000Z"
  );
});

test("validates and hashes anonymous visitor IDs", () => {
  const visitorId = "9c33ff5c-f938-4c8f-9cee-8a882290516f";
  assert.equal(isValidBlogVisitorId(visitorId), true);
  assert.equal(isValidBlogVisitorId("not-a-uuid"), false);

  const first = hashBlogVisitorId(visitorId, "a".repeat(32));
  const repeated = hashBlogVisitorId(visitorId, "a".repeat(32));
  const differentSecret = hashBlogVisitorId(visitorId, "b".repeat(32));
  assert.equal(first, repeated);
  assert.notEqual(first, differentSecret);
  assert.equal(first.length, 64);
  assert.throws(() => hashBlogVisitorId(visitorId, "too-short"));
});

test("filters bots and accepts normal browser user agents", () => {
  assert.equal(isLikelyBot("Googlebot/2.1"), true);
  assert.equal(isLikelyBot("curl/8.7.1"), true);
  assert.equal(isLikelyBot(null), true);
  assert.equal(
    isLikelyBot(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36"
    ),
    false
  );
});

test("selects only one of the available last twelve months", () => {
  const now = new Date("2026-07-31T04:00:00.000Z");
  const months = getRecentBlogAnalyticsMonths(now);
  assert.equal(months.length, 12);
  assert.equal(months[0].key, "2026-07");
  assert.equal(months[11].key, "2025-08");
  assert.equal(selectBlogAnalyticsMonth("2026-05", months).key, "2026-05");
  assert.equal(selectBlogAnalyticsMonth("2020-01", months).key, "2026-07");
  assert.equal(selectBlogAnalyticsMonth("invalid", months).key, "2026-07");
});

test("reports unique visitors globally and per article without counting refreshes", () => {
  const now = new Date("2026-07-31T04:00:00.000Z");
  const months = getRecentBlogAnalyticsMonths(now);
  const selectedMonth = selectBlogAnalyticsMonth("2026-07", months);
  const rows: BlogVisitRow[] = [
    {
      postId: "post-a",
      visitorHash: "visitor-1",
      day: new Date("2026-07-31T00:00:00.000Z"),
    },
    {
      postId: "post-a",
      visitorHash: "visitor-1",
      day: new Date("2026-07-30T00:00:00.000Z"),
    },
    {
      postId: "post-b",
      visitorHash: "visitor-1",
      day: new Date("2026-07-31T00:00:00.000Z"),
    },
    {
      postId: "post-a",
      visitorHash: "visitor-2",
      day: new Date("2026-07-20T00:00:00.000Z"),
    },
    {
      postId: "post-a",
      visitorHash: "visitor-old",
      day: new Date("2025-01-01T00:00:00.000Z"),
    },
  ];

  const report = buildBlogVisitorReport(rows, selectedMonth, months, now);
  assert.deepEqual(report.totals, {
    today: 1,
    sevenDays: 1,
    thirtyDays: 2,
    year: 2,
  });
  assert.equal(report.selectedMonthVisitors, 2);
  assert.equal(report.selectedMonthByPost.get("post-a"), 2);
  assert.equal(report.selectedMonthByPost.get("post-b"), 1);
  assert.equal(report.monthlyTotals[0].visitors, 2);
});
