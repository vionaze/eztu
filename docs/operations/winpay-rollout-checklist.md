# WinPay — checklist verifikasi menyeluruh

Runbook untuk memastikan integrasi WinPay (Checkout Page) sehat dari kode sampai
uang masuk. Jalankan berurutan; setiap bagian punya kriteria lulus sendiri.
Tidak ada langkah di sini yang menagih pelanggan, kecuali bagian 4.

## 0. Ringkas: satu perintah

```bash
# di lokal (repo)
pnpm winpay:status
# di VPS (memakai env produksi + DNS produksi)
cd /var/www/eztu && pnpm winpay:status
```

Skrip ini read-only: memeriksa kelengkapan env (nilai tidak dicetak), status
`/api/payment/methods`, keberadaan route callback, dan apakah host WinPay
membalas JSON atau diblokir edge. Keluar dengan kode 1 bila ada `FAIL`.

Untuk benar-benar membuat satu invoice (tetap tidak menagih siapa pun):
`pnpm winpay:preflight`.

## 1. Kode di repo

```bash
git log --oneline -1          # harus memuat commit winpay terakhir
git status --short            # tidak boleh ada perubahan winpay yang belum di-commit
pnpm --filter @kupon/payments test    # 23 lulus
pnpm test:webhooks                    # 10 lulus
pnpm typecheck                        # bersih
pnpm build                            # EXIT 0
```

Lulus bila keempatnya hijau dan `origin/main` sama dengan HEAD lokal
(`git rev-list --left-right --count origin/main...HEAD` → `0 0`).

## 2. VPS: deploy dan env

```bash
cd /var/www/eztu
git log --oneline -1                     # harus commit winpay terakhir
git rev-list --left-right --count origin/main...HEAD   # harus "0 0"
pm2 status                               # proses eztu online, restart terbaru wajar
```

Cek env **tanpa mencetak nilai**:

```bash
awk -F= '/^WINPAY_(ENABLED|KEY|SECRET_KEY|BASE_URL)=/{v=$0; sub(/^[^=]*=/,"",v); print $1, (length(v)?"set("length(v)")":"EMPTY")}' apps/web/.env
```

Harapan: `WINPAY_ENABLED set(4)` (isinya `true`), `WINPAY_KEY` dan
`WINPAY_SECRET_KEY` `set(N)` dengan N > 20, `WINPAY_BASE_URL` `EMPTY` untuk
produksi.

```bash
# IP egress server (dibutuhkan bila harus minta allowlist ke WinPay)
curl -4 -s https://ifconfig.me; echo

# jangkauan kedua host WinPay dari server ini
curl -sS -m 15 -o /tmp/c.txt -w "checkout:%{http_code}\n" -X POST https://checkout.winpay.id/api/create -H "Content-Type: application/json" -d '{}'
head -c 160 /tmp/c.txt; echo
curl -sS -m 15 -o /tmp/s.txt -w "snap:%{http_code}\n" -X POST https://snap.winpay.id/v1.0/transfer-va/create-va -H "Content-Type: application/json" -d '{}'
head -c 160 /tmp/s.txt; echo
```

Harapan: keduanya membalas **JSON** (`4010100 Invalid headers`/`no access`), bukan
halaman HTML. HTML 403 = blokir Cloudflare (lihat bagian 6).

```bash
cd /var/www/eztu && pnpm winpay:preflight
```

Lulus bila mencetak `✓ Invoice created` + `✓ Invoice lookup`.

## 3. Database

```sql
-- Toggle admin (retail + reseller). Absen = default aktif.
SELECT key, value FROM "Setting" WHERE key LIKE 'payments.%winpay%';

-- Order WinPay terakhir
SELECT id, "orderNumber", status, "paymentProviderPaymentId", "totalIDR", "paidAt", "createdAt"
FROM "Order" WHERE "paymentProvider" = 'winpay'
ORDER BY "createdAt" DESC LIMIT 5;

-- Jejak callback/verifikasi (harus ada setelah pembayaran sukses)
SELECT "eventId", "eventType", "orderId", "createdAt"
FROM "PaymentEvent" WHERE provider = 'winpay'
ORDER BY "createdAt" DESC LIMIT 10;

-- Order reseller
SELECT id, "orderNumber", status, "paymentProvider"
FROM "B2BOrder" WHERE "paymentProvider" = 'winpay'
ORDER BY "createdAt" DESC LIMIT 5;
```

