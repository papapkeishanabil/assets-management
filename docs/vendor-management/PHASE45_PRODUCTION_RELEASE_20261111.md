# Rilis produksi Fase 4 + 5 — 11 November 2026

**Fase 4 Sampling & QC dan Fase 5 Persetujuan & Aktivasi sudah LIVE.**
Migration gabungan COMMIT dan verifikasi selesai pukul **11.42 WIB**;
domain utama terverifikasi memakai frontend baru pukul **11.45 WIB**.
UAT menggunakan akun operasional belum dilakukan pada produksi.

## Persetujuan dan rilis

- Izin frontend: “ok sekarang fase 4 dan 5 di deploy”.
- Izin migration terpisah: “Setuju migration Fase 4 dan 5 ke produksi”.
- Target Supabase: `uwlxkwyauxwewoexfgwi`. Kedua SQL dijalankan berurutan
  dalam **satu transaksi**, dengan pemeriksaan sebelum COMMIT, kemudian
  pembacaan ulang produksi. Izin sekali pakai telah dikonsumsi;
  **jangan menjalankan kembali driver migration**.
- Source fitur Fase 4 `4788f2ca`, Fase 5 `888cd72a`; hardening SQL dan
  persiapan rilis final berada pada commit lokal `2adafaf7`.
- Deployment production yang sudah diuji dipromosikan tanpa rebuild:
  `dpl_8Dv1gZW6jhdE1wg8D4CvziiezjhQ`.
  Domain [aplikasi HARMAS](https://harmas-asset-management.vercel.app)
  telah diverifikasi menunjuk ID ini pada proyek/tim yang benar.
- Tidak ada push Git. Konfigurasi environment cloud tidak diubah.
  Artifact prebuilt memakai konfigurasi publik Supabase lokal yang sudah divalidasi;
  perbaikan environment cloud diperlukan sebelum mengandalkan build remote berikutnya.

## Migration, backup dan integritas

| SQL yang dieksekusi | SHA-256 |
| --- | --- |
| `202611110001_vendor_management_phase4.sql` | `023d8328a677af1a91249759c29461b9dcb3eb9cf66a5f711e7875bebb6996f3` |
| `202611110002_vendor_management_phase5.sql` | `0cee202a7e2a2d02d0690a8610ce71ef01cbfb9565ba23b0bab62af24e5fd1f9` |

Backup privat: `D:\Backups\harmas-pre-phase45-20261111-040820-8f160784`.
Dump SHA-256 `2f2ad10d1cc4687acd578757d6fe1abe59a2ba086e613a78d2d8a8b046095373`.
Restore logis **141 tabel / 1.839 baris** dan **95 blob / 29.027.178 byte**
terverifikasi; replay migration/rollback dua kali dan aktivasi dalam transaksi
ROLLBACK lulus pada clone tanpa jaringan. Ini bukan klaim pemulihan penuh
seluruh platform Auth/Storage/Gateway Supabase.

Live preflight dan pemeriksaan sesudah COMMIT membuktikan checksum **20 tabel
baseline** serta fungsi/ACL/RLS/policy/trigger existing tetap sama. Tidak ada
perubahan data master vendor, aset, akun, role atau relasi existing. Migration
hanya menambahkan objek Fase 4/5, dua bucket privat dan enam parameter rubrik.
Tabel bisnis baru tetap kosong. Tidak ada kandidat yang diuji/diaktifkan,
akun privileged baru atau fixture produksi.

Semua postcheck lulus: view security invoker, seed rubrik, trigger aktif,
hak DELETE sampel dicabut, tulisan langsung QC/keputusan dicabut, sequence
internal dibatasi dan privilege administratif tabel baru dicabut. Tidak
mengembalikan policy lama yang bermasalah atau melemahkan guard existing.

[Bukti migration produksi](phase45-release-evidence/PRODUCTION_MIGRATION_CHECKS.json),
[backup](phase45-release-evidence/BACKUP_READINESS.json),
[review SQL final](phase45-release-evidence/SQL_REVIEW.json).

## Validasi frontend

| Pemeriksaan | Hasil |
| --- | --- |
| Regresi Fase 4 pada Docker/API/browser lokal | **75/75** |
| Regresi Fase 5 pada Docker/API/browser lokal | **69/69** |
| Gerbang rilis/transaksi/ACL/RLS lokal | **12/12** |
| Build prebuilt/PWA dan scan artifact | Lulus, 86 file |
| Hash file yang dilayani domain utama | **14/14 cocok** |
| Rute existing + vendor + tiga menu baru, SPA fallback/login anonim | **11/11 lulus** |
| PWA aktivasi, cache entry terbaru, reload login | Lulus; respons Supabase tidak tercache |
| Error browser, aset gagal, permintaan tulis dalam probe anonim | **0 / 0 / 0** |

Probe Vercel error/fatal pada jendela 15 menit hingga 11.45 WIB tidak menemukan
log yang cocok. Ini terbatas pada log function/daemon, bukan bukti bahwa seluruh
alur aplikasi/Supabase bebas error. Uji produksi ini anonim dan tidak melakukan
CRUD bisnis; otorisasi/RLS/aktivasi menyeluruh diuji pada Docker dan clone.

[Hash, rute dan PWA](phase45-release-evidence/PRODUCTION_FRONTEND_CHECKS.json),
[domain dan log](phase45-release-evidence/PRODUCTION_DEPLOYMENT_CHECKS.json),
[tangkapan login](phase45-release-evidence/production-login.png).

## UAT setelah rilis

Gunakan akun operasional berwenang dan data uji yang disepakati sebelum tindakan
tulis. Checklist berikut belum dijalankan pada produksi:

1. **Sourcing/Resources:** menu Pengujian Sampel/Hasil QC muncul sesuai izin;
   buka kandidat, buat brief, catat penerimaan, input QC atas nama pemeriksa,
   simpan bukti privat, buat revisi dan periksa audit. Tidak ada role QC baru.
2. **Direksi/Super Admin:** tinjau checklist dan bukti, catat keputusan
   beralasan. Pastikan Sourcing/HRD hanya membaca keputusan. Perubahan dasar
   penilaian setelah persetujuan harus memerlukan keputusan baru.
3. **Aktivasi eksplisit:** gunakan hanya kandidat yang memang disetujui untuk
   aktivasi. Periksa duplicate match, relasi master, retry idempoten dan riwayat;
   jangan mengaktifkan vendor riil hanya untuk mencoba fitur.
4. **Regresi:** Vendor Aktif, profil/lokasi/koordinat, Peta/rute, calon vendor,
   Follow-Up, aset dan kontrak existing tetap dapat dibuka sesuai peran.
5. **Perangkat:** desktop/mobile, tema terang/gelap, refresh/PWA, unggah/akses
   bukti privat sesuai peran, serta penolakan akses role di luar kewenangan.

Menu utama baru:
[Pengujian Sampel](https://harmas-asset-management.vercel.app/vendor/samples),
[Hasil QC](https://harmas-asset-management.vercel.app/vendor/qc),
[Persetujuan Vendor](https://harmas-asset-management.vercel.app/vendor/approvals).
Visibilitas tetap mengikuti izin modul dan peran yang sudah ditetapkan.

## Risiko dan pemulihan

- **Lulus QC → keputusan → aktivasi** tetap tiga langkah terpisah. Batas lulus
  wajib diisi sesuai SOP; sistem tidak menetapkan ambang perusahaan sepihak.
- Pengecualian lokasi/QC hanya approver dengan alasan; persyaratan identitas/
  kontak/master tidak dapat dilewati. Master exact match dipakai ulang tanpa
  menimpa data existing; match ambigu/inaktif ditolak.
- Keputusan Dibekukan/Cadangan/Ditolak tidak otomatis mematikan master aktif
  atau memutus aset. Evaluasi ulang dan keputusan belum memiliki scheduler.
- Deployment frontend sebelumnya `dpl_8HZD3SCrS2ZuwGWRonkkYPRPUKEu` tersedia
  sebagai target pemulihan terpisah; tidak dieksekusi dalam rilis ini.
- Rollback SQL terpisah di `supabase/rollbacks/`, urutan Fase 5 lalu Fase 4,
  **hanya dengan persetujuan dan review data terbaru**. Fase 5 menolak rollback
  jika ledger aktivasi sudah berisi. Ekspor bukti/audit sebelum pemulihan;
  jangan menghapus master/relasi aset hasil aktivasi atau metadata Storage via SQL.
- Backup/approval/log privat tidak masuk Git. Tidak ada kredensial baru
  di-hardcode; password terminal telah dibersihkan setelah helper selesai.

Readiness sebelum eksekusi dan temuan teknis tetap tersedia sebagai riwayat:
[persiapan rilis](PHASE45_RELEASE_READINESS_20261111.md).
