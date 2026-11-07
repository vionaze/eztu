# Session notes — Phantom Blade Zero catalog (7 Nov 2026)

## Ringkasan

Menambahkan game **Phantom Blade Zero** (Steam CD Keys) ke katalog:

- Web utama: produk `phantom-blade-zero`, kategori **Game Vouchers**, tipe VOUCHER.
- Reseller: tier pricing `TIER_1` + `TIER_2` dengan markup **2,6%** di atas modal supplier.
- Cakupan pasar: **Indonesia only** sesuai catatan pada workbook sumber.
- Status kode: commit `b523a97`, sudah di-push ke `origin/main`.
- Status produksi: **belum di-deploy**; akses SSH VPS ditolak (`publickey`).

## Sumber data & keputusan bisnis

Workbook asal: `~/Documents/ez-compro/phantom blade steam.xlsx`.
Salinan yang di-track repo: `data/phantom blade steam.xlsx`.

Workbook asli berisi lima negara (Indonesia, Malaysia, Philippines, Thailand,
Singapore, Brazil). Catatan di sheet:

> ambil yg kuning (indo aja dulu karena luar negri crypto kan blm live nunggu
> approval bimasakti)

Karena itu workbook yang diimpor hanya memuat dua baris Indonesia. Harga
negara lain di workbook memakai mata uang lokal (MYR/PHP/THB/SGD/BRL), bukan
IDR, sehingga tidak aman dimasukkan apa adanya ke kolom `supplierCostIDR`.

Keputusan lain:

- **Crypto tetap disiapkan.** UI crypto sedang disembunyikan, tetapi
  `cryptoMarkupBps` diisi supaya SKU langsung bisa dibeli via crypto ketika
  akses PG crypto dibuka kembali.
- **Tidak menyentuh hero section.** Hero masih memakai lima kartu kurasi lama;
  produk baru muncul di listing `/vouchers` dan halaman detailnya.

## Harga

| Varian | SKU | Modal | Non-crypto 5,3% | B2B/reseller 2,6% |
|---|---|---:|---:|---:|
| Standard Edition | `PBZCDKSE-S22` | 720.840 | **759.045** | **739.582** |
| Deluxe Edition | `PBZCDKDE-S22` | 868.700 | **914.742** | **891.287** |

Markup crypto: **7,3%** (5,3% + fallback 2 poin persentase yang sudah dipakai
konvensi katalog).

## Perubahan kode

| File | Perubahan |
|---|---|
| `packages/db/src/eztopup-catalog.ts` | Definisi produk `PBZCDK` → slug `phantom-blade-zero`, image `/phantom-blade.webp`, VOUCHER |
| `packages/db/src/import-eztopup-products.ts` | Workbook `data/phantom blade steam.xlsx` masuk daftar import (bisa dioverride `EZTOPUP_PHANTOM_BLADE_PRODUCTS_XLSX`) |
| `packages/db/src/supplier-expansion.ts` | Mapping `phantom-blade-zero` → `PBZCDK`; guard `PRODUCT_SUPPLIER_COUNTRIES` = `["id"]` agar sync `--expand` tidak menambah varian luar negeri |
| `packages/db/src/seed-product-reseller-pricing.ts` | CLI baru untuk membuat tier pricing produk di luar workbook reseller |
| `packages/db/src/eztopup-catalog.test.ts` | Test parsing SKU Phantom + margin |
| `packages/db/src/supplier-expansion.test.ts` | Test country allowlist |
| `apps/web/public/phantom-blade.webp` | Asset produk 800×1000 |
| `package.json`, `packages/db/package.json` | Script `products:seed:reseller-pricing` |

### Script reseller pricing

Dry run (default):

```bash
pnpm products:seed:reseller-pricing \
  --product phantom-blade-zero --markup 2.6
```

Apply:

```bash
pnpm products:seed:reseller-pricing \
  --product phantom-blade-zero --markup 2.6 --apply
```

Perilaku:

- Membuat rule `MARKUP` untuk `TIER_1` dan `TIER_2` pada setiap varian
  published yang punya `supplierSku`.
- Rule yang sudah ada **tidak ditimpa**; hitungannya dilaporkan sebagai
  `existing rules kept`.
- `provenance` mencatat `MANUAL_GAME_LAUNCH`, slug, SKU, negara, dan markup.
- Idempoten untuk rule yang belum ada.

## Verifikasi

