# Session notes — Grand Theft Auto VI (PlayStation) catalog (10 Nov 2026)

## Ringkasan

Menambahkan **Grand Theft Auto VI (PlayStation)** ke retail dan reseller.

- Produk katalog: slug `gta-vi`, kategori **Game Vouchers**, tipe VOUCHER.
- Sumber: `/Users/iskavonalia/Downloads/GTA BARU.xlsx` (sheet `GTA BARU`,
  kategori supplier `GTAVI` — *GTA VI PS5 Keys*).
- Pasar: **Indonesia, Malaysia, Thailand, Singapore** (pilihan user).
- Varian: `Grand Theft Auto VI Standard Edition`
  (SKU pre-order `GTAVISE-S22PO*` status available; SKU reguler
  `GTAVISE-S22*` masih `empty` sehingga otomatis tersembunyi di storefront).
- Aset: `apps/web/public/gta-vi.webp` (800×1000, sampul PS5 dari user).
- Reseller: rule `MARKUP` TIER_1 & TIER_2 sebesar **1,5%**.
- Kode di-push ke `origin/main`; deploy produksi dikerjakan user (pull sendiri).

## Harga & margin

Workbook berisi dua skenario margin, dan menurut user keduanya untuk metode
pembayaran berbeda:

| Jalur | Margin B2C (retail) | Margin B2B (reseller) |
|---|---:|---:|
| Web2 payment gateway (Pakasir/QRIS) | **5,5%** | **1,5%** |
| Web3 (Cryptomus) | **6,5%** | 3,5% |

Yang dipetakan ke kode:

- `nonCryptoMarkupBps` = **550** (web2 retail).
- `cryptoMarkupBps` = **650** (web3 retail).
- Tier reseller di-seed dengan markup **1,5%**.

### Harga jual (ID, modal pre-order 1.115.750)

| Jalur | Harga |
|---|---:|
| Retail web2 | **1.177.117** |
| Retail web3/crypto | **1.188.274** |
| Reseller TIER_1/TIER_2 | **1.132.487** |

Catatan: model pricing reseller saat ini hanya punya **satu** markup per tier,
jadi varian B2B web3 (3,5%) belum bisa dibedakan dari web2 (1,5%). Reseller yang
memilih bayar crypto tetap memakai harga tier 1,5%. Kalau ini perlu dibedakan,
harus ada perubahan model pricing B2B (bukan bagian sesi ini).

## Perubahan kode & data

| File | Perubahan |
|---|---|
| `packages/db/src/eztopup-catalog.ts` | Entri `PRODUCTS.GTAVI` → slug `gta-vi`, nama `Grand Theft Auto VI (PlayStation)`, image `/gta-vi.webp`, VOUCHER |
| `packages/db/src/import-eztopup-products.ts` | Workbook `data/gta vi ps5.xlsx` masuk daftar import (override `EZTOPUP_GTA_PRODUCTS_XLSX`) |
| `packages/db/src/supplier-expansion.ts` | Mapping `gta-vi` → kategori `GTAVI`; allowlist negara `id,my,th,sg` |
| `packages/db/src/eztopup-catalog.test.ts` | Test parsing SKU GTA + margin 5,5%/6,5% |
| `data/gta vi ps5.xlsx` | 8 baris SKU-negara (4 negara × pre-order/reguler), plus kolom `MARGIN NON CRYPTO`/`MARGIN CRYPTO` |
| `apps/web/public/gta-vi.webp` | Aset produk 800×1000 |

Workbook sumber berisi ~131 ribu baris seluruh katalog supplier; yang disalin
ke repo hanya 8 baris kategori `GTAVI` agar import tidak menduplikasi katalog
lain.

## Verifikasi

| Cek | Hasil |
|---|---|
| `pnpm products:import:eztopup --dry-run` | 16 produk, 753 baris SKU-negara, 5 workbook; GTA VI terbaca |
| `pnpm test:db` | 32 test lulus |
| `pnpm --filter @kupon/db typecheck` | Lulus |
| Seed lokal produk | 8 varian (4 available pre-order, 4 `empty`), harga ID retail 1.177.117, crypto 6,5% |
| Seed reseller lokal | 16 rule tier dibuat; harga ID reseller 1.132.487 |

Import penuh lokal **tidak dijalankan** karena `SUPPLIER_SECRET_KEY` tidak ada
di env lokal (175 baris butuh harga live supplier). Sebagai gantinya produk
GTA di-seed lokal memakai parser + aturan harga yang sama untuk verifikasi.
Build produksi tidak dijalankan pada sesi ini (perubahan hanya data/katalog).

## Status deploy

- Commit kode: `e3f8bab` — *Add Grand Theft Auto VI (PlayStation) to catalog*.
- Push: `origin/main` (HTTPS).
- Belum diverifikasi live di production.

Langkah di VPS setelah pull:

```bash
cd /var/www/eztu
git pull --ff-only origin main
pnpm install
pnpm products:import:eztopup
pnpm products:seed:reseller-pricing --product gta-vi --markup 1.5 --apply
pnpm deploy:vps
```

`pnpm products:import:eztopup` wajib dijalankan eksplisit karena deploy rutin
hanya menjalankan supplier sync. Import ini menerbitkan ulang seluruh katalog
workbook (perilaku existing), lalu `deploy:vps` menyegarkan harga supplier.

Cek setelah deploy:

- `https://eztopup.io/products/gta-vi` (market Indonesia)
- `https://eztopup.io/vouchers` (kartu `E-voucher Grand Theft Auto VI (PlayStation)`)
- `https://reseller.eztopup.io/` untuk tier 1 & 2 (market ID/MY/TH/SG)

## Sisa pekerjaan

1. Jalankan import + seed di produksi lalu verifikasi halaman produk.
2. SKU reguler (`GTAVISE-S22*`) masih `empty`; otomatis muncul saat supplier
   mengubah status menjadi available dan sync dijalankan.
3. Kalau margin B2B crypto (3,5%) ingin dibedakan dari web2, perlu perubahan
   model pricing reseller.
4. Buka pasar lain: tambah kode negara di
   `PRODUCT_SUPPLIER_COUNTRIES["gta-vi"]` lalu sync `--expand`.
