# Peta gratis dan rute fasilitas — 10 November 2026

Status: **implementasi/test lokal selesai, belum deploy versi ini**. User memilih
layanan gratis dan meminta navigasi menuju posisi vendor. Keputusan ini menggantikan
pilihan Google Maps JavaScript API pada rancangan awal. **Leaflet 1.9.4 + OpenStreetMap**
menjadi peta utama, tanpa API key atau billing Google. Database/migration Fase 3 tidak
diubah atau dijalankan ke produksi. Frontend produksi masih rilis `d3beb8f5` sampai
deployment baru disetujui.

## Perilaku akhir

Halaman peta dan pemilih koordinat kini memakai Leaflet stable yang dimuat dinamis.
Pin per fasilitas, filter, cluster, panel detail, klik/drag draf koordinat, GPS dengan
konfirmasi dan foto privat tetap tersedia. Fasilitas dengan koordinat berimpit dapat
dipilih dari daftar popup pada zoom maksimum, sehingga workshop/gudang tidak hilang
di balik satu marker. Resize mobile mempertahankan pusat viewport dan pin.

**Rute ke Lokasi** tersedia pada kartu fasilitas, panel pilihan peta dan baris daftar
yang memiliki GPS. Tautan menggunakan Maps URLs ke Google Maps aplikasi/browser,
dengan tujuan koordinat fasilitas tersebut. Origin tidak dibuat-buat; Google Maps
memakai posisi pengguna bila tersedia atau meminta titik awal. Kendaraan, estimasi
waktu dan navigasi dikelola di Google Maps. HARMAS tidak menggambar garis lurus sebagai
rute jalan dan tidak menghitung rute melalui Directions API berbayar.
[Maps URLs tidak memerlukan API key](https://developers.google.com/maps/documentation/urls/get-started).

Lokasi tanpa GPS tidak mendapat tautan rute. Edit koordinat memperbarui tujuan.
Tidak meminta geolocation aplikasi secara otomatis untuk membuka rute. Tampilan
dasar peta dapat dimuat walaupun database lokasi belum diaktifkan; data/tombol tulis
tetap mengikuti kesiapan backend dan izin role/module yang sudah ada.

## Penyedia, biaya dan privasi

Leaflet stable 1.9.4 dipilih dari [referensi resmi](https://leafletjs.com/reference-1.9.4.html).
Tile default menggunakan `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. Layanan
publik OSM berkapasitas terbatas dan best-effort, tanpa SLA; ini **bukan janji gratis
tanpa batas**. Pemakaian besar memerlukan evaluasi penyedia/hosting lain. Atribusi
OpenStreetMap selalu terlihat, referrer mengirim origin aplikasi, cache browser
mengikuti header server, dan tidak ada fitur bulk download/offline/prefetch tile.
[Kebijakan resmi tile OSM](https://operations.osmfoundation.org/policies/tiles/).

Marker/nama vendor tidak dipublikasikan ke OSM. Permintaan tile memuat z/x/y untuk
area viewport, tanpa nama, kontak, foto, id kandidat atau daftar koordinat vendor.
Tautan rute baru mengirim koordinat tujuan ke Google Maps ketika pengguna mengkliknya.
RLS, foto private/signed URL, guard verifikasi dan module key `vendor_map` tidak diubah.

Jika tile gagal, peta memberi pesan dan retry; daftar vendor dan tautan rute tetap
dapat digunakan. Provider tile dapat diganti melalui `VITE_VENDOR_MAP_TILE_URL`,
dengan kredit teks tambahan `VITE_VENDOR_MAP_TILE_CREDIT` dan pemeriksaan lisensi/
kebijakan penyedia yang dipilih. Konfigurasi kosong memakai OSM; tidak perlu key.

## File

| Kelompok | File/perubahan |
|---|---|
| Dependency | `package.json`, `package-lock.json`: tambah tepat `leaflet@1.9.4`; tidak meng-upgrade dependency lain |
| Peta baru | `src/components/vendor/VendorMap.jsx`, `vendor-map.css`, `src/lib/vendor-map-loader.js` |
| Navigasi | `src/components/vendor/VendorLocationNavigation.jsx`, `vendorDirectionsUrl` pada `src/lib/vendor-location-utils.js` |
| Integrasi | `MapPicker.jsx`, `VendorLocationsPanel.jsx`, `VendorMapPage.jsx` |
| Hapus kode lama | `VendorGoogleMap.jsx`, `google-maps-loader.js`, fixture `google-maps-mock.js` |
| Config contoh | `.env.example`: tile/credit opsional menggantikan key/Map ID |
| Test | Harness map memakai Leaflet nyata dan mock tile; utility/dataset/CRUD/rute/mobile/pending-backend diperbarui |

SHA-256 migration tetap
`7f38d171690ceaf1afb2d0b8df4eb3462d48c41a49caf63bca7c2dd3bc945e2f`.
Tidak ada migration/rollback baru untuk pergantian renderer peta ini. Field
`coordinate_source=PICK_ON_MAP/MAPS_LINK` tetap kompatibel dan tidak bergantung
pada penyedia peta. Parser URL Google Maps dan tautan lihat lokasi tetap didukung.

## Pengujian dan bukti

| Kelompok | Hasil | Bukti |
|---|---:|---|
| Utility koordinat/parser/cluster/file + directions URL | 26 PASS | [utility](PHASE3_UTIL_TEST_RESULTS.txt) |
| Leaflet nyata: pin, cluster 1005 titik, fasilitas berimpit, klik/drag, retry, referrer, directions | 11 PASS | [peta](phase3-evidence/FREE_MAP_BROWSER_RESULTS.txt) |
| Browser → API → Docker: lokasi/foto, role/guard, fasilitas tanpa GPS, rute per fasilitas, mobile dan cleanup | 22 PASS | [integrasi](phase3-evidence/FREE_MAP_INTEGRATION_RESULTS.txt) |
| Backend belum terpasang / RLS ditolak | 5 PASS | [kompatibilitas rilis](phase3-evidence/SPLIT_RELEASE_BROWSER_RESULTS.txt) |
| Build final | Exit 0 | [build](phase3-evidence/FREE_MAP_BUILD_RESULTS.txt) |

Total **64 pemeriksaan lokal lulus**. Screenshot [desktop](phase3-evidence/map-free-desktop.png)
dan [mobile light](phase3-evidence/map-free-mobile.png) memakai tile bertuliskan
**TEST TILE**, bukan citra jalan OSM nyata. Browser test tidak mengirim request ke
server tile publik, geocoder atau Google SDK; ini menjaga layanan publik dari beban
otomatis. Library/interaksi Leaflet yang diuji adalah versi nyata, bukan SDK double.
Navigasi Google di ponsel dan rute jalan nyata masih membutuhkan UAT pengguna.

Pengujian memakai stack Docker sintetis; fixture dibersihkan, checksum master/aset/
profil/role/permission/notifikasi yang dicakup identik dan guard dikembalikan aktif.
Tidak membuat akun atau data bisnis produksi. Perbaikan resize `invalidateSize`
diterapkan setelah screenshot awal menunjukkan viewport bergeser; uji mobile final
menambahkan pemeriksaan bahwa pin tetap terlihat dan lulus.

Build: 1579 modul, 5,25 detik; peta 11,22 kB, Leaflet chunk terpisah 149,98 kB
(gzip 43,55 kB). Bundle utama 1254,13 kB memberi warning >500 kB yang tetap ada.
PWA mem-precache bundle kode statis, termasuk library, **bukan tile OSM**.
Audit npm mencatat 18 temuan dependency lain; Leaflet tidak tercantum. Tidak menjalankan
audit fix atau perubahan dependency di luar penambahan Leaflet.

## Rilis dan aktivasi

Perubahan siap direview untuk commit/deploy frontend terpisah. **Belum push/deploy
versi gratis ini.** Persetujuan migration produksi juga belum diterima. Backend lokasi
dan GPS nyata harus aktif dan diisi sebelum ada pin/rute vendor produksi. Peta dasar
tetap dapat tampil tanpa konfigurasi Google Cloud.

Backup/preflight 9 November tetap tercatat dalam
[laporan aktivasi](PHASE3_ACTIVATION_READINESS_20261109.md). Karena hari telah berganti,
preflight/baseline produksi harus diperbarui saat migration disetujui; jangan menganggap
snapshot kemarin sebagai kondisi live sekarang. Jangan menulis data dummy atau
mengubah tabel master untuk mengisi peta.
