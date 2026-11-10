# Fase 3 aktif di produksi — 10 November 2026

**Status: migration COMMIT dan verifikasi produksi PASS, 09.29–09.30 WIB.**
User menjawab **“ya setuju”** atas pertanyaan eksekusi migration Fase 3 dan verifikasi
RLS/checksum existing. Hanya migration tersebut dijalankan; tidak ada push Git,
deployment tambahan, perubahan role/pemilik tabel, akun baru atau data dummy.

- Database: project `uwlxkwyauxwewoexfgwi`, koneksi PostgreSQL langsung via pooler;
  executor `postgres`, password diinput tersembunyi di terminal dan dibersihkan.
- SQL: [202611090001_vendor_management_phase3.sql](../../supabase/migrations/202611090001_vendor_management_phase3.sql).
- SHA-256 tetap `7f38d171690ceaf1afb2d0b8df4eb3462d48c41a49caf63bca7c2dd3bc945e2f`.
- Rollback tetap di [folder rollbacks](../../supabase/rollbacks/202611090001_vendor_management_phase3_rollback.sql);
  tidak dijalankan otomatis.
- Frontend tetap `5ae0c673`, deployment `dpl_F3UijNeKStcKMe8nTQfUdvLVo7BC`.
  URL: https://harmas-asset-management.vercel.app/vendor/map

## Hasil verifikasi

| Pemeriksaan | Hasil |
|---|---|
| Backup sebelum migration | Dump 10 Nov 09.09 WIB, restore 140 tabel/1.908 baris dan 95 blob terverifikasi; hash/baseline diperiksa lagi sebelum eksekusi |
| Preflight produksi terakhir | **9 kelompok PASS**, snapshot stabil dan identik dengan metadata/baseline backup terverifikasi |
| Uji pelaksana transaksi di clone | **5 PASS**: baseline stale, database salah, rollback jika RLS rusak, commit valid, izin platform non-pemilik |
| Commit migration | Marker `PHASE3_COMMIT_CONFIRMED`, transaksi selesai sebelum snapshot verifikasi baru |
| SQL setelah commit | **25 pemeriksaan PASS** |
| Data existing | Checksum **17 tabel** identik sebelum/sesudah; vendors=10, assets=55, user_profiles=6, auth.users=6, employees=45, contracts=28 |
| Keamanan existing | **11 fungsi/ACL**, policy, RLS, trigger, role/permission, kolom dan bucket existing tetap identik |
| Relasi aset | 16 relasi vendor, 0 orphan |
| Objek Fase 3 | Dua tabel dengan RLS/ACL, index dan empat trigger, dua view `security_invoker`, 11 fungsi dengan body/definer/search_path/ACL yang diharapkan |
| Foto privat | Bucket `vendor-photos` private, maksimal 5 MB JPG/PNG/WebP; enam policy tabel dan tujuh policy Storage termasuk empat restrictive gate |
| HTTP setelah aktivasi | **11 pemeriksaan PASS**, seluruhnya GET |
| Akses anonim | Tabel lokasi, foto, dan view peta: HTTP 401; helper pembaca foto mengembalikan false |
| File existing | Satu sampel di masing-masing assets, employee-photos, maintenance-photos, ppm-documents HTTP 200 dan SHA-256 cocok backup |
| Frontend | Route peta HTTP 200; hash entry sama dengan rilis frontend gratis yang sudah aktif |

Tabel lokasi/foto baru masih kosong saat verifikasi, kandidat/follow-up masih 0.
Migration tidak menghubungkan vendor aktif atau mengisi koordinat secara otomatis.
Tidak ada baris master vendor, aset, profil, kandidat atau log bisnis yang ditulis
oleh migration. Penambahan metadata bucket privat adalah bagian migration yang disetujui.

Bukti: [preflight terakhir](phase3-evidence/PHASE3_FINAL_PREFLIGHT_20261110.json),
[SQL setelah commit](phase3-evidence/PHASE3_PRODUCTION_ACTIVATION_CHECKS.json),
[HTTP](phase3-evidence/PRODUCTION_HTTP_POST_ACTIVATION.json),
[uji transaksi clone](phase3-evidence/RELEASE_TRANSACTION_TEST_RESULTS.json),
[backup dan batas restore](PHASE3_ACTIVATION_READINESS_20261110.md).

## Kendala dan pelajaran

