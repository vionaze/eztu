# Session notes — harga PlayStation/GTA + WinPay 0,7% + Pakasir dihapus (24 Nov 2026)

## Ringkasan

Satu sesi, tiga pekerjaan yang saling terkait:

1. **Harga baru** dari `PLAYSTATION + GTA B2B B2C.xlsx` (sheet B2B dan B2C)
   diterapkan ke katalog `playstation-store` dan `gta-vi`.
2. **Buffer 0,7% WinPay** dibakukan ke semua harga IDR non-crypto (retail +
   reseller), karena MDR QRIS WinPay tidak bisa dibebankan di akhir checkout.
3. **Pakasir dihapus permanen** dari kode, setting, dan UI — berhenti operasi
   25 Nov 2026. WinPay menjadi satu-satunya kanal IDR.

Belum di-deploy. Build lokal diblokir masalah environment (lihat bagian
Verifikasi); typecheck bersih.

## Keputusan & alasan

- **+0,7% di atas angka Excel** (bukan sudah termasuk). Buffer diterapkan
  **multiplikatif ke harga akhir**, bukan menambah 70 bps ke markup:
  `harga = ceil(harga_dasar × 1,007)`.
- **Satu buffer untuk semua kanal IDR**, retail maupun reseller. Tidak ada
  surcharge per metode; VA memang fee-nya kecil, tapi satu harga lebih sederhana
  dan tidak bisa dibedakan di checkout.
- **Crypto tidak kena buffer.** Crypto di-settle USD lewat Cryptomus dengan
  markup sendiri (`cryptoMarkupBps`), jadi tidak menanggung MDR QRIS.
- **“Lock GTA B2B & B2C”** dibaca sebagai: GTA VI memakai persentase khusus dari
  file, bukan markup default. Bukan FIXED nominal — harga tetap mengikuti cost
  supplier live.
  - B2B: semua PlayStation/PSN +1,5%; **GTA VI +2%**.
  - B2C: GTA VI Standard **+4,15%**, Ultimate **+3,15%** (SKU `VPSNGTA*`).
  - Varian PlayStation B2C lain tidak diubah markup-nya.
- **Buffer di kode, bukan di markup DB.** `IDR_PAYMENT_FEE_BPS` (default 70)
  dipakai oleh `calculateSellPriceIDR`, `calculateResellerPrice`, dan quote
  retail. Dengan begitu harga tampil, quote, dan order selalu konsisten, dan
  bisa dimatikan (`0`) tanpa migrasi data.
- **Pakasir: hapus kode, bukan sekadar toggle.** Route, adapter, setting admin,
  tombol checkout, dan tombol bot dihapus.
  - Enum `B2BPaymentMethod.PAKASIR` **dipertahankan** agar order historis tetap
    terbaca; aplikasi tidak lagi membuatnya.
  - Label “Pakasir” di admin/riwayat dipertahankan untuk data lama (kini
    “Pakasir (legacy)” di filter order).
  - Migration `20261124093000_retire_pakasir_settings` menghapus dua baris
    `Setting` lama.

## Harga hasil (cost dari file)

| Item | Cost | Harga dasar | +0,7% (dibayar) |
|---|---:|---:|---:|
| GTA VI SE `VPSNGTASE-S122` B2C | 1.238.593 | 1.289.995 | **1.299.025** |
| GTA VI UE `VPSNGTAUE-S122` B2C | 1.550.820 | 1.599.671 | **1.610.869** |
| GTA VI SE B2B (+2%) | 1.238.593 | 1.263.365 | **1.272.209** |
| PSN IDR100k B2B (+1,5%) | 92.900 | 94.294 | **94.955** |

**Perhatian:** harga live GTA VI SE di screenshot user adalah **Rp1.306.716**
(= cost × 5,5%). Target baru **Rp1.299.025**, jadi turun ~0,6%. Sudah
dikonfirmasi user bahwa file adalah sumber kebenaran.

## Perubahan

