# Fase 4 — Pengujian Sampel dan Hasil QC

Status 11 November 2026: **implementasi lokal selesai, belum migration/push/deploy produksi**.
Fase 5 persetujuan/aktivasi belum diimplementasikan. Persetujuan rilis terdahulu
tidak digunakan sebagai persetujuan migration Fase 4 ini.

## Alur penggunaan

1. Sourcing membuka Calon Vendor, melengkapi profil, kontak, lokasi dan foto.
   Pemeriksaan kelengkapan profil/lokasi tetap dikerjakan pada fitur existing.
2. Buka **Pengujian Sampel → Tambah Sampel**, atau tab **Sampel & QC** pada detail
   calon vendor. Isi jenis sampel, brief, jumlah, bahan dan kode produk bila ada.
   Unggah techpack PDF pada detail sampel bila diperlukan.
3. **Perbarui Status**: Brief Dibuat → Ditugaskan (tanggal penugasan, target dan
   PIC wajib) → Dikerjakan → Sampel Diterima (tanggal penerimaan) → Sedang QC.
4. Petugas pemeriksa memeriksa sampel secara nyata. **Tidak perlu akun/role QC**.
   Sourcing/HRD/Super Admin mencatat nama pemeriksa, atau memilih data karyawan,
   waktu pemeriksaan, skor 1–5 tiap parameter, batas lulus dan bukti pemeriksaan.
   Nama pemeriksa dan pengguna penginput disimpan sebagai dua identitas berbeda.
5. Hasil pemeriksaan:
   - **Revisi**: temuan, instruksi perbaikan dan tenggat wajib. Sampel menjadi
     Perlu Revisi → Dikerjakan (catatan revisi wajib) → Sampel Diterima → Sedang QC.
     Pencatatan selanjutnya membuat **putaran baru**, dengan catatan pemeriksaan
     ulang; hasil sebelumnya tetap ada.
   - **Tidak Lulus**: temuan wajib, sampel selesai dengan hasil Tidak Lulus.
     Buat sampel terkait baru bila ingin mencoba spesifikasi/percobaan berikutnya.
   - **Lulus**: nilai berbobot harus mencapai batas lulus. Sampel selesai; kandidat
     masuk Menunggu Keputusan hanya bila seluruh sampel efektif telah selesai dan
     QC terakhirnya Lulus. Sampel induk yang memiliki pengganti nonbatal tidak
     dihitung dua kali dalam syarat ini.
6. Salah ketik pada hasil yang sudah disimpan menggunakan **Koreksi putaran**,
   bukan membuat putaran uji fiktif. Alasan wajib, nilai sebelum/sesudah dan
   pengoreksi/waktu dicatat otomatis. Koreksi menggunakan rubrik asli, bukan
   bobot baru. Keputusan putaran terakhir tidak dapat diganti saat revisi berjalan.
7. **Lulus QC bukan Disetujui dan bukan Vendor Aktif**. Keputusan manajemen dan
   aktivasi vendor melalui Fase 5 yang belum tersedia. Tidak ada tombol baru yang
   dapat melewati guard keputusan/aktivasi existing.

Tahap proses kandidat, kelayakan dan status operasional tetap tiga dimensi
berbeda. Brief baru/batal/hasil gagal yang membuat syarat menunggu keputusan
tidak terpenuhi mengembalikan tahap sampel terkait ke Kontak Awal untuk ditindak
lanjuti; tidak mengubah kelayakan atau status operasional. Perubahan sampel satu
kandidat diserialkan untuk menjaga agregasi ketika ada penginputan bersamaan.
Sampel dapat dicatat pada profil kandidat yang sudah terhubung ke vendor aktif,
tanpa menulis tabel master `vendors` atau mengganti status finalnya.

## Rubrik dan hak akses

Enam parameter awal: Kesesuaian Spek, Ukuran/Gramasi, Hasil Pengerjaan,
Bahan/Warna, Finishing, Fungsi/Ketahanan. Parameter umum dan parameter kategori
aktif digabung. Nilai = jumlah(skor × bobot) / jumlah(bobot), dibulatkan 2 desimal
oleh server. Snapshot rubrik dan brief melekat pada setiap putaran.

Tidak dibuat ambang lulus perusahaan secara sepihak: **batas lulus wajib diisi
per pemeriksaan, tanpa default**. Sebelum pemakaian produksi, manajemen perlu
menetapkan SOP batas lulus dan bobot yang digunakan. Nilai/ambang dalam bukti
tes adalah fixture sintetis, bukan keputusan kebijakan perusahaan.

