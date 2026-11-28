# 2026-11-28 — Insiden keamanan: RCE mailserver (host-network), eskalasi SUPERADMIN, exfiltrasi

Status: **CONTAINMENT + HARDENING SELESAI (28 Nov ~12:45 WIB)** — payments dinonaktifkan,
mailserver fresh + bridge, kredensial DB & mailbox dirotasi. Host tetap direkomendasikan
untuk REBUILD. Owner mengonfirmasi `141.11.243.59` & `euploading.com` bukan miliknya dan
menyetujui containment penuh. Catatan revisi ketiga (mengoreksi dua versi sebelumnya).

## Hardening yang dieksekusi (putaran kedua, disetujui owner)

| # | Aksi | Hasil |
|---|---|---|
| 1 | Kill-switch pembayaran: Setting `payments.crypto.enabled`, `payments.winpay.enabled`, `payments.reseller.crypto.enabled`, `payments.reseller.winpay.enabled` = `false` | ✓ `/api/payment/methods` → semua `enabled:false` (Pakasir memang sudah KO; `PAKASIR_WEBHOOK_SECRET` di ceritain.env jadi basi) |
| 2 | Postgres `log_statement = mod` (ALTER SYSTEM + reload) | ✓ `SHOW log_statement` = mod |
| 3 | **Mailserver di-recreate dari image fresh `analogic/poste.io:latest`** + **NetworkMode host → bridge** dengan port mapping eksplisit: publik 25/110/143/465/587/993/995/4190, admin 8080/8443 **loopback-only**; env dipertahankan (`TZ=Europe/Berlin`, `HTTP_PORT=8080`, `HTTPS_PORT=8443`, `HTTPS=ON`) | ✓ healthy; SMTP banner 220 di 25 & 587; admin 302; webmail 200; `/home.php` & `/app/.env` 404 |
| 4 | Deep scan `/opt/posteio/data`: PHP <7 hari, script aneh, pola webshell | ✓ bersih (persistence memang di container FS, bukan volume) |
| 5 | **Rotasi 6 password mailbox** (`admin`, `bd`, `hendri`, `feyber`, `cs`, `sales`) via `doveadm pw` SHA512-CRYPT → `users.db` | ✓ hash 120 char; `doveadm auth test` admin **succeeded** |
| 6 | Rollback disiapkan: container lama di-rename `mailserver-pre-incident-20261128` (stopped) + inspect JSON tersimpan | ✓ |
| 7 | **Recreate ceritain-web/billing/meili** (`docker compose up -d --force-recreate`) | ✓ Up; image audit: web=nginx official, meili=official, billing=custom build 21 Nov (rebuild-from-source disarankan), mongodb=official (belum di-recreate — volume-based, cek FS terpisah) |
| 8 | Cek editan file bind-mount ceritain (`convos.js` dll, mtime 20 Nov 06:12–06:34 WIB) | ⚠️ konsisten dengan kerjaan dev "auto-title" 19 Nov — **owner perlu konfirmasi** |

Password mailbox baru diserahkan langsung ke owner via chat (tidak dicatat di dokumen).

## Ringkasan serangan (chain final)

1. **Vektor awal (indikasi):** endpoint `/app/.env` aplikasi webmail/mailserver
   (`analogic/poste.io` di docker **host-network**) terbaca lewat HTTP — historisnya 200
   lewat Cloudflare (16×, 3 hari terakhir), dan 200 (±3.6 KB) oleh penyerang 07:02 WIB.
   Content kemungkinan berisi kredensial mail/admin.
2. **Webshell:** `GET /home.php?c=<cmd>` — file PHP 167 byte ditanam di `/opt/www/home.php`
   (container mailserver). Karena container pakai **NetworkMode=host**, semua service
   loopback HOST terekspos ke webshell: Postgres eztu (5432), hermes (36097), gween (3401),
   ceritain-api (3012), meili (7700), redis, rspamd, poste admin (8080/8443).
3. **Eskalasi DB eztu:** attacker menulis sniffer + **TCP packet injector** (perl, checksum
   benar) yang menargetkan koneksi Postgres di port 5432 → injeksi `UPDATE "User" SET
   role='SUPERADMIN'` ke koneksi aplikasi yang sudah terautentikasi → **tanpa jejak HTTP
   maupun audit log** (Postgres `log_statement=none`).
4. **Akses admin:** login `zephyrblade@euploading.com` (email-code, mailbox domain
   penyerang) → browsing `/admin/orders|settings|logs|products` (±837 request 200, PII
   pelanggan terbaca) dari 141.11.243.59.
5. **Dump & exfiltrasi di sisi ceritain:** dumper wire-protocol MongoDB buatan sendiri →
   dump + tarball exfil (`/tmp/ev.tgz`, `/tmp/md.tgz`), capture bearer token & meter secret
   via sniffer, baca Maildir email bisnis (`feyber@eztopup.io`), SQLite `users.db` poste.io
   (username+hash), `/etc/shadow` container, config webmail (`config.inc.php`: des_key,
   smtp_pass), probe sudo/doveadm escape, scan docker network (172.28.0.x), OOB callback.
6. **Persistence:** 8+ akun LibreChat `@euploading.com` (probe1/2, prole…, budi…, zephyrblade,
   qaf4bgtr17) + injeksi `plugins` (agents-probe-hooks, dst) + percobaan `statefulCodeEnvironment`
   (code-exec) pada user `qaf4bgtr17`. Percobaan `setrole` Mongo **gagal/tidak persist**.
