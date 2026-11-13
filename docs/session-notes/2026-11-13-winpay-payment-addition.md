# Session notes — WinPay sebagai metode pembayaran ketiga (2026-11-13)

## Ringkasan

Menambahkan **WinPay Checkout Page** sebagai kanal IDR ketiga di storefront,
portal reseller, dan bot Telegram. Cryptomus dan Pakasir tetap aktif apa adanya;
Pakasir dimatikan belakangan lewat toggle admin, bukan lewat penghapusan kode.
Kode selesai dan lolos test/typecheck/build, tetapi **belum di-deploy**: butuh
kredensial WinPay + pengaturan URL callback di dashboard mereka.

## Keputusan & alasan

- **Checkout Page (hosted), bukan SNAP API** — signature cukup HMAC-SHA256 atas
  timestamp, alur identik dengan Pakasir (redirect → callback → verifikasi), dan
  WinPay yang merender QRIS/VA/e-wallet. SNAP API (RSA, render VA sendiri)
  dicadangkan untuk fase berikutnya.
- **Aditif, bukan menggantikan** — user memutuskan Pakasir tetap aktif sampai
  WinPay terbukti di produksi. Semua route, setting, dan enum Pakasir utuh.
- **Callback tanpa signature** — body callback hanya petunjuk. Sumber kebenaran
  selalu `GET /api/find/{id}` dengan kredensial server. Halaman return customer
  tetap bukan bukti bayar.
- **Satu baris produk `qty: 1`, `price` = `Order.totalIDR`** — supaya `amount`
  provider selalu sama persis dengan total order, tanpa pembulatan per-unit.
- **Verifikasi jumlah** memakai jumlah `products[].price`; `payment.nett` dipakai
  sebagai `paidAmount`, karena `paid_amount` sudah termasuk fee.
- **`B2BPaymentMethod` memakai `ADD VALUE 'WINPAY'`**, bukan `RENAME`, supaya
  seluruh baris Pakasir lama tetap valid.
- **`payment-provider.ts`** menyatukan daftar provider IDR + label, menggantikan
  `event.provider === "pakasir"` yang tadinya hardcode di cek integritas amount.
- **Enum status dinormalisasi defensif** — dokumentasi WinPay hanya mencontohkan
  `PAID`; token tak dikenal diperlakukan `pending`.
- **`customer.phone` placeholder `08000000000`** — WinPay mewajibkan phone,
  aplikasi tidak mengumpulkannya. Harus dikonfirmasi di sandbox.
- **Ref callback ambigu** — contoh dokumentasi menunjukkan `ref` dan
  `invoice.ref` berbeda, jadi callback route mencoba keduanya sebagai `Order.id`.

## Perubahan

