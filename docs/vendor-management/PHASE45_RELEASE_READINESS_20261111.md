# Kesiapan rilis gabungan Fase 4 + 5 — 11 November 2026

**Status akhir: migration dan frontend sudah LIVE pada 11 November 2026.**
Persetujuan migration terpisah sudah diberikan dan dikonsumsi; COMMIT/20 baseline
terverifikasi, staging dipromosikan ke domain utama. Tidak ada push Git.
[Laporan produksi dan checklist UAT](PHASE45_PRODUCTION_RELEASE_20261111.md).

Isi di bawah adalah catatan persiapan **sebelum** eksekusi, dipertahankan sebagai
riwayat review. Status menunggu persetujuan/eksekusi tidak berlaku lagi.

## Frontend

- Source fitur `888cd72a` (Fase 5), setelah `4788f2ca` (Fase 4). File runtime
  dibandingkan dengan Git, termasuk normalisasi line ending; pekerjaan lain tidak
  dimasukkan. Tidak ada perubahan JavaScript UI saat hardening SQL di bawah.
- Staging **`dpl_8Dv1gZW6jhdE1wg8D4CvziiezjhQ`**, target production **tanpa alias
  utama**: https://harmas-asset-management-2dcsbcywj.vercel.app . Dilindungi
  autentikasi Vercel, selain login aplikasi HARMAS.
- Build prebuilt Vercel/PWA lulus; **86 file** diperiksa tanpa secret/env/dump,
  **14/14 hash artifact staging cocok** dengan build yang direview. Konfigurasi
  publik Supabase divalidasi lewat GET settings; env cloud tidak diubah.
- Domain utama masih menunjuk `dpl_8HZD3SCrS2ZuwGWRonkkYPRPUKEu`, rilis arsip
  kandidat sebelumnya. Proyek/tim terverifikasi:
  `prj_2MBxDEiNjz80jfB2L0dQ55hUbG0P` /
  `team_gulGpJeEXpB77MplKv8w4Ilo`.
- [Preflight frontend](phase45-release-evidence/FRONTEND_PREFLIGHT.json),
  [hash staging](phase45-release-evidence/STAGING_CHECKS.json).

## Backup dan rehearsal

Backup privat: `D:\Backups\harmas-pre-phase45-20261111-040820-8f160784`.
Dump 1.255.677 byte, SHA-256
`2f2ad10d1cc4687acd578757d6fe1abe59a2ba086e613a78d2d8a8b046095373`.

- Preflight produksi menggunakan PostgreSQL langsung, **READ ONLY**; tidak
  mengambil service key dari file legacy. Password dimasukkan tersembunyi di
  terminal dan dibersihkan setelah proses selesai.
- Restore logis **141 tabel / 1.839 baris** terverifikasi melalui seluruh COPY.
  Dua puluh checksum tabel aplikasi/Auth, helper/fungsi public, ACL, RLS, trigger,
  view, metadata Storage dan relasi aset diperiksa.
- **95 blob / 29.027.178 byte** disalin dan hash disk diverifikasi. Inventaris
  backup saat ini memiliki **0 objek file privat**; bucket privat kosong tetap
  tercakup metadata. Tidak memakai service key untuk file publik ini.
- Clone tanpa jaringan/published port, backup mount read-only, cron nonaktif.
  Migration gabungan dan rollback masing-masing dua kali lulus. Aktivasi pada
  schema/constraint master hasil restore diuji dalam transaksi yang selalu
  ROLLBACK, memakai salinan approver yang sudah ada; tidak membuat akun.
- [Readiness backup](phase45-release-evidence/BACKUP_READINESS.json).
  Restore seluruh platform Auth/Storage/Gateway tidak diklaim lengkap. Live
  baseline harus diperiksa lagi sebelum eksekusi; backup diperbarui dengan sesi
  password yang sama jika berubah atau berusia lebih dari satu jam.

## Koreksi yang ditemukan sebelum produksi

1. **Collation katalog:** 239 policy pada clone tersusun berdasarkan tipe `name`,
   sedangkan pengurutan hasil JSON bertipe `text` mengikuti locale berbeda.
   Pembanding lama salah menilai perubahan. Kini kedua sisi dibandingkan melalui
   seluruh isi baris JSON dengan urutan byte `COLLATE "C"`. Tidak mengabaikan
   ekspresi, role, aksi, permissive/restrictive atau ACL. Kegagalan terjadi pada
   clone dan transaksinya dibatalkan; tidak ada write produksi.
   [Bukti](phase45-release-evidence/COLLATION_CHECK.json).
