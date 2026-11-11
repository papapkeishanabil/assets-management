# Fase 5 — Persetujuan dan Aktivasi Vendor

Status 11 November 2026: **selesai di lokal, belum migration produksi, push atau
deployment**. Fase 4 juga belum dipasang di produksi. Persetujuan rilis terdahulu
tidak digunakan kembali untuk kedua migration baru ini.

## Alur untuk staf dan manajemen

1. **Sourcing/Resources** melengkapi profil, kategori, kontak, lokasi/GPS/foto,
   kemudian menugaskan sampel dan mencatat hasil pemeriksa QC melalui Fase 4.
   **HRD/Super Admin** memverifikasi lokasi. Tidak ada akun/role QC baru.
2. Buka **Persetujuan Vendor**, pilih kandidat dan **Tinjau**, atau buka tab
   **Keputusan** pada detail kandidat. Sourcing/HRD dapat membaca checklist dan
   riwayat; tindakan keputusan/aktivasi hanya untuk **Direksi/Super Admin**.
3. Approver meninjau delapan syarat: nama/kategori aktif, kontak bernama dengan
   telepon/WA valid, identitas master tidak ambigu, alamat utama, koordinat,
   file foto exterior nyata, verifikasi lokasi dan seluruh sampel efektif dengan
   QC terakhir Lulus. Sampel tergantikan atau batal tidak dianggap sampel efektif.
   QC lama yang lulus tidak menutupi sampel lain yang masih berjalan/gagal.
4. **Catat Keputusan**: Disetujui/Cadangan/Ditolak/Dibekukan. Dasar keputusan
   wajib; tersedia batas ruang lingkup, evaluasi ulang, tindak lanjut, PIC dan
   bukti privat. Aktor, waktu, kode `K-####`, referensi QC dan snapshot bukti
   dicatat server. Tanggal efektif saat ini hanya hari ini (WIB); tidak mendukung
   backdate/penjadwalan keputusan.
5. Jika lokasi/QC belum memenuhi syarat, hanya approver yang dapat membuat
   pengecualian tertulis (minimal 10 karakter). Daftar kekurangan disimpan bersama
   alasan. **Nama/kategori/kontak/pemetaan master tidak dapat dikecualikan**.
6. **Disetujui belum Aktif.** Setelah keputusan tersimpan, approver memilih
   **Aktivasi Vendor**, memeriksa master baru/pemakaian ulang yang ditampilkan,
   lalu mengonfirmasi **Aktifkan Vendor**. Server memeriksa keputusan terakhir,
   masa evaluasi dan bukti saat ini. Perubahan profil, kontak, lokasi, foto atau
   QC sejak persetujuan memerlukan keputusan baru sebelum aktivasi.
   Fingerprint snapshot memakai SHA-256 bawaan PostgreSQL.
7. Aktivasi sukses menghubungkan kandidat ke satu master, mengisi audit aktivasi
   dan status operasional Aktif. Vendor terlihat di menu existing **Vendor Aktif**;
   profil kandidat berpindah ke kelompok profil terhubung pada Calon Vendor.

| Kejadian | Tahap proses | Kelayakan | Operasional |
| --- | --- | --- | --- |
| Kandidat didata/dievaluasi | Tahap input, verifikasi, sampel/QC | Prospek/Dalam Evaluasi/Menunggu Approval | Belum Aktif |
| Semua sampel efektif lulus | Menunggu Keputusan | Tetap, tidak otomatis Disetujui | Tetap Belum Aktif |
| Keputusan Disetujui | Selesai | Disetujui | Tetap Belum Aktif |
| Keputusan Cadangan | Selesai | Cadangan | Tetap |
| Keputusan Ditolak | Tidak Dilanjutkan | Ditolak | Tetap |
| Keputusan Dibekukan | Selesai | Dibekukan | Tetap |
| Aktivasi eksplisit kandidat baru | Selesai | Disetujui | Aktif |

Keputusan adalah catatan permanen. Koreksi memakai **keputusan baru**, bukan
mengubah/menghapus yang lama. Keputusan yang paling akhir menjadi acuan; APPROVED
lama tidak mengalahkan keputusan Cadangan/Ditolak/Dibekukan yang lebih baru.

## Identitas dan perlindungan master existing