| Aksi | Sourcing | HRD | Super Admin | Direksi |
| --- | --- | --- | --- | --- |
| Baca sampel/QC/riwayat sesuai modul | Ya | Ya | Ya | Ya |
| Buat/edit/status sampel | Ya | Ya | Ya | Tidak |
| Catat/koreksi hasil QC | Ya | Ya | Ya | Tidak |
| Kelola/nonaktifkan rubrik | Tidak | Ya | Ya | Tidak |
| Hapus sampel, QC, riwayat, bukti | Tidak | Tidak | Tidak | Tidak |
| Setujui/aktifkan kandidat lewat UPDATE | Tidak | Tidak | Tidak | Tidak |

Frontend mengikuti sidebar, route, guard halaman serta `vendor_samples` dan
`vendor_qc`. Modul QC saja tidak memberi tombol tambah/edit brief; modul sampel
saja tidak menampilkan hasil/skor/rincian koreksi QC. RLS mengikuti role aktif
seperti fase existing; toggle `role_permissions` adalah pembatas frontend,
bukan pencabutan hak SQL per modul. Finance/Pelaksana/akun tidak aktif/anon
tidak mendapat akses data baru. Kandidat arsip beserta buktinya hanya dibaca.

## Perubahan database dan rollback

Migration: [202611110001_vendor_management_phase4.sql](../../supabase/migrations/202611110001_vendor_management_phase4.sql).
Rollback manual: [202611110001_vendor_management_phase4_rollback.sql](../../supabase/rollbacks/202611110001_vendor_management_phase4_rollback.sql).

- Lima tabel baru: `vendor_samples`, `vendor_qc_parameters`,
  `vendor_sample_qc_runs`, `vendor_qc_run_revisions`,
  **`vendor_sample_change_history`**. Tabel kelima menampung snapshot perubahan
  brief/status di balik RLS yang sama. Log aktivitas existing hanya menerima
  kode/status/nomor putaran agar isi brief, biaya, skor dan path bukti tidak
  terekspos lewat akses log yang lebih luas.
- Dua sequence, view `vendor_sample_monitor`, RPC `vendor_record_sample_qc`
  dan `vendor_sampling_dashboard`, helper/trigger, serta bucket privat baru.
- Migration additive/idempotent; memerlukan Fase 1–3 dan migration arsip kandidat
  yang sudah dirilis. Tidak ALTER/DML ke tabel master, profil, role atau policy
  existing. Seed hanya pada tabel rubrik baru; tidak ada perubahan status kandidat
  saat migration. Sinkronisasi tahap/audit terjadi saat pengguna memakai fitur.
- Penanda kepemilikan tabel dan pemeriksaan policy menghentikan migration jika
  objek/policy baru bertabrakan. Bucket existing dengan konfigurasi berbeda juga
  ditolak. Helper role `is_app_role` dipakai; tidak ada policy membaca tabelnya
  sendiri. Guard keputusan/aktivasi/profil existing tidak diganti.
- Rollback di luar folder migration otomatis. **Rollback menghapus data Fase 4**:
  ekspor/backup dahulu. Rollback ditolak bila bucket masih berisi file. Setelah
  ekspor dan penanganan file secara sah melalui Storage API/Dashboard, jalankan
  rollback manual; hapus bucket privat yang sudah kosong melalui API/Dashboard.
  Tidak memakai SQL DELETE ke metadata Storage atau melewati `protect_delete`.
  Audit kandidat existing/tahap yang berubah karena aktivitas pengguna tidak
  dihapus/ditulis ulang oleh rollback.

## Bukti dan pengujian lokal

File frontend baru: `src/lib/vendor-sampling.js`,
`src/pages/vendor/VendorSamplesPage.jsx`, serta komponen di `src/components/vendor/`:
`VendorSamplesPanel`, `VendorSamplingSummary`, `SampleFormModal`,
`SampleStatusModal`, `SampleQCModal`, `SampleDetailModal`, `SampleEvidence`,
`QCParametersModal` (semua `.jsx`). File existing berubah: `src/App.jsx`,
`src/components/layout/MainLayout.jsx`, `src/pages/vendor/VendorDetailPage.jsx`,
`src/components/vendor/VendorSourcingPanel.jsx`. Dokumen handoff/prosedur diperbarui;
migration/rollback, skrip tes dan bukti pengujian disertakan. Tidak ada file env,
kredensial, dependensi atau source di luar modul yang ditambahkan.

[Hasil per skenario](phase4-evidence/RESULTS.json): **56/56 database/API,
17/17 browser (73/73)**. Stack Docker `supabase_db_harmas-vendor-test`, API
`http://127.0.0.1:54321`. Tes tidak membaca `.env`; Vite `envFile:false`, target
Supabase loopback didefinisikan eksplisit. Browser memblokir host luar, dan tidak
mengirim request ke Supabase produksi. Toggle modul dimock pada respons baca
permissions agar tidak menulis konfigurasi role existing; seluruh CRUD sampel,
QC, riwayat, Storage dan otorisasi role diuji ke API/database Docker sebenarnya.

