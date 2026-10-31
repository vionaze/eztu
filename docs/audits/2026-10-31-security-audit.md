# Audit Keamanan & Operasional — eztopup
Tanggal: 2026-10-31
Cakupan: codebase `apps/web` (53 route handler, 5 paket) + prosedur VPS.
Metode: pembacaan kode statis; pemeriksaan VPS lewat `docs/audits/vps-audit.sh` (read-only, hasil menyusul).

---

## Ringkasan

Fondasi keamanan aplikasi sudah baik: quote harga ditandatangani HMAC dan diverifikasi ulang ke harga supplier live, token B2B terikat ke org+user, semua perbandingan secret memakai `safeEqualSecret` (constant-time), webhook Cryptomus/KIE fail-closed, semua cron menolak request di production bila secret kosong, dan kepemilikan order pada endpoint baca sudah discope ke `userId`/`organizationId`.

Yang perlu ditutup, berurutan menurut risiko:

| # | Severity | Temuan | Lokasi |
|---|---|---|---|
| 1 | HIGH | Bypass token callback supplier lewat header IP yang bisa dipalsukan | `api/callback/order/route.ts:27-38`, `lib/fraud.ts:118-125` |
| 2 | LOW | Default allowlist admin (`aigaktidur@gmail.com`) + promosi tanpa cek verifikasi email | `lib/clerk.ts:209-219`, `:231-272` |
| 3 | MEDIUM | Webhook Pakasir fail-open bila secret kosong | `packages/payments/src/pakasir.ts:171-179` |
| 4 | MEDIUM | Tidak ada rate limiting di mana pun; quote memanggil supplier tiap request | `api/pricing/quote/route.ts:67` |
| 5 | MEDIUM | `/api/admin/*` tidak dijaga di middleware, hanya per-handler | `apps/web/src/proxy.ts:4` |
| 6 | MEDIUM | Gating market bisa diakali lewat header klien | `lib/product-availability.ts:26-32` |
| 7 | LOW | Token callback dikirim sebagai query parameter | `api/callback/order/route.ts:56` |
| 8 | LOW | Route admin mutasi tanpa cek same-origin | 25 handler `/api/admin/*` |
| 9 | LOW | Auth failure mengembalikan 500/503, menyamarkan probing | beberapa route admin |

---

## 1. HIGH — Callback supplier bisa dipalsukan

`isTrustedCallbackHealthcheck` (`api/callback/order/route.ts:27-38`) melewati validasi token bila **IP termasuk daftar trust** dan **User-Agent diawali `curl/`**. IP-nya diambil `getClientIp` (`lib/fraud.ts:118-125`) yang membaca berurutan: `cf-connecting-ip` → `x-real-ip` → `x-forwarded-for`.

Karena aplikasi ini di belakang nginx, bukan Cloudflare, header `CF-Connecting-IP` dari klien diteruskan apa adanya (nginx tidak menghapusnya kecuali dikonfigurasi). Artinya siapa pun bisa mengirim:

```
POST /api/callback/order
CF-Connecting-IP: 161.97.130.68
User-Agent: curl/8.5.0
{"code":"SUCCESS","data":{"reference_id":"<orderNumber miliknya>","status":"success","transactions":[{"voucher_code":"X"}]}}
```

dan lolos tanpa token. Dampak: `applySupplierOrderSnapshot` menandai order `COMPLETED` dan membuat `SupplierOrder` `FULFILLED` **tanpa memeriksa `paymentStatus`** (`lib/fulfillment.ts:300-310`; tidak ada satu pun referensi `paymentStatus` di file itu). Pembeli bisa menyelesaikan order yang belum ia bayar, mengisi kode voucher karangan sendiri, dan order tersebut lolos dari `payment-expiry`.

Risiko finansial langsung terbatas karena supplier belum dikirimi order (tid baru dibuat setelah pembayaran, `lib/fulfillment.ts:512`), tetapi ini integritas data + celah fraud yang serius.

Perbaikan (revisi setelah pemeriksaan infrastruktur):

**eztopup.io berada di belakang Cloudflare, tetapi origin-nya terbuka.** Tes langsung `curl --resolve eztopup.io:443:161.97.130.68` mengembalikan `200` dari `nginx/1.24.0` dengan TLS valid, tanpa `cf-ray`. Jadi header `CF-Connecting-IP` tidak bisa dipalsukan lewat domain publik, tetapi **bisa** dipalsukan dengan menembak IP origin langsung.

