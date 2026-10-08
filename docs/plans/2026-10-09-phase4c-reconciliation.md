# Phase 4c — admin reconciliation and durable fulfillment

## What changed

- `B2BOrder` gains `fulfillmentAttempts`, `fulfillmentLeaseUntil`, `lastReconciledAt` (migration `20261009100000_b2b_fulfillment_lease`) with a status/lease index.
- Fulfillment claim is lease-based: an order can be claimed from `PAID`, or from `PROCESSING` when its lease expired, up to `MAX_FULFILLMENT_ATTEMPTS = 3`. Finished runs clear the lease and stamp `lastReconciledAt`.
- `reconcileB2BOrders()` sweep:
  - expires stale `PENDING` payment intents and cancels their unpaid orders,
  - parks `PROCESSING` orders whose retries are exhausted into `MANUAL_REVIEW`,
  - re-runs fulfillment for paid-but-unclaimed orders older than 60 seconds (crash recovery).
- New admin surfaces: `GET /api/admin/reseller-orders` (filters), `GET /api/admin/reseller-orders/[id]` (lines, payment intent, event inbox), `POST /api/admin/reseller-orders/[id]` with `action: "retry"` (typed order-number confirmation) or refund/cancel bookkeeping `status` transitions guarded by `canAdminOrderTransition`.
- New admin page `/admin/reseller-orders` with status/search filters, line and payment detail, re-submit and refund/cancel actions (nav entry added).
- New cron endpoint `POST /api/cron/b2b-orders` (Bearer `B2B_CRON_SECRET` or `CRON_SECRET`) which runs the sweep and writes an AppLog entry.

## Boundaries kept

- Refunds are bookkeeping only: an admin moves money in the provider dashboard, then records `REFUND_PENDING` → `REFUNDED`. No automatic provider refunds.
- Supplier re-submits are explicit and audited; deterministic `partner_reference_id` is what makes them safe against duplicates.
- Consumer checkout, consumer webhooks, consumer fulfillment, and retail pricing remain untouched. Wallet/deposit stays hidden.

## Verification

- Migration applied to fresh isolated DB `reseller_phase4_test_20261009_v4`; `scripts/b2b-foundation.test.sql` invariants still pass.
- `b2b-order-rules.test.ts` (6 tests) covers the new admin transition matrix.
- Typecheck, changed-file ESLint (0 errors), and production build pass.

## Ops

Add to production env and crontab (deploy user):

```bash
# every 10 minutes
*/10 * * * * curl -fsS -X POST -H "Authorization: Bearer $B2B_CRON_SECRET" https://eztopup.io/api/cron/b2b-orders
```

Live B2B ordering still requires `B2B_ORDERING_ORG_IDS` to list the pilot organization.

## Remaining after 4c

- Wallet/deposit UI and ledger postings (Phase 4d) — wallet stays hidden.
- Order status notifications to the reseller (email/Discord).
- Bulk policy validation to raise the provisional caps (10 lines / 20 units).
