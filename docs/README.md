# Dokumentasi EZTopUp

Dokumen di folder ini adalah **sumber kebenaran** untuk keputusan, status kerja,
dan konteks antar sesi. Jangan mengandalkan riwayat chat saja.

## Wajib dibaca sebelum mulai kerja

1. Baca file ini.
2. Baca 1–2 session note terbaru di [`session-notes/`](session-notes/) yang
   relevan dengan tugas.
3. Baca plan terkait di [`plans/`](plans/) jika ada.
4. Cek [`operations/`](operations/) untuk urusan deploy/reseller,
   [`decisions/`](decisions/) untuk keputusan arsitektur.

## Peta folder

| Folder | Isi |
|---|---|
| [`session-notes/`](session-notes/) | Catatan per sesi/pekerjaan: apa yang berubah, keputusan, verifikasi, status deploy, sisa pekerjaan |
| [`plans/`](plans/) | Rencana implementasi per fitur |
| [`decisions/`](decisions/) | ADR ringkas untuk keputusan arsitektur |
| [`operations/`](operations/) | Runbook deploy/operasional |
| [`audits/`](audits/) | Audit keamanan/infrastruktur |
| [`reports/`](reports/) | Laporan untuk founder/operasional |
| [`history/`](history/) | Sejarah proyek jangka panjang |

## Aturan session note

Setiap sesi kerja **wajib** meninggalkan catatan:

- Path: `docs/session-notes/YYYY-MM-DD-<slug-singkat>.md`
- Template: [`session-notes/_template.md`](session-notes/_template.md)
- Isi minimum: ringkasan, keputusan + alasan, file/perubahan, hasil verifikasi,
  status deploy (live/belum + blocker), dan sisa pekerjaan.
- Kalau sesi terputus, tulis catatan parsial berisi kondisi terakhir.
- Setelah menambah note baru, tambahkan ke daftar di bawah.

Jika ada perubahan yang belum di-commit/push/deploy, tulis eksplisit. Jangan
menulis "sudah live" tanpa verifikasi di production.

## Session notes terbaru

- [2026-11-13 — WinPay sebagai metode pembayaran ketiga](session-notes/2026-11-13-winpay-payment-addition.md)
- [2026-11-10 — Grand Theft Auto VI (PlayStation) catalog](session-notes/2026-11-10-gta-vi-playstation-catalog.md)
- [2026-11-09 — Label Phantom Blade Zero (steam)](session-notes/2026-11-09-phantom-blade-zero-steam-label.md)
- [2026-11-07 — Phantom Blade Zero catalog](session-notes/2026-11-07-phantom-blade-zero-catalog.md)
- [2026-11-02 — Security incident hardening](session-notes/2026-11-02-security-incident-hardening.md)
- [2026-10-07 — Harness handoff / package display](session-notes/2026-10-07-harness-handoff.md)

## Operasional penting

- Deploy VPS: [`../README.md`](../README.md) bagian *Production deploy (VPS)*,
  script `scripts/deploy-vps.sh`.
- Reseller/B2B: [`operations/reseller-phase2-deployment.md`](operations/reseller-phase2-deployment.md).
- Katalog produk: `data/*.xlsx` + `packages/db/src/import-eztopup-products.ts`;
  cek session note terakhir sebelum menambah game/produk.
- Jangan menulis credential, token, atau password ke dokumentasi.
