# Integrasi navigasi Manajemen Vendor — 10 November 2026

Status **selesai dan diuji lokal; belum di-deploy**. User memilih menyatukan menu
menjadi Dashboard, Vendor Aktif, Calon Vendor, Follow-Up dan Peta dalam satu kelompok
Manajemen Vendor. Ini melanjutkan perubahan input koordinat Master Vendor pada
commit `ec617b81`; deployment kedua perubahan tetap memerlukan persetujuan user.

## Susunan akhir

| Menu | Alamat tetap | Fungsi |
|---|---|---|
| Dashboard Vendor | `/vendor` | Ringkasan sourcing, aktivitas, tugas dan kelengkapan lokasi |
| Vendor Aktif | `/vendors` | Master operasional existing, kontak, status dan lokasi/koordinat |
| Calon Vendor | `/vendor/database` | Profil kandidat dan tahapan kualifikasi |
| Follow-Up Vendor | `/vendor/followups` | Riwayat komunikasi dan tugas tindak lanjut |
| Peta Vendor | `/vendor/map` | Titik lokasi vendor aktif maupun calon vendor sesuai filter/izin |

Tautan Vendor pada Master Data dipindahkan ke kelompok Manajemen Vendor dengan
nama **Vendor Aktif**. Halaman master tetap mempertahankan pengelolaan status
aktif/nonaktif existing; tidak menyembunyikan data nonaktif atau mengubah filter
secara diam-diam. URL `/vendors` dan seluruh referensi aset/kontrak tetap sama.

Dashboard mendapat tautan terpisah Vendor Aktif dan Calon Vendor. Halaman master
mendapat tautan balik Dashboard Vendor dan Peta Vendor sesuai akses pengguna.
Input koordinat/foto tetap berada pada halaman master melalui tombol Koordinat
dan tab Lokasi & Koordinat; [laporan fitur tersebut](MASTER_VENDOR_COORDINATES_20261110.md).

## Hubungan data dan akses

Master operasional tetap pada `vendors`, profil sourcing pada `vendor_candidates`
dan identitas terhubung melalui `vendor_id`. Lokasi/foto memakai backend Fase 3
yang sama. Tidak ada penggabungan tabel, penyalinan massal vendor atau aktivasi calon
vendor otomatis. Rumus KPI dan RPC dashboard tetap mengikuti implementasi existing;
integrasi ini tidak menambahkan total gabungan master + kandidat yang berpotensi
menghitung dua kali vendor terhubung.

Menu Vendor Aktif memerlukan role Super Admin/HRD dan module key `vendors`, sesuai
guard halaman master existing. Sourcing/Direksi tetap memakai halaman sourcing
yang diizinkan. HRD yang hanya memiliki akses master tetap melihat kelompok
Manajemen Vendor beserta Vendor Aktif, tanpa bergantung pada izin sourcing.
Nama modul `vendors` pada pengaturan akses diperjelas menjadi Vendor: Data
Operasional / Vendor Aktif; key dan baris permission database tidak diubah.

Tidak ada perubahan pada route guard App.jsx, RLS, role, permission database,
master/aset/kontrak, schema/migration, environment, dependency atau data produksi.
Tidak melakukan push Git atau deployment.

## File perubahan

- `src/components/layout/MainLayout.jsx`: pindahkan master ke kelompok vendor,
  urutan lima menu dan tampilkan sesuai role/module.
- `src/pages/vendor/VendorDashboardPage.jsx`: tautan Vendor Aktif/Calon Vendor.
- `src/pages/VendorsPage.jsx`: tautan Dashboard/Peta dan keterangan data operasional.
- `src/lib/permissions.js`: label modul master diperjelas; key tetap `vendors`.
- `scripts/test-vendor-navigation-browser.mjs`: browser test navigasi dan akses.
- Dokumen, JSON/log hasil dan screenshot sintetis pendukung.

## Verifikasi

| Pengujian | Hasil |
|---|---|
| Navigasi terpadu | **7 PASS**: urutan dan tidak duplikat, tautan silang, route, mobile, master-only, pembatasan role dan checksum |
| Regresi input koordinat master | **16 PASS**: cancel/validasi, simpan/edit, multi-fasilitas, peta/rute, guard, retry, vendor baru dan mobile |
| Build | Exit **0**, 1580 modul, Vite 6,64 detik, service worker 159 ms |
| Baseline | Enam checksum master/aset/profil/role/permission/notifikasi Docker identik setelah tes/cleanup |

Total **23 pemeriksaan browser lulus**. Test navigasi memakai backend Docker nyata;
fixture izin master-only disimulasikan pada response API browser tanpa menulis
role_permissions. Awalnya fixture HRD Docker tidak memiliki key `vendors`, sehingga
uji positif master-only belum mewakili skenario yang dimaksud. Fixture browser
diperjelas dengan `vendors=true` dan modul sourcing=false, lalu seluruh uji lulus.
Guard role tetap diperiksa menggunakan akun/JWT lokal nyata.

RPC reminder dinonaktifkan melalui mock pada test navigasi agar pemeriksaan menu
tidak menulis notifikasi. Tidak ada request tes ke Supabase/Google Maps produksi;
tile OSM menggunakan **TEST TILE**. Regresi koordinat memakai fixture bisnis Docker
yang dihapus setelah selesai. Tidak menguji CRUD modul aset/kontrak produksi.

Bukti: [navigasi](phase3-evidence/VENDOR_NAVIGATION_BROWSER_RESULTS.json),
[regresi master](phase3-evidence/MASTER_VENDOR_LOCATION_BROWSER_RESULTS.json),
[build](phase3-evidence/VENDOR_NAVIGATION_BUILD_RESULTS.txt),
[desktop](phase3-evidence/vendor-navigation-desktop.png),
[mobile](phase3-evidence/vendor-navigation-mobile.png).
Warning bundle utama >500 kB tetap ada. Peninjauan screenshot desktop/mobile dan
`git diff --check` lulus. Deployment gabungan menunggu persetujuan user; tidak perlu
migration baru karena backend lokasi sudah aktif.
