# Phase 4a — B2B order/payment foundation

## Status

Phase 4a adds database groundwork only. No B2B order button, payment intent, wallet deposit, supplier job, or consumer checkout change is live.

## MFA feature removed — 2026-10-09

The reseller MFA/2FA feature was removed at the user's request because Clerk's MFA requires a paid plan. Deleted:

- `apps/web/src/lib/reseller-mfa.ts`, `reseller-mfa-policy.ts` and its tests
- `GET/PATCH /api/reseller/security/mfa`
- `/reseller/security` page and the dashboard header shield link

The temporary `ResellerOrganization.requireMfa` column and its migration were never pushed and were deleted in the same pass. Do not re-add Clerk-based MFA without confirming the paid plan; a cheaper authenticator implementation would be a separate, deliberate project.

## Additive database models

- `B2BOrder`, `B2BOrderLine`
- `B2BPaymentIntent`, `B2BPaymentEvent`
- `B2BWalletAccount`, `B2BWalletLedger`

The wallet is IDR-only groundwork and is disabled by default. It is not a substitute for `TreasuryLedgerEntry`, `Setting.inventory.balanceIDR`, or `User.walletAddress`.

B2B orders use a separate state enum, request fingerprint and organization-scoped idempotency key. Payment events have a provider/event unique key. Wallet entries have a DB trigger prohibiting update/delete, unique idempotency keys and BigInt IDR amounts. A composite FK prevents pairing an account with another organization's ledger entries. Wallet balances reject negative values and wallet currency is constrained to IDR. Posting/atomic debit/reconciliation services are not implemented yet; these schema constraints alone do not establish a working wallet. Foreign keys for organizations/users/variants/accounts are restrictive where financial history must not disappear; order lines/payment events cascade only from their owning B2B aggregate.

## Explicit boundaries

- Consumer `Order`, consumer payment webhooks, consumer checkout, consumer cooldown and consumer fulfillment remain unchanged.
- No wallet/deposit option is shown in the reseller UI.
- No Cryptomus/Pakasir B2B callback route exists yet.
- No B2B supplier worker exists yet.
- Phase 4b/4c must implement multi-SKU quote/order, direct Crypto/Pakasir invoices, provider inbox/reconciliation, monotonic state transitions, supplier leases, and manual review for partial supplier results before enabling purchase.

## Test status

- Prisma schema validation and client generation passed.
- Workspace TypeScript passed.
- Phase 4a migration applied successfully to isolated PostgreSQL databases `reseller_phase4_test_20261009` and revalidated on `reseller_phase4_test_20261009_v2`.
- `scripts/b2b-foundation.test.sql` passed for order/payment-event/ledger uniqueness, ledger append-only triggers, account/org mismatch rejection, IDR currency, overdraft rejection and organization deletion restriction. Test fixture changes rolled back.
- No production migration or payment/wallet data was changed by Phase 4a development.
