# EZTopUp dan ceritAIn — Riwayat Proyek Kanonis

Terakhir diperbarui: 2026-08-04, Asia/Jakarta

- Repo EZTopUp: /Users/iskavonalia/Documents/kupon/app
- Branch: main
- Path produksi EZTopUp: /var/www/eztu
- Path konten ceritAIn: /var/www/ceritain

Dokumen ini adalah handoff utama lintas sesi. Isinya mencatat tujuan produk,
implementasi, operasi deployment, keputusan penting, dan pekerjaan lokal yang
belum boleh dipush. Semua nilai rahasia sengaja tidak dicantumkan.

## 1. Aturan kerja permanen

- Komunikasi dan handoff menggunakan bahasa Indonesia yang ringkas dan langsung.
- Uang untuk keputusan pembayaran disimpan sebagai integer, bukan floating point.
- Credential hanya disimpan di environment mesin yang dituju dan tidak pernah
  masuk Git.
- Perubahan dirty milik user yang tidak berhubungan harus dipertahankan.
- ClinkBill tidak boleh di-commit atau dipush sampai user secara eksplisit
  mencabut larangan tersebut.
- Bahasa storefront mengikuti locale perangkat/browser pengunjung. Country
  selector hanya mengontrol market, harga, dan currency.
- Artikel blog dibuat satu per satu sesuai market dan bahasa market tersebut.
- Setiap artikel AI wajib mempunyai CTA lokal yang menarik dan mengarah ke
  https://eztopup.io untuk top-up atau pembelian voucher.
- Brand supplier fulfillment asli tidak boleh muncul pada wording publik EZTopUp.

## 2. Status Git pada handoff ini

Commit terakhir yang sudah dipush ke main dan origin/main:

    840bd82 Add blog visitor analytics reports

Eksperimen pembayaran ClinkBill masih berada di working tree lokal dan belum
di-commit. Isinya mencakup route pembayaran, UI checkout dan order, package
payment, helper, perubahan Prisma, serta migrasi lokal.

Sebelum push fitur lain:

1. Jalankan git status --short.
2. Stage hanya file atau hunk yang memang diminta.
3. Cari clink, PaymentEvent, PAYMENT_REVIEW, dan DISPUTED di staged diff.
4. Jalankan git diff --cached --check.
5. Push hanya setelah staged commit dipastikan bebas ClinkBill.

## 3. Live FX, model uang, dan underpayment crypto

### Masalah awal

Storefront menampilkan Rp48.800 sebagai USD 3.15, sedangkan konversi publik saat
itu menilai USD 3.15 sekitar Rp56.854. Harga IDR dan jumlah stablecoin yang harus
dibayar menjadi tidak konsisten dan berisiko merugikan persepsi customer.

### Model P0/P1 yang diimplementasikan

- Harga katalog IDR tetap menjadi source of truth.
- Nilai USD untuk keputusan checkout memakai integer cents.
- Server mengambil FX, membuat quote bertanda tangan, menyimpan cache, dan
  memberikan expiry.
- Checkout memverifikasi quote sebelum membuat invoice.
- Order menyimpan snapshot rate, source, quoted time, expiry, dan total cents.
- Cryptomus menerima angka yang sama dengan total yang ditampilkan ke customer.
- Kolom float lama dipertahankan hanya untuk kompatibilitas.
- UI memperingatkan bahwa gas/network fee dibayar user sesuai chain.
- Pembayaran kurang dari jumlah wajib menjadi UNDERPAID.
- Order UNDERPAID tidak boleh masuk fulfillment dan customer diarahkan ke
  cs@eztopup.io.

### Provider FX

- Primary: Open Exchange Rates.
- Fallback: CurrencyFreaks.
- Benchmark harian resmi: JISDOR Bank Indonesia.
- Env: OPEN_EXCHANGE_RATES_APP_ID, CURRENCYFREAKS_API_KEY, FX_QUOTE_SECRET,
  FX_CACHE_MINUTES, FX_MAX_STALE_MINUTES, dan FX_QUOTE_LIFETIME_MINUTES.

Plan: ../plans/2026-07-27-live-fx-stablecoin-underpayment.md

Commit utama:

    b440864 Add live FX pricing and underpayment holds

## 4. Admin dan operasi

- Admin memakai console layout padat dan responsif.
- Waktu dashboard/admin menggunakan Asia/Jakarta, WIB GMT+7.
- Products mendukung Top-up dan Voucher, variant, publish state, label,
  game/server identifier, harga, dan cost.
- Categories mendukung CRUD dan typed delete; product boleh Uncategorized.
- Orders memperlihatkan data customer, payment, dan fulfillment.
- Members mendukung operasi admin serta block/ban.
- AppLog mencatat sales/payment, blog, perubahan admin, dan auth relevan.
- Security mencakup access block, trusted IP, CSP Clerk, fraud alert, callback
  authentication, dan purchase history.

