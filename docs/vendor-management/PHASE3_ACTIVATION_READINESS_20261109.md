# Kesiapan aktivasi database Fase 3 — 9 November 2026

**Catatan historis:** backup/preflight sudah diperbarui
[10 November](PHASE3_ACTIVATION_READINESS_20261110.md). File evidence bersama pada
tautan di bawah kini memuat pemeriksaan terbaru; versi bukti 9 November ada pada
riwayat Git. Migration produksi tetap belum dijalankan.

**Pembaruan pilihan peta 10 November:** kebutuhan Google Cloud pada catatan historis
ini diganti Leaflet/OpenStreetMap gratis dan Maps URLs untuk rute. Tidak perlu API
key/Map ID untuk pilihan terbaru. [Laporan perubahan](FREE_MAP_AND_DIRECTIONS_20261110.md).
Persetujuan migration produksi tetap terpisah dan belum diterima.

Status: **preflight, backup database, restore logis dan salinan blob terverifikasi;
migration produksi belum dijalankan**. User memasukkan PGPASSWORD sendiri di terminal
interaktif. Google Maps belum memiliki key/Map ID; [panduan setup](GOOGLE_MAPS_SETUP.md)
disiapkan sesuai permintaan user. Tidak membuka billing atau membuat key Google atas
nama user. Frontend di alamat utama sudah aktif sejak rilis sebelumnya.

## Backup terbaru

Direktori privat di luar repo:
`D:\Backups\harmas-pre-phase3-20261109-162946-b0c15d41`.
Backup dimulai 16.29 WIB; verifikasi selesai sekitar 16.41 WIB, 9 November 2026.

- `database.dump`: 1.202.620 byte, custom archive PostgreSQL.
- SHA-256: `c0224faff889ff635a33167212a0d5190aa640b43fe19249d5b66a656cd9cebc`.
- Manifest, TOC, metadata preflight, laporan restore dan manifest blob tersimpan
  bersama backup. Dump/raw data/nama path blob tidak disalin ke Git.
- Password hanya di environment proses helper dan dibersihkan sesudah driver selesai.
  Tidak ada service key legacy yang diambil; koneksi database memakai PostgreSQL langsung.

## Hasil yang dibuktikan

| Pemeriksaan | Hasil |
|---|---|
| Preflight PostgreSQL READ ONLY | 9 kelompok PASS; tidak ada benturan objek/bucket Fase 3 |
| Snapshot sebelum/sesudah dan sesudah dump | Metadata/checksum 17 tabel identik |
| Hash dan daftar archive | Cocok dengan manifest |
| Restore database | `pg_restore` exit 0 pada Supabase PostgreSQL 17.11; source database 17.6 |
| Isi archive vs restore | **139 tabel COPY, 1.905 baris** cocok per jumlah dan SHA-256 seluruh baris per tabel |
| Struktur aplikasi | 89 tabel public, 235 FK, 208 policy, 58 trigger cocok jumlah objek TOC |
| Keamanan | 11 fungsi/ACL, RLS/policy dan trigger relevan cocok dengan snapshot; exec_sql tetap tertutup client |
| Migration pada hasil restore | Dijalankan **dua kali hanya di clone lokal**, data/helper/policy/bucket existing tetap utuh |
| Blob Storage | **95 file, 29.027.178 byte** tersalin; 95 ETag sumber cocok, SHA-256 berkas lokal diperiksa ulang |
| Lingkungan restore | Container terpisah, tanpa jaringan/port, cron dimatikan; dihentikan setelah pemeriksaan |

Data operasional yang diamati: vendors=10, assets=55, employees=45, contracts=28,
user_profiles=6, auth.users=6, notifications=115; kandidat/follow-up=0. Ada 16 relasi
aset-vendor dan tidak ada orphan. Tidak membuat akun atau riwayat bisnis uji produksi.

