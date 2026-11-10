# Hapus dari daftar dan pulihkan calon vendor

Status: **implementasi lokal selesai; belum migration produksi, push atau deploy**.
User meminta fitur hapus dan penjelasan prosedur kelayakan. Penghapusan menggunakan
arsip yang dapat dipulihkan untuk mempertahankan riwayat permanen existing.

## Perilaku

- Dropdown **Tampilkan data** memisahkan Calon vendor, Vendor aktif terhubung, dan Arsip calon vendor.
  Daftar awal hanya berisi kandidat yang belum terhubung ke master dan belum diarsipkan.
- Sourcing, HRD dan Super Admin dapat memilih **Hapus dari daftar**, mengisi alasan
  5–1000 karakter dan mengonfirmasi. Batal tidak menulis data. Kegagalan mempertahankan draft.
- Kandidat berpindah ke Arsip; semua profil/kontak/lokasi/foto/riwayat dipertahankan.
  Tugas follow-up OPEN dibatalkan secara atomik melalui guard/audit status existing.
- Arsip tidak dihitung pada dashboard sourcing/total prospek atau peta dan tidak
  muncul pada opsi pembuatan follow-up. Log follow-up historis tetap dapat dibaca.
- Detail arsip hanya lihat. Guard database menolak edit profil, kontak, spesialisasi,
  follow-up, lokasi dan metadata foto pada kandidat yang diarsipkan.
- **Pulihkan kandidat** wajib alasan dan tercatat. Tugas lama tetap ditutup; tindak
  lanjut berikutnya dibuat sebagai catatan baru. Pemanggilan ulang tidak menggandakan audit.
- Vendor terhubung ke master, status operasional selain NOT_ACTIVE, serta seluruh
  keputusan akhir APPROVED/RESERVE/REJECTED/FROZEN tidak dapat diarsipkan/pulihkan.
  Profil vendor aktif pada screenshot tidak mendapat tombol hapus dari daftar.
- Direksi, Finance, Pelaksana, akun nonaktif dan anonim tidak mendapat hak arsip.
  Policy DELETE kandidat tetap tidak ditambahkan. Guard keputusan/aktivasi tetap utuh.

## Migration dan rollback

- [Migration](../../supabase/migrations/202611100001_vendor_candidate_archive.sql):
  tiga kolom nullable pada vendor_candidates (archived_at/by/reason), index, RPC
  arsip/pulihkan, trigger penjaga arsip/child. Monitoring dashboard, reminder,
  location monitoring dan view peta hanya ditambah filter arsip; checks role,
  SECURITY INVOKER, atribusi audit dan deduplikasi reminder dipertahankan.
- [Rollback terpisah](../../supabase/rollbacks/202611100001_vendor_candidate_archive_rollback.sql):
  mengembalikan definisi monitoring/view pra-arsip dan menghapus objek/kolom arsip.
  Riwayat dan catatan follow-up dipertahankan. Tugas yang sudah dibatalkan tidak
  dibuka ulang. Metadata kolom arsip hilang dan kandidat kembali terlihat setelah rollback.

Tidak ada penulisan/perubahan tabel master vendors, assets, user_profiles, roles,
role_permissions atau notifications oleh migration. Kolom baru awalnya NULL;
tidak ada backfill/archive otomatis terhadap data existing. Foreign key archived_by
hanya mereferensikan user_profiles. Tidak mengubah policy existing atau helper keamanan.
Semua perubahan database terbatas pada objek vendor_*.

RPC SECURITY DEFINER memakai search_path tetap, izin role aktif melalui is_app_role,
aktor dari my_profile_id, row lock dan pemeriksaan updated_at untuk konfirmasi stale.
Trigger arsip tetap INVOKER, sehingga client tidak dapat memalsukan archived_by/at
atau melewati fungsi resmi. SQL helper produksi lain dan guard keputusan tidak diganti.

## File frontend dan pengujian

