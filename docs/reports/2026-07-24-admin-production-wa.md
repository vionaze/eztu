# Laporan Founder / Ops (siap copy ke grup WA)

**Tanggal:** 24 Juli 2026  
**Project:** EZTopUp (eztopup.io)  
**Repo:** github.com/vionaze/eztu · branch `main`  
**Commit referensi:** `ffa20bf` (dan rantai sebelumnya di main)

---

## Versi pendek (copy-paste WA)

```
Update EZTopUp — 24 Jul 2026 (Admin production)

Yang sudah naik ke main (siap pull VPS):

✅ Admin dashboard production (data real DB, bukan dummy)
✅ Products: list + detail edit (variant, harga, SKU, hide/show store)
✅ Product type: Top-up (User ID/Zone) vs Kode voucher
✅ Categories: tambah / edit / hapus (hapus wajib ketik nama kategori)
   → produk orphan jadi Uncategorized, assign ulang di Products
✅ Orders: klik baris → preview lengkap (email, User ID, Zone, payment, fulfillment)
   → modal tanpa scroll, waktu Paid/Created WIB
✅ Blog: CRUD manual + AI helper opsional (scope blog only)
✅ Blog AI settings: on/off, API base/key/model, negara editable, jadwal, auto-publish
✅ Activity Logs berwarna (Sales/Payment/Auth/Admin/dll) · waktu WIB GMT+7
✅ Superadmin badge di header + log Auth saat buka admin
✅ Security: CSP + Clerk domain custom, cron secret, callback token fail-closed
✅ Login Clerk diperbaiki (CSP sempat blokir clerk.eztopup.io)
✅ Deploy VPS 1 perintah: cd /var/www/eztu && pnpm deploy:vps
   (user deploy · include migrate + build + pm2 restart eztu)

Catatan ops penting:
• Deploy HARUS sebagai user deploy (bukan root)
• WAJIB pnpm db:migrate (atau lewat deploy:vps) — tanpa migrate admin products error
• SUPPLIER_SECRET_KEY di env VPS wajib diisi kalau fulfillment jalan (error di order detail = key kosong)
• CRON_SECRET + crontab Bearer untuk blog AI schedule
• ADMIN_EMAILS=email superadmin di env
• Duplikat User (email sama, clerkId beda) bisa bikin promote SUPERADMIN berisik di log — bersihkan di DB bila perlu

Next suggested:
• Isi SUPPLIER_* + test E2E top-up MLBB
• Nyalakan Blog AI + negara hanya setelah keputusan konten
• Rotate CRON_SECRET kalau pernah share di chat

Detail: docs/session-notes/2026-07-24-admin-production-ops.md
```

---

## Versi agak formal

**Subject:** Update progress EZTopUp — admin production, catalog, logs, deploy

Tim,

Ringkasan progress admin & ops (akhir Juli 2026):

### 1. Admin panel production
- Dashboard, orders, products, categories, blog, settings, logs memakai data database.
- UI admin dipadatkan (bento/console density, spacing lebih rapat).
- Badge role **SUPERADMIN/ADMIN** + email di header.
- Activity Logs: kategori berwarna; waktu **WIB (Asia/Jakarta, GMT+7)**; session Auth tercatat (throttle ~6 jam).

### 2. Catalog
- **Products:** create + edit full (fulfillment Top-up vs Voucher, variant, hide/show).
- **Categories:** CRUD; delete butuh ketik nama exact; produk pindah ke Uncategorized.
- Checkout top-up menyimpan **User ID / Zone** di order; order detail menampilkan field itu.

### 3. Blog & AI
- Artikel manual + helper AI (bukan wajib).
- Settings: API OpenAI-compatible, negara, schedule, auto-publish.
- AI scope tetap **blog only** (tidak sentuh payment/admin core).

### 4. Security & auth
- Security headers/CSP; patch Next; cron auth; callback token production fail-closed.
- Login: CSP diperbaiki agar Clerk di `clerk.eztopup.io` load form sign-in.

### 5. Deploy
```bash
sudo -iu deploy
cd /var/www/eztu
git pull --ff-only origin main
pnpm deploy:vps
```
Script: pull → install → **migrate** → generate → build → `pm2 restart eztu --update-env`.

### Ops checklist
- [ ] Production sudah `deploy:vps` sampai commit terbaru?
- [ ] `SUPPLIER_SECRET_KEY` (+ URL supplier) terisi?
- [ ] `CRON_SECRET` + crontab blog AI (jika dipakai)?
- [ ] `ADMIN_EMAILS` benar?
- [ ] Order fulfillment test (MLBB top-up) lulus?

Terima kasih.

---

## Checklist founder (ops)

| Item | Status / aksi |
|------|----------------|
| Pull + migrate + build VPS | `pnpm deploy:vps` sebagai `deploy` |
| Fulfillment supplier | Set env; cek error order detail |
| Blog AI | Off dulu OK; on + Save saat siap |
| Login form Clerk | Setelah deploy CSP fix, hard refresh `/login` |
| Superadmin DB | Kalau dual User email, bersihkan di Postgres |
