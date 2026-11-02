# Session notes — Insiden keamanan & hardening produksi (2–3 Nov 2026)

## Ringkasan

Dua percobaan berantai dari satu IP (`192.25.102.65`, range datacenter Hewlett Packard
Enterprise) terhadap produksi. Semua berhasil diblokir **sebelum order dibuat**:

- 22:18 WIB — POST `/api/payment/webhook` dengan signature Cryptomus palsu (body 128 byte).
- 22:26 WIB — 20 request berturut ke `/api/payment/create`, field honeypot `company` terisi,
  email `buyer@mailinator.com`, User-Agent Chrome 131 (dipalsukan), Origin/Referer sah.

Hasil akhir: tidak ada order, pembayaran, atau voucher yang bocor.

## Timeline (WIB)

| Waktu | Kejadian |
|---|---|
| 22:18 | Webhook signature invalid → `403`, alert `payment_webhook_invalid_signature` (HIGH) |
| 22:26 | 20× checkout bot → `403`, alert `checkout_create` (HIGH, `HONEYPOT_FILLED` + `DISPOSABLE_EMAIL`) |
| 22:40 | Investigasi: `SecurityEvent` di DB lokal kosong → alert berasal dari produksi |
| 22:45 | Tes bypass callback dari agent memicu alert palsu (IP `161.97.130.68`, UA `curl/8.5.0`) — lihat catatan di bawah |
| 23:11 | Commit `4b1f49b` — token callback selalu wajib + throttle alert Discord |
| 23:25 | Commit `8391b34` — `/account/purchases` tidak lagi menelan `NEXT_REDIRECT` |
| ~00:05 | Blokir IP + email `192.25.102.65` lewat `/admin/logs` |
| ~00:50 | Uji origin: `161.97.130.68` menjawab langsung tanpa `cf-ray`; bypass callback terkonfirmasi mati |
| 01:00 | `ufw`: hapus `Nginx Full`, izinkan 80/443 hanya dari range Cloudflare |
| 01:05 | Efek samping: `gweenstudios.xyz` & `ikymianstudios.si` (DNS-only) down; `certbot renew --dry-run` gagal untuk keduanya |
| 01:10 | 80/443 dibuka kembali |
| 01:15 | nginx: `geo`/`map` Cloudflare + `proxy_set_header CF-Connecting-IP $client_ip` |
| 01:25 | nginx: `limit_req` untuk `/api/payment/create` + body 429 JSON |

## Perubahan kode

| Commit | Isi | File |
|---|---|---|
| `4b1f49b` | Bypass token callback dihapus total; throttle alert Discord | `apps/web/src/app/api/callback/order/route.ts`, `apps/web/src/lib/fraud.ts`, `apps/web/src/lib/alert-throttle.ts`, `apps/web/.env.example`, `scripts/alert-throttle.test.mjs`, `scripts/callback-token-only.test.mjs` |
| `8391b34` | `redirect()` tidak lagi tertelan `catch` di halaman riwayat | `apps/web/src/app/(storefront)/account/purchases/page.tsx` |

Detail:

- **Callback token.** `isTrustedCallbackHealthcheck` (bypass IP + `curl` UA) dihapus. Sebelumnya
  siapa pun yang bisa menembak origin langsung dapat memalsukan `CF-Connecting-IP` dan melewati
  token. Sekarang token satu-satunya bukti keaslian.
- **Throttle alert.** 1 notifikasi per `eventType + IP` per 10 menit, plus cap global 20 per
  10 menit. `SecurityEvent` tetap ditulis semua — throttle hanya memengaruhi Discord.
  Diuji: 20 request beruntun → 1 alert, 19 suppressed.
- **Redirect.** `redirect()` bekerja dengan melempar `NEXT_REDIRECT`; error itu tertangkap
  `catch` terluar sehingga pengunjung yang belum login melihat halaman kosong. Diperbaiki dengan
  `unstable_rethrow` + restrukturisasi try/catch (sekaligus menghapus satu error lint lama).

