# Fase 3 — Lokasi, GPS, Foto Privat dan Peta Vendor

Tanggal: 9 November 2026. Status: **implementasi dan pengujian lokal selesai; belum dirilis**.
Fase 1+2 yang sudah produksi tidak dijalankan ulang. Fase 3 difinalisasi sebagai commit
lokal terpisah; belum di-push atau di-deploy dan migration Fase 3 belum dijalankan ke
produksi. Perkembangan preflight/backup: [kesiapan rilis](PHASE3_RELEASE_READINESS.md).

## Perilaku yang tersedia

Sourcing membuka tab **Lokasi & Foto**, mencatat beberapa fasilitas milik kandidat,
memilih satu lokasi utama, mengisi alamat dan koordinat, lalu mengunggah foto asli.
Koordinat dapat berasal dari input manual, URL Maps lengkap, GPS perangkat dengan
konfirmasi, atau klik/drag pin bila Google Maps sudah dikonfigurasi. Lokasi tanpa GPS
tetap dapat disimpan dan masuk monitoring belum dipetakan; tidak dibuat titik 0,0 palsu.

Foto memakai bucket PRIVATE `vendor-photos`, preview dan signed URL 600 detik.
Frontend memeriksa ekstensi/MIME/signature, batas 5 MB, maksimum 40 megapiksel,
memperkecil sisi terpanjang ke 2048 piksel dan melakukan encode ulang untuk membuang
EXIF. Bucket memeriksa MIME/ukuran; trigger mencocokkan metadata dengan objek Storage
dan pemilik upload. **Pemeriksaan signature dan re-encode terjadi di browser, bukan
byte-sniff server**. Pemanggil API yang melewati frontend tidak mendapat jaminan sanitasi
EXIF yang sama. Jika perlindungan terhadap pengunggah internal yang sengaja melewati
frontend diperlukan, tambahkan pipeline sanitasi server sebelum memperluas akses.
Tidak menerima SVG/HTML dan tidak mengizinkan overwrite berkas terdaftar.

Data lengkap tidak otomatis terverifikasi. HRD/Super Admin dapat memverifikasi setelah
alamat, kota/provinsi, koordinat dan minimal satu EXTERIOR aktif tersedia. Perubahan
alamat/koordinat/jenis fasilitas membatalkan verifikasi. Mengarsipkan atau mengganti jenis
foto EXTERIOR terakhir juga membatalkan verifikasi. Foto hanya dapat diarsipkan/dipulihkan
Super Admin; berkas dan metadata tetap disimpan beserta audit.

Peta menampilkan setiap fasilitas sebagai titik terpisah, cluster, panel detail, pencarian,
filter kategori/spesialisasi/tahap/kelayakan/operasional/PIC/kota/verifikasi/jenis vendor,
pilihan lokasi utama, daftar belum dipetakan dan pagination. Pengambilan data REST
berhalaman 500 baris menghindari pemotongan pada baris ke-1001. Tanpa key/Map ID,
daftar dan navigasi ke koordinat nyata tetap berfungsi tanpa meminta SDK Google.
Dashboard Fase 2 kini mengambil kelengkapan lokasi fisik melalui RPC baru.

Tombol **Lokasikan Vendor Aktif** menjalankan pengecualian K3 yang disetujui:
membuat kandidat CLOSED/APPROVED/ACTIVE ter-link hanya untuk master yang SUDAH aktif.
RPC mengembalikan kandidat ter-link yang sudah ada, mengunci per vendor untuk mencegah
duplikasi antar-panggilan, dan mencatat `legacy_vendor_linked`. Tidak menyetujui prospect
existing, mengaktifkan master nonaktif, atau menulis `vendors`/`assets`.

## File baru dan berubah