1. **Jangan strip `CF-Connecting-IP` di nginx.** Aplikasi memakainya sebagai sumber IP klien untuk access block, fraud, dan analytics. Menimpanya dengan `$remote_addr` (yang di bawah Cloudflare bukan IP klien) akan merusak fitur-fitur itu. Ini membatalkan saran versi awal dokumen ini.
2. **Perbaikan minimal tanpa build:** set `ORDER_CALLBACK_HEALTHCHECK_IPS=""` di `apps/web/.env`, lalu `pm2 restart eztu --update-env`. `getCallbackHealthcheckIps` memakai default hanya bila env `undefined`; string kosong menghasilkan daftar kosong sehingga bypass mati. Callback sah tetap diterima karena token valid.
3. Hapus bypass di kode (`api/callback/order/route.ts:11,27-38,65`) saat deploy berikutnya.
4. Opsional jangka panjang: batasi port 80/443 hanya untuk IP range Cloudflare (atau Authenticated Origin Pulls) agar seluruh kelas serangan header-injection ke origin tertutup. Berisiko downtime bila salah konfigurasi — kerjakan saat ada waktu mengawasi.

## 2. LOW — Default allowlist admin

`getAdminEmailAllowlist` (`lib/clerk.ts:209-219`) memakai default literal `aigaktidur@gmail.com` bila `ADMIN_EMAILS`/`SUPERADMIN_EMAILS` kosong, dan `ensureAllowlistedAdmin` mempromosikan akun dengan email tersebut menjadi `SUPERADMIN`. `emailVerified` dihitung (`lib/clerk.ts:46`) tetapi tidak pernah diperiksa di jalur promosi ini.

Severity diturunkan menjadi LOW setelah verifikasi: alamat default itu adalah email pemilik sistem dan sama dengan nilai di `.env.example:12`, jadi bukan backdoor. Risiko yang tersisa hanya bila Clerk menerbitkan email belum terverifikasi untuk alamat itu (Clerk production normalnya mewajibkan verifikasi). Cukup pastikan `ADMIN_EMAILS` terisi eksplisit di `.env` VPS; perbaikan kode (hapus default + wajibkan `emailVerified`) bisa menyusul kapan saja.

## 3. MEDIUM — Pakasir webhook fail-open

`verifyPakasirWebhookSecret` mengembalikan `true` bila `PAKASIR_WEBHOOK_SECRET` tidak di-set (`packages/payments/src/pakasir.ts:171-179`). Saat ini tidak bisa dipakai untuk memalsukan pembayaran karena status selalu diverifikasi ulang ke API Pakasir (`lib/pakasir-payment.ts:139-145`), tapi ini primitif berbahaya: bila verifikasi ulang berubah/terlewat di masa depan, webhook langsung bisa dipalsukan. Isi secret-nya di `.env` dan ubah menjadi fail-closed.

## 4. MEDIUM — Tanpa rate limiting

Tidak ada rate limit di seluruh codebase. `/api/pricing/quote` melakukan lookup supplier live setiap request tanpa autentikasi — siapa pun bisa menghabiskan kuota API Lapak (limit Get Products 50 req/10 s) sehingga harga seluruh situs mati (persis error yang baru kita alami), sekaligus memicu biaya/CPU. Endpoint publik lain (`/api/products/analytics`, `/api/blog/[slug]/view`) menerima write ke DB dengan gate yang bisa diakali.

Perbaikan minimum: batasi per-IP di nginx (`limit_req_zone`) untuk `/api/pricing/quote` dan endpoint analytics; cache quote supplier beberapa detik (harga tidak perlu real-time per request).

## 5. MEDIUM — Middleware hanya menjaga halaman `/admin`

`proxy.ts:4` hanya `createRouteMatcher(["/admin(.*)"])`. Meski matcher menjalankan Clerk middleware untuk `/api/*`, `auth.protect()` tidak dipanggil untuk `/api/admin/*`. Semua 25 handler admin saat ini punya guard masing-masing, jadi **tidak ada bypass saat ini**, tapi satu route admin baru yang lupa dipasangi guard akan langsung terbuka anonim. `api/admin/reseller-orders/[id]/delivery` pun sudah tidak punya guard di level route (bergantung pada fallback service). Tambahkan `"/api/admin(.*)"` ke matcher sebagai defense in depth.

## 6. MEDIUM — Gating market dari header klien