7. **Cleanup oleh attacker:** `rm -f` massal terhadap tool mereka di `/opt/www` (artefak
   tertinggal: `.ch_*.hex`, `.b64`, `.rootcap/`) — evidence diselamatkan ke
   `/root/evidence-optwww-20261128.tgz` (8.8 MB).

## Containment yang dieksekusi (semua terverifikasi)

| # | Aksi | Hasil |
|---|---|---|
| 1 | Role `zephyrblade` → `USER` + `bannedAt` + banReason | ✓ (DB) |
| 2 | `AccessBlock`: IP `141.11.243.59`, EMAIL `zephyrblade@euploading.com` | ✓ aktif |
| 3 | Revoke semua sesi Clerk zephyrblade | ✓ status `revoked` |
| 4 | Clerk `banned=true` via API | ✗ API menerima tapi flag tidak menempel (plan/fitur) — ditutupi AccessBlock + ban DB |
| 5 | ufw: deny 8080/8443 (sudah ada), **deny IP penyerang (insert 1)**, deny 12 port internal (27017, 7700, 3000, 3001, 3011, 3012, 3401, 36097, 5000, 5432, 6379, 9000) | ✓ terverifikasi dari luar (timeout) |
| 6 | nginx: blok `location = /home.php` + `location ~ \.php$` di semua 8 vhost + blok `/\.env` | ✓ `nginx -t` OK, reload OK, webshell → 404 |
| 7 | Hapus webshell + artefak `/opt/www`, **restart container mailserver** | ✓ healthy, `/home.php` 404 |
| 8 | Hapus 7 akun attacker di LibreChat Mongo | ✓ deletedCount=7 |
| 9 | **Rotasi password Postgres eztu** + update `.env` (apps/web & root) + `pm2 restart` | ✓ auth test OK; `methods` 200 (downtime app ±3 menit) |
| 10 | Rotasi `JWT_SECRET` + `JWT_REFRESH_SECRET` + `CERITAIN_METER_SECRET` di `/opt/ceritain/infra/ceritain.env` + **recreate container librechat** | ✓ Up |
| 11 | Evidence: tar `/opt/www` → `/root/evidence-optwww-20261128.tgz`; daftar perintah webshell terekstrak & di-decode | ✓ tersimpan |

State akhir terverifikasi: eztu 200, reseller 200, mailserver healthy, librechat Up,
webshell 404, tidak ada request penyerang setelah ufw-deny (terakhir 11:54:45 WIB).

## Yang TIDAK terjadi (dikonfirmasi)

- Tidak ada order dibayar/fulfillment (27 order PENDING, SupplierOrder 0, `Setting` aman).
- Tidak ada role != USER di Mongo LibreChat (setrole gagal).
- Tidak ada evidence baca `/var/www/eztu` (filesystem container terpisah; akses DB via
  network injection, bukan baca .env). TAPI karena NetworkMode=host + waktu bebas,
  **asumsikan semua secret yang lewat loopback/traffic terpapar**.
- authorized_keys root/deploy bersih (1 key: iskavonalia@192.168.1.9), crontab bersih,
  pg_roles bersih (postgres + eztopup).

## WAJIB manual (tidak bisa dieksekusi via CLI/API)

1. **REBUILD VPS dari nol** (rekomendasi kuat): host-network root + berbulan-bulan uptime
   = asumsikan compromised penuh. Migrasi eztu ke VPS baru, data di-restore dari backup
   bersih, lalu matikan yang lama.
2. **Rotasi via dashboard/eksternal:**
   - `CLERK_SECRET_KEY` (Clerk Dashboard → tidak bisa via API) → update `.env` + `pm2 restart`
   - Cryptomus & WinPay API key (dashboard merchant)
   - Google OAuth client secret (Google Cloud Console — sinkron dengan `GOOGLE_CLIENT_SECRET`)
   - Password admin poste.io + semua mailbox (SQLite users.db mereka dump — hash bisa
     di-crack offline), termasuk `des_key`/smtp Roundcube
   - Cloudflare: block IP 141.11.243.59 + review WAF (origin harusnya lock ke CF ranges)
3. **CREDS_KEY/CREDS_IV LibreChat**: rotasi memutus kredensial AI tersimpan user
   (perlu koordinasi) — belum dirotasi.
4. **Email bisnis terbaca** → review inbox `feyber@` (dan lainnya) untuk phishing lanjutan;
   cek forwarding/sieve rules; ganti password semua service yang reset-nya lewat email
   domain eztopup.io.
5. **PII pelanggan terbaca** (admin/orders) → evaluasi kewajiban notifikasi pelanggan
   sesuai hukum yang berlaku.
6. Host `mongod --bind_ip_all` (user `ikymian`) — pastikan bind 127.0.0.1 / auth aktif
   (port 27017 kini ufw-denied).
7. Postgres: aktifkan `log_statement = mod` (minimal) agar mutasi langsung berjejak.

## Perbaikan kode repo (setelah krisis)

1. `syncClerkUser` (`apps/web/src/lib/clerk.ts`): relink by email tanpa cek
   `verification.status === "verified"` → vektor take-over by email-squatting (latent).
2. AccessBlock tidak bisa blokir domain email (enum tanpa DOMAIN) → tambahkan.
3. Alert webhook 597 blocked tanpa ringkasan → agregasi harian via Discord.

## File terkait

- Evidence server: `/root/evidence-optwww-20261128.tgz`, backup nginx
  `/root/nginx-backup-incident-20261128/`, backup env `*.bak-incident-20261128`
- Ekstraksi perintah webshell: hasil decode tersimpan di mesin lokal sesi (cmds.txt)
