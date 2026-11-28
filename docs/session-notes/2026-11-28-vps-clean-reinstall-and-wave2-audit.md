# 2026-11-28 — Audit log Gelombang 2 & Clean Reinstall VPS `161.97.130.68`

Status: **SELESAI — VPS di-reinstall bersih (Ubuntu 24.04.5 LTS), seluruh 8 domain diverifikasi LIVE (HTTP 200), `/admin/` mailserver terkunci dari publik (403), kill-switch pembayaran masih aktif (`false`) menunggu rotasi secret eksternal.**

## 1. Temuan Audit Log Gelombang 2 (sebelum reinstall)

Pengecekan log live pada ~12:30 WIB menemukan **Gelombang Serangan Ke-2 (12:01–12:28 WIB)** yang sempat terjadi setelah containment pertama (11:55 WIB) — melengkapi catatan di [`2026-11-28-security-scan-admin-escalation.md`](2026-11-28-security-scan-admin-escalation.md):

- **Backdoor kedua:** `/admin/?c=<cmd>` di container `mailserver` lama (tidak terkena rule `\.php$` Nginx), digunakan dari 5 IP baru: `43.156.59.116`, `185.129.61.5`, `192.42.116.101`, `204.8.96.170`, dan Tor exit `185.220.101.106`.
- **Aksi penyerang di Gelombang 2:**
  - Uji API WinPay (`X-Winpay-Key` + invoice `checkout.winpay.id`) dan grep `/var/vmail`.
  - Eskalasi root container via `sudo -n /usr/bin/doveadm exec ../../../opt/www/.r*.sh`.
  - **DNS spoofer (`.dnsi.pl`) + TLS MITM (`.cap28609.js`, `.relay.pl`)** menyasar `www.lapakgaming.com`, `openexchangerates.org`, dan `api.clerk.com` (memicu 22× `ERR_TLS_CERT_ALTNAME_INVALID` di `eztu-error.log` sampai 12:18 WIB).
  - Raw packet sniffer Perl (`PF_PACKET`) pada `lo`/bridge, lalu **PostgreSQL TCP injector** ulang untuk dump daftar tabel (`40,9 KB`) dan skema `information_schema.columns` (`420,6 KB` pada 12:28:15 WIB).
  - Terputus total pada `12:28:37 WIB` saat `mailserver` di-recreate ke image fresh bridge; `185.220.101.106` masih probing hingga `12:32 WIB` (seluruhnya gagal `502`/`302`/`404`/`401`).
- **Temuan tambahan pada `AppLog` & `Setting` DB `eztopup`:**
  - `zephyrblade@euploading.com` mengunggah 1 gambar WebP via `/api/admin/blog/uploads` (`a6218857-eb72-461f-ac4f-62fb215f6754.webp`, 11:16:56 WIB) — **sudah dikecualikan dari backup/restore**.
  - `zephyrblade@euploading.com` mengubah `blog.ai.*` 30+ kali (11:27–11:30 WIB); saat ini `blog.ai.model = mimo-v2.5-pro` & `blog.ai.baseUrl = https://api.xiaomimimo.com/v1` (menyebabkan cron Blog AI warning `Unsupported model`).
  - Tidak ada order dibayar/fulfillment (`SupplierOrder = 0`, `B2BOrder = 0`).

## 2. Clean Backup & Reinstall VPS (Opsi 1 — IP tetap `161.97.130.68`)

Keputusan owner: tetap memakai VPS Contabo existing (reinstall OS bersih, hemat biaya dibanding VPS baru spek 6 vCPU / 12 GB RAM), restore semua layanan web + mailserver fresh, **skip Hermes** (`/root/.hermes`).

- **Backup bersih lokal (Mac, `chmod 700`):** `/Users/iskavonalia/Documents/kupon/vps-backup-2026-11-28` (521 MB, seluruh arsip terverifikasi `PGDMP`/`gzip -t`/`tar -tzf`/`SHA256SUMS.txt`).
  - Kode `eztopup`, `flexing` (`feyber.asia`), `dokterlift`, `ikymianstudios.si` (branch `setup/domain-bootstrap`) di-clone bersih dari GitHub — bukan copy binary OS lama.
  - DB di-restore bersih lewat `pg_dump`/`pg_restore` (PostgreSQL) dan `mongodump`/`mongorestore` (MongoDB).
  - Semua image Docker custom Ceritain (`librechat`, `ceritain-billing-api`, `tinyfish-search`) di-build ulang dari source bersih.
  - Direktori staging sementara di VPS (`/root/restore-20261128`, `/root/fast-eztu`) sudah dihapus setelah restore.

## 3. Hardening OS & Layanan di VPS Baru