- Nomor lokal `08...`, `+62...` dan `0062...` dinormalisasi untuk pencocokan.
  Nama dibandingkan tanpa kapitalisasi/spasi/tanda baca. Cocok tepat nama + salah
  satu nomor kontak, satu master aktif, tanpa profil kandidat lain → dapat dipakai
  ulang. Cocok hanya nama atau nomor, master nonaktif, banyak kecocokan atau master
  yang telah memiliki profil lain → hentikan proses untuk rekonsiliasi manual.
  Tidak melakukan merge identitas/riwayat otomatis atau pencarian fuzzy bebas.
- Master baru mendapat kode `VND-AM-######` dari sequence dengan pemeriksaan
  benturan. Profil/kontak/alamat utama disalin saat INSERT master baru. Jahit dan
  Bordir memakai tipe existing yang sesuai; kategori lain memakai tipe Lainnya
  dengan kategori pada `service_type`, tanpa menambah enum master.
- **Master existing tidak ditimpa**, termasuk alamat/kota meski data kandidat
  berbeda. Ini menjaga batas perubahan data existing; alamat utama selalu tersedia
  pada lokasi kandidat. Tidak UPDATE/DELETE tabel `vendors`, `assets`, profil atau
  role dari migration/RPC ini. Pembuatan master baru hanya terjadi saat tindakan
  aktivasi tervalidasi dijalankan, bukan saat migration/keputusan.
- Aktivasi diserialkan melalui lock transaksi master dan tabel bukti, lalu lock
  kandidat. Tidak ada panggilan jaringan di dalam transaksi. Dua kandidat identik
  yang diaktifkan bersamaan tidak membuat dua master; perubahan basis kandidat
  kedua ditolak. Kegagalan penulisan status/audit membatalkan seluruh transaksi.
- Catatan aktivasi, status kandidat dan log aktivitas memakai ID peristiwa serta
  waktu aktivasi yang sama. Pengulangan aktivasi kandidat yang sudah Aktif tidak
  membuat master/audit baru, tetap memeriksa keputusan terakhir dan master aktif.

## File dan objek baru

| File/kelompok | Isi |
| --- | --- |
| [Migration 202611110002](../../supabase/migrations/202611110002_vendor_management_phase5.sql) | Definisi lengkap tabel, helper, RPC, RLS dan Storage baru; additive/idempotent |
| [Rollback manual](../../supabase/rollbacks/202611110002_vendor_management_phase5_rollback.sql) | Di luar migrations; menolak rollback bila sudah ada aktivasi atau bukti belum diekspor/dikosongkan |
| `src/lib/vendor-approvals.js` | Query kandidat/checklist/riwayat, RPC keputusan/aktivasi, bukti privat |
| `src/pages/vendor/VendorApprovalsPage.jsx` | Daftar/filter/pagination dan pemeriksaan kandidat |
| `src/components/vendor/VendorDecisionPanel.jsx` | Checklist, ringkasan bukti, keputusan dan ledger aktivasi |
| `VendorDecisionModal.jsx`, `VendorActivationModal.jsx`, `DecisionEvidence.jsx` dalam folder komponen vendor | Keputusan, konfirmasi aktivasi dan signed link bukti |
| `src/App.jsx`, `src/components/layout/MainLayout.jsx`, `src/pages/vendor/VendorDetailPage.jsx` | Route/menu `vendor_approval` dan tab Keputusan; tab Lokasi/Riwayat dipertahankan |
| `scripts/test-vendor-phase5.mjs` | Fixture database/API/browser lokal dan cleanup |
| `scripts/test-vendor-phase4.mjs` | Hanya menambahkan opsi folder bukti melalui env agar regresi tidak menimpa bukti Fase 4 terdahulu |
| Handoff/prosedur dan `phase5-evidence/` | Status terbaru, bukti hasil, screenshot dan manifest review |

Objek: `vendor_decisions` append-only, **`vendor_activations`** append-only untuk
ledger aktivasi yang terpisah dari log umum; dua sequence; helper internal dan
RPC `vendor_approval_checklist(uuid)`,
`vendor_record_decision(uuid,jsonb,timestamptz,text,uuid)`,
`activate_vendor_candidate(uuid,uuid DEFAULT NULL)`. Argumen kedua aktivasi adalah
ID keputusan yang telah ditinjau; frontend selalu mengirimkannya. Pemanggilan
dengan kandidat saja tetap memvalidasi keputusan terakhir.

