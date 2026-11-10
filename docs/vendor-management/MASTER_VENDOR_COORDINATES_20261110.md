# Input koordinat pada Master Vendor — 10 November 2026

Status **selesai dan diuji lokal; belum di-deploy**. User meminta input koordinat
juga tersedia pada Master Data → Vendor. Perubahan frontend memakai backend Fase 3
yang sudah aktif, tanpa migration atau kolom tambahan pada tabel master `vendors`.
Frontend utama tetap versi `5ae0c673` sampai deployment baru disetujui.

## Alur penggunaan

- Setiap baris Master Vendor mendapat tombol **Koordinat** (label aksesibel
  **Lokasi & Koordinat [nama vendor]**).
- Form **Edit Vendor** mendapat tab **Profil Vendor** dan **Lokasi & Koordinat**.
  Pengguna tetap di halaman Master Vendor untuk menambah/mengedit koordinat, beberapa
  fasilitas, foto, lokasi utama dan membuka rute/peta.
- Form vendor baru memiliki pilihan **Simpan dan Isi Koordinat** untuk menyimpan
  profil aktif lalu melanjutkan ke tab lokasi. **Simpan** biasa dan tombol Enter
  mempertahankan alur simpan profil tanpa membuat lokasi otomatis.
- Alamat/kota master dipakai sebagai draf awal lokasi yang dapat diubah. GPS tidak
  ditebak dari alamat; latitude/longitude harus diisi berpasangan, melalui manual,
  pilih pin, URL Maps yang dapat diurai, atau GPS dengan konfirmasi.
- Setelah lokasi disimpan, data yang sama langsung dibaca Peta Vendor dan tombol
  **Rute ke Lokasi** menuju GPS fasilitas yang dipilih.

Tab lokasi tidak dibungkus form profil, sehingga form foto dan form lokasi tidak
menjadi nested form. Tab mendukung keyboard; draf profil tetap tersimpan di state
ketika berpindah tab, tanpa menulisnya secara otomatis. Tampilan desktop dark dan
mobile light 390px diperiksa melalui screenshot.

## Data dan keamanan

Master aktif yang belum mempunyai profil terhubung dibaca tanpa mutasi saat tab
dibuka. Link dibuat melalui RPC idempotent `vendor_link_existing_active` **hanya saat
Simpan Lokasi**, setelah validasi form. Membuka, menutup, membatalkan, atau gagal
validasi koordinat tidak membuat link/riwayat baru. Master nonaktif yang belum
terhubung tidak dapat memulai pengelolaan lokasi.

Lokasi/foto memakai `vendor_locations`/`vendor_location_photos` existing dan guard,
audit serta RLS Fase 3. Menyimpan lokasi tidak mengirim UPDATE ke master vendors/aset.
Pilihan Simpan dan Isi Koordinat pada vendor baru tetap melakukan INSERT master
sebagaimana fungsi Tambah Vendor existing; koordinatnya disimpan terpisah setelah
pengguna melanjutkan dan menekan Simpan Lokasi. Membatalkan tahap lokasi tidak
membatalkan profil vendor yang sudah disimpan.

RPC link dan INSERT lokasi merupakan dua request. Jika link berhasil tetapi INSERT
lokasi gagal, profil terhubung tetap ada; form menampilkan error, menyimpan id link
di memori dan memakainya untuk retry. Membuka ulang juga membaca link yang sama.
Tidak mengklaim kedua request sebagai satu transaksi atomik. Tombol simpan dilindungi
dari klik berulang selama request berjalan.

Guard route Master Vendor tetap Super Admin/HRD. Kontrol lokasi juga mensyaratkan
role pembaca lokasi dan module key `vendor_map`; pemeriksaan diulang pada komponen
panel dan RLS tetap penjaga database. HRD tanpa module key tetap memakai profil
master tanpa kontrol/request lokasi. Sourcing/Direksi tetap memakai halaman modul
vendor yang sudah diizinkan, tanpa perluasan akses ke route Master Vendor.
Tidak mengubah role/permission, policy atau helper keamanan di database.

## File

| File | Perubahan |
|---|---|
| `src/pages/VendorsPage.jsx` | Aksi koordinat, tab, simpan profil lalu lokasi, guard, cegah submit ganda, label form |
| `src/components/vendor/MasterVendorLocationsPanel.jsx` | Panel lokasi master, baca link tanpa write, validasi sebelum link, retry |
| `src/components/vendor/LocationFormModal.jsx` | Draf awal dan callback save opsional, label alamat eksplisit |
| `src/components/vendor/VendorLocationsPanel.jsx` | Draf alamat lokasi dari master opsional; komponen lokasi/foto/rute tetap dipakai bersama |
| `src/lib/vendor-location-helpers.js` | Validasi payload reusable, query id profil terhubung tanpa mutasi |
| `scripts/test-master-vendor-locations-browser.mjs` | Integrasi UI → API → Docker untuk alur baru dan cleanup fixture |

Tidak ada perubahan migration/rollback, dependency, environment atau database produksi.
Tidak melakukan push Git atau deployment.

## Bukti pengujian

| Pemeriksaan | Hasil |
|---|---|
| Alur Master Vendor | **16 PASS**, termasuk simpan/edit/multi-fasilitas/rute, Enter biasa, validasi, cancel, error RPC/INSERT, retry, guard dan mobile |
| Regresi lokasi/foto existing | **22 PASS**, termasuk Storage nyata lokal/signed URL/EXIF, verifikasi/guard, RLS, peta, >1000 baris dan dashboard |
| Build final | Exit **0**, 1580 modul, Vite 5,33 detik, SW 120 ms |
| Cleanup lokal | Checksum master/aset/profil/role/permission/notifikasi identik setelah fixture dihapus dan guard dipulihkan |
| Target produksi | Tidak ada request tes ke Supabase/Google Maps produksi; Vite memakai envFile:false dan URL Docker tetap |

Total **38 pemeriksaan browser lokal lulus**.
[Hasil Master](phase3-evidence/MASTER_VENDOR_LOCATION_BROWSER_RESULTS.json),
[regresi](phase3-evidence/MASTER_VENDOR_LOCATION_REGRESSION_RESULTS.txt),
[build](phase3-evidence/MASTER_VENDOR_LOCATION_BUILD_RESULTS.txt).
[Screenshot desktop](phase3-evidence/master-vendor-coordinates-desktop.png) dan
[mobile](phase3-evidence/master-vendor-coordinates-mobile.png) memakai data sintetis.
Tile OSM dimock **TEST TILE** pada automation, tidak membebani server tile publik.

Kendala awal: label textarea alamat yang sudah terisi tidak dapat dikenali secara
tepat oleh harness karena isi awal turut terbaca sebagai teks label. Label diperbaiki
dengan htmlFor/id terpisah; seluruh alur dan regresi kemudian lulus. Padding panel
juga dirapikan setelah meninjau screenshot, lalu uji mobile dan build diulang.
Warning bundle utama >500 kB masih ada; panel master dimuat lazy (2,67 kB gzip 1,23 kB)
dan Leaflet tetap dimuat dinamis hanya saat diperlukan.

## Rilis berikutnya

Perubahan frontend siap untuk deployment setelah **persetujuan terpisah user**,
sesuai batasan rilis. Backend Fase 3 sudah aktif sehingga tidak ada migration baru.
UAT setelah deployment: login akun berizin, buka `/vendors`, pilih Koordinat,
simpan lokasi asli, pastikan titik dan rutenya konsisten pada `/vendor/map`.
Tidak membuat data dummy atau akun uji produksi otomatis.