Lulus bila: tidak ada order `PENDING` yang menggantung lebih dari masa berlaku
invoice, dan setiap order `PAID` punya minimal satu baris `PaymentEvent`
berprovider `winpay`.

## 4. End-to-end manual (browser)

1. Buka halaman produk apa pun saat sudah login.
   Harap: tiga kartu pembayaran tampil (Stablecoin, Pakasir, WinPay) **sesuai
   switch admin yang aktif**.
2. Pilih WinPay. Harap: harga IDR berubah dan tombol berbunyi "Pay with WinPay".
3. Checkout dengan SKU termurah. Harap: browser diarahkan ke
   `https://checkout.winpay.id/<token>`, bukan halaman error.
4. Bayar dengan QRIS di halaman WinPay sampai sukses.
5. Kembali ke `/order/success?orderId=...`. Harap: status berubah sendiri
   menjadi paid/completed (jalur `/api/payment/winpay/sync`).
6. Cek kode terkirim (email/riwayat pembelian) dan `pm2 logs eztu --lines 100`
   bersih dari `[WinPay Callback]` / `[Payment Create]` error.
7. Buka admin → Settings → matikan `WinPay (retail)`.
   Harap: `GET /api/payment/methods` mengembalikan `winpay.enabled: false` dan
   kartu WinPay hilang setelah refresh. Nyalakan kembali.
8. Buka admin security log. Harap: **tidak ada** event HIGH baru dari
   `winpay_callback_*` untuk lalu lintas normal.

## 5. Kriteria go / no-go

Rilis dinyatakan siap bila semua ini benar:

- [ ] Skrip bagian 1 hijau dan HEAD = `origin/main`.
- [ ] VPS menjalankan commit yang sama dan `pm2 status` online.
- [ ] `pnpm winpay:status` di VPS: 0 FAIL.
- [ ] `pnpm winpay:preflight` di VPS: invoice + lookup sukses.
- [ ] Satu pembayaran nyata menghasilkan order `PAID`/`COMPLETED` + kode terkirim.
- [ ] Tidak ada `PaymentEvent` ganda untuk invoice yang sama.
- [ ] Toggle admin retail dan reseller bereaksi sesuai harapan.
- [ ] Pakasir masih berfungsi sebagai kanal cadangan.

## 6. Peta gejala → penyebab → aksi

| Gejala | Penyebab paling mungkin | Aksi |
|---|---|---|
| `WinPay checkout is temporarily unavailable` di browser | Exception saat create invoice; pesan asli ada di log | `pm2 logs eztu --lines 200 --nostream \| grep -A3 "Payment Create"` |
| `/api/payment/methods` tanpa key `winpay` | Build lama / belum deploy | `bash scripts/deploy-vps.sh`, lalu ulangi |
| `winpay.enabled: true` di methods tapi checkout tetap ditolak | Toggle admin reseller berbeda, atau gate env berubah setelah build | cek bagian 3 (Setting) dan bagian 2 (env) |
| `WinPay API error: 403 … Cloudflare Error 10xx (cf-ray …)` | IP server diblokir edge WinPay | kirim cf-ray + IP ke WinPay; lihat tiket di session note |
| `WinPay API error: 4010100 …` | Key/secret salah atau tertukar | `WINPAY_KEY` = Key, `WINPAY_SECRET_KEY` = Secret Key, tanpa spasi |
| `WinPay API error: 4010300 Invalid signature` | Secret salah, atau jam server melenceng jauh | sinkronkan NTP; ulangi preflight |
| Callback 409 `Order not found` | `ref`/`invoice.ref` tidak cocok dengan order kita | cek payload di log; laporkan bentuknya |
| Order tetap `PENDING` setelah bayar | Callback tidak masuk / verifikasi gagal | cek `PaymentEvent`, lalu buka `/order/success` untuk memicu sync |
| `PaymentEvent` menumpuk untuk satu invoice | Callback retry dari provider | normal bila status akhir benar; tidak normal bila ada dua baris dengan status berbeda |

## 7. Referensi

- Adapter: `packages/payments/src/winpay.ts`
- Verifier: `apps/web/src/lib/winpay-payment.ts`
- Callback route: `apps/web/src/app/api/payment/winpay/callback/route.ts`
- Plan & keputusan: `docs/plans/2026-11-13-winpay-replace-pakasir.md`
- Catatan sesi + tiket WinPay: `docs/session-notes/2026-11-13-winpay-payment-addition.md`
