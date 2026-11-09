# Session notes — label Phantom Blade Zero (steam) (9 Nov 2026)

## Ringkasan

Permintaan: tampilkan game **Phantom Blade Zero** di retail dan reseller
sebagai **Phantom Blade Zero (steam)**.

- Nama produk katalog `phantom-blade-zero` diubah menjadi
  `Phantom Blade Zero (steam)`.
- Retail (storefront) otomatis menampilkan `E-voucher Phantom Blade Zero
  (steam)` karena prefix `E-voucher` ditambahkan di `product-data.ts` untuk
  semua produk VOUCHER.
- Reseller menampilkan nama produk apa adanya: `Phantom Blade Zero (steam)`
  (`getResellerCatalog` memakai `product.name`).
- Data lama di database diperbarui lewat migrasi
  `20261109180000_phantom_blade_zero_steam_label`, sehingga ikut berubah saat
  `pnpm db:migrate` (bagian dari `pnpm deploy:vps`).
- Kode di-commit dan di-push ke `origin/main`; deploy produksi dikerjakan user
  dengan pull sendiri.

## Keputusan & alasan

- **Slug, SKU, dan harga tidak diubah.** Slug tetap `phantom-blade-zero` supaya
  link produk, riwayat order, dan rule pricing reseller yang sudah ada tidak
  putus.
- **Nama varian tidak diubah.** Varian (`Phantom Blade Zero: Standard Edition`
  / `Deluxe Edition`) berasal dari workbook supplier; label platform cukup di
  level produk.
- **Pakai migrasi data, bukan hanya ubah konstanta katalog.** `scripts/deploy-vps.sh`
  hanya menjalankan supplier sync (`--expand --full-import`), bukan
  `products:import:eztopup`, jadi nama produk existing di DB tidak akan
  berubah hanya dari perubahan kode. Migrasi membuat rename ikut jalan di
  langkah `pnpm db:migrate`.
- **String persis mengikuti permintaan user**: `(steam)` huruf kecil.

## File yang berubah

| File | Perubahan |
|---|---|
| `packages/db/src/eztopup-catalog.ts` | `PRODUCTS.PBZCDK.name` → `Phantom Blade Zero (steam)` |
| `packages/db/src/eztopup-catalog.test.ts` | Ekspektasi `productName` ikut diperbarui |
| `packages/db/prisma/migrations/20261109180000_phantom_blade_zero_steam_label/migration.sql` | `UPDATE "Product"` untuk slug `phantom-blade-zero` (idempoten) |
| `docs/README.md` | Daftar session note terbaru |

## Verifikasi

| Cek | Hasil |
|---|---|
| `pnpm test:db` | 31 test lulus |
| `pnpm --filter @kupon/db typecheck` | Lulus |
| `pnpm db:migrate` (DB lokal) | Migrasi diterapkan |
| Query DB lokal | `{"name":"Phantom Blade Zero (steam)","published":true}`, 2 varian published (759.045 / 914.742), 4 rule tier reseller ada |

DB produksi **belum** disentuh dari sesi ini.

## Status deploy

- Commit: `2484d4b` — *Label Phantom Blade Zero as Steam in retail and reseller*.
- Push: `origin/main` (HTTPS; SSH GitHub masih publickey).
- Belum diverifikasi live di production.

Langkah di VPS setelah pull:

```bash
cd /var/www/eztu
git pull --ff-only origin main
pnpm install
pnpm db:migrate            # rename nama produk
pnpm deploy:vps            # build + restart (opsional kalau tidak ada perubahan schema lain)
```

Kalau produk belum pernah diimpor / rule reseller belum ada di produksi:

```bash
pnpm products:import:eztopup
pnpm products:seed:reseller-pricing --product phantom-blade-zero --markup 2.6 --apply
```

Cek setelah deploy:

- `https://eztopup.io/products/phantom-blade-zero` → judul `E-voucher Phantom Blade Zero (steam)`
- `https://reseller.eztopup.io/` → kartu produk `Phantom Blade Zero (steam)`

## Sisa pekerjaan

1. Verifikasi nama baru di production setelah user pull + migrate.
2. Kalau mau kapitalisasi `(Steam)`, cukup ubah satu konstanta + satu migrasi
   baru (nama saat ini mengikuti permintaan literal user).
