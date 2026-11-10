# Staging rilis arsip kandidat — 10 November 2026

Pengguna menyetujui **deployment frontend** dengan “ok deploy”. Sesuai batasan
pengguna yang memisahkan migration produksi dan deployment, izin ini belum dianggap
sebagai persetujuan menulis database produksi.

## Hasil yang selesai

- Source `a32d3c49`; 19/19 pengujian lokal sebelumnya dan seluruh hash sumber tetap cocok.
- Build production berhasil dan identik dengan build teruji:
  `/assets/index-BXKUYMUZ.js`, SHA-256
  `e6c7b9f479992229e955ce5a9ca4951bcd233e23f631663a3ffcdd073435fa8c`.
- Scan 81 file artifact tanpa kredensial privat, environment atau dump.
- Staging production **READY**, tanpa pemindahan alias utama:
  `dpl_8HZD3SCrS2ZuwGWRonkkYPRPUKEu`,
  https://harmas-asset-management-ic54qndin.vercel.app .
- Sembilan file staging cocok SHA-256. Domain utama tetap deployment stabil
  `dpl_EvUg1fFbiXATT3xTv4fGem4UGVsT`,
  https://harmas-asset-management-2wbh8xjq0.vercel.app .

Bukti: [RELEASE_PREFLIGHT.json](candidate-archive-evidence/RELEASE_PREFLIGHT.json),
[STAGING_CHECKS.json](candidate-archive-evidence/STAGING_CHECKS.json).
Konfigurasi publik build divalidasi via GET Auth settings. Cache build lokal
dikoreksi sesuai prosedur existing; environment cloud tidak diubah.

## Belum siap dipromosikan

Frontend baru membutuhkan kolom archived_at/by/reason dan RPC arsip. Karena itu
staging tidak boleh dipromosikan sebelum backend arsip tervalidasi di produksi.
UAT login staging juga belum diklaim berjalan dengan backend arsip produksi.

Migration konkret yang menunggu persetujuan:
[202611100001_vendor_candidate_archive.sql](../../supabase/migrations/202611100001_vendor_candidate_archive.sql)
(SHA-256 `f2ed4b42d2fb77ab8c9e986ff5fd6bead177d28b72d562bb2671ab8d06aeb1c5`).
[Rollback terpisah](../../supabase/rollbacks/202611100001_vendor_candidate_archive_rollback.sql).
Migration tidak mengarsipkan/menghapus kandidat existing secara otomatis; tugas
dibatalkan hanya saat pengguna menjalankan tindakan Hapus dari daftar setelah rilis.

PGPASSWORD belum tersedia pada sesi ini. Pemeriksaan PostgreSQL produksi read-only,
backup terbaru dan restore verifikasi belum dilakukan untuk rilis arsip; jangan
menganggap backup Fase 3 pagi hari sebagai backup terbaru untuk langkah ini.
Gunakan koneksi PostgreSQL langsung dan password yang dimasukkan pengguna melalui
terminal tersembunyi; jangan mengambil service key legacy atau mengirim password di chat.
Driver Fase 3 lama tidak boleh langsung dipakai: ia menuntut objek Fase 3 belum ada,
sedangkan Fase 3 sudah aktif. Preflight rilis arsip harus meninjau baseline yang sesuai.

## Lanjutan

1. Sediakan PGPASSWORD melalui terminal, lalu pemeriksaan objek produksi read-only,
   backup dan verifikasi restore. Rekonsiliasi bila ada drift dari definisi baseline.
2. Dapatkan persetujuan eksplisit migration arsip; eksekusi hanya sesudah backup
   dan pemeriksaan lulus. Jangan mengulang migration Fase 1–3.
3. Verifikasi schema/guard/RLS dan checksum data existing, kemudian promosikan
   staging yang telah disetujui. Tidak perlu meminta izin deploy frontend yang sama lagi.
4. Verifikasi domain/files/login dan UAT pengguna pada kandidat yang memang ingin
   diarsipkan. Jangan membuat data dummy atau menghapus kandidat bisnis untuk smoke test.

Tidak ada migration produksi, penulisan data bisnis, akun baru, perubahan RLS atau
push Git pada langkah staging ini. Persetujuan deployment tetap berlaku untuk
menyelesaikan rilis sesudah prasyarat database dipenuhi.