| Area | Perubahan |
|---|---|
| `packages/db/src/payment-fee.ts` (baru) | `IDR_PAYMENT_FEE_BPS` (env, default 70) + `applyIdrPaymentFee` (ceil) |
| `packages/db/src/eztopup-catalog.ts` | `calculateSellPriceIDR` memakai buffer |
| `packages/db/src/reseller-pricing.ts` | `calculateResellerPrice` memakai buffer (MARKUP & FIXED) |
| `packages/db/src/supplier-replacements.ts` | harga varian pengganti memakai buffer |
| `packages/db/src/index.ts` | ekspor helper buffer |
| `apps/web/src/lib/supplier-pricing.ts` | quote retail non-crypto memakai buffer; crypto tidak |
| `packages/db/src/apply-playstation-gta-price-update.ts` (baru) | dry-run/`--apply`: cost/status dari snapshot, B2C GTA, upsert rule B2B 1,5%/2% |
| `data/playstation-gta-2026-11-24.json` (baru) | snapshot 465 baris VPSN+GTAVI dari Excel |
| `package.json`, `packages/db/package.json` | `prices:playstation-gta` & `:apply` |
| `packages/payments/src/pakasir.ts`, `pakasir.test.ts` | dihapus |
| `packages/payments/src/index.ts` | ekspor Pakasir dihapus; `PaymentProvider` = cryptomus/winpay |
| `apps/web/src/lib/pakasir-payment.ts` | dihapus |
| `apps/web/src/app/api/payment/pakasir/**`, `.../b2b/pakasir/**` | dihapus |
| `apps/web/src/lib/payment-settings.ts` | key & fungsi Pakasir dihapus |
| `apps/web/src/lib/checkout-order.ts` | cabang invoice Pakasir dihapus |
| `apps/web/src/app/api/payment/create/route.ts` | hanya crypto/winpay; pesan error disesuaikan |
| `apps/web/src/app/api/pricing/quote/route.ts` | default IDR = `winpay` |
| `apps/web/src/app/api/payment/methods/route.ts` | `pakasir` tidak dikembalikan lagi |
| `apps/web/src/lib/b2b-order-service.ts`, `b2b-order-rules.ts` | `PAKASIR` dihapus dari tipe & cabang |
| `apps/web/src/app/api/reseller/orders/route.ts` | hanya `CRYPTO`/`WINPAY` |
| `apps/web/src/lib/reseller-pricing-service.ts` | default method `WINPAY` |
| `apps/web/src/lib/telegram-shop.ts` | tombol & alur Pakasir dihapus |
| `apps/web/src/app/(storefront)/products/[slug]/ProductDetailClient.tsx` | kartu Pakasir dihapus; harga IDR = WinPay |
| `apps/web/src/app/(storefront)/order/success/PaymentStatusSync.tsx` | sync hanya untuk WinPay |
| `apps/web/src/app/reseller/ResellerOrders.tsx`, `ResellerDashboard.tsx` | tombol Pakasir dihapus; default WinPay |
| `apps/web/src/app/(admin)/admin/settings/*` + API | tile & setting Pakasir dihapus |
| `apps/web/src/app/(admin)/admin/orders/OrdersFilterClient.tsx` | label “Pakasir (legacy)” |
| `apps/web/src/lib/fx.ts`, `pricing-rules.ts` | tipe metode tanpa pakasir |
| `apps/web/.env.example` | blok Pakasir dihapus; `IDR_PAYMENT_FEE_BPS` didokumentasikan |
| `scripts/pakasir-webhook.test.mjs` | dihapus; `test:webhooks` hanya WinPay |
| `scripts/winpay-status.mjs`, `discord-reseller-sale.test.mjs` | referensi Pakasir dibersihkan |
| Migration `20261124093000_retire_pakasir_settings` | hapus baris `Setting` Pakasir |
| Test | ekspektasi harga db disesuaikan buffer; `payment-fee.test.ts` baru; test web pakasir→winpay |

## Verifikasi

| Cek | Hasil |
|---|---|
| `node --test packages/db/src/*.test.ts` | 34 lulus |
| `node --test packages/payments/src/*.test.ts` | 16 lulus |
| `node --test apps/web/src/lib/*.test.ts` | 73 lulus; 2 gagal **pre-existing/environment**: `b2b-delivery-export` (resolve `server-only`), `blog-image-storage` (binary `sharp` diblokir code signature macOS) |
| `node --test scripts/winpay-webhook.test.mjs` | 8 lulus |
| `scripts/discord-reseller-sale.test.mjs` | 2 lulus |
| `tsc --noEmit` (apps/web, packages/db, packages/payments) | bersih |
| `pnpm build` | **gagal karena environment**, bukan kode: native SWC/Turbopack tidak bisa dimuat (code signature macOS), dan `next build --webpack` berhenti di `lightningcss.darwin-arm64.node` yang tidak ada. Build harus dijalankan di VPS/Linux |
| `prices:playstation-gta` dry-run | 465 baris snapshot, 134 cocok di DB lokal, 331 tidak ada (kebanyakan varian negara `gta-vi` yang tidak di-seed lokal) |
| `prices:playstation-gta:apply` di DB lokal | 134 varian + 268 rule reseller diperbarui |
| Cek harga lokal | GTA SE retail 1.350.532 / B2B 1.324.560 (memakai cost file 1.289.560 untuk `gta-vi`); PSN100RM retail 459.342 / B2B 423.848 |

## Status deploy

- Commit `4d02b10` — *feat(pricing): bake WinPay fee, refresh PlayStation/GTA
  prices, retire Pakasir* — sudah di-push ke `origin/main`.
- **Belum di-deploy.** Perubahan lain yang sudah ada sebelumnya
  (`ProductQuickToggle`, `products/page.tsx`, `AdminSidebar`, `clerk.ts`,
  `product-analytics*`, `fav-eztopup.png`, `admin/loading.tsx`,
  `api/cache-test/`) sengaja **tidak** ikut di-commit.
- DB lokal sudah di-`--apply`; produksi belum.
- Blocker build lokal: native SWC. Deploy di VPS tetap memakai `pnpm build`
  (Linux) seperti biasa.

## Checklist manual (di luar repo)

### VPS