| File | Perubahan |
|---|---|
| src/components/vendor/CandidateArchiveModal.jsx | Konfirmasi arsip/pulihkan dengan alasan, loading, error dan dialog native |
| src/pages/vendor/VendorDatabasePage.jsx | Filter daftar/profil terhubung/arsip, tombol hapus/pulihkan yang sesuai role/status |
| src/pages/vendor/VendorDetailPage.jsx | Profil arsip hanya lihat, label audit dan alasan arsip/pulihkan |
| src/lib/vendor-helpers.js | Metadata/filter arsip, predicate kelayakan arsip dan pemanggilan RPC |
| src/lib/vendor-followup-helpers.js | Kandidat arsip tidak menjadi opsi follow-up baru |
| src/lib/vendor-dashboard-helpers.js | Total prospek mengecualikan arsip |
| src/components/vendor/VendorFollowupsPanel.jsx | Mode hanya lihat pada detail arsip |
| src/components/vendor/VendorLocationsPanel.jsx | Mode hanya lihat termasuk kontrol foto pada detail arsip |
| scripts/test-vendor-candidate-archive.mjs | Integrasi migration/rollback/RLS/guard/API/browser di Docker loopback |

**19/19 kelompok skenario PASS**. [Hasil](candidate-archive-evidence/RESULTS.json),
[hash sumber dan build](candidate-archive-evidence/VERIFICATION_SUMMARY.json).

- Migration dua kali dan rollback dua kali berhasil.
- Role/anon/nonaktif ditolak; alasan invalid/ID hilang ditolak.
- Vendor aktif/terhubung dan seluruh keputusan akhir dilindungi.
- PATCH metadata arsip palsu dan persetujuan/aktivasi langsung ditolak.
- Arsip membatalkan tugas OPEN dengan audit aktor yang benar; isi follow-up tetap sama.
- Dashboard/peta mengecualikan arsip, reminder tidak menghasilkan notifikasi untuk tugas arsip.
  Uji reminder SQL di-ROLLBACK agar notifikasi baseline Docker tidak diubah.
- Edit arsip/child dan DELETE fisik ditolak; stale/serentak/idempoten diuji.
- Browser: pemisahan daftar, batal, alasan kosong, error/retry, hapus/pulihkan,
  detail/riwayat/lokasi hanya lihat, mobile dan perlindungan vendor aktif terhubung.
- Nol pageerror/request produksi. Tujuh akun sintetis dibersihkan; checksum 14 tabel
  termasuk Auth users/identities dan metadata policy/helper/guard kembali identik.
- `npm run build` exit 0, 1586 modul; warning bundle existing >500 kB tetap ada.

Kendala uji yang diselesaikan: fixture lokasi perlu created_by dan coordinate_source;
label alasan/pemilih scope diperbaiki menjadi label eksplisit agar stabil setelah error.
Migration/rollback final diuji menggunakan akun dan database Docker sintetis saja.
Nomor sequence kandidat/follow-up dapat memiliki gap setelah rollback fixture, seperti
perilaku PostgreSQL normal; bukan perubahan data bisnis produksi.

## Rilis yang menunggu persetujuan

1. Review read-only objek produksi: kolom kandidat, guard/RLS, definisi/ACL dashboard,
   reminder, location monitoring dan view peta. Cocokkan baseline migration Fase 1–3;
   rollback yang disertakan memulihkan definisi repository pra-arsip, sehingga perubahan
   produksi di luar baseline harus direkonsiliasi sebelum eksekusi.
2. Backup produksi terbaru dan verifikasi restore sebelum migration.
3. **Persetujuan eksplisit migration produksi**, lalu terapkan hanya migration baru
   dan verifikasi guard/RLS serta baseline master/aset/profil.
4. **Persetujuan deployment frontend terpisah**. Jangan deploy frontend ini mendahului
   migration: query baru memerlukan kolom arsip. Push Git juga menunggu izin tersendiri.
5. UAT pengguna pada kandidat nyata yang memang ingin diarsipkan; periksa tugas,
   riwayat, pemulihan dan profil vendor terhubung. Jangan membuat dummy produksi.

Rollback frontend lama dapat menampilkan kandidat arsip karena UI lama belum memfilter
arsip, walaupun guard database tetap menolak edit. Rencanakan rollback bersama status
backend/maintenance agar daftar tidak membingungkan pengguna.

Panduan penilaian kelayakan: [prosedur](PROSEDUR_PENILAIAN_KELAYAKAN_VENDOR.md).
Sampel/QC dan persetujuan/aktivasi tetap belum tersedia; fitur arsip tidak membuka
kewenangan baru untuk menyetujui atau mengaktifkan kandidat.