| Kelompok | File | Perubahan |
|---|---|---|
| Migration baru | [202611090001_vendor_management_phase3.sql](../../supabase/migrations/202611090001_vendor_management_phase3.sql) | Isi SQL lengkap: dua tabel, index, guard/audit, RLS, tiga RPC mutasi terbatas, dua view INVOKER, RPC monitoring, private bucket dan policy Storage |
| Rollback baru | [202611090001_vendor_management_phase3_rollback.sql](../../supabase/rollbacks/202611090001_vendor_management_phase3_rollback.sql) | Isi SQL lengkap; berada di luar migrations otomatis |
| Library baru | `src/lib/vendor-location-utils.js`, `vendor-location-helpers.js`, `google-maps-loader.js` | Validasi/cluster/filter, CRUD/Storage/RPC, lazy loader |
| Komponen baru | `src/components/vendor/LocationFormModal.jsx`, `MapPicker.jsx`, `VendorGoogleMap.jsx` | Form, GPS/parser, pin/cluster/drag/error/retry |
| Komponen baru | `src/components/vendor/LocationPhotos.jsx`, `SignedVendorPhoto.jsx`, `VendorLocationsPanel.jsx`, `LinkActiveVendorModal.jsx` | Foto privat, kelengkapan/verifikasi, retrofit master |
| Halaman baru | `src/pages/vendor/VendorMapPage.jsx` | `/vendor/map` dan fallback |
| Integrasi berubah | `src/App.jsx`, `src/components/layout/MainLayout.jsx` | Route lazy dengan guard `vendor_map`, sidebar |
| Integrasi berubah | `src/pages/vendor/VendorDetailPage.jsx`, `VendorDashboardPage.jsx` | Tab lokasi nyata, monitoring kelengkapan fisik |
| Konfigurasi contoh | `.env.example` | Dua variabel Maps kosong; tanpa API key nyata |
| Harness baru | `scripts/test-vendor-phase3-local.mjs`, `test-vendor-phase3-utils.mjs`, `test-vendor-phase3-browser.mjs`, `test-vendor-phase3-map-browser.mjs` | Target Docker/loopback tetap, tidak membaca `.env` produksi |
| Fixture SDK baru | `scripts/fixtures/vendor-map-browser.jsx`, `google-maps-mock.js` | Kontrak Google Maps tiruan, tidak diimpor aplikasi produksi |
| Dokumentasi/bukti | Laporan ini, `HANDOFF_CODEX.md`, `PHASE3_*_TEST_RESULTS.txt`, `phase3-evidence/` | Hasil per skenario, build dan screenshot |

Perubahan dokumentasi/UAT produksi Fase 1+2 yang sudah berada di working tree dipertahankan.
`.superdesign/` dan `scripts/check-finance-policies.js` tidak disentuh dan tidak menjadi
bagian Fase 3. Tidak ada dependency baru, file environment berkredensial atau dump database
yang ditambahkan.

## Review migration dan keamanan

- Additive dan transactional; tidak ada ALTER/UPDATE/DELETE data master existing.
  Eksekusi migration sendiri hanya membuat objek baru dan bucket baru. Penulisan tabel
  kandidat/kontak/audit terjadi kemudian ketika pengguna menjalankan fitur K3/lokasi.
- RLS baca lokasi/foto: Sourcing, HRD, Direksi, Super Admin. Tulis: Sourcing, HRD,
  Super Admin; verifikasi: HRD/Super Admin; arsip foto: Super Admin. Direksi baca saja.
  Role pelaksana/finance/anon, akun disabled dan JWT tanpa sub ditolak.
- Guard frontend tiga lapis melalui sidebar/module key `vendor_map`, route/komponen,
  dan RLS/trigger database. HRD yang belum diberi `vendor_map` tetap ditolak oleh UI;
  kebijakan backend memakai role aplikasi sesuai pola existing. Pengaturan module key
  bukan pengganti RLS dan tidak ditambahkan ke `role_permissions` oleh migration ini.
- `is_app_role`, `my_profile_id`, guard keputusan/aktivasi, guard profil, RLS profil/role/
  notifikasi, fungsi dashboard/reminder Fase 2 dan ACL existing tidak diubah.
  Tidak ada policy yang membaca tabel role/profilnya sendiri secara rekursif.
