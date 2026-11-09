# Deployment Preview Fase 3 — 9 November 2026

Status **READY**, environment **Preview**, dibuat 12.59 WIB. User meminta deployment
lebih dahulu untuk melihat hasil. Tidak menjalankan migration produksi, push Git atau
mempromosikan deployment ke domain produksi.

- URL: https://harmas-asset-management-7qi0mttcc.vercel.app
- Deployment: `dpl_AJYvZ3SSMcWaHQqpg73S3doKD2ru`
- Project: `prj_2MBxDEiNjz80jfB2L0dQ55hUbG0P`, team `team_gulGpJeEXpB77MplKv8w4Ilo`
- Commit frontend: `d3beb8f5`, perbaikan kompatibilitas di atas implementasi `4b180082`.
- Build: artifact lokal `vercel build --target=preview`, kemudian `deploy --prebuilt
  --target=preview`; 77 file artifact/1,6 MB. Source repo dan file environment privat
  tidak diunggah sebagai sumber build. Pemindaian artifact tidak menemukan pola
  secret key/JWT yang diperiksa; publishable key frontend memang bagian konfigurasi client.

## Cara melihat

Buka URL preview. Deployment Protection Vercel tetap aktif; login Vercel dengan akun
yang memiliki akses project bila diminta, kemudian login aplikasi menggunakan akun
HARMAS, misalnya Super Admin. Buka **Manajemen Vendor → Dashboard Vendor / Peta Vendor**.
Tidak ada akun uji sementara baru yang dibuat. Preview memakai database operasional
yang sama untuk fitur existing; preview ini bukan database sandbox.

Fase 3 database belum dipasang. Dashboard sourcing tetap berfungsi, sedangkan peta
dan tab lokasi memberi keterangan **Lokasi dan foto vendor belum aktif**. Tombol
tulis lokasi/retrofit tidak ditampilkan sampai backend tersedia; jumlah lokasi yang
belum diketahui ditampilkan `—`, bukan nol. Error izin/RLS tetap dilaporkan terpisah.
Penyimpanan lokasi/foto dan pin Google nyata masih menunggu migration dan konfigurasi
Maps yang disetujui. Tidak mengisi data fiktif ke produksi untuk mempercantik preview.

## Bukti pemeriksaan

- Build Vercel lokal lulus (1574 modul, lazy map 11,01 kB, bundle utama 1252,44 kB;
  warning >500 kB tetap ada). API QR existing tetap termasuk artifact.
- Lima [uji browser backend belum aktif](phase3-evidence/SPLIT_RELEASE_BROWSER_RESULTS.txt)
  lulus pada Docker sintetis; 20 [alur browser backend lengkap](phase3-evidence/BROWSER_RESULTS.txt)
  dijalankan ulang dan lulus setelah perubahan frontend.
- `vercel inspect` memastikan target Preview dan status Ready. Konektor Vercel meminta
  autentikasi ulang berulang; CLI resmi berhasil memakai sesi yang tersedia.
- HTTP terlindungi 200 melalui `vercel curl` dan OIDC development resmi, tanpa
  menonaktifkan Deployment Protection. Token tidak dicetak/disimpan di bukti/Git.
- Entry `/assets/index-ktmUd8T6.js`, SHA-256
  `814243805cd9e183a4ea83ca904c2f38e763d57db11e2673560116995583a821`
  cocok dengan artifact lokal.
- Browser anonim: tiga route vendor mengarah ke login; 0 pageerror, 0 kegagalan
  asset dan 0 request tulis bisnis. Tidak menjalankan UAT login produksi baru.
- HTML dan entry bundle domain produksi identik sebelum/sesudah preview; entry
  produksi tetap `/assets/index-BwKPK6y3.js`.

Bukti: [hasil deployment](phase3-evidence/PREVIEW_DEPLOYMENT_CHECKS.json),
[login preview](phase3-evidence/preview-login.png),
[driver verifikasi read-only](../../scripts/verify-vendor-phase3-preview-readonly.mjs).

Pemeriksaan browser awal menggunakan format import path Windows yang tidak sesuai ESM;
diperbaiki ke `pathToFileURL` sebelum verifikasi final lulus. Ini kegagalan harness,
bukan kegagalan deployment. Pengujian fitur setelah login pada backend lengkap tetap
dibuktikan di Docker, bukan diklaim sebagai pengujian CRUD produksi.

## Gerbang berikutnya

Preview ini memenuhi permintaan melihat frontend terlebih dahulu. Backup/preflight
PostgreSQL produksi masih menunggu PGPASSWORD dan verifikasi restore/blob; migration
produksi memerlukan izin eksplisit tersendiri. Push Git dan deployment/promotion
produksi juga belum dilakukan. Jangan mempromosikan preview hanya karena build lulus.