## Perubahan infrastruktur (di luar repo)

| Lokasi | Perubahan |
|---|---|
| Cloudflare | Rate limiting rule: `/api/payment/create`, 5 request / 10 detik per IP, block 10 detik |
| ufw | `Nginx Full` (allow any) dihapus; aturan per-range Cloudflare dipasang; kemudian 80/443 dibuka lagi (lihat "Sisa pekerjaan") |
| nginx | `geo $from_cf` + `map $from_cf $client_ip` di `/etc/nginx/conf.d/cloudflare-realip.conf`; `proxy_set_header CF-Connecting-IP $client_ip` di server block eztopup; `limit_req_zone $client_ip zone=pay:10m rate=10r/m`; `location = /api/payment/create` + `error_page 429` JSON |
| Admin | AccessBlock IP + email `192.25.102.65` / `buyer@mailinator.com` |

Aturan `[13] 443/tcp ALLOW IN 188.166.205.40 # Lapakgaming order callback` di ufw **dipertahankan**
(supplier mengirim callback langsung ke origin).

## Verifikasi

| Uji | Hasil |
|---|---|
| Checkout Chrome normal / iOS Safari / tanpa Origin | `400` (lolos gate, berhenti di validasi quote) |
| Checkout honeypot / UA `curl` / origin asing / `cross-site` | `403` |
| Callback tanpa token, token salah | `403` |
| Callback token benar | `400 BAD_REQUEST` (sampai handler) |
| Spoof `CF-Connecting-IP: 1.2.3.4` ke origin | tercatat `161.97.130.68` (`$remote_addr`), bukan `1.2.3.4` |
| 8× POST `/api/payment/create` | `403 403 403 403 429 429 429 429` |
| Halaman produksi (`/`, produk, blog, login) | `200` |

## Catatan: alert palsu 22:45

Saat memverifikasi bypass callback, agent mengirim `POST /api/callback/order` dengan
`CF-Connecting-IP: 161.97.130.68` dan UA `curl/8.5.0`. Request itu memicu alert
`supplier_callback_invalid_token` yang terlihat seperti serangan. Bukti bahwa header IP dapat
dipalsukan sekaligus sumber kebisingan. Pelajaran: IP pada alert tidak boleh dipakai sebagai
dasar ban otomatis.

## Sisa pekerjaan

1. `gweenstudios.xyz` dan `ikymianstudios.si` belum diproksi Cloudflare (DNS-only) sehingga tidak
   bisa mengikuti penutupan origin. Pindahkan ke Cloudflare, lalu tutup 80/443 lagi.
2. `res.json()` di `ProductDetailClient.tsx` belum dibungkus `try/catch`; 429/500 non-JSON masih
   bisa menghasilkan error parsing di UI. Body 429 dari nginx sudah JSON, jadi ini hanya jaring
   pengaman tambahan.
3. Penyegaran daftar IP Cloudflare secara berkala (cron bulanan) agar range baru tidak terblokir.
4. Tinjau port `8080`/`8443` yang masih terbuka ke publik.
5. Perbarui `docs/audits/2026-10-31-security-audit.md` bila ada temuan lain yang menyusul.

## Pelajaran operasional

- **"Ada di Cloudflare" ≠ "diproksi Cloudflare".** Record DNS-only (grey cloud) membuat Let's
  Encrypt dan pengunjung menembak IP origin langsung, sehingga penutupan origin memutus situs.
- **Satu IP melayani banyak domain.** ufw tidak bisa membedakan berdasarkan nama domain; penutupan
  origin hanya aman setelah semua domain diproksi.
- **Honeypot itu deteksi, bukan pencegahan.** Bot yang mengisi seluruh field tertangkap; bot yang
  melewati field `company` akan lolos ke tahap login. Penahan sesungguhnya: login wajib, quote
  token bertanda tangan, dan rate limit.
- **Alert tanpa dedup mudah dibanjiri.** 20 request sebelumnya menghasilkan 20 pesan Discord.