- **OS:** Ubuntu 24.04.5 LTS updated, `unattended-upgrades`, `fail2ban` aktif, swap 4 GB.
- **SSH (`/etc/ssh/sshd_config.d/00-hardening.conf`):** `PasswordAuthentication no`, `PermitRootLogin without-password`, `PubkeyAuthentication yes`, `MaxAuthTries 4`, `X11Forwarding no`. Public key Mac (`id_ed25519`) dipasang untuk `root` dan `deploy` (`/home/deploy/.ssh/authorized_keys`, `chmod 600`, terverifikasi).
- **UFW Firewall:** default deny incoming; **6 IP penyerang diblokir di urutan teratas** (`141.11.243.59`, `43.156.59.116`, `185.129.61.5`, `192.42.116.101`, `204.8.96.170`, `185.220.101.106`); hanya membuka OpenSSH, 80/443, callback Lapakgaming (`188.166.205.40`), dan port email (25/110/143/465/587/993/995/4190). Semua port internal (3000/3001/3011/3012/3210/3401/5432/7700/8080/8081/8443/27017) tertutup total.
- **PostgreSQL 16:** `listen_addresses = localhost`, `log_statement = mod`.
- **`mail.eztopup.io`:** fresh `analogic/poste.io:latest` pada **bridge network** (admin 8080/8443 loopback-only) + Nginx mengunci `location ^~ /admin` hanya untuk `127.0.0.1` & Tailscale (`100.64.0.0/10`) → publik `403`.
- **`ikymianstudios.si`:** dijalankan terisolasi sebagai user non-root `ikymian` via systemd (`NoNewPrivileges=true`, `PrivateTmp=true`).
- **`ceritain` PM2 services:** `ceritain-supervisor`, `ceritain-model-health` (deps `mongodb` di `ceritain-billing-api`), dan `ceritain-render` (`ecosystem.config.cjs`, `chmod 600`) seluruhnya online dengan `0` restart.
- **Rotasi `CLERK_SECRET_KEY` (15:23–15:37 WIB):** owner memperbarui `/var/www/eztu/apps/web/.env`; key baru terverifikasi `HTTP 200` ke `api.clerk.com/v1/users`; proses `eztu` di-reload bersih dari `ecosystem.config.cjs` untuk mengatasi error `clerk_key_invalid` (digest `3647871248`) akibat cache env PM2 lama.
  - **Catatan operasional:** setiap selesai mengedit `/var/www/eztu/apps/web/.env`, jalankan `cd /var/www/eztu && pm2 delete eztu && pm2 start ecosystem.config.cjs && pm2 save` (sebagai `deploy`), bukan sekadar `pm2 restart eztu`, agar `ecosystem.config.cjs` memuat ulang isi `.env`.
- **Audit tambahan (15:25–15:30 WIB):**
  - **Blog AI settings:** `systemPrompt` & `baseUrl` dikonfirmasi tetap asli milik owner (bukan diubah permanen oleh penyerang); warning `Unsupported model mimo-v2.5-pro` berasal dari deprecation Xiaomi MiMo sejak akhir Okt 2026. Model teks aktif terverifikasi dari `api.xiaomimimo.com/v1/models`: `mimo-v2.6-pro`, `mimo-v2.6-pro-ultraspeed`, `mimo-v2.6-flash`.
  - **Role admin:** terverifikasi bersih — di `eztopup.io` hanya `aigaktidur@gmail.com` & `crispyskinpork@gmail.com` berstatus `SUPERADMIN`; di `ceritain.xyz` hanya `aigaktidur@gmail.com` di `CERITAIN_ADMIN_EMAILS`/`CERITAIN_SUPERADMIN_EMAILS` dan seluruh 614 user MongoDB berstatus `USER`. Tercatat 1 organisasi reseller dummy (`QA Reseller Test ZZ`) buatan `zephyrblade@euploading.com` (akun sudah banned, bukan admin situs).
- **Disk & RAM pasca-reinstall:** disk turun dari 50 GB (26%) → **25 GB (13%)**; RAM tersedia **8,3 GB**.

## 4. Hasil Verifikasi Produksi (Live dari Indonesia & VPS)

