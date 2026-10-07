# Reseller Phase 2 — workbook rules and pricing separation

Updated: 2026-10-08.

## Current implementation

Phase 2 implements isolated tier/SKU pricing, organization overrides, authenticated reseller catalog and live price lookup, plus an internal admin pricing editor. No B2B ordering, payment, invoice or wallet is implemented here; these remain Phase 4.

Main-domain consumer pricing is unchanged. Reseller pricing never writes `ProductVariant.priceIDR`, `nonCryptoMarkupBps` or `cryptoMarkupBps`. An organization override wins over its tier rule, including disabled overrides. No matching reseller rule means unavailable, not retail fallback.

## Corrections to the initial preview

The preliminary preview contained assumptions which must not be carried into live rules:

- The business note says Tier 2 stores **rarely sell Roblox**, not that they are forbidden. User approved Roblox in both tiers using their respective FINAL sheet formulas.
- `Reseller Price` is the supplier/base cost in these inputs, not automatically the B2B selling price. User approved the final formula uplift as the reseller selling-price rule.
- Nintendo must follow the workbook's explicit B2B rows/formulas, not a supplier-country-US filter. Supplier country and voucher region are different concepts.
- Workbook customer columns do not alter consumer/main-domain pricing.

## Workbook scope

Private source files:

- Roblox workbook: `Roblox Tier 1 FINAL` and `Roblox Tier 2 FINAL`.
- PlayStation Indonesia workbook: `PAKE INI FINAL RUMUS`, country inferred explicitly as Indonesia.
- Steam workbook: `VSTEAM` only. Explicit +2% business rule is used when the relevant row has no formula; invalid formulas block rather than fall back.
- Nintendo workbook: `NTD` rows with explicit final B2B formula only. Missing formula is unresolved, not an implicit global markup.
- Xbox/PC Game Pass source workbook was not supplied and is excluded.

All matching uses exact original SKU/country, stable variant ID and expected product slug. Duplicate catalog identities, conflicting source rules, unknown identities, invalid formulas or missing source/sheet prevent apply. Internal SKU spaces and case are preserved.

## Validated rule counts

Four supplied files produce **712 tier rules**, representing **356 distinct variants**:

| Source | Variants | Tier rules |
| --- | ---: | ---: |
| Steam Wallet | 332 | 664 |
| PlayStation | 18 | 36 |
| Nintendo with verified B2B formula | 3 | 6 |
| Roblox, separate formulas per tier | 3 | 6 |

32 other Nintendo rows lack an explicit B2B formula and remain unresolved. Non-target rows from the large mixed supplier exports are excluded. Source stock does not activate an unavailable SKU; runtime catalog/quote checks current stock and market eligibility.

## Price arithmetic

Pricing mode supports `MARKUP` and `FIXED`. Markup precision is five decimal places of a percentage: `1% = 100000 markupMicros`. BigInt ceiling arithmetic preserves the Roblox FINAL expressions without truncating them to integer basis points. Supplier costs at/above INT_MAX sentinel, negative/invalid costs, overflow, malformed rules and below-cost fixed prices are rejected.

Tables:

- `ResellerTierSkuPrice`, unique tier/variant.
- `ResellerOrganizationSkuPrice`, unique organization/variant.

Organization deletion cascades only its reseller overrides/memberships; tier rules restrict variant deletion, and consumer user/order data is not deleted by this relation.

## Private artifact

Validated artifact outside the public repository:

`/Users/iskavonalia/Documents/ChatGPT/voucher/outputs/reseller-pricing-preview-2026-10-08/reseller-pricing-phase2-rules.json`

Source workbooks, snapshots and generated JSON/XLSX pricing artifacts must not be committed. The old preview JSON/XLSX is historical and not an apply artifact. Use the Phase 2 rules file instead.

The artifact includes source SHA-256, workbook sheet/physical row/formula, exact SKU/country/product slug and target variant ID. Schema hash checks compatibility, not authenticity: only use a reviewed file transferred through a trusted private channel.

## Import CLI

- `pnpm reseller-pricing:import -- --source-dir <private-workbook-dir> --snapshot <snapshot.json> --output <private-report.json>`: offline preview only.
- `pnpm reseller-pricing:import -- --rules-file <reviewed-rules.json> --output <private-report.json>`: artifact validation without writes.
- Add `--apply` to apply to the configured database, never with `--snapshot`.

Apply rechecks current published catalog identities in a serializable transaction. Repeated unchanged imports do not increment revisions and do not overwrite organization overrides. Import audit entry records changes and artifact hash. Routine `deploy:vps` does not import pricing rules.

## APIs and UI

- `/api/reseller/catalog?organizationId=...`: active verified member only, indicative prices from cost snapshot, no internal cost/tier/role/margin fields.
- `/api/reseller/pricing/quote?organizationId=...&variantId=...&quantity=1`: fresh supplier cost, membership/tier rechecked after lookup, no shared retail writes or consumer checkout tokens.
- `/admin/resellers/<id>/pricing`: admin-only search and exact-SKU overrides, Edit/Save/Cancel/Reset to tier. Revision guards prevent stale writes; fixed price is checked against current supplier cost.

Runtime stock, publication and market restrictions remain in place. Cached catalog prices are indicative; a live quote can differ. Pending/rejected/suspended members do not receive pricing access.

## Verification and deployment boundary

Implementation was tested on an isolated PostgreSQL database seeded from the saved 9,826-variant production snapshot. No production mutation or migration was executed during implementation.

- All migrations applied to isolated test DB.
- 712 tier rules applied and repeated without revision changes.
- Disabled organization override retained after tier import.
- All 9,826 consumer prices/non-crypto/crypto markups unchanged after repeated imports.
- SQL mode/range/unique constraints, variant FK restriction and organization cascade tested.
- 31 targeted pricing/import/API/admin and consumer pricing/market/grouping regression tests passed.
- Prisma validation/generation, workspace typecheck, changed-file ESLint and production build passed.
- Local HTTP smoke test was blocked by Clerk development middleware rewriting to localhost and the local runtime reporting ENOTFOUND/EMFILE. This test was not counted as passed; no system networking config was changed. Production login/catalog/quote smoke tests remain required after deploy.

See `docs/operations/reseller-phase2-deployment.md` for the private-artifact VPS apply sequence. Push is not proof that migration/rules are live; verify production separately.
