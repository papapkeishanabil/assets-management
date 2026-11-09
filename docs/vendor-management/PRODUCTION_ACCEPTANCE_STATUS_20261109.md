# Status produksi dan penerimaan Fase 1+2 — 9 November 2026

Status: **migration Fase 2 dan frontend Fase 1+2 sudah tersedia di produksi; UAT baca Super Admin/Sourcing selesai dan lulus**. Kedua akun/profil uji sementara sudah dihapus. Dokumen ini memperbarui catatan persiapan 6 November yang masih menyebut belum migration/push/deploy.

## Yang benar-benar diverifikasi pada sesi ini

Pemeriksaan awal: route publik aplikasi → guard login; endpoint anonim → RLS; definisi database produksi → migration yang direview. Tahap awal tidak membuat akun atau login. Setelah user menyetujui secara eksplisit dua akun sementara, dilanjutkan UAT baca dengan login normal Super Admin/Sourcing dan pembersihan akun tersebut. **Tidak memasukkan kandidat/follow-up, tidak mengirim reminder/notifikasi dummy, dan tidak menjalankan migration/push/deploy.**

| Pemeriksaan | Hasil |
|---|---|
| Empat fungsi Fase 2 | Isi fungsi produksi identik dengan migration `202611060001_vendor_management_phase2.sql` |
| RLS/trigger Fase 2 | Aktif; tiga policy, tanpa DELETE; guard dan audit trigger enabled |
| Hardening existing | Delapan policy user_profiles/roles/notifications dan tujuh definisi fungsi existing identik dengan snapshot pra-Fase 2 |
| Izin RPC | exec_sql tetap tertutup anon/authenticated; dashboard/reminder tetap INVOKER dan tertutup anon |
| Master operasional | Checksum vendors/assets identik dengan snapshot pra-Fase 2; 16 relasi aset-vendor, 0 orphan |
| Akses anonim | Lima endpoint internal tidak membocorkan data; empat route UI mengarah ke login |
| Frontend | HTTP 200; bundle memuat halaman follow-up, produktivitas PIC, contact_outcome; tidak mengandung service key |
| Efek pemeriksaan | Snapshot/checksum sepuluh tabel dan metadata identik sebelum/sesudah |
| Jumlah | **9 kelompok pemeriksaan PASS**, 0 FAIL |

Bukti: [READONLY_RESULTS.json](production-verification-20261109/READONLY_RESULTS.json), [login desktop](production-verification-20261109/anonymous-login-desktop.png), [login mobile](production-verification-20261109/anonymous-login-mobile.png).

Hasil lokal sebelumnya tetap terpisah: 71 pemeriksaan SQL dan 20 browser serta build lulus. Redirect login pada browser anonim membuktikan guard anonim. UAT login produksi dibuktikan secara terpisah pada hasil berikut, bukan disimpulkan dari pengujian lokal.

## Data produksi yang diamati

vendors=10; assets=55; relasi aset-vendor=16; orphan=0; vendor_candidates=0; vendor_followups=0. Profil operasional aktif sebelum/setelah UAT: Super Admin=2, Direksi=2, Finance=1, HRD=1, **Sourcing permanen=0**. Kedua akun uji hanya hadir selama UAT. Tidak menyalin nama/email pengguna existing ke laporan ini.

Baseline tepat sebelum UAT login mencatat employees=45 dan contracts=28. Angka tersebut sudah ada sebelum akun uji dibuat (snapshot awal sebelumnya adalah 44/27). Checksum sebelum/sesudah UAT identik; pengujian tidak membuat atau mengubah karyawan/kontrak.

Commit Fase 2 adalah `c02a66d5`; commit lokal terbaru `12de0de4` memperbaiki penggunaan password akun E2E melalui env. Reflog lokal mencatat push ke origin/main pada 6 November 2026 pukul 14.39 WIB. Bundle publik membuktikan kode Fase 2 sudah tersaji; metadata deployment Vercel belum dapat diverifikasi karena koneksi app memerlukan autentikasi ulang. Jangan mengasumsikan commit deployment persis dari nama hash bundle.

## Backup pra-Fase 2 ditemukan dan ditinjau

File: `D:\Backups\harmas-pre-phase2-2026-11-06.dump`, 1.178.511 byte. SHA-256 dihitung ulang pada pemeriksaan ini dan cocok dengan manifest:

```text
1fc0df1727b296f115b0860269984b3ea5e3d57351fb5f0529aaf0ae58ba8048
```

Bukti teredaksi: [BACKUP_EVIDENCE_REVIEW.json](production-verification-20261109/BACKUP_EVIDENCE_REVIEW.json). Bukti asli manifest/restore/platform-analysis tetap di D:\Backups, di luar Git. Tidak menyalin dump atau baseline berisi data ke repo.

Laporan restore 6 November mencatat pemulihan **90 tabel aplikasi/identitas** (88 public + auth.users/auth.identities), 232 foreign key, 205 policy, 56 trigger, dan tujuh helper/guard/ACL; preflight migration Fase 2 pada hasil restore juga lulus. Tidak ditemukan kehilangan data aplikasi dalam pemeriksaan tersebut.

