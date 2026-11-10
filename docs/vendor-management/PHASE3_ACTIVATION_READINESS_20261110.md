# Kesiapan migration Fase 3 — 10 November 2026

**Pembaruan 09.29 WIB:** user kemudian menyetujui migration; COMMIT dan verifikasi
produksi lulus. [Laporan aktivasi](PHASE3_PRODUCTION_ACTIVATION_20261110.md).
Isi di bawah adalah snapshot kesiapan sebelum persetujuan, bukan status saat ini.

Status: **backup baru dan pemeriksaan teknis lulus; menunggu persetujuan eksplisit
migration produksi**. User meminta melanjutkan pembaruan backup/preflight dan mengisi
password PostgreSQL di terminal interaktif. Tidak menjalankan migration produksi,
push Git, deployment tambahan, pembuatan akun atau tulis data bisnis.

Frontend gratis Leaflet/OpenStreetMap + tombol rute sudah production READY, source
`5ae0c673`; [bukti rilis](FREE_MAP_PRODUCTION_RELEASE_20261110.md). Backend lokasi/foto
belum aktif. Tidak memerlukan Google Cloud/API key/billing untuk pilihan peta ini.

## Backup dan bukti

Folder privat: `D:\Backups\harmas-pre-phase3-20261110-090939-f4bf7fbd`.
Backup 09.09 WIB; verifikasi selesai sekitar 09.16 WIB, 10 November 2026.
Backup 9 November tetap disimpan terpisah, tidak ditimpa.

- Dump PostgreSQL custom: **1.206.308 byte**.
- SHA-256: `1c0183981ddcdaa4e91a55cccb7a688c8de97d52c2fd33add276c6e42c6105f9`.
- Manifest, archive/TOC, snapshot dan blob beserta inventaris nama/path tersimpan
  hanya di folder privat. Tidak disalin ke Git.
- Koneksi produksi memakai PGPASSWORD dari terminal; driver memakai transaksi
  READ ONLY dan `default_transaction_read_only=on`. Password dibersihkan pada akhir
  proses helper; tidak membaca service key legacy.

| Pemeriksaan | Hasil |
|---|---|
| Preflight read-only | **9 kelompok PASS**, tidak ada benturan objek/bucket Fase 3 |
| Snapshot sebelum/sesudah/sesudah dump | Metadata/checksum **17 tabel** identik selama backup |
| Keamanan produksi relevan | **11 fungsi/ACL**, policy hardening, RLS dan trigger cocok snapshot tervalidasi; `exec_sql` tetap tertutup client |
| Restore archive | `pg_restore --exit-on-error` **exit 0** pada image Supabase PostgreSQL 17.11 |
| Isi archive vs restore | **140 tabel COPY / 1.908 baris**, jumlah dan hash seluruh baris per tabel cocok |
| Struktur public | 89 tabel, 235 FK, 208 policy, 58 trigger cocok archive |
| Migration di clone | Dua kali berhasil; 17 baseline, helper/ACL, policy dan bucket existing utuh |
| File Storage | **95 file / 29.027.178 byte**, seluruh ukuran dan ETag versi cocok; SHA-256 disk diperiksa ulang setelah penyalinan |
| Isolasi | Container tanpa jaringan/port, backup mount read-only, cron nonaktif; container sudah dihentikan |

Baseline bisnis: vendors=10, assets=55, employees=45, contracts=28, user_profiles=6,
auth.users=6, notifications=115, candidates/followups=0. Relasi aset-vendor=16, orphan=0.
Master vendor/aset juga cocok snapshot penerimaan sebelumnya. Tidak membuat fixture
atau akun produksi. Aktivitas platform sejak 9 November terlihat pada tabel Auth,
riwayat cron dan partisi realtime; backup ini memakai snapshot 10 November, bukan
menganggap snapshot lama identik dengan kondisi baru.

Semua objek Storage existing pada snapshot berada di bucket public; bucket private
existing berisi 0 objek. Inventaris dibaca dari clone, salinan file hanya melalui GET
URL yang memang public. Tidak upload, mengubah bucket, menghapus remote atau memakai
service key. Manifest privat blob memuat pemetaan nama asli ke nama file hash lokal.

Bukti metadata terbaru (berkas ini diperbarui oleh pemeriksaan 10 November):
[preflight](phase3-evidence/PRODUCTION_PREFLIGHT.json),
[restore](phase3-evidence/BACKUP_RESTORE_VERIFICATION.json),
[Storage](phase3-evidence/STORAGE_BACKUP_VERIFICATION.json),
[ringkasan](phase3-evidence/ACTIVATION_BACKUP_SUMMARY.json).
Versi bukti 9 November tetap tersedia pada riwayat Git sebelum commit pembaruan ini.