- Primary dan cover memakai partial unique index serta RPC switch atomik dengan
  advisory lock. Lokasi/foto tidak menerima DELETE pengguna. Identitas, pembuat,
  timestamps upload dan referensi berkas immutable; aktor dari JWT, audit old/new
  ke `vendor_activity_logs` melalui trigger SECURITY DEFINER yang tertutup pemanggilan langsung.
- Policy Storage lama tidak dihapus. Restrictive gate baru hanya membatasi bucket
  `vendor-photos`; bucket lain tetap mengikuti policy lamanya. Simulasi policy legacy
  yang sangat luas tetap tidak membocorkan bucket baru atau mengizinkan overwrite.
- Predicate Storage baru yang executable PUBLIC hanya mengembalikan boolean terbatas
  dan menolak role tak berwenang. Ini menghindari error planner policy PUBLIC memanggil
  helper existing yang authenticated-only; ACL helper existing tetap utuh.
- Migration menolak policy tak dikenal pada dua tabel baru serta konfigurasi bucket
  existing yang berbeda. Tidak mengaktifkan policy lama bermasalah secara diam-diam.
- Signed URL adalah bearer link sampai kedaluwarsa, bukan tautan yang langsung mati
  saat logout. Jangan membagikannya; TTL aplikasi 600 detik. Sumber: [Supabase downloads](https://supabase.com/docs/guides/storage/serving/downloads).

Rollback menolak bucket berisi objek dan juga menolak bucket kosong yang masih ada.
Backup lalu hapus objek/bucket melalui Storage API terlebih dahulu dengan persetujuan;
tidak melakukan SQL DELETE metadata Storage karena ada trigger proteksi. Rollback hanya
menjatuhkan objek Fase 3, **menghapus data lokasi/foto metadata**, dan tidak membalikkan
riwayat append-only atau kandidat/kontak K3 yang sudah dibuat. Kandidat tersebut tetap
ter-link ke master aktif. Rollback schema bukan undo bisnis; pertahankan backup terverifikasi.

## Bukti pengujian lokal

Target: `%TEMP%\harmas-vendor-test`, container `supabase_db_harmas-vendor-test`, API
`http://127.0.0.1:54321`. Semua data foto/kandidat pengujian sintetis. Harness browser
menolak host eksternal dan tidak memakai service key di browser. Password akun lokal
dibaca dari env sesi; kunci Docker lokal dibaca ke memori, tidak dicatat dalam bukti.

| Kelompok | Hasil final | Bukti per skenario |
|---|---:|---|
| Struktur/idempotensi/RLS/guard/audit/Storage/K3/rollback | 62 PASS, 0 FAIL | [SQL](PHASE3_LOCAL_TEST_RESULTS.txt) |
| Koordinat/parser/cluster/filter/file | 21 PASS, 0 FAIL | [Utility](PHASE3_UTIL_TEST_RESULTS.txt) |
| Browser → API → database/Storage → UI, termasuk master existing | 20 PASS, 0 FAIL | [Browser](phase3-evidence/BROWSER_RESULTS.txt) |
| Interaksi pin/drag/cluster/SDK lazy/error/retry, SDK tiruan | 7 PASS, 0 FAIL | [Kontrak SDK](phase3-evidence/MAP_SDK_DOUBLE_RESULTS.txt) |
| Build final | Exit 0 | [Build](phase3-evidence/BUILD_RESULTS.txt) |

Total **110 pemeriksaan** lulus. Bukti visual: [desktop fallback](phase3-evidence/map-fallback-desktop.png),
[mobile light 390 px](phase3-evidence/map-fallback-mobile.png),
[tab lokasi/foto dark](phase3-evidence/locations-photos.png).

Skenario SQL mencakup migration dua kali, reapply saat ada data, policy dorman ditolak,
rollback menolak bucket berisi file, rollback dua kali dan reapply, role matrix,
approval langsung tetap ditolak, verifikasi/reset, pergantian primary/cover, audit,
retrofit idempotent dan policy Storage legacy. Checksum **14 tabel existing**, policy
lama, bucket lain dan definisi guard/helper/Fase 2 identik sebelum/sesudah harness.
Browser menguji upload nyata dan download signed URL, public URL tertutup, EXIF
terbuang, tipe/ukuran/overwrite ditolak, GPS perlu konfirmasi, Direksi baca saja,
module key HRD ditolak, Master Vendor tetap memuat seluruh master dan pembacaan
**1.010 baris** peta melalui helper frontend. Cleanup hanya pada fixture Docker;
snapshot enam tabel existing browser kembali identik.

Kegagalan selama pengembangan diperbaiki sebelum hasil final: trigger audit bersama
sempat merujuk field foto pada record lokasi (diubah ke IF bersarang); policy PUBLIC
sempat meminta izin helper authenticated-only (predicate bounded terpisah); pembanding
jumlah view tanpa JWT menghasilkan nol (pembanding tabel dasar); label select native,
injeksi HTML Vite dan remove-listener pada double SDK disesuaikan di harness.
Tidak menyamakan kegagalan harness dengan bukti kerusakan produksi.

Build tetap memberi warning bundle utama >500 kB (1.251,89 kB, gzip 305,24 kB).
Halaman peta sudah chunk terpisah 10,67 kB dan SDK dimuat saat perlu. Warning tidak
menyebabkan build gagal. `git diff --check` lulus; peringatan LF/CRLF bukan error build.
Pemindaian 24 file kode/konfigurasi/harness tidak menemukan literal kredensial pada
pola yang diperiksa. Hash migration/rollback dan batas pemeriksaan dicatat pada
[manifest review](phase3-evidence/REVIEW_MANIFEST.txt).

## Batas yang belum diverifikasi

Google Maps nyata belum diuji: belum ada API key/Map ID/billing. Double SDK hanya
membuktikan kontrak dan state UI, tidak membuktikan billing, pembatasan referrer,
rendering vector map atau geolocation perangkat lapangan. GPS browser lokal disimulasikan;
perlu uji ponsel HTTPS nyata. Query semua halaman dan clustering cocok untuk skala
awal; dataset jauh lebih besar dapat memerlukan pencarian/paging spasial server.
Tidak ada pengujian tulis Fase 3 atau pembacaan ulang schema produksi pada tahap ini.
Snapshot produksi Fase 1+2 sebelumnya bukan pengganti preflight Fase 3 terbaru.
Driver preflight/backup kemudian disiapkan dan diuji sintaks/lokal; eksekusi produksi
masih tertunda karena kredensial environment belum tersedia. Lihat [status](PHASE3_RELEASE_READINESS.md).

Tidak ada perintah tulis produksi, migration produksi, push Git atau deployment pada
implementasi Fase 3 ini. Data existing lokal terbukti identik dalam cakupan snapshot;
data produksi tidak disentuh oleh harness ini. Riwayat lifecycle akun sementara produksi
sebelumnya dijelaskan terpisah dalam [status Fase 1+2](PRODUCTION_ACCEPTANCE_STATUS_20261109.md).

## Konfigurasi Google Cloud yang diperlukan

1. Siapkan project/billing, aktifkan Maps JavaScript API dan buat Map ID JavaScript
   dengan vector map untuk AdvancedMarkerElement.
2. Buat browser API key dengan pembatasan API ke Maps JavaScript API dan HTTP referrer
   ke domain aplikasi yang dipakai. Pisahkan kebutuhan localhost/preview dari produksi;
   jangan membuka wildcard semua domain. Atur quota/budget sesuai kebutuhan.
3. Isi `VITE_GOOGLE_MAPS_API_KEY` dan `VITE_GOOGLE_MAPS_MAP_ID` pada environment yang
   dituju melalui mekanisme rahasia/environment. Key VITE browser terlihat di bundle;
   pengaman utamanya adalah pembatasan Google Cloud. Jangan commit nilai nyata.
4. Rebuild lalu uji pin/cluster/drag, billing/referrer, penolakan key salah dan fallback.
   Fallback dapat dipakai lebih dulu bila konfigurasi Google belum siap.

Rujukan: [Advanced markers dan Map ID](https://developers.google.com/maps/documentation/javascript/advanced-markers/start),
[draggable marker](https://developers.google.com/maps/documentation/javascript/advanced-markers/draggable-markers),
[pemakaian loader](https://developers.google.com/maps/documentation/javascript/load-maps-js-api).

## Rekomendasi dan gerbang rilis

Status migration: **siap direview untuk rilis, belum diizinkan untuk produksi**.
Jangan jalankan migration otomatis seluruh folder; Fase 1+2 sudah produksi.

1. Review working tree dan pisahkan commit lokal Fase 3 dari dokumentasi/UAT lain.
2. Preflight produksi **read-only terbaru**: bandingkan helper/ACL/guard/RLS yang
   diperbaiki, schema kolom vendor yang dibaca K3, policy Storage (termasuk policy
   restrictive existing), hak akses service Storage, dan pastikan objek/bucket Fase 3
   tidak konflik. Catat baseline/checksum vendor/aset/profil dan semua tabel pipeline.
3. Buat backup produksi baru pra-Fase 3 di luar repo: dump schema/data/roles yang
   diperlukan, daftar objek Storage dan salinan blob terpisah, konfigurasi layanan,
   checksum SHA-256, waktu dan manifest. Backup 6 November bukan backup terkini.
4. Verifikasi hash/list archive, restore ke Supabase terisolasi yang kompatibel,
   cocokkan jumlah/checksum, FK/orphan, RLS/trigger/helper/ACL dan file Storage. Uji
   migration Fase 3 di hasil restore. Backup lama hanya membuktikan restore aplikasi;
   extension pg_cron/pg_net/vault gagal pada postgres:17 standar dan blob tidak termasuk.
5. Setelah **persetujuan eksplisit migration produksi**, jalankan hanya SQL Fase 3
   yang direview, lalu verifikasi struktur/RLS/bucket privat, guard existing dan
   checksum master/aset. Hentikan rilis jika preflight atau verifikasi berbeda.
6. Setelah **persetujuan terpisah push/deploy**, rilis frontend dengan konfigurasi
   Maps yang dipilih; verifikasi PWA/cache dan bundle yang tersaji.
7. UAT Super Admin/Sourcing pada scope data bisnis yang disetujui; jangan membuat
   data dummy permanen atau menonaktifkan guard di produksi untuk cleanup. Penetapan
   petugas Sourcing permanen masih diperlukan, tidak membuat akun sementara otomatis.

Checklist setelah deploy: Master Data → Vendor dan relasi aset tetap normal;
dashboard/follow-up Fase 1+2 tetap berfungsi; perbedaan vendor unik/aktivitas tidak
berubah; tambah/edit beberapa lokasi dan switch primary; GPS perlu konfirmasi;
upload/preview/signed URL foto; verifikasi hanya HRD/Super Admin; perubahan fisik
membatalkan verifikasi; sourcing/direksi tidak dapat approve/activate prospect;
anon/pelaksana tidak melihat lokasi/foto; retrofit hanya master aktif; peta/filter/
cluster/navigasi/mobile/denied key/fallback; audit aktor/waktu/old/new; checksum data
existing tetap sesuai scope bisnis yang disetujui.

Reminder Fase 2 tetap memeriksa overdue ketika monitoring dibuka/di-refresh; tidak
dijalankan otomatis saat aplikasi tidak digunakan dan mekanisme deduplikasi existing
tidak diubah. Indikator sampel/QC masih berdasarkan tahap kandidat sampai Fase 4.
Setelah Fase 3 aktif dan lolos UAT, pekerjaan berikutnya adalah Fase 4 sesuai roadmap.
