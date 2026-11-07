# Handoff EZTopUp — 7 Oktober 2026

## Mulai dari sini

User pindah harness dan meminta model tetap **GPT 6.1 Sol**. Ini preferensi
untuk harness berikutnya; sesi ini tidak mengubah pengaturan model/harness.
Baca dokumen ini sebelum melanjutkan. Jangan mengulang ekspansi katalog atau
mengubah margin production hanya karena membaca handoff.

Repo aktif: `/Users/iskavonalia/Documents/kupon/app`, branch `main`.
Remote: `git@github.com:vionaze/eztu.git`.
Folder chat `/Users/iskavonalia/Documents/ChatGPT/voucher` merupakan workspace
artifact Excel, bukan checkout kode aplikasi.
Website: `https://eztopup.io`. VPS: `/var/www/eztu`, PM2 `eztu`, user runtime
`deploy`. Koneksi tersimpan di Termius dengan nama EZTOPUP. Jangan menyalin
credential ke docs atau chat.

Workflow user: minimum sufficient approach. Restate goal, non-goals, acceptance,
dan bagian yang tetap sebelum implementasi. Tidak perlu banyak agent,
abstraksi baru, test tambahan, atau konfirmasi berulang untuk kerja reversible
yang sudah diizinkan. Bahasa percakapan Indonesia santai.

## Perubahan kode terakhir

Semua commit berikut sudah di-push ke `origin/main`:

| Commit | Hasil |
| --- | --- |
| `f7e0108` | Deploy rutin tidak lagi mengimpor ulang Excel lama. Katalog diambil langsung dari supplier official. |
| `af29f0f` | Grouping kartu paket, Best value, dan fallback SKU ketika live quote mengonfirmasi stok kosong. |
| `450f5d6` | Menyembunyikan paket out of stock sesuai koreksi user. |
| `ef38b6f` | Perbaikan grouping untuk produk global. |
| `4cc41b7` | Grouping generik untuk seluruh produk setelah market eligibility. |
| `a685e98` | Badge Best value menjadi pill emas, ikon Lightning, teks tebal uppercase, dan glow tipis. |

### Aturan paket yang disepakati

- Berlaku untuk **semua produk dan SKU** pada halaman detail produk.
- Satu kartu untuk **nama paket persis sama + harga display IDR sama** di dalam
  daftar SKU yang eligible bagi negara pengunjung.
- Nama/nominal berbeda tidak digabung hanya karena harganya sama.
- Harga berbeda tetap menghasilkan kartu berbeda untuk paket yang sama.
- Negara supplier tidak memecah kartu setelah eligibility diterapkan.
- SKU ekuivalen lainnya disimpan sebagai fallback, tidak tampil sebagai kartu
  duplikat.
- Best value adalah harga termurah yang tersedia untuk setiap nama paket di
  market eligible. Bukan harga per diamond/unit atau satu badge untuk seluruh
  katalog.
- Semua SKU kosong: grup disembunyikan. User mengoreksi permintaan awal
  “Out of stock”; keputusan terakhir adalah **tetap sembunyikan OOS**.
- Live quote hanya mencoba SKU ekuivalen berikutnya untuk error stok yang
  dikonfirmasi (`SUPPLIER_SKU_UNAVAILABLE`). Error lain tetap error.
- Quote mengikat `variantId` dan signed token; pembayaran memakai SKU persis
  yang di-quote. Jika stok berubah sebelum create payment, refresh lalu minta
  pembeli konfirmasi ulang. Tidak ada pindah SKU setelah order dibayar.

File penting:

- `apps/web/src/lib/product-packages.ts`
- `apps/web/src/lib/product-packages.test.ts`
- `apps/web/src/app/(storefront)/products/[slug]/ProductDetailClient.tsx`
- `apps/web/src/lib/supplier-pricing.ts`
- `apps/web/src/app/api/payment/create/route.ts`
- [Rencana paket](../plans/2026-10-07-package-display.md)

Badge terakhir hanya mengubah markup visual di ProductDetailClient. Harga,
grouping, stok, payment gateway, paid-order fulfillment, dan margin tetap.
TypeScript dan changed-file ESLint lolos untuk `a685e98`. Badge dicek pada
preview kartu memakai kelas Tailwind yang sama. Tidak ada test baru untuk
perubahan visual ini. Sembilan test package/stock/pricing lolos pada perubahan
grouping; build penuh lolos sebelum commit badge.

## Katalog dan deploy

Production memiliki **9.826 SKU supplier kanonis, 14 produk**, dengan **1.867
available** dan **7.959 lainnya** pada snapshot 7 Oktober 2026 pukul 16.59 WIB.
Termasuk fallback dan SKU kosong; bukan jumlah kartu yang tampil per pengguna.
Ekspansi sebelumnya menambah 9.083 SKU. Margin SKU existing dipertahankan;
SKU baru mewarisi pasangan markup umum produk/negara.

[Laporan ekspansi dan backup](../reports/2026-10-07-product-sku-expansion.md).
Supplier sync hourly memakai `--expand`. Deploy memakai full import supplier,
bukan Excel. Ada 25 SKU tanpa harga/modal supplier valid (INT_MAX sentinel /
unpriced); tetap tersimpan tetapi tidak purchasable.

User menjalankan `pnpm deploy:vps` di Termius. Observasi terakhir sebelum
ekspor: supplier sync selesai (9.826 / 1.867 / added 0), Next build compiled
dan TypeScript selesai, lalu collecting build traces. **Completion restart PM2
dan versi production setelah itu belum diverifikasi dalam sesi ini.**
Commit badge `a685e98` dibuat setelah deploy user mulai, jadi jangan klaim
badge emas sudah live hanya karena commit sudah di-push.