| File / area | Perubahan |
|---|---|
| `packages/payments/src/winpay.ts` | Adapter baru: timestamp Jakarta, HMAC signature, create invoice, find invoice, parser callback, assert mismatch |
| `packages/payments/src/winpay.test.ts` | 11 test (signature vector, origin allowlist, create/find, normalisasi status, callback, mismatch) |
| `packages/payments/src/index.ts` | Ekspor adapter + `PaymentProvider` menerima `"winpay"` |
| `apps/web/src/lib/winpay-payment.ts` | `verifyAndApplyWinpayPayment`: verifikasi invoice sebelum apply, throttle 5 detik, cabang retail + B2B |
| `apps/web/src/app/api/payment/winpay/callback/route.ts` | Listener callback; balas `ACCEPTED`, 503 agar WinPay retry, 409 + security event untuk penolakan |
| `apps/web/src/app/api/payment/winpay/sync/route.ts` | Pemulihan status oleh customer yang login |
| `apps/web/src/app/api/payment/b2b/winpay/callback/route.ts` | Re-export dispatcher yang sama untuk order reseller |
| `apps/web/src/lib/payment-provider.ts` | `isIdrPaymentProvider`, `paymentProviderLabel`, `resolveProviderAmount` |
| `apps/web/src/lib/payment-orders.ts` | Cek amount memakai provider IDR/USD bersama, label gateway bersama |
| `apps/web/src/lib/fulfillment.ts` | Label gateway memakai helper |
| `apps/web/src/lib/checkout-order.ts` | Cabang invoice WinPay + `providerForMethod` |
| `apps/web/src/app/api/payment/create/route.ts` | Menerima `winpay`, gate env/admin, pesan error |
| `apps/web/src/app/api/payment/methods/route.ts` | Menambah `winpay` (retail + reseller) |
| `apps/web/src/lib/payment-settings.ts` | Key/function WinPay di samping Pakasir |
| `apps/web/src/app/api/admin/settings/payments/route.ts` | Baca/tulis toggle WinPay retail & reseller |
| `apps/web/src/app/(admin)/admin/settings/PaymentsSettingsForm.tsx` | Dua tile switch baru; `persist` merge otomatis dari state |
| `apps/web/src/app/(admin)/admin/settings/page.tsx` | Kartu infra WinPay + kirim initial props |
| `apps/web/src/lib/fx.ts`, `pricing-rules.ts` | Tipe `paymentMethod` menerima `winpay` |
| `apps/web/src/app/api/pricing/quote/route.ts` | Parse `paymentMethod=winpay` + gate availability |
| `apps/web/src/app/(storefront)/products/[slug]/ProductDetailClient.tsx` | Kartu WinPay, grid 2/3 kolom, copy harga & CTA |
| `apps/web/src/app/(storefront)/order/success/PaymentStatusSync.tsx` | Sync per provider IDR (`/api/payment/<provider>/sync`) |
| `apps/web/src/lib/b2b-order-service.ts` | Gate, intent provider, cabang invoice WinPay |
| `apps/web/src/app/api/reseller/orders/route.ts` | Menerima `WINPAY` |
| `apps/web/src/app/reseller/ResellerOrders.tsx`, `ResellerDashboard.tsx` | Tiga tombol bayar, availability WinPay |
| `apps/web/src/lib/telegram-shop.ts` | Tombol + alur WinPay |
| `apps/web/src/app/(admin)/admin/orders/*` | Label gateway + filter `winpay` |
| `packages/db/prisma/schema.prisma` + migrasi `20261113120000_b2b_winpay_payment_method` | `ALTER TYPE ... ADD VALUE 'WINPAY'` |
| `docs/plans/2026-11-13-winpay-replace-pakasir.md` | Amandemen: eksekusi aditif |
| `apps/web/src/app/api/payment/winpay/callback/route.ts` | Mismatch/ref/amount kini tercatat `winpay_callback_rejected` (409, tidak di-retry); gangguan provider tetap 503 agar WinPay retry |
| `apps/web/src/app/(admin)/admin/reseller-orders/ResellerOrdersManager.tsx` | Label metode B2B tidak lagi menyebut semua non-crypto sebagai "Pakasir" |
| `apps/web/src/app/(storefront)/account/purchases/PurchaseHistoryClient.tsx` | Provider ditampilkan lewat `paymentProviderLabel` (WinPay/Pakasir/Cryptomus) |
| `apps/web/.env.example` | Blok `WINPAY_ENABLED`, `WINPAY_KEY`, `WINPAY_SECRET_KEY`, `WINPAY_BASE_URL` |
| `scripts/winpay-webhook.test.mjs` | 7 test integrasi route callback (pakai pola VM-stub `pakasir-webhook.test.mjs`) |
| `scripts/winpay-preflight.mjs` + root scripts | Preflight kredensial: buat 1 invoice lalu baca ulang, tanpa menagih siapa pun |
| `apps/web/src/lib/winpay-payment.ts` | Tidak berubah pada pass ini; dipakai apa adanya oleh test integrasi |

## Verifikasi