Handoff rinci:

    ../session-notes/2026-07-24-admin-production-ops.md

## 5. Blog AI

### API dan model

- Base URL default: https://api.openai.com/v1
- Model artikel multilingual yang dipilih: gpt-5.6-terra
- API key tetap server-side.
- Scope AI dikunci untuk konten blog.

### Market aktif

    SA, AE, RU, KZ, TR, IQ, EG, PH, BR, ID, US, JO, KW, QA, BH, OM,
    BY, AM, UZ, GE, MY, TH, SG, VN, IN, JP, KR, GLOBAL

Admin Settings mempunyai chip market serta Select all dan Unselect all.

### Bahasa, rotasi, dan CTA

- Generator otomatis berputar ke market berikutnya, tidak mengulang market
  pertama terus-menerus.
- Run satu artikel per jam tetap memajukan cursor market.
- Bahasa dipetakan sesuai market: Arabic, Russian, Kazakh, Turkish, Indonesian,
  Malay, Thai, Filipino, Portuguese Brazil, Hindi, Japanese, Korean, atau
  English sesuai negara.
- Prompt gambar membawa judul artikel dalam bahasa artikel.
- Setiap artikel harus memiliki CTA lokal menuju https://eztopup.io.

Commit terkait:

    b0d6b76 Add AI image prompts and blog market controls
    f6c4fbe Fix blog market language and hourly rotation

## 6. Uploader gambar blog

- Hero dan thumbnail mempunyai uploader terpisah.
- Source yang diterima: JPG, JPEG, dan PNG.
- Sharp memvalidasi, auto-rotate, resize tanpa memperbesar, lalu mengubah ke WebP.
- Source bytes hanya berada di memory dan tidak disimpan ke disk.
- Disk hanya menyimpan file WebP dengan nama acak.
- Env BLOG_UPLOAD_DIR menunjuk persistent disk.
- Rekomendasi produksi: /var/lib/eztopup/blog-images.
- Public media route membatasi path agar tidak bisa traversal.
- Nginx EZTopUp menggunakan client_max_body_size 15M untuk upload.

Plan:

    ../plans/2026-07-28-blog-image-uploader.md

Commit:

    f7ee4cf Add blog image uploader and publish notifications

### Notifikasi Discord blog

- Artikel yang auto-publish bisa mengirim notifikasi Discord.
- Env yang dipakai: DISCORD_BLOG_WEBHOOK_URL.
- Nilai webhook yang pernah muncul di chat tidak disimpan di docs ini.
- Rotasi webhook dianjurkan jika exposure dianggap berisiko.

## 7. KIE Z-Image

- Provider/model: KIE Z-Image.
- Hero dan thumbnail memakai dua API call yang independen.
- Hero: 16:9.
- Thumbnail: 4:3.
- Jika auto image generation aktif, job dimulai setelah artikel AI tersimpan.
- Admin dapat menjalankan Generate both untuk artikel yang belum bergambar.
- Job disimpan dalam BlogImageGeneration dan dapat direkonsiliasi bila callback
  terlewat.
- Result hanya diunduh dari HTTPS host yang diizinkan.
- Result masuk pipeline WebP lokal dan memperbarui field gambar yang sesuai.
- Callback KIE diverifikasi dengan KIE_WEBHOOK_HMAC_KEY.
- Nilai HMAC dan API key tidak disimpan di Git atau docs.

Plan:

    ../plans/2026-07-30-kie-z-image-blog-generation.md

Commit:

    bd1e3bc Add KIE Z-Image blog generation

## 8. Laporan pengunjung blog

Admin Blog menampilkan:

- unique visitors hari ini;
- 7 hari terakhir;
- 30 hari terakhir;
- 365 hari terakhir;
- total masing-masing bulan selama 12 bulan terakhir;
- rincian per artikel untuk bulan yang dipilih.

Aturan counting dan privacy:

- Tracking hanya berjalan setelah pengunjung memilih Accept all.
- Browser mendapat random first-party HttpOnly SameSite=Lax cookie.
- Database hanya menyimpan HMAC-SHA256 identifier tersebut.
- IP, email, user ID, dan user-agent tidak disimpan untuk laporan.
- Bot umum diabaikan.
- Refresh dideduplikasi berdasarkan artikel, visitor hash, dan tanggal Jakarta.
- Total periode menghitung visitor unik lintas seluruh blog.
- Detail artikel menunjukkan setiap artikel yang dibaca visitor.
- Data historis baru dimulai sesudah migrasi tracking dideploy.
- BlogPost.views lama dipertahankan sebagai legacy views.
- Produksi wajib mempunyai BLOG_VIEW_HASH_SECRET minimal 32 karakter.

Plan:

    ../plans/2026-07-31-blog-visitor-analytics.md

Commit:

    840bd82 Add blog visitor analytics reports

## 9. Status ClinkBill