Skrip: [test-vendor-phase4.mjs](../../scripts/test-vendor-phase4.mjs). Gunakan
`PLAYWRIGHT_PACKAGE_PATH` untuk Playwright yang tersedia, lalu
`node scripts/test-vendor-phase4.mjs`. Script menolak instalasi Fase 4 lokal yang
sudah ada agar tidak menghapus hasil kerja lain. Ia menyiapkan fixture employees
minimal hanya bila tabel ini belum ada di skema Docker sintetis, lalu
mengembalikan kondisi awal. Ini bukan bagian migration aplikasi.

Cakupan: migration dua kali, tabrakan policy dorman, RLS enam role/akun tidak
aktif/anon, pemalsuan actor/code/time/parent, status/date/angka tidak valid,
konkurensi koreksi dan putaran baru, agregasi sampel paralel, rubric snapshot,
arsip, privat/signed URL, larangan overwrite/delete, MIME/5 MB, rollback nonempty,
dashboard sampel/vendor/putaran terpisah, retry gagal simpan, signature PDF,
guard modul dan integrasi tab detail. Tujuh akun Auth disposable dibersihkan.
Rollback dua kali dan cleanup mengembalikan **17 checksum tabel existing**, definisi
fungsi public existing dan seluruh policy RLS ke baseline; tabel employees bila
sudah ada juga diperiksa. Gap sequence kode akibat fixture tidak direset.

Screenshot: [desktop gelap](phase4-evidence/sample-qc-desktop.png),
[mobile terang](phase4-evidence/sample-qc-mobile-light.png).
[Computed style tema terang](phase4-evidence/LIGHT_STYLES.json) diverifikasi
setelah transisi warna selesai.

`npm.cmd run build` lulus (termasuk PWA/service worker). `npm run build` langsung
di PowerShell diblokir ExecutionPolicy pada npm.ps1; memakai npm.cmd tanpa
mengubah kebijakan Windows. Peringatan bundle utama >500 kB masih ada; panel
sampel/rincian dirutekan melalui lazy chunk. Tidak ada dependensi baru.

## Batasan dan rencana rilis

- File bukti privat maksimum 5 MB; PDF/JPEG/PNG/WebP. Gambar di-reencode untuk
  membuang EXIF pada frontend; PDF diperiksa signature. Storage memeriksa ukuran,
  MIME dan path/RLS, **belum melakukan pemindaian malware/signature byte pada
  server**. File lama dipertahankan untuk audit. Upload yang dibatalkan dapat
  meninggalkan file privat tidak terhubung; pembersihan administratif perlu
  memeriksa seluruh referensi dan riwayat, bukan menghapus otomatis.
- Signed URL berlaku 10 menit dan dapat dimuat ulang. Penerima tautan dapat
  menggunakannya sampai kedaluwarsa; jangan bagikan bukti di luar pihak berwenang.
- Tidak ditambahkan scheduler/notifikasi QC otomatis. Target/deadline terlihat
  pada monitoring; reminder follow-up Fase 2 tetap mekanisme existing saat
  monitoring digunakan.
- Preflight produksi Fase 4, backup terbaru dan uji restore belum dijalankan
  pada pekerjaan ini. Semua akses pengujian ke lingkungan lokal terisolasi.
- Persetujuan/aktivasi tetap Fase 5; jangan mengubah status menjadi APPROVED/ACTIVE
  secara manual untuk meniru fitur tersebut.

Urutan yang menunggu persetujuan terpisah: review final SQL dan SOP rubrik →
preflight **read-only** objek/RLS produksi → backup database + Storage terbaru →
verifikasi restore/checksum/ACL dan objek privat → **persetujuan migration ini** →
eksekusi dan verifikasi schema/RLS produksi → **persetujuan push/deploy frontend**
→ UAT Super Admin/Sourcing/Direksi. Dilarang memakai helper persetujuan migration
arsip terdahulu yang sudah dikonsumsi.

Checklist setelah rilis: menu Pengujian Sampel/Hasil QC sesuai toggle; tambah
brief dan bukti privat; assignment/PIC/target; penerimaan/QC; Revisi dan putaran
kedua; koreksi beralasan; data/berkas role terlarang ditolak; kandidat arsip
read-only; angka dashboard terpisah; Master Vendor, koordinat/peta, follow-up dan
modul aset tetap bekerja; tidak ada perubahan kelayakan/aktivasi otomatis.