| Layanan / Endpoint | Status | Catatan |
|---|---|---|
| `https://eztopup.io/` | **HTTP 200** | PM2 `deploy/eztu` online dengan `CLERK_SECRET_KEY` baru, PostgreSQL 100% row cocok, `blog-images` bersih |
| `https://eztopup.io/api/payment/methods` | **HTTP 200** | Kill-switch masih `enabled: false` (aman sampai rotasi secret selesai) |
| `https://reseller.eztopup.io/` | **HTTP 200** | Online |
| `https://ceritain.xyz/` | **HTTP 200** | 6 container Up, MongoDB 65.627 dokumen (0 gagal), PM2 `ceritain-supervisor`/`model-health`/`render` online, geo-lock aktif |
| `https://mail.eztopup.io/webmail/` | **HTTP 200** | `mailserver` healthy (bridge) |
| `https://mail.eztopup.io/admin/` (publik) | **HTTP 403** | Terkunci khusus localhost & Tailscale |
| `https://mail.eztopup.io/home.php` | **HTTP 404** | Diblokir Nginx |
| `https://feyber.asia/` | **HTTP 200** | PM2 `root/feyber` online |
| `https://ikymianstudios.si/` | **HTTP 200** | `ikymianstudios.service` active (user `ikymian`) |
| `https://gweenstudios.xyz/` | **HTTP 200** | PM2 `deploy/gween-editor` online |
| `https://dokterlift.com/` | **HTTP 200** | Nginx static online |

## 5. Sisa Pekerjaan Manual (Wajib sebelum buka pembayaran lagi)

1. **Rotasi secret eksternal tersisa** → update `/var/www/eztu/apps/web/.env` lalu jalankan `cd /var/www/eztu && pm2 delete eztu && pm2 start ecosystem.config.cjs && pm2 save`:
   - ~~`CLERK_SECRET_KEY`~~ **(SELESAI & terverifikasi)**
   - **WinPay** merchant key/secret (kunci sempat diuji langsung di Gelombang 2)
   - **Lapakgaming** API secret & **OpenExchangeRates** key (menjadi target DNS spoof/MITM Gelombang 2)
   - **Cryptomus** API key & **Google OAuth** client secret
   - Kunci DKIM/mail & review forwarding/sieve rules di semua mailbox
2. **Update model Blog AI** di admin `eztopup.io` dari `mimo-v2.5-pro` ke **`mimo-v2.6-pro`** (atau `mimo-v2.6-flash`) jika ingin auto-blog berjalan kembali.
3. **Aktifkan kembali pembayaran** (`payments.winpay.enabled`, `payments.crypto.enabled`, reseller) **hanya setelah** poin 1 selesai.
4. **Opsional bersih-bersih & hardening lanjutan:**
   - Hapus organisasi reseller dummy `QA Reseller Test ZZ` milik `zephyrblade@euploading.com` jika tidak diperlukan.
   - Re-login Tailscale di VPS (`ssh -i ~/.ssh/id_ed25519 root@161.97.130.68 'tailscale up'`) jika ingin mengakses `https://mail.eztopup.io/admin/` via Tailscale.
   - Pindahkan DNS `gweenstudios.xyz` & `ikymianstudios.si` ke proxy Cloudflare, lalu kunci UFW port `80/443` hanya ke range IP Cloudflare + `188.166.205.40`.
   - Blokir 6 IP penyerang di Cloudflare WAF (IP Access Rules / Custom Rule).
   - Hapus folder backup lokal `/Users/iskavonalia/Documents/kupon/vps-backup-2026-11-28` setelah 3–7 hari dipastikan semua layanan & data stabil (berisi `.env` & dump DB).

## 6. Perbaikan Kode & Deploy (15:43 WIB)

- **Force-delete member dengan order** (`apps/web/src/app/api/admin/members/[id]/route.ts`, `apps/web/src/app/(admin)/admin/members/MembersManager.tsx`):
  - `DELETE /api/admin/members/:id?force=1` kini menghapus member beserta order-nya dalam satu transaksi (`prisma.$transaction`), termasuk membersihkan organisasi reseller kosong yang ditinggalkan (0 member/B2B order/wallet ledger) seperti `QA Reseller Test ZZ`.
  - Guard keamanan: member dengan `B2BOrder` tetap ditolak (409); member dengan order berbayar/terpenuhi (`PAID`/`PROCESSING`/`COMPLETED`/`REFUNDED`/`DISPUTED` atau punya `SupplierOrder`) hanya bisa dihapus oleh `SUPERADMIN`.
  - Perbaikan keamanan penting: `AccessBlock` jenis `EMAIL`/`CLERK_ID`/`IP` **tetap dipertahankan aktif** saat member dihapus (hanya blokir `USER_ID` lokal yang di-revoke), sehingga menghapus akun penyerang tidak mencabut blokir email/IP-nya.
  - UI modal konfirmasi menampilkan jumlah order yang ikut terhapus permanen (`Delete + N orders`).

## Status Git & Deploy

- Commit perbaikan member delete + catatan sesi ini di-push ke `origin/main` dan di-deploy ke VPS `161.97.130.68` (`eztu`).
- Perubahan WIP lain di working tree lokal (produk/analytics/clerk) tidak ikut di-commit.