`getDetectedMarketCode` membaca `cf-ipcountry`/`x-vercel-ip-country`/`x-country-code` (`lib/product-availability.ts:26-32`) dan dipakai `/api/pricing/quote` serta `/api/payment/create`. Semua header itu bisa dipalsukan klien, jadi produk yang dikecualikan dari suatu market bisa dibeli dengan menyetel `x-country-code`. Ini pelanggaran pembatasan bisnis/geo, bukan auth bypass — tapi tetap perlu: ambil negara dari `CF-IPCountry` yang di-set edge tepercaya saja, atau validasi `marketCode` terhadap IP yang sudah diverifikasi.

## 7–9. LOW

- Token callback di query string (`?token=`) tercatat di access log nginx dan referer. Pindah ke header.
- 25 route admin mutasi tanpa `requireSameOrigin`, berbeda dengan route reseller yang punya (`lib/reseller-api.ts:24-37`). Bergantung pada `SameSite` cookie Clerk — cukup selama itu benar, tapi tidak berlapis.
- Status code auth tidak konsisten: `b2bApiError` memetakan auth failure ke **503** (`lib/b2b-order-service.ts:882-887`), beberapa route admin menangkap semua error jadi **500**. Probing otentikasi jadi tidak terlihat di monitoring. Kembalikan 401/403.
- `SUPPLIER_SECRET_KEY` di `/var/www/eztu/.env` masih kosong → `products:sync:supplier` akan gagal pada `pnpm deploy:vps` berikutnya.

---

## Yang sudah benar

- Quote harga: HMAC + verifikasi ulang ke harga supplier (`lib/fx.ts:190-244`).
- Token quote B2B terikat org+user+revisi aturan (`lib/b2b-order-service.ts:208-249`).
- Semua perbandingan secret constant-time (`lib/security.ts:8-25`).
- Webhook Cryptomus + KIE: signature, fail-closed.
- Cron: semua menolak di production tanpa secret.
- Ownership order pada endpoint baca sudah discope `userId`/`organizationId`.
- `.env` tidak pernah masuk git (`.gitignore:41`), repo bersih dari secret ter-commit.

## Catatan kerahasiaan

Selama sesi debugging ini, isi `apps/web/.env` lokal (Clerk test secret, Privy app secret, NowPayments API/IPN key, Discord webhook URL, DATABASE_URL lokal) tampil di percakapan. Putuskan apakah perlu rotasi; yang paling murah: rotate NowPayments key dan Discord webhook, karena keduanya tidak butuh koordinasi vendor panjang.

---

## Dependensi (`pnpm audit --prod`)

Total 57 advisory: **5 critical, 22 high, 25 moderate, 5 low** — sebagian besar transitif lewat `next` dan toolchain Prisma. Yang relevan untuk sistem Linux ini:

| Paket | Versi | Perbaikan | Catatan |
|---|---|---|---|
| `next` | 16.2.11 | `>=16.3.8` | 2 advisory high: SSRF di Image Optimization (berlaku di Linux) + RCE di Windows hosted server (tidak berlaku di VPS Linux ini). `remotePatterns` di `next.config.ts:126-136` sudah allowlist, jadi SSRF terbatas — tapi upgrade tetap murah dan menutup semuanya. |
| `sharp` | <0.35.4 | `>=0.35.4` | libheif. Dipakai untuk gambar blog. |
| `@tiptap/core` + `prosemirror-view` | <3.30.5 / <1.42.3 | `>=3.30.5` / `>=1.42.3` | ReDoS + XSS di editor admin. Hanya admin yang terpapar. |
| `xlsx` | <0.19.3 | **tidak ada patch di npm** | Prototype pollution. Hanya dipakai untuk import/export operator (`lib/b2b-delivery-export.ts`, `packages/db/src/import-*.ts`), jadi input selalu dari admin. Jangka panjang: ganti dengan library lain atau pin build resmi SheetJS. |
| `mysql2`, `deepmerge-ts`, `fast-uri` | — | — | Transitif lewat toolchain Prisma CLI, tidak dipakai di runtime web. |

`next` dan `sharp` adalah yang paling layak dikerjakan lebih dulu.

---

## Hasil VPS (diisi setelah script dijalankan)

`docs/audits/vps-audit.sh` memeriksa: update OS & reboot-required, konfigurasi SSH efektif, akun UID 0, anggota sudo, ufw/iptables, port terbuka, fail2ban, `nginx -T` (TLS, header, `proxy_set_header`, body size), masa berlaku sertifikat, Postgres listen address + `pg_hba`, backup terjadwal, izin file `.env`, duplikat key, env rahasia yang bocor ke PM2, error terakhir aplikasi, dan probe `/\.env`/`wp-admin` di access log.

Jalankan:
```bash
ssh deploy@161.97.130.68 'bash -s' < docs/audits/vps-audit.sh
```
