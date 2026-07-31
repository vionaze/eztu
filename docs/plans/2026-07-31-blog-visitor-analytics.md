# Blog Visitor Analytics Implementation Plan

**Goal:** Add a privacy-conscious admin report showing how many unique, consenting browsers visit published blog articles.

## Scope

- Count one browser once per article per Jakarta calendar day.
- Report unique visitors across all articles for today, 7 days, 30 days, and the last 365 days.
- Show totals for each of the last 12 calendar months.
- Let admins select a month and inspect unique visitors per article.
- Preserve the existing `BlogPost.views` field as a legacy all-time counter.

## Data and privacy

- Set a first-party, HttpOnly, SameSite=Lax browser identifier only after the visitor accepts optional analytics.
- Store only an HMAC-SHA256 hash of that random identifier.
- Do not store IP addresses, user IDs, emails, or user-agent strings.
- Ignore common crawler, preview, monitoring, and command-line user agents.
- Deduplicate with a database unique key on article, visitor hash, and day.
- Require `BLOG_VIEW_HASH_SECRET` (at least 32 characters) in production.

## Implementation

1. Add `BlogPostDailyVisit` to Prisma and a deployable migration.
2. Add pure date, bot-filter, hash, and report aggregation helpers with unit tests.
3. Add `POST /api/blog/[slug]/view` to validate same-site requests, set the anonymous cookie, and persist a deduplicated visit.
4. Replace server-render view increments with a small client tracker that honors the existing cookie-consent choice.
5. Add responsive analytics cards, monthly totals, a month selector, and per-article monthly details to Admin → Blog.
6. Validate Prisma, run targeted tests, typecheck, lint changed files, and build.

## Reporting caveat

Historical period data begins after this migration is deployed. The existing all-time `views` number is retained, but it cannot be reconstructed into reliable historical unique-visitor periods.