Command biasa, sebagai `deploy`:

```bash
cd /var/www/eztu
git pull --ff-only origin main
pnpm deploy:vps
```

Jika pull menunjukkan `Already up to date`, itu hanya status Git. Build/restart
tetap diperlukan untuk perubahan web yang belum dideploy. Jangan mengetik
command ke terminal yang sedang menjalankan deploy atau menginterupsinya.

DB lokal tertinggal: `ProductVariant.replacementForId` belum ada. Jangan
menganggap data lokal sebagai snapshot production, atau memperbaiki/migrasi
DB lokal di luar scope hanya untuk preview.

## Excel margin: artifact dan status sebenarnya

Permintaan user: daftar margin website di Excel yang bisa diedit dan di-upload
lagi di chat, sebagai dasar rencana dashboard khusus B2B. **Dashboard B2B,
importer otomatis, dan tier harga B2B belum dibangun. Harga production belum
diubah oleh pekerjaan Excel ini.**

Data diekspor read-only langsung dari `ProductVariant` production pada
`2026-10-07T09:59:48.425Z` (16.59 WIB), dengan filter published variant,
published product, supplierSku tidak null, replacementForId null.
Tidak mengakses order/customer. Ada 9.826 ID unik.

Artifact lokal, **jangan commit data margin/JSON/XLSX ke repo publik**:

```text
/Users/iskavonalia/Documents/ChatGPT/voucher/outputs/01a115a4-95dd-7c02-a750-dc4667d2e33d/EZTOPUP-Margin-Website-2026-10-07.xlsx
```

Folder kerja dan builder:

```text
/Users/iskavonalia/Documents/ChatGPT/voucher/.spreadsheet_work/01a115a4-95dd-7c02-a750-dc4667d2e33d/
  build-margin.mjs
  eztopup-margin-export-2026-10-07.json
  summary.png
  sku.png
  prices.png
```

Workbook telah diekspor (sekitar 1,9 MB) dengan dua sheet:

- `Ringkasan`: jumlah SKU/stok dan rentang markup per produk, instruksi edit.
- `Margin SKU`: satu baris per SKU, termasuk fallback/OOS. Modal, markup asli,
  input markup baru, harga/laba kotor, ID stabil, dan timestamp sumber.
- Kolom **I–J kuning**: markup baru non-crypto / crypto. Kosong = tidak berubah.
  **0% = markup nol**. Input persen, maksimal dua desimal persen.
- Identitas `variant_id`, product slug/id, supplier SKU, dan negara harus tetap.
- Preview setara IDR; bukan quote crypto USD live. Laba kotor sebelum fee,
  promo, FX, dan biaya lainnya. Modal snapshot bisa berubah saat checkout.
- Dua puluh lima SKU tanpa modal valid memiliki harga/laba kalkulasi kosong,
  tetapi markup asli tetap dicantumkan.

Rumus harga sama dengan website:
`ceil(modal * (10000 + markupBps) / 10000)`.
Markup adalah persentase atas **modal**, bukan gross margin atas harga jual.
Excel menyimpan persen sebagai pecahan: bps / 10000.

Pengecekan selesai: count total/available, ID unik, baris awal/tengah/akhir,
preview blank/0%/8,5%, dan scan formula error (0 hasil). Temporary edits sudah
dipulihkan. Semua sheet dirender.

**Masih perlu satu perbaikan format sebelum delivery Excel:** visual review
terakhir menemukan `Ringkasan!B3` tampil sebagai serial tanggal
`46302.41653` karena ISO timestamp di-coerce oleh artifact tool. Beri number
format tanggal UTC yang terbaca (`yyyy-mm-dd hh:mm:ss`) pada B3 dan timestamp
`Margin SKU!T8:U9833`, atau simpan timestamp eksplisit sebagai teks. Jangan
memodifikasi nilai margin. Render ulang bagian yang berubah, cek export, lalu
kirim workbook ke user. Aplikasi Excel native belum dipakai untuk verifikasi.

Gunakan skill Spreadsheets dan bundled `@oai/artifact-tool`; builder yang sama
sudah tersedia. Native export menulis `.xlsx.inspect.ndjson` besar sebagai
support file. File itu bukan deliverable user.

Catatan engine: `IF(input="",old,input)` memperlakukan numeric zero sebagai
blank pada kalkulator artifact tool yang dipakai. Builder sudah memakai
`IF(ISBLANK(input),old,input)`; blank dan nol lolos verifikasi. Jangan regresi
ke pengecekan nol/blank yang sama.

Saat user upload hasil edit, cocokkan berdasarkan ID stabil dan original
markup, tampilkan perubahan konkret, periksa snapshot production terbaru
sebelum menerapkan. Jangan menganggap margin website sebagai margin B2B yang
sudah aktif. Penerapan harga/tier B2B memerlukan scope user yang jelas.

## Urutan lanjut di harness baru

1. Tetap gunakan **GPT 6.1 Sol** sesuai preferensi user.
2. Baca handoff ini; repo aplikasi berbeda dari folder artifact chat.
3. Selesaikan format timestamp Excel dan delivery tanpa mengubah harga.
4. Jika user ingin badge live, cek status deploy/HEAD VPS sebelum menjalankan
   deploy lagi. Commit badge yang harus masuk adalah `a685e98` atau sesudahnya.
5. Untuk dashboard B2B, klarifikasi tier dan target perubahan ketika scope
   implementasinya diberikan; jangan membangun dashboard dari handoff saja.

Direktori `docs/history/` sudah untracked sebelum perubahan ini. Isi existing
tidak diedit atau ikut di-stage oleh sesi ini.