Bucket baru **`vendor-decision-files` PRIVATE**, PDF/JPEG/PNG/WebP, maksimal 5 MB,
path kandidat/UUID. Baca empat role vendor; upload hanya approver aktif; overwrite
dan delete dari aplikasi ditolak, termasuk Super Admin. Signed URL berlaku 10 menit.
Foto direencode untuk membuang EXIF, PDF diperiksa signature pada frontend.
Storage memeriksa MIME/ukuran/path/RLS; belum ada pemindaian malware/byte-signature
server. Upload batal dapat meninggalkan file privat tidak terhubung; cleanup harus
memeriksa seluruh referensi keputusan/audit dan dilakukan administratif.

Tidak menambah role atau memperluas policy UPDATE kandidat untuk Direksi.
Keputusan dan aktivasi melalui RPC SECURITY DEFINER yang memvalidasi role aktif;
raw UPDATE/INSERT/DELETE tetap ditolak. Helper internal tidak terbuka ke aplikasi;
helper Storage PUBLIC hanya memberikan boolean yang membatasi autentikasi/role.
Toggle `role_permissions` tetap guard frontend sebagaimana fase existing, bukan
pencabutan hak SQL granular per modul. Policy/helper/guard existing tidak diganti.
Migration menolak tabrakan tabel/sequence tak dikenal, policy dorman tak dikenal, atau bucket
dengan konfigurasi berbeda; Fase 4 wajib sudah terpasang.

## Hasil pengujian dan batas bukti

Hasil final per skenario: [RESULTS.json](phase5-evidence/RESULTS.json).
**52/52 database/API + 16/16 browser = 68/68**, di stack Docker lokal
`supabase_db_harmas-vendor-test` / `http://127.0.0.1:54321`. Tujuh akun disposable
dibersihkan; 17 checksum tabel existing serta definisi fungsi/ACL/policy kembali
identik setelah cleanup. Fixture aset yang menunjuk master existing tetap tertaut
selama aktivasi. Tidak ada request atau perubahan produksi.

Cakupan: migration/rollback dua kali, prasyarat Fase 4, tabrakan policy, enam role
dan akun tidak aktif/anon, raw-write/forged actor, checklist nyata dengan file
Storage, batas pengecualian, stale basis termasuk koreksi QC yang tidak mengubah
timestamp kandidat, idempotensi permintaan, koreksi keputusan append-only,
penolakan tanggal efektif/evaluasi ulang, konflik duplikasi, konkurensi satu/dua
kandidat, kegagalan transaksi setelah INSERT master, bukti privat, arsip, menu/route,
retry draft/upload, konfirmasi aktivasi, Super Admin override, Sourcing/HRD baca,
regresi tab lokasi/riwayat serta kemunculan vendor baru pada halaman Vendor Aktif.
Penomoran keputusan/master diuji melalui RPC pada angka melewati lebar tampilan
minimum; kode tidak dipotong. Satu hasil QC lama yang lulus tidak dapat menutupi
sampel efektif lain yang belum selesai.

Test kegagalan transaksi memasang trigger sementara hanya pada Docker dan ID
fixture sendiri, kemudian melepasnya. Rollback nyata terlebih dahulu diuji menolak
ledger berisi; cleanup harness men-TRUNCATE ledger fixture **yang baru dibuat dan
dipastikan seluruhnya milik tes**, lalu menguji rollback. Ini bukan prosedur
rollback produksi atau izin melewati guard dalam pemakaian aplikasi.

Permissions dimock pada respons baca browser agar konfigurasi role existing tidak
diubah; data bisnis/RPC/RLS/Storage memakai backend lokal sebenarnya. Vite
`envFile:false`, key demo dibaca in-memory dari Kong Docker, password fixture
dibuat acak. Browser memblokir koneksi luar. Tes tidak membaca `.env` produksi.

Regresi Fase 4: [hasil](phase5-evidence/regression-phase4/RESULTS.json),
**56/56 DB/API + 17/17 browser = 73/73** pada frontend terintegrasi.
`npm.cmd run build` lulus, termasuk PWA; panel persetujuan lazy-load. Peringatan
bundle utama >500 kB masih ada. Tidak ada dependensi baru.

