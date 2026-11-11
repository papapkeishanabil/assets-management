# Kesiapan rilis katalog sampel Ofissio — 11 November 2026

**Ofissio: migration produksi COMMITTED dan terverifikasi; backend menunggu Dashboard.**
Migration `202611110003` yang telah disetujui berjalan pada 2026-11-11T08:27:42.560Z.
Persetujuan sudah dikonsumsi. **Jangan menjalankan ulang executor migration.**
Backup terbaru `D:\Backups\harmas-pre-ofissio-20261111-082620-05d1c5e6`: **148 tabel/1.857 baris**,
restore aplikasi dan rehearsal migration/rollback lulus, **96/96 file Storage** lengkap.
Original privat 143.698 byte dari ZIP pengguna cocok native ETag MD5 dan SHA-256;
dipakai ulang untuk refresh hanya setelah metadata identitas cocok.
27 tabel baseline, data existing, fungsi/ACL/RLS/policy/view/trigger sebelumnya utuh.
Enam post-check PASS: bucket privat, reference kosong, RPC service-only, trigger aktif,
policy lengkap, dan reference SELECT-only. Tidak membuat akun/data uji bisnis,
tidak mengaktifkan kandidat, tidak push Git, dan tidak mempromosikan frontend.
Frontend utama terbaru `7d24e295`, deployment
`dpl_GTXij7gDgjy5ivswdJ9Z5F7ZBDtJ`, sudah membawa source Ofissio teruji dan peta terbaru.
11 file publik, konfigurasi Auth dan 8 guard login anonim PASS; error browser 0,
request tulis 0. Artifact lokal berbeda; tidak diklaim cocok hash build lokal.
Backend `vendor-ofissio-catalog` masih 404 pada probe 2026-11-11T08:24:12.376Z.
Pengguna diminta deploy bundle teruji `.vercel/ofissio-function-bundle.ts`
melalui Dashboard Supabase HARMAS, nama fungsi persis dan Verify JWT ON.
Sesi ini tidak memiliki token deployment Supabase; jangan ambil key legacy.
Verifikasi header release dan penolakan anonim setelah pengguna selesai deploy;
UAT login Super Admin/Sourcing serta pembuatan sampel tetap menunggu pengguna.
Jangan promosikan staging lama atau menimpa peta terbaru.
[Bukti migration](ofissio-catalog-evidence/PRODUCTION_MIGRATION_CHECKS.json),
[frontend](ofissio-catalog-evidence/CURRENT_MAIN_FRONTEND_CHECKS.json),
[impor Storage](ofissio-catalog-evidence/PRIVATE_STORAGE_IMPORT_CHECKS.json).

**Catatan di bawah adalah riwayat persiapan; status migration terbaru mengikuti bukti di atas.**

**Frontend utama terbaru sudah memuat Ofissio; backend dan migration masih menunggu.**
Selama persiapan, domain utama beralih ke rilis peta `b0e376a6`, deployment
`dpl_A9EAQDt7WJzNAkvZa5yc8M9fT7qZ`. Commit tersebut merupakan turunan `e1285125`
dan seluruh source fitur Ofissio tetap cocok dengan hash teruji. Sebelas file
publik, konfigurasi Auth dan delapan guard anonim diperiksa: tidak ada error
browser/permintaan tulis. Hash publik dicatat, tetapi build lokal yang tersedia
berbeda sehingga **tidak diklaim cocok dengan artifact rilis tersebut**.
[Pemeriksaan domain terkini](ofissio-catalog-evidence/CURRENT_MAIN_FRONTEND_CHECKS.json).

Staging `e1285125` di bawah adalah bukti persiapan sebelumnya dan **tidak boleh
dipromosikan**, karena akan mengembalikan versi peta lama. Build gabungan `b0e376a6`
juga sudah disiapkan terisolasi sebagai cadangan, tanpa upload/promosi baru;
perubahan `vendor-location-utils.js` yang masih berjalan di workspace tidak
disertakan. Frontend utama dapat dipertahankan setelah backend/DB siap apabila
pemeriksaan akhir kembali cocok; jangan menimpa rilis lebih baru secara otomatis.

User memberi izin
deploy melalui “ok deploy”, lalu “lanjutkan”. Migration `202611110003` belum
disetujui terpisah dan belum dieksekusi. Backend menunggu deployment Dashboard.
Tidak ada push Git atau perubahan data bisnis produksi.

## Riwayat staging dan build

- Source fitur teruji: `e12851253da2240bae269d56d461f0a72897d0ec`.
- Build dibuat dari **ekspor file runtime commit tersebut** di folder terisolasi
  `%TEMP%\harmas-ofissio-release-e12851253da2`. Source dibandingkan dengan hash
  pengujian dan file commit, konfigurasi publik divalidasi melalui Auth settings.
