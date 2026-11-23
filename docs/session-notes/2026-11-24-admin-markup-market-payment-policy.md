# Session notes — markup admin & aturan pembayaran per market (24 Nov 2026)

## Ringkasan

Dua permintaan setelah sesi harga/WinPay/Pakasir:

1. **Markup bisa diedit admin** — global dan per produk, tersimpan di DB,
   tidak boleh negatif. Menggantikan hardcode 0,7% di env sebagai satu-satunya
   sumber.
2. **Aturan pembayaran per market** — pembeli Indonesia hanya bisa WinPay;
   internasional bisa semua metode dan crypto diutamakan.

## Keputusan & alasan

### Markup admin

- **Markup ini adalah lapisan di atas markup per SKU**, bukan pengganti margin
  per SKU. Harga = `cost × (1 + markup SKU) × (1 + markup global/override)`.
  Dengan begitu angka 4,15% / 1,5% / 2% dari file Excel tetap utuh.
- **Dua level: global + override per produk.** Override kosong = ikut global.
  Default global 70 bps (0,7%) supaya perilaku lama tidak berubah.
- **Disimpan di `Setting`**, bukan kolom baru:
  `pricing.markup.globalBps` dan `pricing.markup.productOverrides` (JSON
  `{ "<slug>": bps }`). Tidak perlu migrasi.
- **Guard negatif berlapis**: regex UI menolak `-`, parser server menolak
  negatif/NaN/desimal >2, `isValidMarkupBps` di paket db menolak di luar
  0–1000%, dan `applyIdrPaymentFee` menolak nilai tidak valid.
- **Berlaku retail + reseller.** Crypto tidak kena karena settle USD dan tidak
  menanggung MDR QRIS.
- **Harga tampil dihitung ulang saat admin menyimpan** (semua SKU `available`),
  karena kartu produk/voucher membaca `priceIDR`. Konsekuensi yang
  didokumentasikan di UI: edit harga manual per varian akan tertimpa.
- **Jalur lain ikut membaca setting**: quote retail, harga reseller, cron
  `refreshAllSupplierPrices`, `products:sync:supplier` (termasuk `--expand`),
  `products:import:eztopup`, dan script harga PlayStation/GTA.
- `IDR_PAYMENT_FEE_BPS` tetap ada sebagai fallback untuk script lama/offline.

### Aturan pembayaran per market

- **Indonesia (dan market tak terdeteksi) = WinPay saja.** Crypto disembunyikan
  dan ditolak di server.
- **Internasional = semua metode, crypto diutamakan**: tombol pertama, otomatis
  terpilih, badge “Utama”, dan default reseller `CRYPTO`.
- **Ditegakkan di server**, bukan hanya UI:
  - `/api/pricing/quote` → 400 `CRYPTO_ID_MARKET_ONLY_WINPAY`
  - `/api/payment/create` → 400 dengan kode yang sama
  - `createB2BOrder` → 403 untuk reseller Indonesia
  - Bot Telegram → tombol crypto tidak muncul untuk market `id`; quote crypto
    ditolak.
- **Market kosong dianggap Indonesia.** Storefront Indonesia-first dan aturan
  restriktif lebih aman; Cloudflare mengirim `CF-IPCountry` di produksi.
- Admin crypto switch & blokir negara tetap berlaku untuk internasional
  (policy hanya menambah syarat, tidak menyalakan yang dimatikan admin).

## Perubahan

