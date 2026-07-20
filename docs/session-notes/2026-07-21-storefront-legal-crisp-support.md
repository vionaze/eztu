# Session Note: Storefront Legal, UX & Crisp Support

Date: 2026-07-21 (work stream continued from 2026-07-16–20)

## Summary

Expanded the EZTopUp storefront for production-readiness around **trust, legal, support chat, and checkout login UX**, then documented Crisp Hugo training assets. Code was pushed to `main` on GitHub (`vionaze/eztu`).

## Goals covered

1. Contact + Terms + Privacy pages (English legal/support content).
2. Login requires Terms acceptance before Clerk sign-in UI unlocks.
3. “Login to Pay” reliable redirect to `/login` (no broken modal-only flow).
4. Cookie consent banner (Accept all / Essential only).
5. Crisp live chat widget for all visitors.
6. FAQ accordion (compact, click-to-expand).
7. Features bar copy without overclaims; USDT/USDC + 24/7 support wording.
8. Hero CTAs: Explore Products → `/products`, How it works → `#faq`.
9. Navbar spacing + logo size; footer logo matched; remove NOWPayments footer line.
10. Crisp knowledge base PDF + manual FAQ list for Hugo training.
11. Production deploy guidance (user `deploy`, env for Crisp).

## Key URLs (production)

| Page | URL |
|------|-----|
| Home | https://eztopup.io |
| Products | https://eztopup.io/products |
| Contact | https://eztopup.io/contact |
| Terms | https://eztopup.io/terms |
| Privacy | https://eztopup.io/privacy |
| Login | https://eztopup.io/login |
| Support email | cs@eztopup.io |

## Commits on `main` (this stream)

| Commit | Note |
|--------|------|
| `68abf85` | Mobile jank + burger menu safe-area / less blur |
| `3a8052f` | Legal pages, cookie banner, Crisp, FAQ, login ToS, hero, features, support docs |
| `3837461` | (reverted later) Crisp login-only — wrong interpretation |
| `7a23b0d` | **Revert:** Crisp visible to **all visitors** again |

Latest expected on origin after session: **`7a23b0d`** (or newer if more pushes).

## Product / policy highlights

### Terms of Service (EN)

- Emphasizes: **after customer receives voucher code, transaction is complete** (codes sourced live from supplier).
- System-side errors: review and resolve per policy (re-fulfill / limited refund options).
- Footer + login checkbox link to `/terms`.

### Privacy Policy (EN)

- Accounts (Clerk), orders, payments, cookies, retention, rights.
- Cookie banner: essential always; optional only if “Accept all”.

### Features bar (honest marketing)

| Title | Description |
|-------|-------------|
| Fast Delivery | Codes after payment confirms |
| Secure Checkout | Protected payment flow |
| USDT / USDC | Stablecoin crypto checkout |
| Always Online | Browse & order anytime |
| 24/7 Support | Help when you need it |

(No “AI” wording in public UI.)

### Checkout / login

- Guest “Login to Pay” works **without** filling email first → `/login?redirect_url=...`.
- Login page: Terms checkbox at bottom; Clerk form slides in only after accept.
- Default quantity on product page: `1`.

### Support stack

- **Crisp** widget via `NEXT_PUBLIC_CRISP_WEBSITE_ID`.
- Website ID used in local env: `75e78e80-a30f-47da-9592-abb1d5ee041c` (set on production env + rebuild).
- Training assets:
  - `docs/support/EZTopUp-Crisp-Knowledge-Base.pdf`
  - `docs/support/Crisp-Hugo-FAQ-Manual-Input.md` (30 Q&A for Hugo manual input)
  - Generator: `docs/support/generate-crisp-kb-pdf.py`

### Cryptomus domain verification (ops)

- Place file under `apps/web/public/cryptomus_<id>.html` on VPS so `https://eztopup.io/cryptomus_....html` serves content like `cryptomus=<token>`.
- Example earlier: `cryptomus_6698b2ae.html` → body `cryptomus=6698b2ae`.

## Production deploy (user `deploy`)

```bash
su - deploy   # if currently root
cd /var/www/eztu
git pull origin main
# ensure apps/web/.env has:
# NEXT_PUBLIC_CRISP_WEBSITE_ID="75e78e80-a30f-47da-9592-abb1d5ee041c"
pnpm install
pnpm prisma:generate
pnpm build          # required after NEXT_PUBLIC_* changes
pm2 restart eztu --update-env
pm2 save
```

If `EACCES` on node_modules: as root `chown -R deploy:deploy /var/www/eztu`, then rebuild as deploy.

## Not committed

- `apps/web/.env` (secrets — correct)
- `Audit-Kupon-EZTopUp-ID.pdf`
- `apps/web/public/gabung.webp` (untracked asset)
- Local `.venv-docs` used only to generate PDF

## Test catalog note (from prior day in stream)

Production DB previously seeded to **3 test products** (ML / Steam / Roblox) with other products unpublished. That is **data**, not only code — still the live catalog unless changed since.

## Next useful steps

1. Confirm production pull + build + Crisp bubble for guests.
2. Finish Cryptomus review / payment provider switch when ready.
3. Train Crisp Hugo with PDF + FAQ list; set human handoff rules.
4. Optional: About Us page, wire Privacy cookie “manage” reset UI.
5. E2E paid test order (USDT/USDC) on one voucher SKU after payment live.

## Related docs

- `docs/session-notes/2026-07-16-test-skus-production-deploy.md` — SKU seed + PM2/VPS notes
- `docs/support/*` — Crisp Hugo materials