| Cek | Hasil |
|---|---|
| `pnpm test:db` | 31 test lulus |
| `pnpm products:import:eztopup --dry-run` | 15 produk, 745 baris SKU-negara, 12 negara, 4 workbook; Phantom terbaca |
| `pnpm typecheck` | Lulus semua package |
| `pnpm build` | Build produksi lulus |
| Halaman lokal `/products/phantom-blade-zero` | HTTP 200, nama varian + gambar + harga benar |
| Listing `/vouchers` | Produk `E-voucher Phantom Blade Zero` ada di payload |
| Seed reseller lokal | 4 rule terbentuk (2 tier × 2 SKU), harga 739.582 / 891.287 |

DB lokal ikut dimigrasi dan di-seed hanya untuk verifikasi. **Tidak ada
perubahan DB produksi** pada sesi ini.

## Deployment

Commit: `b523a97` — *Add Phantom Blade Zero to storefront and reseller catalog*.
Push ke `origin/main` berhasil lewat credential GitHub CLI (SSH GitHub juga
menolak publickey; remote HTTPS dipakai untuk push).

Deploy rutin (`scripts/deploy-vps.sh`) **tidak** mengimpor ulang workbook lama
(lihat commit `f7e0108`), jadi produk baru harus diimpor eksplisit sebelum
sync supplier.

Urutan di VPS:

```bash
cd /var/www/eztu
git pull --ff-only origin main
pnpm install
pnpm products:import:eztopup
pnpm products:seed:reseller-pricing --product phantom-blade-zero --markup 2.6 --apply
pnpm deploy:vps
```

`pnpm deploy:vps` menjalankan migrate, supplier sync `--expand --full-import`,
build, dan restart PM2 `eztu`. Import penuh menyentuh seluruh katalog sesuai
alur yang sudah ada; sync setelahnya menyegarkan harga dari supplier.

Cek setelah deploy:

- `https://eztopup.io/products/phantom-blade-zero`
- `https://eztopup.io/vouchers` (produk tampil untuk market Indonesia)
- `https://reseller.eztopup.io/` (produk tampil untuk reseller tier 1 & 2,
  market Indonesia)

## Catatan & sisa pekerjaan

1. **Belum live.** SSH `deploy@161.97.130.68` ditolak
   (`Permission denied (publickey)`); percobaan ke `deploy@eztopup.io`
   timeout. Deploy perlu akses yang valid atau dijalankan manual oleh user.
2. **Buka pasar luar negeri** nanti: hapus/ubah
   `PRODUCT_SUPPLIER_COUNTRIES["phantom-blade-zero"]` di
   `packages/db/src/supplier-expansion.ts`, lalu jalankan sync `--expand`.
   Harga per negara akan diambil dari supplier API, bukan workbook lokal.
3. **Ubah markup reseller** untuk produk ini: rule existing sengaja tidak
   ditimpa oleh script. Gunakan admin pricing per organisasi, atau hapus rule
   tier terkait lebih dulu jika memang ingin re-seed.
4. **Aktifkan crypto**: cukup buka akses PG crypto di setting pembayaran.
   Markup 7,3% sudah tersimpan di varian; tidak perlu perubahan katalog.

## Homepage ordering (follow-up)

Permintaan lanjutan: produk baru harus tampil paling depan di homepage.

- Homepage sekarang mengurutkan `getStorefrontProducts()` berdasarkan
  `createdAt` terbaru sebelum filter `featured`, jadi produk yang baru diimpor
  memimpin **Popular Products** dan carousel **Game Vouchers**.
- Perubahan hanya di `apps/web/src/app/(storefront)/page.tsx`; urutan halaman
  `/vouchers` tidak diubah.
- Verifikasi lokal: payload homepage berurutan
  `phantom-blade-zero`, `xbox-pc-game-pass`, `nintendo-eshop`, dst.
- `pnpm --filter @kupon/web typecheck` dan production build lulus.

Commit: `94879be` — *Show newest products first on homepage*.

## Aturan docs-first (ditambahkan sesi ini)

Supaya konteks tidak hilang saat ganti model/harness:

- `AGENTS.md` sekarang mewajibkan: baca `docs/README.md` + session note terbaru
  sebelum kerja, tulis session note sebelum sesi selesai, dan jangan klaim live
  tanpa verifikasi produksi.
- `docs/README.md` menjadi index docs + checklist awal sesi.
- `docs/session-notes/_template.md` menjadi format baku session note.
- `docs/history/` dan handoff `2026-10-07-harness-handoff.md` yang sebelumnya
  untracked ikut di-commit agar tidak hilang.

Commit: `78cb6d8` — *Make docs-first session workflow mandatory*.