0. **Drain dulu, baru migrate.** Set `PAKASIR_ENABLED=false` di
   `apps/web/.env`, lalu `pm2 restart eztu --update-env`. Jangan jalankan
   migrasi selama env masih `true`: migration menghapus baris `Setting`
   Pakasir, dan kode lama akan membaca default `true` sampai proses restart —
   Pakasir bisa muncul lagi selama proses build.
1. Sebelum pull, pastikan tidak ada order Pakasir menggantung:
   ```sql
   SELECT count(*) FROM "Order"
   WHERE "paymentProvider" = 'pakasir' AND status IN ('PENDING','PROCESSING');
   SELECT count(*) FROM "B2BOrder"
   WHERE "paymentProvider" = 'pakasir' AND status IN ('DRAFT','PAYMENT_PENDING');
   ```
   Harus `0` dan `0`.
2. `apps/web/.env`: hapus `PAKASIR_ENABLED`, `PAKASIR_PROJECT_SLUG`,
   `PAKASIR_API_KEY`, `PAKASIR_WEBHOOK_SECRET`; pastikan
   `WINPAY_ENABLED=true`, `WINPAY_KEY`, `WINPAY_SECRET_KEY` terisi; tambahkan
   `IDR_PAYMENT_FEE_BPS=70` (opsional, default sudah 70).
3. `git pull --ff-only origin main`
4. `pnpm install && pnpm db:migrate` (menghapus setting Pakasir)
5. `pnpm prices:playstation-gta` (dry-run) lalu
   `pnpm prices:playstation-gta:apply`
6. `pnpm products:sync:supplier --expand --full-import --apply` (refresh
   cost/status live; markup tetap)
7. `pnpm build && pm2 restart eztu --update-env && pm2 save`
8. Verifikasi:
   - `curl -s https://eztopup.io/api/payment/methods` → tanpa `pakasir`
   - halaman produk: hanya kartu Stablecoin + WinPay
   - `/reseller`: tombol Crypto + WinPay, default WinPay
   - bot Telegram `/shop`: tombol pembayaran tanpa Pakasir
   - satu transaksi WinPay nominal terkecil, cek `PaymentEvent` + kode terkirim

### Dashboard / akun pihak ketiga

- **Pakasir**: tarik saldo tersisa, batalkan invoice pending, nonaktifkan
  webhook, revoke API key, lalu tutup/berhenti langganan akun. Hapus
  kredensialnya dari password manager.
- **WinPay**: pastikan URL callback
  `https://eztopup.io/api/payment/winpay/callback`, Store Name `EZTopUp`, logo
  terpasang. Tidak ada yang perlu dihapus.
- **Cloudflare/nginx**: cari dan hapus rule/allowlist/rate-limit yang menyebut
  `/api/payment/pakasir` (kalau ada):
  `grep -rn "pakasir" /etc/nginx /etc/cloudflare 2>/dev/null`.

## Yang perlu diingat / belum tuntas

1. **Harga GTA VI produk `gta-vi` belum diubah markup B2C-nya** (tetap 4%/4,75%,
   crypto sama). File B2C hanya mengatur SKU PSN `VPSNGTA*`. Saat ini seluruh
   varian `gta-vi` berstatus `empty` sehingga tersembunyi. Kalau mau disamakan
   dengan PSN (4,15%/3,15%), bilang saja.
2. **331 SKU snapshot tidak ada di DB lokal** — kebanyakan varian negara
   `gta-vi` (`-us`, `-br`, `-gb`, dst.). Di produksi bisa berbeda; jalankan
   dry-run di VPS dan cek daftar “tidak ada di katalog”.
3. **Angka Excel vs harga live:** retail dihitung dari harga supplier live ×
   markup. Cost di file hanya untuk preview dan B2B (B2B memakai
   `supplierCostIDR` tersimpan, lalu sync memperbaruinya).
4. **Enum `PAKASIR` masih ada** di `B2BPaymentMethod` demi order historis.
   Menghapusnya butuh recreate type Postgres; tidak dilakukan.
5. **Belum ada bukti transaksi WinPay nyata** di dokumentasi. Preflight
   (16 Nov) lulus, tapi toggle + pembayaran nyata belum tercatat.
6. Build lokal gagal karena environment; **jangan** menyatakan “sudah live”
   sebelum verifikasi di produksi.

## Update — P2028 saat `prices:playstation-gta:apply` di produksi

Apply pertama di VPS gagal dengan Prisma `P2028` (transaction timeout 5000 ms):
426 varian × (1 update + 2 upsert) dijalankan dalam satu interactive
transaction. Transaksi di-rollback penuh, jadi tidak ada perubahan setengah
jadi.

Perbaikan di `apply-playstation-gta-price-update.ts`:

- Ditulis per **chunk 25 varian**, masing-masing transaksi dengan
  `timeout: 120_000` dan `maxWait: 10_000`.
- Hanya menulis baris yang benar-benar berubah (cost/status/markup/priceIDR/
  rule tier), jadi aman dijalankan ulang dan tidak menyentuh baris yang sudah
  sesuai.
- Progress dicetak per chunk.

Jalankan ulang: dry-run → `--apply` → lanjut sync supplier → build → restart.