Screenshot: [desktop gelap](phase5-evidence/approval-desktop.png),
[mobile terang](phase5-evidence/approval-mobile-light.png).
[Computed style](phase5-evidence/LIGHT_STYLES.json) memastikan label checklist
terbaca setelah transisi tema selesai; [manifest build/review](phase5-evidence/BUILD_AND_REVIEW.json)
memuat hash SQL yang diuji.

Menjalankan ulang di stack Docker sintetis yang tidak sedang berisi instalasi
Fase 4/5 lain: set `PLAYWRIGHT_PACKAGE_PATH` ke modul Playwright yang tersedia,
lalu `node scripts/test-vendor-phase5.mjs`. Untuk regresi, set
`HARMAS_VENDOR_EVIDENCE_DIR=docs/vendor-management/phase5-evidence/regression-phase4`
dan jalankan `node scripts/test-vendor-phase4.mjs` secara berurutan. Jangan arahkan
harness fixture ke produksi.

## Batasan operasional dan rencana rilis gabungan Fase 4 + 5

- Keputusan Dibekukan/Ditolak/Cadangan pada profil vendor yang sudah terhubung
  **tidak mematikan master atau memutus relasi aset**. Tindakan operasional existing
  perlu ditangani terpisah oleh pihak berwenang. Reaktivasi master suspended/inactive
  bukan fitur aktivasi kandidat baru ini.
- Tanggal evaluasi ulang membatasi aktivasi baru bila sudah lewat; tidak otomatis
  menonaktifkan vendor aktif. Tidak ada scheduler keputusan, reminder evaluasi atau
  aktivasi otomatis. Tindak lanjut keputusan dicatat sebagai teks/PIC, tidak
  membuat log follow-up seolah komunikasi sudah dilakukan.
- Batas lulus dan bobot QC tetap mengikuti SOP manajemen Fase 4; tidak diciptakan
  ambang perusahaan baru oleh Fase 5.
- Jika aktivasi sudah dipakai, rollback SQL ditolak agar tidak merusak mapping
  master/aset. Perlu backup dan rencana pemulihan terpisah. Jangan menghapus vendor
  hasil aktivasi otomatis sebagai rollback. Rollback tanpa aktivasi tetap menghapus
  tabel keputusan baru: ekspor dahulu; status/audit kandidat existing dipertahankan.
  Bucket kosong dibersihkan melalui Storage API/Dashboard, bukan SQL DELETE.
- Preflight dan restore clone terbaru dari produksi **belum dilakukan** pada
  pekerjaan lokal ini. Bukti yang ada berasal dari skema sintetis Docker, bukan
  pengganti pemeriksaan owner/ACL/policy/constraint/trigger produksi sebelum rilis.

Urutan rilis yang menunggu persetujuan terpisah:

1. Review akhir dua SQL, SOP QC/pengecualian, serta target master.
2. Preflight read-only produksi: Fase 1–3/arsip, seluruh policy/guard, struktur
   vendors, grant executor/Storage, kemungkinan benturan kode/identitas.
3. Backup PostgreSQL terbaru + file Storage privat; verifikasi checksum, restore
   aplikasi/ACL di clone terisolasi, uji kedua migration pada clone. Dokumentasikan
   batas restore seluruh platform Supabase seperti rilis terdahulu.
4. **Persetujuan eksplisit migration Fase 4 `202611110001` dan Fase 5 `202611110002`**.
   Jalankan berurutan, verifikasi schema/RLS/ACL dan checksum data existing setelah
   masing-masing migration. Migration sendiri tidak mengaktifkan vendor/data dummy.
5. **Persetujuan terpisah push Git dan deployment frontend gabungan**. Verifikasi
   artifact/PWA serta guard anonim. Jangan memakai ulang token persetujuan arsip.
6. UAT dengan akun Super Admin, Direksi, Sourcing/HRD yang berwenang: sampel/QC
   revisi, checklist, keputusan, pengecualian, aktivasi eksplisit, duplikasi,
   riwayat/bukti privat. Uji tulis hanya pada data dan scope yang disetujui.
7. Pastikan Vendor Aktif, aset/kontrak existing, GPS/peta, lokasi/riwayat dan
   follow-up tetap berfungsi. Jangan meninggalkan akun/fixture privileged baru.