**Batas penting:** pg_restore menghasilkan exit 1 dengan 31 error komponen platform: pg_cron, pg_net, supabase_vault serta role/platform terkait tidak tersedia pada image postgres:17 standar. Pemulihan aplikasi terverifikasi; **pemulihan seluruh platform Supabase belum terverifikasi**, dan file Storage tidak termasuk. Ini peninjauan bukti restore 6 November ditambah pemeriksaan hash sekarang, bukan klaim melakukan restore baru pada 9 November. Pemulihan penuh memerlukan lingkungan Supabase yang kompatibel beserta konfigurasi/kunci layanan yang sesuai.

## Hasil UAT baca dengan akun sementara yang disetujui

User menyetujui dua akun uji sementara melalui jawaban langsung atas permintaan izin pembuatan akun Super Admin/Sourcing. [Driver lifecycle](../../scripts/run-vendor-production-uat-temporary.mjs) membuat email/penanda unik per run dan password acak hanya di memori, menyiapkan dua profil baru sesuai role, lalu menjalankan login normal. Service key dipakai hanya untuk lifecycle akun yang disetujui dan pembacaan baseline; tidak dipakai menyamar sebagai pengguna atau dikirim ke browser.

Harness [test-vendor-production-authenticated-readonly.mjs](../../scripts/test-vendor-production-authenticated-readonly.mjs) sudah dijalankan: **9 pemeriksaan PASS, 0 FAIL**, termasuk dua logout sesi sendiri. Ia memvalidasi role/status dari API produksi, memeriksa dashboard dari RPC nyata, daftar kandidat, follow-up kosong, modal tanpa submit, dan Master Vendor untuk Super Admin. Tidak ada pageerror, REST error atau percobaan tulis bisnis. Password/token tidak ditulis ke file/hasil.

Bukti: [AUTHENTICATED_RESULTS.json](production-verification-20261109/AUTHENTICATED_RESULTS.json), [lifecycle akun](production-verification-20261109/TEMPORARY_ACCOUNT_LIFECYCLE.json), [dashboard Super Admin](production-verification-20261109/super_admin-dashboard.png), [dashboard Sourcing](production-verification-20261109/sourcing-dashboard.png).

| Skenario UAT produksi | Hasil |
|---|---|
| Login normal + role/profil ACTIVE Super Admin dan Sourcing | Lulus |
| Dashboard dan produktivitas PIC melalui RPC produksi | Lulus untuk kedua role |
| Database Calon Vendor, Follow-Up dan modal tanpa submit | Lulus untuk kedua role |
| Master Data → Vendor | Dapat dibaca oleh Super Admin |
| Error browser/API dan upaya tulis bisnis | Nol |
| Logout sesi uji | Kedua sesi berhasil dicabut |
| Cleanup | Kedua akun Auth dan profil dipastikan tidak ada lagi |
| Baseline setelah cleanup | Checksum **11 tabel** kembali identik, termasuk auth.users dan user_profiles |

Enam pemeriksaan lifecycle juga PASS: pembuatan dua akun, keberhasilan UAT/logout, penghapusan dua akun/profil, dan kesamaan baseline. Peristiwa pembuatan/login/logout/penghapusan dapat tetap tercatat pada audit Auth; tidak mengklaim bahwa seluruh platform tidak menerima penulisan sama sekali. Penulisan terbatas ke lifecycle akun sementara yang disetujui, bukan data bisnis atau akun existing.

Mode harness: data bisnis read-only. Login/logout tetap mencatat metadata sesi pada Supabase Auth. Semua request tulis bisnis diblokir. RPC dashboard yang membaca data diizinkan. Panggilan reminder otomatis dicegat dan diberi respons kosong oleh harness untuk menghindari notifikasi; **respons tersebut bukan bukti reminder produksi berhasil**. Uji CRUD dan pengiriman reminder nyata masih harus mendapat scope data uji atau dilakukan pada data bisnis yang sah dengan persetujuan yang sesuai.

Tidak ada akun Sourcing permanen yang ditinggalkan. Untuk penggunaan operasional, user tetap perlu menentukan petugas Sourcing dan penetapan akses yang sah melalui pengelolaan pengguna. UAT dengan akun sementara tidak mengubah role siapa pun yang existing.

## Langkah sesudah UAT baca

- UAT baca login kedua role selesai; skenario tulis dan reminder nyata tetap belum dijalankan di produksi sesuai scope yang disetujui.
- Bila perlu uji CRUD/reminder penuh, tentukan data bisnis/uji yang boleh ditulis beserta perlakuan riwayat permanennya. Jangan menonaktifkan guard untuk membersihkan data uji produksi.
- Tidak perlu mengulang migration Fase 2 atau melakukan deploy ulang hanya untuk pemeriksaan ini.
- Fase 1+2 aktif dan UAT baca sesuai scope yang disetujui sudah lulus. Prioritas berikutnya tetap **Fase 3 — lokasi vendor, koordinat GPS, foto workshop/pabrik, Google Maps**. Implementasi Fase 3 belum dimulai oleh pekerjaan penerimaan ini.