- Perubahan peta yang sedang berlangsung di workspace sengaja tidak disertakan:
  `VendorMap.jsx`, `vendor-map.css`, `VendorMapPage.jsx`. Tidak menimpa/stash/reset
  pekerjaan tersebut; `AuthContext.jsx`, `.superdesign/`, dan skrip finance juga
  tetap di luar commit rilis.
- Prebuilt Vercel/PWA lulus; **86 file** artifact diperiksa tanpa environment,
  service key, token OIDC, dump atau SQL. Hanya dua variabel publik Supabase yang
  disalin ke build terisolasi. Environment cloud tidak diubah.
- Deployment **`dpl_5bHPoKtZUHK3BVo6fVsBVriUCXDN`**, production skip-domain:
  https://harmas-asset-management-gembyprdv.vercel.app . Proyek
  `prj_2MBxDEiNjz80jfB2L0dQ55hUbG0P`, tim `team_gulGpJeEXpB77MplKv8w4Ilo`.
- **14/14 hash file dan 4/4 fallback route cocok** melalui `vercel curl`
  terautentikasi. Tidak mematikan Deployment Protection atau membuat share token.
- Pada saat probe staging, domain utama masih `dpl_8Dv1gZW6jhdE1wg8D4CvziiezjhQ`,
  source `888cd72a`, hash HTML lama cocok. Kemudian berubah ke rilis peta terbaru
  seperti status di atas. Staging lama kini hanya disimpan sebagai bukti.

[Preflight](ofissio-catalog-evidence/FRONTEND_PREFLIGHT.json),
[staging](ofissio-catalog-evidence/STAGING_CHECKS.json).

## Preflight, backup dan clone

Koneksi PostgreSQL langsung memakai password yang dimasukkan pengguna di
terminal tersembunyi. Semua koneksi persiapan produksi memakai
`default_transaction_read_only=on` dan transaksi READ ONLY. Tidak mengambil
service key dari file legacy. Password dibersihkan setelah helper selesai.

Backup privat terbaru:
`D:\Backups\harmas-pre-ofissio-20261111-055844-aacfeda0`.
Dump **1.364.299 byte**, SHA-256
`7db6be2577329cce369c14ca5d3d65977d52f9a3f7e919bd4f6e64100a397335`.

- Full COPY restore **148 tabel / 1.851 baris** dibandingkan dengan dump, bukan
  hanya menghitung daftar tabel. Checksum **27 tabel baseline** meliputi Fase 4/5
  serta master, aset, profil/Auth, role, audit dan lokasi.
- **95 blob / 29.027.178 byte** disalin, dibandingkan ukuran/ETag dan hash disk.
  Inventaris backup saat ini **0 file privat**. Tidak memakai kredensial Storage.
- Clone baru `harmas-ofissio-restore-20261111-aacfeda0`: network none, tidak ada
  port publik, mount backup read-only, cron jobs nonaktif, dihentikan setelah uji.
- Migration baru + replay dua kali, rollback dua kali, stale transaction ditolak;
  seluruh baseline data, fungsi/ACL, RLS, policy, view dan trigger existing utuh.
- Delapan gerbang rilis juga diuji pada clone backup terdahulu yang dipasang
  Fase 4/5 secara offline: privilege hilang, baseline stale, perubahan fungsi
  aktivasi dan bucket publik ditolak; rollback mempertahankan Fase 4/5.
- Restore logis aplikasi/metadata diverifikasi; pemulihan seluruh layanan platform
  Auth/Storage/Gateway Supabase tidak diklaim lengkap.

[Backup readiness](ofissio-catalog-evidence/BACKUP_READINESS.json),
[gerbang rilis](ofissio-catalog-evidence/RELEASE_GATE_TESTS.json).
Karena penyelesaian terakhir berjalan offline tanpa password, **live recheck
terakhir wajib** sebelum migration. Executor yang disiapkan memeriksa ulang
baseline/privilege, hash backup/blob, source dan umur backup. Jika baseline
berubah atau usia mencapai satu jam, backup read-only diperbarui memakai sesi
password yang sama sebelum ada percobaan migration.

## Backend Dashboard

Tidak ada konektor/otorisasi deployment Supabase dalam sesi ini. Mengikuti
pilihan pengguna sebelumnya, backend disiapkan untuk deployment lewat Dashboard,
yang tercakup izin deploy saat ini. Tidak meminta token di chat.

1. Buka https://supabase.com/dashboard/project/uwlxkwyauxwewoexfgwi/functions .
2. Deploy a new function → Via Editor, nama persis **`vendor-ofissio-catalog`**.
3. Ganti seluruh isi `index.ts` dengan
   `E:\ASSET MANAGEMENTS\harmas-asset-management\.vercel\ofissio-function-bundle.ts`.
4. Pertahankan Verify JWT aktif dan deploy. Reserved environment Supabase
   menyediakan URL/anon/service role; tidak ada key dalam bundle.