| File / area | Perubahan |
|---|---|
| `packages/db/src/pricing-markup.ts` (baru) | Key setting, parser override JSON, `readPricingMarkup`, `resolveProductMarkupBps`, batas 0–1000% |
| `packages/db/src/payment-fee.ts` | `applyIdrPaymentFee(price, feeBps?)` + validasi fee |
| `packages/db/src/eztopup-catalog.ts`, `reseller-pricing.ts` | menerima `feeBps` eksplisit |
| `packages/db/src/index.ts` | ekspor helper markup & `calculateSellPriceIDR` |
| `packages/db/src/sync-supplier-products.ts` | baca setting; fee per produk untuk sync & expand |
| `packages/db/src/supplier-expansion.ts` | parameter opsional `feeBpsFor` |
| `packages/db/src/import-eztopup-products.ts` | fee per product slug saat import |
| `packages/db/src/apply-playstation-gta-price-update.ts` | preview/apply memakai markup admin |
| `apps/web/src/lib/pricing-markup.ts` (baru) | cache 10 detik, simpan+validasi, hitung ulang harga tampil + `priceUSD` |
| `apps/web/src/lib/pricing-markup-parse.ts` (baru) | parser persen murni (bisa dites tanpa Prisma) |
| `apps/web/src/app/api/admin/settings/pricing/route.ts` (baru) | GET/PUT setting markup; semua admin |
| `apps/web/src/app/(admin)/admin/settings/PricingMarkupForm.tsx` (baru) | form global + per produk, error inline, simpan |
| `apps/web/src/app/(admin)/admin/settings/page.tsx` | render form markup |
| `apps/web/src/lib/supplier-pricing.ts` | quote + harga tampil memakai fee admin; cron ikut |
| `apps/web/src/app/api/pricing/quote/route.ts`, `api/payment/create/route.ts` | fee + blokir crypto untuk market ID |
| `apps/web/src/lib/b2b-order-service.ts`, `reseller-pricing-service.ts`, `api/admin/resellers/[id]/pricing/route.ts` | fee per produk untuk harga reseller; default market |
| `apps/web/src/lib/payment-market.ts` (baru) | policy market + pesan error |
| `apps/web/src/app/api/payment/methods/route.ts` | `market`, `crypto.preferred`, `crypto.reason` |
| `apps/web/src/app/(storefront)/products/[slug]/ProductDetailClient.tsx` | auto-pilih crypto untuk internasional, badge “Utama”, copy khusus ID |
| `apps/web/src/app/reseller/ResellerOrders.tsx` | metode default ditampilkan lebih dulu |
| `apps/web/src/lib/telegram-shop.ts` | tombol & validasi crypto per market |
| `apps/web/.env.example` | catatan bahwa env hanya fallback |
| Test | `pricing-markup-parse.test.ts`, `payment-market.test.ts` |

## Verifikasi

| Cek | Hasil |
|---|---|
| `node --test apps/web/src/lib/*.test.ts` | 78 lulus; 2 gagal **pre-existing/environment** (`b2b-delivery-export` server-only, `blog-image-storage` sharp code signature) |
| `node --test packages/db/src/*.test.ts` | 34 lulus |
| `node --test packages/payments/src/*.test.ts` | 16 lulus |
| `tsc --noEmit` (web, db, payments) | bersih |
| Round-trip setting di DB lokal | global 70 → 150, override `gta-vi` 200 terbaca; harga 100k × 1,5% SKU × fee benar; setting dibersihkan lagi |
| Uji negatif parser | `-0.7`, `-5`, `1000.01`, `1.234` ditolak |
| Build | belum bisa di lokal karena native `sharp`/SWC/lightningcss (environment), sama seperti sesi sebelumnya |

## Status deploy

- Commit `c5c9725` — *feat(pricing): make markup admin-editable and gate
  payments by market* — di-push ke `origin/main`. WIP lain
  (`ProductQuickToggle`, `products/page.tsx`, `AdminSidebar`, dll.) sengaja
  tidak ikut.
- Belum di-deploy.

## Sisa pekerjaan / catatan

1. Setelah deploy, buka **Admin → Settings → Markup harga**, coba simpan 0,7%
   global, lalu cek harga di kartu produk berubah dan tidak ada yang negatif.
2. Cek `/api/payment/methods` dari IP Indonesia: `crypto.enabled=false`,
   `winpay.enabled=true`; dari luar: `crypto.preferred=true`.
3. Pastikan `CF-IPCountry` benar-benar sampai ke aplikasi (nginx/Cloudflare).
   Kalau header hilang, semua dianggap Indonesia (WinPay saja).
4. Edit harga manual per varian di form produk akan tertimpa saat markup admin
   disimpan — ini disengaja dan tertulis di UI.
5. Harga crypto tidak memakai markup ini (memakai `cryptoMarkupBps`).