Berkas Storage: assets 70, employee-photos 14, maintenance-photos 4, ppm-documents 7.
Bucket private existing tidak berisi file. Inventaris diambil dari database hasil
restore; unduhan hanya GET URL public untuk berkas yang memang sudah public.
Tidak menggunakan service key, mengubah bucket, upload atau menghapus objek produksi.

## Batas verifikasi dan temuan

Yang terverifikasi adalah **pemulihan logis database dan salinan isi blob**. Layanan
Supabase Auth/Storage/Gateway beserta konfigurasi eksternal dan kunci platform belum
dihidupkan sebagai stack pemulihan penuh. Blob belum diuji diimpor ulang melalui
Storage API. Manifest tetap `supabase_platform_restore_complete=false` dan
`storage_restore_service_verified=false`; jangan menyebutnya pemulihan seluruh
project Supabase. Salinan file, ukuran, versi ETag dan hash disk sudah terverifikasi.

Restore awal gagal karena schema public bawaan keliru dihapus pada database uji;
database clone dibuat ulang dengan schema public dipertahankan, kemudian restore
lulus exit 0. Extension pg_cron/pg_net/vault tersedia pada image Supabase, sehingga
error extension pada percobaan postgres:17 lama tidak muncul pada hasil final ini.

Deparser PostgreSQL 17.6/17.11 menuliskan beberapa ekspresi cast policy berbeda.
Sembilan policy dibandingkan dengan parse kanonik di engine restore yang sama;
policy sementara untuk pembandingan hanya dibuat dalam transaksi clone dan di-rollback.
Identitas policy, role, jenis operasi dan ekspresi yang diparse cocok. Tidak melakukan
normalisasi regex yang menghapus syarat keamanan atau mengubah policy produksi.

## Bukti dan file tooling

- [Preflight produksi](phase3-evidence/PRODUCTION_PREFLIGHT.json).
- [Verifikasi restore](phase3-evidence/BACKUP_RESTORE_VERIFICATION.json).
- [Verifikasi blob](phase3-evidence/STORAGE_BACKUP_VERIFICATION.json).
- [Ringkasan backup](phase3-evidence/ACTIVATION_BACKUP_SUMMARY.json).
- `scripts/start-vendor-phase3-backup.ps1`: prompt password aman dan pemanggil driver.
- `scripts/verify-vendor-phase3-backup-local.mjs`: hash/COPY/security dan migration clone.
- `scripts/backup-vendor-phase3-storage-public.mjs`: inventaris clone, download dan hash.

Container restore yang dihentikan: `harmas-vendor-restore-phase3-20261109-8bb9cf17`.
Tidak memodifikasi stack fixture `%TEMP%\harmas-vendor-test`. Tidak ada deployment atau
push baru pada tahap backup ini.

## Langkah yang menunggu persetujuan

Migration yang disiapkan: `supabase/migrations/202611090001_vendor_management_phase3.sql`;
rollback terpisah di `supabase/rollbacks/202611090001_vendor_management_phase3_rollback.sql`.
Isi SQL dan invariannya sudah direview serta diuji pada fixture dan hasil restore.

**Minta persetujuan eksplisit user untuk menjalankan migration Fase 3 di produksi.**
Backup yang lulus tidak dianggap sebagai izin migration otomatis. Setelah disetujui,
ambil baseline/preflight terbaru lagi, jalankan hanya migration tersebut, lalu
verifikasi schema/RLS/ACL/bucket privat serta checksum data existing. Jangan membuat
vendor/koordinat/foto dummy permanen untuk UAT tanpa scope yang disetujui.

Google Cloud dapat disiapkan paralel. Key browser dibatasi domain produksi dan Maps
JavaScript API; Map ID JavaScript Vector dimasukkan ke environment Production.
Tanpa konfigurasi Google, backend lokasi tetap dapat dipakai lewat alamat/GPS/manual
dan fallback daftar setelah migration, tetapi peta tiles Google belum tersedia.
