# Phase 4a — B2B order/payment foundation + reseller MFA

## Status

Phase 4a adds schema groundwork and MFA/security surface only. No B2B order button, payment intent, wallet deposit, supplier job, or consumer checkout change is live.

## Security decision

All reseller members must use a non-email second factor before future financial B2B actions are allowed. The app uses Clerk-native MFA/security setup; it does not store TOTP secrets or recovery codes. The gate requires Clerk TOTP enrollment plus a verified second-factor session age less than 10 minutes. Missing/malformed claims and Clerk's -1 sentinel fail closed. First-factor login alone does not satisfy the gate. Passkeys can be managed through Clerk when available, but passkey enrollment alone is not treated as second-factor verification by this implementation. MFA reduces risk from compromised email but does not eliminate recovery/session/device compromise risks.

- `/reseller/security` hosts the Clerk security profile for active reseller members.
- `GET /api/reseller/security/mfa` reports the current session factor status without exposing secrets.
- Future B2B order/payment/wallet handlers must call `requireResellerMfa()` after active organization authorization.
- Consumer users on `eztopup.io` are not forced through this reseller MFA gate.

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
- Phase 4a migration applied successfully to isolated PostgreSQL database `reseller_phase4_test_20261009`.
- Revalidated the final migration on fresh isolated database `reseller_phase4_test_20261009_v2`; `scripts/b2b-foundation.test.sql` passed for order/payment-event/ledger uniqueness, ledger append-only triggers, account/org mismatch rejection, IDR currency, overdraft rejection and organization deletion restriction. Test fixture changes rolled back.
- Four MFA policy tests passed: first-factor-only denial, required TOTP enrollment, ten-minute freshness boundary and malformed claim denial.
- No production migration or payment/wallet data was changed by Phase 4a development.

## Clerk dashboard prerequisite

Enable authenticator-app/TOTP MFA for the production Clerk instance before testing enrollment. Merely deploying the security page does not enable Clerk's MFA methods. The UserProfile uses hash routing so its built-in security subviews do not require application catch-all paths. Security setup is reachable via the shield link on both mobile and desktop.

Do not disable Clerk account recovery or change consumer-wide login policies without a separate review. Native recovery codes should be stored offline by the user. Authenticated production enrollment and session reverification have not been smoke-tested from this environment.

## Next boundary

Phase 4b still needs organization-bound quotes, idempotent order creation and Crypto/Pakasir B2B intents/webhooks; Phase 4c needs durable supplier jobs and partial-result manual review. Financial routes must call `requireResellerMfa(organizationId)` and implement a Clerk-native reverification UX when the session factor has expired. No such order/payment routes are enabled by Phase 4a.
