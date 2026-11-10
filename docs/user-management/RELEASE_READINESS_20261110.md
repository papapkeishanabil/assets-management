# Kesiapan rilis pengelolaan pengguna — 10 November 2026

User menyetujui **deploy backend dan frontend**, lalu memilih **deployment backend
melalui Dashboard Supabase** ketika CLI Windows tidak dapat dijalankan.

## Status

- Commit fitur lokal: **b5d07ba5**; tidak di-push.
- Fungsi backend `admin-update-user`: paket Dashboard siap, **menunggu pengguna
  mengunggah/deploy di Dashboard**. Paket/manifest ada di `deploy/`.
- Frontend production prebuilt berhasil, entry dan hash sama persis dengan build
  yang diuji. Scan 81 file tidak menemukan credential privat atau environment/dump.
- Frontend staging READY: **dpl_3Z7Rm7KEApHETkfSnuGcHiWbZUKR**,
  https://harmas-asset-management-2a4sj6mxy.vercel.app . **Belum dipromosikan.**
  Sembilan file HTML/JS/CSS/SW cocok SHA-256 dengan build, dan domain utama terbukti
  tetap versi sebelumnya sebelum promosi.
- Domain utama tetap deployment dashboard sebelumnya
  **dpl_3g9VVqhLqJuvCoZK3v5Mt7evdVPa**, source **539932d1**.
- Tidak ada migration, perubahan RLS, akun uji produksi atau perubahan password/data
  bisnis produksi yang dijalankan oleh Codex.

GET metadata OpenAPI tanpa sesi pengguna menghasilkan HTTP 401; tidak ada baris
data dibaca. Kolom produksi tidak diklaim telah diverifikasi oleh request ini.
Bukti: [SCHEMA_METADATA_CHECK.json](evidence/SCHEMA_METADATA_CHECK.json).

Build 1585 modul, 6,15 detik + service worker 176 ms, exit 0. Peringatan bundle
existing >500 kB tetap ada. Konfigurasi publik Supabase cloud yang tidak valid
ditangani dengan validasi GET Auth dan koreksi cache lokal sesuai prosedur rilis
existing; konfigurasi cloud tidak diubah.

Entry `/assets/index-MELo0Wop.js`, SHA-256:

```text
c8db264fbf4a9515a69df235fd797bd096152607da82fbe4439e98f575a33b6a
```

## Kendala dan keputusan

CLI Supabase 3.1.0 terpasang, tetapi Windows **Application Control policy** memblokir
binary yang tidak ditandatangani. Kebijakan tidak dibuka/dinonaktifkan dan binary
alternatif tidak dijalankan untuk menghindari blokir. SUPABASE_ACCESS_TOKEN tidak
tersedia pada environment sesi. Tidak mengambil service key/token dari file legacy.

Ini adalah blokir OS, **bukan penolakan automatic approval review**. Jalur Management
API resmi memerlukan token akun; user memilih menggunakan Dashboard sehingga token
baru tidak diminta. [Langkah Dashboard](deploy/DASHBOARD_DEPLOY.md) dan
[paket ZIP](deploy/admin-update-user.zip) disediakan. Source fungsi tidak diubah
dari versi yang lolos 22 pemeriksaan lokal termasuk browser melalui Deno asli.

## Lanjutan yang sudah diotorisasi

Sesudah pengguna mengonfirmasi fungsi sudah aktif:

1. Periksa endpoint OPTIONS/metode/request anonim atau JWT tidak valid. Pastikan
   tanpa otorisasi tidak dapat mengubah akun. Jangan menciptakan akun uji atau
   mengubah password bisnis untuk smoke test tanpa izin khusus.
2. Pastikan target frontend staging dan hash masih sesuai, lalu promosikan ke
   https://harmas-asset-management.vercel.app . **Tidak perlu meminta persetujuan
   deployment yang sama lagi.**
3. Verifikasi file publik, guard anonim `/users`, error browser/runtime dan domain
   yang menunjuk deployment baru. Simpan laporan rilis.
4. Pengguna Super Admin menjalankan UAT pada akun yang memang ingin diperbarui.

Bukti preflight: [RELEASE_PREFLIGHT.json](evidence/RELEASE_PREFLIGHT.json).
Bukti staging: [STAGING_CHECKS.json](evidence/STAGING_CHECKS.json).
Paket asli hanya `index.ts` dan `handler.js`; hash tercatat di [manifest](deploy/MANIFEST.json).