Bundle berisi handler yang hash-nya cocok dengan implementasi teruji, import
Supabase SDK yang dipin, dan adapter header versi `ofissio-e1285125` untuk probe
OPTIONS tanpa login. Adapter diujikan lokal tanpa jaringan/kredensial. Bundle
SHA-256 `a0d1b17d403a05ec98163e6b170574f5559b426d0bff15b1532a009820d2226f`.
[Bukti bundle](ofissio-catalog-evidence/EDGE_BUNDLE_PREPARATION.json).

Probe awal sekitar 13.07 WIB mendapat **404**, sehingga deployment backend belum
dinyatakan berhasil. [Probe](ofissio-catalog-evidence/EDGE_DEPLOYMENT_PROBE.json).
Setelah pengguna deploy, periksa header versi, OPTIONS/CORS dan penolakan anonim;
uji pencarian terautentikasi memerlukan akun operasional pengguna. Jangan membuat
akun privileged atau data dummy produksi tanpa persetujuan tersendiri.

## Helper rilis dan koreksi selama persiapan

- `vendor-ofissio-release-checks.mjs`: pure snapshot/validator/transaksi untuk
  27 baseline dan satu SQL baru, tanpa koneksi saat import.
- `prepare-vendor-ofissio-frontend.mjs`: build dari source commit terisolasi;
  tidak deploy/push/menulis DB. Upload staging melalui CLI terpisah.
- `backup-vendor-ofissio-release.mjs`, `start-vendor-ofissio-backup.mjs`:
  preflight/backup **read-only** dan rehearsal hanya pada clone.
- `finish-vendor-ofissio-backup-local.mjs`: melanjutkan verifikasi clone/COPY/blob
  yang sudah ada; tidak mempunyai koneksi SQL produksi atau akses password.
- `apply-approved-vendor-ofissio.mjs`, `start-vendor-ofissio-migration.mjs`:
  **belum dijalankan untuk migration**. Menolak tanpa file persetujuan terpisah
  sekali pakai, quote user, target/hash SQL dan source pin. Persetujuan lama
  Fase 4/5 tidak dipakai ulang. Driver diuji menolak sebelum kredensial/network
  saat file persetujuan tidak tersedia.

Build pertama menolak perubahan peta yang belum direview; penyelesaiannya memakai
ekspor commit terisolasi. Docker Desktop yang tidak aktif dinyalakan untuk uji.
Rehearsal awal pada database tambahan clone lama terbentur konfigurasi database
pg_cron; clone baru memakai database cron yang sesuai dan jobs nonaktif.

Pembanding restore awal memasukkan nama database/executor yang memang berbeda
antara produksi dan clone. Keduanya kini divalidasi terpisah, seperti driver
sebelumnya; semua data/owner/ACL/fungsi/policy tetap dibandingkan. Deparse policy
dikanonisasi lengkap pada engine restore, urutan seluruh baris memakai COLLATE C.
Asumsi rollback harus menghapus objek Fase 4/5 juga diperbaiki: hanya objek
katalog baru yang harus hilang. Bucket tambahan kosong milik rehearsal boleh
tetap ada, setelah divalidasi privat/kosong/ukuran/MIME dan dipastikan tidak ada
pada baseline dump. Tidak mengecualikan baris bisnis existing dari verifikasi.
Impor hashing dan reuse blob identik diperbaiki pada helper lanjutan; verifikasi
diselesaikan tanpa meminta ulang password atau SQL produksi.

## Langkah yang masih menunggu

1. Konfirmasi migration produksi **`202611110003_vendor_sample_ofissio_references.sql`**
   secara terpisah, sesuai aturan pengguna, lalu input password untuk executor.
   SQL tidak berubah dari hash teruji `2dc70eecbb64f7198eac55566485c064cd9c148ab041ed6c703e6435de8aa0df`.
2. Live preflight/backup refresh bila perlu, satu transaksi migration, COMMIT dan
   pemeriksaan ulang semua baseline/guard/hak/bucket baru. Tidak mengaktifkan
   kandidat atau membuat fixture produksi.
3. Verifikasi deployment backend Dashboard dengan nama/header versi yang tepat.
4. Periksa kembali domain utama terbaru yang sudah memuat source Ofissio dan
   mempertahankan peta. Bila artifact tambahan diperlukan, gunakan source gabungan
   yang telah diperiksa; jangan promosikan staging lama `e1285125`. Verifikasi
   domain utama/PWA/route dan error browser setelah backend/DB aktif.
5. UAT Sourcing/Super Admin pada data yang disepakati; pencarian KS-003/SN,
   manual Harmas, acuan privat, QC dan retry. Push Git tetap menunggu izin lain.

Jika outcome migration tidak pasti, jangan retry otomatis; lakukan inspeksi
read-only terlebih dahulu. Rollback membutuhkan review/persetujuan baru dan
menolak acuan/file yang sudah berisi.
