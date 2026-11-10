# Kesiapan rilis pengelolaan pengguna — 10 November 2026

Persetujuan deploy backend dan frontend sudah diberikan pengguna. Tidak melakukan push Git.

## Status koneksi backend

Pengguna men-deploy paket backend melalui Dashboard Supabase dengan nama **smooth-task**.
Source tetap di **supabase/functions/admin-update-user/**. Frontend sekarang memanggil
slug aktual tersebut; tidak perlu membuat fungsi kedua atau menjalankan migration.
Nama awal admin-update-user memberi 404. Staging lama dpl_3Z7Rm7KEApHETkfSnuGcHiWbZUKR
masih memakai nama awal dan tidak boleh dipromosikan.

Pemeriksaan endpoint aktual: OPTIONS 200, GET 405, POST tanpa sesi 401 dan token
palsu 401. Respons sesuai kontrak handler. Pemeriksaan ini tidak mengunduh atau
membandingkan source yang terpasang, tidak mengubah identitas/password produksi,
dan tidak menggantikan UAT dengan akun Super Admin. [Bukti](evidence/BACKEND_DEPLOY_CHECK.json).

## Verifikasi lokal dan rilis

Pengujian terbaru setelah penyesuaian slug: **22/22 PASS** melalui native Deno dan
Supabase Docker sintetis. Sembilan akun uji dibersihkan, checksum 14 tabel termasuk
Auth kembali identik. Build frontend exit 0; warning bundle existing >500 kB.
[Hasil](evidence/RESULTS.json), [hash build](evidence/VERIFICATION_SUMMARY.json).

Rilis frontend **sudah aktif** di https://harmas-asset-management.vercel.app/users .
Source **a220e274**, deployment **dpl_3P4JiPZE2QwZE1EsQVDBHZgsTX2Q**
(https://harmas-asset-management-a7qfp4wli.vercel.app). Sembilan file cocok dengan
build teruji pada staging dan domain utama. Enam route termasuk /users dan menu
vendor menolak sesi anonim ke login; nol error browser, asset gagal, atau request
tulis pada pemeriksaan tersebut. Query runtime error saat rilis mengembalikan nol
entri. Ini bukan UAT perubahan akun dengan sesi produksi.
Rollback sebelum rilis: dpl_3g9VVqhLqJuvCoZK3v5Mt7evdVPa,
https://harmas-asset-management-gaoll0eom.vercel.app (source 539932d1).

Tidak ada migration, perubahan RLS, akun uji produksi atau perubahan password/data
bisnis produksi oleh Codex. GET metadata sebelumnya memberi 401; kolom produksi
tidak diklaim telah diverifikasi melalui request itu.

## Kendala yang tetap dicatat

CLI Supabase diblokir Windows Application Control; pengguna memilih Dashboard.
Tidak membuka kebijakan OS, mengambil service key legacy, atau meminta password di chat.
Konfigurasi publik Supabase pada environment cloud Vercel masih placeholder;
rilis prebuilt memvalidasi public config dan memperbaiki cache build lokal saja,
tanpa mengubah environment cloud. Build otomatis cloud berikutnya perlu koreksi
konfigurasi publik tersebut sebelum dipakai untuk rilis.

## UAT setelah rilis

Super Admin membuka Pengguna, mengedit identitas akun target yang memang ingin
diperbarui, lalu memeriksa hasil. Reset password hanya pada akun yang disepakati;
uji login password baru dan penolakan password lama. Pastikan role/status tetap.
Role lain tetap tidak boleh mengelola pengguna. Tidak perlu menjalankan migration vendor.

Bukti: [staging](evidence/STAGING_CHECKS.json), [produksi](evidence/PRODUCTION_CHECKS.json),
[status rilis dan rollback](evidence/RELEASE_STATUS.json).
Pemeriksaan publik tidak melakukan reset password atau edit identitas akun produksi.
