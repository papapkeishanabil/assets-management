# Arsip kandidat aktif di produksi — 10 November 2026

**Backend COMMIT dan verifikasi selesai sekitar 16.50 WIB; frontend aktif sekitar
16.51 WIB.** Pengguna menyetujui frontend dengan “ok deploy”, kemudian migration
dengan “ya setuju”. Tidak melakukan push Git.

Frontend source **a32d3c49**, deployment **dpl_8HZD3SCrS2ZuwGWRonkkYPRPUKEu**:
https://harmas-asset-management.vercel.app/vendor/database . URL unik:
https://harmas-asset-management-ic54qndin.vercel.app .

## Perubahan yang tersedia

Calon Vendor mempunyai pilihan Calon vendor / Vendor aktif terhubung / Arsip calon
vendor. Kandidat yang memenuhi syarat dapat dihapus dari daftar kerja dengan alasan,
dipertahankan sebagai arsip, dan dipulihkan. Riwayat/foto tidak dihapus. Tugas OPEN
dibatalkan dengan audit saat pengguna mengarsipkan; pemulihan tidak membuka tugas lama.
Vendor aktif/terhubung dan kandidat yang memiliki keputusan akhir tetap dilindungi.
Profil seperti Agus Kartiwa dapat dilihat melalui Vendor aktif terhubung.

## Database dan backup

Hanya migration baru `202611100001_vendor_candidate_archive.sql` yang dijalankan.
SHA-256 `f2ed4b42d2fb77ab8c9e986ff5fd6bead177d28b72d562bb2671ab8d06aeb1c5`.
Marker COMMIT terkonfirmasi, validasi sebelum/sesudah dalam transaksi serta
verifikasi read-only pasca-commit lulus. Tiga kolom/RPC/trigger/filter monitoring
arsip sesuai source. Delapan belas checksum tabel existing tetap sama, termasuk
vendor/master, aset, profil, role/izin, notifikasi, kandidat/riwayat dan Auth.
Helper keamanan, guard keputusan/aktivasi, seluruh policy public/storage dan
RLS existing dipertahankan. Tidak ada archive/delete bisnis atau akun uji produksi.

Backup privat terbaru:
`D:\Backups\harmas-pre-candidate-archive-20261110-094551-7cf2f2a6`.
Dump **1.244.528 byte**, SHA-256
`b8c382313178e2a5c9b8e7b54cc37559b4293d1d50345da6babc04f16f55dcff`.
Restore logis **141 tabel / 1.830 baris** cocok dengan seluruh COPY archive.
Cold clone tanpa jaringan/published port, backup mount read-only, cron nonaktif.
Migration dan rollback diuji masing-masing dua kali pada clone; baseline stale
ditolak oleh pembungkus transaksi. Seluruh clone rilis dihentikan.

Restore logis aplikasi diverifikasi; restore seluruh platform Supabase tidak
diklaim lengkap. File blob Storage tidak disalin pada rilis ini: migration tidak
menyentuh bucket/file fisik, dan fitur arsip mempertahankan foto.

## Verifikasi frontend dan batas UAT

- 19 kelompok fitur/API/browser lokal dan 8 kelompok transaksi rilis lulus.
- Hash source frontend/migration tetap identik dengan versi yang diuji.
- Build production 1586 modul lulus dan sama dengan build lokal teruji.
- Scan 81 file artifact tanpa kredensial privat/env/dump.
- Sembilan hash file cocok pada staging dan domain utama; alias utama menunjuk deployment di atas.
- Enam guard anonim: /users, /vendors, /vendor, /vendor/database, /vendor/followups,
  /vendor/map mengarah login. Nol pageerror, asset gagal, atau request tulis selama probe.
- Query log runtime error pada waktu rilis mengembalikan nol entri.
- UAT login produksi dan tindakan arsip pada kandidat bisnis belum dijalankan agent.
  Pengguna menguji pada kandidat yang memang ingin diarsipkan, tanpa dummy permanen.

Bukti: [aktivasi database](candidate-archive-evidence/PRODUCTION_ACTIVATION_CHECKS.json),
[restore backup](candidate-archive-evidence/BACKUP_OFFLINE_VERIFICATION.json),
[produksi frontend](candidate-archive-evidence/PRODUCTION_CHECKS.json),
[status rilis](candidate-archive-evidence/RELEASE_STATUS.json).

## Kendala yang diselesaikan dan risiko tersisa

Autentikasi awal ditolak sebelum write. Pembanding ACL restore diperbaiki agar
urutan daftar grant tidak dianggap perubahan izin; seluruh grant/grantor dan
izin efektif tetap diperiksa. Readiness clone memakai TCP loopback agar tidak
tertipu server bootstrap sementara. Kedua koreksi diuji offline sebelum migration.
Password hanya berada dalam environment terminal dan dibersihkan setelah driver.

Konfigurasi publik cloud Vercel masih placeholder, sehingga rilis menggunakan
public config cache lokal tervalidasi dan prebuilt. Cloud env tidak diubah;
perbaiki sebelum mengandalkan build otomatis cloud. Warning bundle existing >500 kB tetap.

Rollback frontend sebelumnya: `dpl_EvUg1fFbiXATT3xTv4fGem4UGVsT`,
https://harmas-asset-management-2wbh8xjq0.vercel.app . Frontend lama dapat menampilkan
kandidat arsip karena belum memfilter arsip; guard backend tetap menolak edit.
Rollback database manual ada di supabase/rollbacks, bukan migrations, dan tidak
membuka ulang tugas yang sudah dibatalkan. Jangan menjalankan rollback tanpa izin.

Sampel/QC dan persetujuan/aktivasi formal masih belum diimplementasikan. Rilis ini
tidak memberi Sourcing hak menyetujui/mengaktifkan kandidat. [Prosedur kelayakan](PROSEDUR_PENILAIAN_KELAYAKAN_VENDOR.md).
