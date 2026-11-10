# Aktivasi arsip kandidat yang disetujui

**Pembaruan verifikasi backup:** autentikasi pertama ditolak sebelum backup/write.
Input kedua berhasil; backup `D:\Backups\harmas-pre-candidate-archive-20261110-094017-12d0c079`
dibuat, tetapi perbandingan restore sempat berhenti karena urutan ACL tiga fungsi.
Tidak ada percobaan migration produksi. Reviewer kini mengurutkan isi ACL dengan
collation C, tetap membandingkan seluruh grant/grantor serta izin efektif.
8/8 uji transaksi tetap lulus. Verifikasi offline penuh backup: **141 tabel COPY /
1.830 baris**, 18 baseline, helper/guard/ACL/RLS cocok; migration dan rollback dua
kali di clone berhasil. [Bukti](candidate-archive-evidence/BACKUP_OFFLINE_VERIFICATION.json).
Clone dihentikan. Password sudah dibersihkan; terminal lanjutan meminta ulang
password dan membuat backup baru sebelum write yang telah disetujui.

Pengguna menyetujui migration secara eksplisit dengan **“ya setuju”**, setelah
menyetujui deployment frontend. Persetujuan berlaku untuk migration
`202611100001_vendor_candidate_archive.sql`, SHA-256
`f2ed4b42d2fb77ab8c9e986ff5fd6bead177d28b72d562bb2671ab8d06aeb1c5`.
Tidak perlu meminta persetujuan migration/deploy yang sama lagi.

## Driver khusus rilis ini

- `scripts/start-vendor-candidate-archive-release.ps1`: prompt password tersembunyi,
  PGPASSWORD dibersihkan setelah driver selesai. Password tidak ditulis ke file.
- `scripts/release-vendor-candidate-archive.mjs`: target PostgreSQL produksi tetap;
  snapshot READ ONLY, pg_dump di luar repo, restore Docker tanpa jaringan/port,
  verifikasi COPY seluruh tabel, rehearsal migration/rollback pada clone, lalu
  satu write yang sudah diotorisasi. Bukan driver Fase 3 lama.
- `scripts/vendor-candidate-archive-release-checks.mjs`: reviewer definisi fungsi,
  izin DDL, 18 checksum tabel, RLS/policy/helper/guard, view peta dan objek arsip;
  membungkus migration dengan pemeriksaan sebelum/sesudah dalam satu transaksi.
- `scripts/test-vendor-candidate-archive-release.mjs`: rehearsal pembungkus rilis
  di Docker sintetis, tanpa kredensial atau koneksi produksi.

Snapshot mencakup 18 tabel, termasuk vendors, assets, user_profiles, role/izin,
notifikasi, kandidat, kontak, lokasi/foto, follow-up, riwayat dan Auth users/identities.
Checksum kandidat menormalkan tiga kolom baru agar penambahan metadata NULL tidak
dianggap perubahan data existing. Semua policy public/storage dibandingkan;
helper/guard lama dan ACL tetap. Archive RPC, filter monitoring dan view baru
divalidasi terhadap source migration yang disetujui.

Driver membuat backup privat di `D:\Backups\harmas-pre-candidate-archive-*`.
Dump/hash/TOC dan hasil restore harus valid sebelum write. Restore memakai image
Supabase PostgreSQL yang sama dengan proses Fase 3 sebelumnya, jaringan `none`,
tanpa published port, mount backup read-only dan cron job nonaktif. Role bootstrap
hanya dibuat di clone. Setiap COPY archive dibandingkan hash dan jumlah baris.
Restore logis aplikasi diverifikasi; restore keseluruhan platform Supabase tidak
diklaim lengkap. Blob Storage tidak disalin pada rilis ini, karena migration tidak
memodifikasi/menghapus bucket maupun file fisik dan arsip mempertahankan foto.

Jika baseline berubah saat backup/restore, proses berhenti sebelum write. Jika
pernah mencoba write tetapi marker COMMIT tidak jelas, status menjadi
MIGRATION_OUTCOME_REVIEW_REQUIRED; jangan mengulang otomatis. Periksa database
read-only terlebih dahulu. Catatan izin yang dikonsumsi disimpan di `.vercel/`.

## Bukti rehearsal lokal

**8/8 pemeriksaan PASS**, [hasil](candidate-archive-evidence/RELEASE_TRANSACTION_TEST_RESULTS.json):
snapshot lengkap, baseline stale ditolak, database/executor salah ditolak, perubahan
RLS yang disisipkan sengaja menyebabkan rollback seluruh transaksi, migration
valid dan pengulangan idempotent berhasil, rollback dua kali memulihkan snapshot.
Pemeriksaan sintaks Node dan PowerShell juga lulus. Fixture sintetis tidak mempunyai
exec_sql; reviewer menerima kondisi fungsi tidak ada atau hak anon/authenticated
tetap dicabut. Tidak ada kelonggaran jika exec_sql memang ada di produksi.

Status runtime ada di `.vercel/candidate-archive-activation-status.json`. Jangan
menganggap migration selesai hanya karena terminal dibuka atau password diisi.
Laporan produksi baru dibuat sesudah COMMIT dan verifikasi read-only berhasil.
Sesudah itu lanjutkan promosi staging `dpl_8HZD3SCrS2ZuwGWRonkkYPRPUKEu` yang sudah
disetujui, bandingkan artifact dan verifikasi halaman publik tanpa dummy bisnis.
