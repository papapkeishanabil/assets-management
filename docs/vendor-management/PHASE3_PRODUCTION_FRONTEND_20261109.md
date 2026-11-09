# Rilis frontend Fase 3 ke alamat utama — 9 November 2026

Status **READY**. User meminta deploy untuk melihat hasil, melaporkan menu Peta Vendor
tidak ada, lalu mengonfirmasi bahwa alamat yang digunakan adalah
`https://harmas-asset-management.vercel.app/vendors`. Rilis frontend diarahkan ke
alamat utama tersebut. **Tidak menjalankan migration Fase 3, push Git atau write data bisnis.**

- Aplikasi: https://harmas-asset-management.vercel.app
- Peta: https://harmas-asset-management.vercel.app/vendor/map
- Deployment aktif: `dpl_AGnmtsEyyNuTFCP3EkmKCLsDFM8R`
- URL artifact: https://harmas-asset-management-pnudvowo3.vercel.app
- Source frontend: `d3beb8f5`; HEAD repo saat build `2df87d47` (dokumentasi preview).
- Deployment sebelumnya: `dpl_F43t8NXx5QU3zxcMyyNQZs1jQPLT` (6 November),
  disimpan sebagai referensi rollback; tidak dihapus.
- Promotion selesai sekitar **15.41 WIB**, 9 November 2026.

## Perubahan yang terlihat

Menu **Manajemen Vendor → Peta Vendor** kini termasuk frontend alamat utama.
Module key `vendor_map` dan guard role tetap berlaku; Super Admin mendapat akses
otomatis, Sourcing/Direksi mengikuti izin modul, HRD memerlukan izin modul yang sesuai.
Tidak mengubah role atau permission siapa pun di database.

Tab/browser yang sudah terbuka perlu **Ctrl+F5** atau ditutup/dibuka ulang untuk memuat
bundle baru. Halaman Master Vendor tetap pada `/vendors`; halaman peta berada di
`/vendor/map` dalam grup Manajemen Vendor, bukan pengganti Master Vendor.

Backend Fase 3 dan API key/Map ID Google belum disiapkan. Halaman lokasi/peta tetap
menampilkan keterangan bahwa fitur belum aktif, tanpa tombol tulis yang akan gagal
atau angka nol palsu. Dashboard sourcing dan follow-up tetap tersedia. Rilis ini
tidak menyatakan CRUD lokasi/foto atau peta Google nyata sudah aktif di produksi.

## Build dan verifikasi

Project/team diverifikasi melalui CLI resmi. Environment Production diambil ke
`.vercel/` yang diabaikan Git; build awal menemukan dua nilai konfigurasi frontend
yang diunduh tidak valid sebagai URL/publishable key. Artifact awal
`dpl_BWgLQJPsiQPH281nzW3bxts8JjQL` hanya dibuat sebagai staging tanpa alias dan
**tidak dipromosikan**. Ia bukan deployment yang boleh dirilis ulang.

Cache build lokal kemudian memakai URL project HARMAS dan publishable key dari
`.env` standar. URL cocok dengan frontend produksi yang aktif sebelumnya; key publik
divalidasi melalui GET endpoint konfigurasi Auth (HTTP 200), tanpa login atau query
data bisnis. Key ini berbeda dari string key pada bundle produksi lama; tidak
menganggap kedua string identik. Konfigurasi environment cloud tidak diubah.
Build Git/remote selanjutnya perlu meninjau nilai environment cloud terlebih dahulu;
jangan menganggap pull konfigurasi menghasilkan nilai frontend yang siap dipakai.

Build ulang `vercel build --prod` lulus: 1574 modul, 5,13 detik; service worker
136 ms. Warning bundle utama >500 kB tetap ada. Pemindaian 77 file artifact tidak
menemukan pola secret key/JWT privat yang diperiksa. Source repo, `.env` privat dan
dump tidak diunggah; hanya artifact prebuilt.

Artifact valid diunggah dengan `--prod --skip-domain`, diverifikasi melalui
`vercel curl` resmi (staging memakai Deployment Protection), baru dipromosikan ke
alamat utama. Tidak menonaktifkan proteksi, tidak mempromosikan preview dengan
environment yang berbeda, dan tidak mengubah schema database.

Entry produksi sekarang `/assets/index-ktmUd8T6.js`, SHA-256:

```text
814243805cd9e183a4ea83ca904c2f38e763d57db11e2673560116995583a821
```

Hash identik dengan artifact preview yang telah diuji. Lima skenario backend belum
aktif serta 20 alur Fase 3 lokal sudah lulus pada source ini. Pengujian menu artifact
preview dengan akun Docker Super Admin/Sourcing juga lulus; seluruh request database
pada pengujian tersebut dialihkan ke Docker, bukan menggunakan akun produksi.

Sesudah promotion: HTTP publik HTML/bundle 200; hash artifact cocok; string menu
dan route peta tersedia; tiga route anonim (`/vendors`, `/vendor`, `/vendor/map`)
mengarah ke login; **0 pageerror, 0 asset gagal dan 0 request tulis bisnis**.
`vercel inspect` memastikan alamat utama menunjuk deployment READY yang baru.
Browser tanpa login tidak membuktikan hak akses akun pengguna tertentu; tidak
membuat akun uji produksi atau mengklaim UAT CRUD produksi pada tahap ini.

Bukti: [staging](phase3-evidence/PRODUCTION_STAGING_CHECKS.json),
[pemeriksaan alamat utama](phase3-evidence/PRODUCTION_FRONTEND_DEPLOYMENT_CHECKS.json),
[login produksi setelah rilis](phase3-evidence/production-frontend-login.png).

## Yang masih menunggu

Preflight PostgreSQL produksi, backup terbaru beserta verifikasi restore/blob,
persetujuan migration Fase 3, konfigurasi Maps dan UAT bisnis sesuai scope yang
disetujui. Rilis frontend ini bukan persetujuan menulis database produksi. Tidak
ada checksum database produksi baru yang diklaim diperiksa; bukti tahap ini adalah
artifact/HTTP/browser dan tidak adanya request write bisnis dari pemeriksaan.