## Batas verifikasi dan kendala yang diselesaikan

Yang terbukti adalah restore logis database dan salinan isi file. Stack layanan Auth,
Storage/Gateway, konfigurasi/kunci eksternal, membership role global produksi dan
impor file melalui Storage API belum dipulihkan sebagai platform penuh. Manifest
tetap `supabase_platform_restore_complete=false` dan
`storage_restore_service_verified=false`. Jangan menyebut ini simulasi pemulihan
seluruh project Supabase.

Bootstrap image awal belum memiliki role pemilik `supabase_realtime_admin` dan role
ACL `supabase_functions_admin`. Role NOLOGIN yang diperlukan archive disiapkan hanya
di clone. Percobaan awal juga tertahan koneksi background dan kepemilikan database;
database clone dibuat ulang secara lokal, lalu restore lengkap lulus exit 0.
Tidak mengubah atau mengulang operasi tulis apa pun di produksi.

Role `postgres` image lokal tidak memiliki membership global produksi dan tidak
dapat membuat tabel pada schema public clone. Uji migration memakai administrator
bootstrap **supabase_admin**, yang memang diizinkan guard; privilege `postgres`
tidak dinaikkan. Hasil ini membuktikan SQL/idempotensi pada konteks administrator
clone, bukan reproduksi semua izin platform produksi. Hak role pelaksana SQL harus
dipastikan kembali read-only sebelum migration produksi.

Sembilan ekspresi policy berbeda penulisan akibat minor PostgreSQL dikanonisasi
dengan parser pada clone dalam transaksi rollback; tidak menghapus syarat policy
dengan regex. Perbandingan policy existing tetap lulus.

Tooling `verify-vendor-phase3-backup-local.mjs` dan
`backup-vendor-phase3-storage-public.mjs` diperbarui agar menerima backup tanggal
baru di bawah `D:\Backups\harmas-pre-phase3-*`, memeriksa realpath, tanggal clone,
label tugas, network/port dan mount read-only. Inventaris dibandingkan dengan
snapshot backup, tanpa angka jumlah file hardcode. Kedua skrip lolos syntax check
dan eksekusi aktual pada backup ini. Tidak ada perubahan frontend/dependency/SQL.

## Migration yang siap dimintakan persetujuan

- SQL: [202611090001_vendor_management_phase3.sql](../../supabase/migrations/202611090001_vendor_management_phase3.sql).
- SHA-256: `7f38d171690ceaf1afb2d0b8df4eb3462d48c41a49caf63bca7c2dd3bc945e2f`;
  identik dengan versi yang diuji sebelumnya.
- Rollback terpisah: [202611090001_vendor_management_phase3_rollback.sql](../../supabase/rollbacks/202611090001_vendor_management_phase3_rollback.sql).
- SHA-256 rollback: `11e32d1dc89587ef1eb1c58ad44b117604ca839d5ce31936ceab8e775cae9858`.

SQL menambah lokasi/foto, index/guard/audit/RLS, view/RPC vendor dan bucket privat
`vendor-photos` beserta policy Storage yang membatasi bucket tersebut. Tidak menulis
baris master vendors/assets/profiles atau mengaktifkan kembali policy lama yang
bermasalah. Uji clone membuktikan metadata/data existing yang dicakup tidak berubah.
Tidak ada perubahan isi migration/rollback pada tahap ini.

**Berhenti sebelum migration produksi dan minta persetujuan eksplisit user.**
Manifest `migration_approval_pending=true`, `ready_for_production_migration=false`
karena gerbang izin belum terpenuhi; pemeriksaan teknis backup lulus.

Setelah persetujuan: ambil baseline/preflight terakhir, periksa role pelaksana dan
izin schema/tabel Storage, jalankan hanya migration Fase 3 dalam transaksi, lalu
verifikasi objek/RLS/ACL/bucket privat dan checksum baseline existing. Jika kondisi
produksi berubah atau backup tidak lagi mewakili kondisi saat eksekusi, perbarui
backup terlebih dahulu. Jangan menjalankan seluruh folder migrations atau rollback
otomatis. Rollback setelah ada data lokasi/foto memerlukan review agar jejak tidak
hilang.

Sesudah backend aktif, pengguna mengisi lokasi nyata melalui input manual/pin/GPS
dengan konfirmasi, mengunggah foto asli dan menguji **Rute ke Lokasi** di ponsel.
Jangan mengarang koordinat atau membuat data dummy permanen. UAT akun operasional
Sourcing memerlukan penetapan akun yang memang diizinkan; tidak membuat akun
berprivilese otomatis. Tidak diperlukan deployment baru untuk mengaktifkan backend
pada frontend yang sekarang sudah dirilis.