Percobaan pertama berhenti **sebelum write** karena pemeriksaan saya hanya menerima
pemilik tabel sebagai pengelola policy. Ini terlalu ketat untuk Supabase: platform
mengizinkan pengelolaan policy tertentu melalui `supautils.policy_grants`.
[Sumber resmi supautils](https://github.com/supabase/supautils#manage-policies) dan
[konfigurasi Supabase](https://github.com/supabase/postgres/blob/develop/ansible/files/postgresql_config/supautils.conf.j2)
menjelaskan jalur ini. Pemeriksaan kini menerima owner yang sah **atau** grant
platform yang tercatat pada `pg_settings`; tidak mengubah grant platform tersebut.

Koreksi diuji pada clone: role postgres yang bukan pemilik berhasil membuat policy
probe restrictive melalui supautils; seluruh probe di-rollback. Koneksi produksi
kemudian memenuhi pemeriksaan dan migration asli berhasil. Tidak memakai SET ROLE
ke role internal, ALTER OWNER, GRANT membership, service key, atau menonaktifkan RLS
produksi. Persetujuan write hanya dikonsumsi pada satu percobaan eksekusi yang sukses.

Pelaksana menambahkan batas lock 10 detik, statement 120 detik dan pemeriksaan
sebelum/akhir transaksi pada SQL yang hash-nya dipatok. Pemeriksaan akhir sebelum
COMMIT memastikan baseline/keamanan lama utuh serta objek baru benar; kegagalan
membatalkan seluruh transaksi. Verifikasi terpisah dilakukan setelah COMMIT. Tidak
mengeksekusi seluruh folder migrations, tidak menjalankan rollback otomatis.

Pembandingan policy dalam transaksi mengurutkan kedua array berdasarkan isi JSON
utuh; urutan tipe PostgreSQL `name` dan `text` berbeda menurut collation. Tidak ada
penghapusan/normalisasi syarat policy untuk meloloskan pembandingan.

## File tooling baru

- `scripts/vendor-phase3-release-checks.mjs`: hash SQL, pemeriksaan izin, guard
  transaksi dan struktur/ACL/body fungsi Fase 3.
- `scripts/prepare-vendor-phase3-release.mjs`: pemeriksa offline snapshot/backup dan
  pembentuk SQL tervalidasi serta laporan verifikasi.
- `scripts/apply-vendor-phase3-production.mjs`: satu target produksi tetap,
  PGPASSWORD dari environment, persetujuan satu eksekusi, preflight dan post-check.
- `scripts/start-vendor-phase3-migration.ps1`: prompt password tersembunyi.
- `scripts/test-vendor-phase3-release-transaction.mjs`: lima skenario clone terisolasi.
- `scripts/verify-vendor-phase3-production-http.mjs`: GET anonim/sampel Storage dan
  hash frontend tanpa akun/fixture produksi.

Tidak ada perubahan SQL migration/rollback, frontend atau dependency. Syntax helper
dan `git diff --check` lulus; tidak mengulang build frontend yang tidak berubah.
Clone restore dihentikan lagi setelah uji transaksi. Koneksi produksi tidak berjalan
di container restore tersebut; semua akses produksi memakai driver target tetap.

## Penggunaan dan batas UAT

1. Login akun berizin (misalnya Super Admin), refresh aplikasi dan buka **Peta Vendor**.
2. Untuk master vendor existing, klik **Lokasikan Vendor Aktif**, pilih vendor yang
   memang aktif. Operasi pengguna ini membuat kandidat terhubung dan audit, tanpa
   menggandakan atau menulis master vendors.
3. Pada detail vendor, buka **Lokasi & Foto → Tambah Lokasi**; isi alamat/GPS asli
   melalui manual, pilih pin atau GPS dengan konfirmasi, lalu unggah foto asli.
4. Kembali ke Peta Vendor, refresh, pilih pin dan klik **Rute ke Lokasi**. Navigasi
   menuju GPS fasilitas dilakukan di Google Maps aplikasi/browser.

Belum UAT CRUD dengan akun bisnis produksi atau rute nyata di ponsel; tidak membuat
akun Sourcing atau data dummy tanpa scope yang disetujui. Pemeriksaan RLS produksi
mencakup metadata/ACL dan akses anonim, sedangkan matriks role/CRUD sudah diuji lokal.
Tile OSM nyata tidak diuji lewat headless automation; pengguna dapat mengujinya di
browser biasa. Layanan tile publik tetap best-effort dengan batas pemakaian.

Backup membuktikan restore logis dan salinan blob, belum stack layanan/platform
Supabase penuh atau impor blob via Storage API. Ini tidak berubah karena aktivasi.
Push Git tetap memerlukan izin terpisah; tidak perlu deployment frontend baru untuk
aktivasi database ini. Sesudah UAT lokasi/rute selesai, tahap berikutnya Fase 4 sesuai roadmap.