ClinkBill pernah direncanakan sebagai opsi Web2 di samping Cryptomus, dengan
gateway selector, embedded checkout, webhook, status order, dan label gateway
pada admin/Discord.

Akun produksi tidak lolos. Instruksi aktif:

> Jangan pernah push pekerjaan ClinkBill ke GitHub.

Seluruh route, component, schema, migration, package, env hunk, dan helper
ClinkBill tetap lokal. Tidak ada key atau secret ClinkBill di history ini.

## 10. Deployment EZTopUp

Command produksi standar dari root repo:

    git pull --ff-only origin main && pnpm deploy:vps

scripts/deploy-vps.sh menjalankan:

1. fetch dan fast-forward pull;
2. dependency install;
3. Prisma migrate deploy dan generate;
4. production build;
5. PM2 restart dengan update environment;
6. PM2 save.

Perubahan env server-side biasanya cukup dengan PM2 restart --update-env.
Perubahan NEXT_PUBLIC memerlukan rebuild. Full deploy tetap menjadi jalur standar
paling aman setelah pull.

## 11. ceritAIn

### Hosting

- Domain: ceritain.xyz dan www.ceritain.xyz.
- Berada di VPS yang sama dengan EZTopUp, tetapi memakai Nginx server block lain.
- Nginx mem-proxy ke http://127.0.0.1:3001.
- SSL dikelola Certbot.
- Root konten: /var/www/ceritain.
- Landing page: /var/www/ceritain/index.html.

### Logo

Source lokal:

    /Users/iskavonalia/Downloads/ceritAIn-logo-transparent-sized.png

Lokasi VPS:

    /var/www/ceritain/public/ceritain-logo.png

URL publik yang benar:

    https://ceritain.xyz/public/ceritain-logo.png

/ceritain-logo.png pernah mengembalikan HTML fallback dengan content-type
text/html. /public/ceritain-logo.png mengembalikan image/png dengan benar.

Source logo berukuran 1610×473 dan tidak boleh tampil pada natural width. Rule
responsif stabil:

    .brand-logo {
      width: clamp(145px, 13vw, 205px);
      max-width: 48vw;
      height: auto;
      object-fit: contain;
    }

### Coming-soon page terbaru

Desain terakhir adalah editorial-cinematic hitam untuk ceritAIn AI Film Festival
2026: ivory typography, orange dan neon-lime accents, hero dua kolom responsif,
panel “The next frame hasn't been imagined yet”, program chips, serta info rail.
Desktop asimetris; mobile menjadi satu kolom tanpa horizontal overflow.

Artifact lengkap:

    ./artifacts/ceritain-coming-soon-index.html

Cloudflare dapat menahan HTML atau respons gambar lama. Purge cache URL terkait
atau pakai query version untuk verifikasi setelah perubahan.

## 12. Checklist env berdasarkan fitur

Hanya nama variabel yang dicatat; tidak ada value.

Core/auth/database:

- DATABASE_URL
- Clerk publishable dan secret keys
- Clerk redirect URLs
- ADMIN_EMAILS
- TRUSTED_IPS

Payments/FX:

- CRYPTOMUS_MERCHANT_ID
- CRYPTOMUS_PAYMENT_API_KEY
- CRYPTOMUS_API_URL
- CRYPTOMUS_CURRENCIES
- OPEN_EXCHANGE_RATES_APP_ID
- CURRENCYFREAKS_API_KEY
- FX_QUOTE_SECRET
- FX cache, stale, dan lifetime settings
- PAYMENT_INVOICE_EXPIRY_MINUTES

Blog/images:

- BLOG_AI_BASE_URL
- BLOG_AI_API_KEY
- BLOG_AI_MODEL
- CRON_SECRET
- BLOG_UPLOAD_DIR
- KIE_IMAGE_GENERATION_ENABLED
- KIE_API_KEY
- KIE_API_BASE_URL
- KIE_WEBHOOK_HMAC_KEY
- KIE_CALLBACK_URL
- KIE_IMAGE_ALLOWED_HOSTS
- BLOG_VIEW_HASH_SECRET

Notifications/fulfillment:

- DISCORD_WEBHOOK_URL
- DISCORD_FRAUD_WEBHOOK_URL
- DISCORD_BLOG_WEBHOOK_URL
- SUPPLIER_API_URL
- SUPPLIER_SECRET_KEY
- ORDER_STATUS_CALLBACK_TOKEN
- ORDER_STATUS_CALLBACK_URL
- email delivery keys dan sender settings

## 13. Verification standar

1. Focused unit tests.
2. Prisma validate dan generate setelah schema berubah.
3. Monorepo typecheck.
4. Targeted lint.
5. Production build.
6. Inspect staged diff sebelum commit.
7. Smoke test produksi setelah deploy.

Analytics blog telah lolos lima focused tests, Prisma validation/generation,
monorepo typecheck, targeted lint, dan production build sebelum commit 840bd82
dipush.