| Cek | Hasil |
|---|---|
| `pnpm --filter @kupon/payments test` | Lulus 20 test (13 di antaranya WinPay, termasuk clamp `interval` dan body callback non-objek) |
| `pnpm test:webhooks` | Lulus 9 test (2 Pakasir + 7 WinPay): ACCEPTED hanya setelah invoice terbukti `PAID`, 503 saat belum dibayar, 409 saat nominal/ref salah, fallback `invoice.ref`, jalur B2B, order tak dikenal |
| `node --experimental-strip-types --test src/lib/*.test.ts` (web) | 78/79 lulus; 1 gagal **pre-existing** (`b2b-delivery-export.test.ts` tidak bisa resolve paket `server-only` di luar bundler Next) |
| `pnpm typecheck` (payments + web) | Lulus, tanpa error |
| `pnpm lint` | 0 error di file yang diubah (dicek juga per-file dengan eslint); 6 error **pre-existing** di `Navbar.tsx`, `LoginClient.tsx`, `CookieConsent.tsx`, `(admin)/layout.tsx`, `CategoriesManager.tsx` |
| `pnpm prisma:validate` + `pnpm db:migrate` | Schema valid; migrasi `20261113120000_b2b_winpay_payment_method` applied ke DB lokal |
| `pnpm build` | `EXIT:0` (dijalankan dua kali, keduanya sukses) |
| `pnpm winpay:preflight` | Gagal dengan pesan jelas saat kredensial kosong (sesuai harapan); jalur sukses belum bisa diuji tanpa kredensial |
| Smoke test sandbox WinPay | **Belum** — butuh kredensial |

## Status deploy

- Commit: `790ad64`, `fbd0d13`, `26135c4` — **belum di-push** ke `origin/main`,
  belum di-deploy.
- Produksi: **belum**. Dengan `WINPAY_ENABLED` kosong/false, kartu WinPay tidak
  muncul dan semua endpoint WinPay fail-closed, jadi kode ini aman di-deploy
  lebih dulu (shadow deploy).
- Blocker: `WINPAY_KEY` + `WINPAY_SECRET_KEY` dari dashboard WinPay, dan URL
  callback yang harus diset di sana.

Langkah deploy berikutnya:

```bash
# 1) VPS: tambah env (gate masih mati)
#    WINPAY_ENABLED=false
#    WINPAY_KEY=...
#    WINPAY_SECRET_KEY=...
cd /var/www/eztu && bash scripts/deploy-vps.sh

# 2) verifikasi gate mati
curl -s https://eztopup.io/api/payment/methods | head -c 400

# 3) nyalakan
sed -i 's/^WINPAY_ENABLED=.*/WINPAY_ENABLED=true/' apps/web/.env
pm2 restart eztu --update-env
```

## Sisa pekerjaan

1. **Dashboard WinPay** — Store Name `EZTopUp`, URL Callback
   `https://eztopup.io/api/payment/winpay/callback`, URL Logo
   `https://eztopup.io/new-logo-eztopup.png` (aset sudah ada di repo, md5 cocok
   dengan file yang dikirim user).
2. **Env VPS + preview** — `WINPAY_ENABLED`, `WINPAY_KEY`, `WINPAY_SECRET_KEY`,
   opsional `WINPAY_BASE_URL=https://sandbox-checkout.winpay.id` untuk sandbox.
3. **Preflight kredensial** sebelum menyentuh checkout:
   `pnpm winpay:preflight` (buat 1 invoice lalu baca ulang; tidak menagih siapa pun).
4. **Smoke test sandbox** dan konfirmasi 5 pertanyaan terbuka di plan:
   `customer.phone` placeholder, bentuk `ref` callback, batas `interval`, string
   status selain `PAID`, dan `nett` vs `paid_amount`.
5. **Transaksi produksi pertama** dengan nominal terkecil sebelum mengumumkan.
6. **Matikan Pakasir** lewat toggle admin setelah WinPay stabil (bukan hapus kode).
7. Opsional: migrasi setting key `payments.pakasir.*` → arsip saat Pakasir
   dimatikan permanen, dan hapus route Pakasir setelah yakin tidak ada order
   menggantung.

## Referensi

- Plan: [2026-11-13-winpay-replace-pakasir.md](../plans/2026-11-13-winpay-replace-pakasir.md)
- Dokumentasi WinPay: <https://docs.winpay.id/payments/checkout-page/overview>
- Session note terkait: [2026-11-02 — Security incident hardening](2026-11-02-security-incident-hardening.md)