2. **Default privileges Supabase:** backup memperlihatkan default grant ALL tabel
   kepada authenticated, baik creator postgres maupun supabase_admin. RLS tidak
   membatasi TRUNCATE. Migration Fase 4 kini mencabut ALL privilege pada lima tabel
   barunya sebelum memberikan hak DML yang diperlukan, termasuk menghapus
   TRUNCATE/TRIGGER/REFERENCES/MAINTAIN. Sequence baru juga direset izinnya; hanya
   sequence kode sampel memberi USAGE untuk trigger invoker, tanpa hak reset.
   Sequence keputusan/aktivasi Fase 5 internal saja. Tidak mengubah default
   privileges schema atau hak tabel/role existing.

Kedua file belum pernah dieksekusi produksi, sehingga perbaikan dimasukkan ke
migration Fase 4/5 yang sama. **Hash rilis final ada di
[SQL_REVIEW.json](phase45-release-evidence/SQL_REVIEW.json)**, menggantikan hash
laporan implementasi sebelum hardening. Isi lengkap:
[Fase 4](../../supabase/migrations/202611110001_vendor_management_phase4.sql),
[Fase 5](../../supabase/migrations/202611110002_vendor_management_phase5.sql).
Rollback tetap terpisah di `supabase/rollbacks`.

## Pengujian setelah hardening

| Cakupan | Hasil |
| --- | --- |
| Fase 4: database/API + browser | **75/75** (58 + 17) |
| Fase 5: database/API + browser | **69/69** (53 + 16) |
| Gerbang rilis/transaksi/ACL/RLS | **12/12** |
| Hash staging yang dilayani Vercel | **14/14** |
| Clone restore aktual + replay/rollback + aktivasi ROLLBACK | Lulus |

[Regresi Fase 4](phase45-release-evidence/regression-phase4/RESULTS.json),
[regresi Fase 5](phase45-release-evidence/regression-phase5/RESULTS.json),
[gerbang rilis](phase45-release-evidence/RELEASE_GATE_TESTS.json).
Target tes fitur selalu Docker/loopback, tidak membaca `.env` produksi. Permissions
browser dimock pada respons baca; RPC, RLS, Storage dan CRUD memakai backend lokal.
Seluruh akun/fixture dibersihkan dan checksum/security baseline kembali identik.

## Helper dan batas eksekusi

- `vendor-phase45-release-checks.mjs`: SQL snapshot 20 tabel, expected source/ACL,
  privilege checks, pembungkus transaksi dengan pre/postcheck sebelum COMMIT.
- `backup-vendor-phase45-release.mjs` dan `start-vendor-phase45-backup.mjs`:
  koneksi produksi **read-only saja**, backup dan uji clone. Tidak memiliki jalur
  eksekusi migration produksi.
- `finish-vendor-phase45-backup-local.mjs`: menyelesaikan/mengulang rehearsal pada
  clone offline dan memverifikasi blob backup, tanpa password/koneksi SQL live.
- `apply-approved-vendor-phase45.mjs` dan `start-vendor-phase45-migration.mjs`:
  **tidak dijalankan sebelum persetujuan terpisah**. Menolak tanpa token persetujuan
  sekali pakai, target/hash sesuai, password, backup terverifikasi dan live baseline
  identik. Bila backup stale, persiapan read-only diulang dahulu memakai password
  sesi yang sama. Tidak menulis kandidat/master/akun uji.
- `prepare-vendor-phase45-frontend.mjs`: build/scan saja; deployment staging melalui
  CLI prebuilt terpisah. Plugin Vercel dipakai untuk inspeksi proyek/domain.
- `test-vendor-phase45-release.mjs`: hanya Docker sintetis. Enam driver juga lulus
  pemeriksaan sintaks; driver eksekusi menolak file persetujuan yang belum ada
  sebelum mencapai kredensial/network.

Persetujuan lama arsip kandidat yang telah dikonsumsi tidak dipakai kembali.
Jika status menyebut outcome migration belum pasti, jangan mengulang otomatis:
periksa schema secara read-only terlebih dahulu.

## Langkah berikut

1. Persetujuan eksplisit untuk **`202611110001` lalu `202611110002`** dalam satu
   transaksi. Hanya objek baru, dua bucket privat, dan enam seed rubrik; tidak
   mengaktifkan kandidat atau menulis data bisnis existing.
2. Input password tersembunyi pada terminal migration yang disetujui; verifikasi
   backup/live baseline kembali, eksekusi, lalu verifikasi COMMIT, 20 checksum,
   fungsi/ACL/RLS/trigger/policy existing dan seluruh objek baru.
3. Setelah DB terverifikasi, promosikan **staging yang sama**, tanpa rebuild,
   menggunakan izin deployment frontend yang sudah diberikan user.
4. Periksa 14 hash domain utama, PWA, guard anonim menu existing dan tiga menu
   baru, serta error runtime. UAT login/CRUD dengan akun operasional milik user;
   jangan membuat akun privileged/data dummy produksi tanpa scope tersendiri.

Tidak ada push Git, aktivasi kandidat, pengarsipan bisnis, atau perubahan
role/owner/platform pada persiapan rilis ini.
