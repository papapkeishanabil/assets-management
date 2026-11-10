# Rilis Dashboard Vendor — 10 November 2026

**Production READY, diverifikasi 13.23 WIB.** User menyetujui rilis dengan
**“ok deploy”** setelah meninjau implementasi kartu sesuai contoh dashboard utama.

- Dashboard: https://harmas-asset-management.vercel.app/vendor
- Commit frontend: **`539932d1`** (`feat(vendor): modernize active vendor dashboard`).
- Deployment: **`dpl_3g9VVqhLqJuvCoZK3v5Mt7evdVPa`**, production, Vite/React.
- Artifact: https://harmas-asset-management-gaoll0eom.vercel.app
- Referensi rollback: **`dpl_2SpGpZVPrLNzJSFJ4HpcziZURWtE`**,
  https://harmas-asset-management-mx0a0umhv.vercel.app ; tidak dihapus.
- Project/team Vercel diverifikasi melalui konektor dan CLI sebelum build/rilis.

Dashboard menampilkan vendor aktif, cakupan GPS, kelengkapan lokasi, aset terkait,
sebaran jenis dan prioritas kelengkapan. Tab Sourcing mempertahankan monitoring
pipeline, filter dan produktivitas PIC. Kartu memakai ikon kiri atas, empat aksen
warna, angka besar, progres pemetaan nyata dan komposisi jenis vendor. Grafik mini
bukan tren historis; tidak menyalin klaim kenaikan +5% pada contoh dashboard.

## Bukti verifikasi

| Pemeriksaan | Hasil |
|---|---|
| Implementasi dasar lokal | 56/56 PASS sebelum penyempurnaan kartu; lihat laporan implementasi |
| Browser/UI final | 15/15 PASS pada Docker sintetis, termasuk screenshot pembanding, role dan mobile; cleanup 12 checksum tabel identik |
| Build production | Exit 0; 1583 modul, 6,14 detik; service worker 137 ms; peringatan bundle existing >500 kB |
| Target konfigurasi | Project Supabase benar dan publishable key valid, GET `/auth/v1/settings` HTTP 200 |
| Scan artifact | 81 file; tidak ada pola kredensial privat, file environment/dump atau source tidak terkait; fitur baru dan menu/koordinat/peta existing ada |
| Bundle yang diuji | Entry build Vercel identik byte-for-byte dengan entry build lokal yang diuji |
| Staging | 9 hash HTML/JS/CSS/SW cocok dengan build; domain utama terbukti masih versi sebelumnya sebelum promosi |
| Domain utama | 9 HTTP 200, seluruh SHA-256 cocok dengan staging/build |
| Guard anonim | `/vendors`, `/vendor`, `/vendor/database`, `/vendor/followups`, `/vendor/map` terlindungi login |
| Browser pascarilis | 0 pageerror, 0 file origin aplikasi gagal, 0 request tulis |
| Status domain | `vercel inspect harmas-asset-management.vercel.app` menunjuk deployment baru READY |
| Error scan | 0 entri error deployment baru dalam jendela 10 menit saat rilis |

Entry `/assets/index-DfD_bc3H.js`, SHA-256:

```text
aa630ead5edaffac363a74666d4e05cb5cf1fe2bf58ce2c185496422c518d6bf
```

Bukti di `dashboard-cards-evidence/`:
[preflight](dashboard-cards-evidence/RELEASE_PREFLIGHT.json),
[staging](dashboard-cards-evidence/STAGING_CHECKS.json),
[domain utama](dashboard-cards-evidence/PRODUCTION_CHECKS.json),
[error scan](dashboard-cards-evidence/ERROR_SCAN.json),
[login produksi](dashboard-cards-evidence/production-login.png).
Screenshot kartu berisi angka vendor pada laporan implementasi berasal dari Docker
sintetis; bukan screenshot angka bisnis produksi.

## Konfigurasi, keamanan dan batas uji

Rilis memakai artifact **prebuilt**. Nilai publik Supabase yang ditarik dari Vercel
production masih berupa konfigurasi tidak valid. Helper existing memvalidasi URL/key
publishable dari `.env` standar melalui GET Auth, lalu mengoreksi **cache build lokal
yang diabaikan Git**. Environment cloud tidak diubah. Jangan memakai remote/Git build
berikutnya tanpa memvalidasi konfigurasi cloud terlebih dahulu.

Tidak menjalankan migration, penulisan data bisnis, perubahan schema/RLS/role,
pembuatan akun uji produksi, push Git atau perubahan pengaturan protection Vercel.
File environment, `.superdesign/` dan skrip finance tidak masuk commit fitur atau
artifact deployment. Tidak mengklaim checksum tabel produksi baru diukur pada rilis
frontend ini; tidak ada perintah tulis database yang dijalankan.

Pemeriksaan domain utama menggunakan browser anonim. UAT login akun operasional
SA/Sourcing/Direksi dan pemeriksaan angka bisnis aktual tetap dilakukan pengguna;
pengujian role dengan data sintetis tidak menggantikan UAT tersebut. Reminder existing
tetap dapat membuat notifikasi saat monitoring digunakan oleh pengguna berizin;
rilis ini tidak menambah scheduler atau mengubah deduplikasi. Mode penggunaan
follow-up manual belum diubah oleh penyempurnaan tampilan ini.

Error scan hanya snapshot saat rilis; konfigurasi drains/monitoring berkelanjutan
tidak diperiksa. Tidak perlu migration/backup database tambahan untuk rilis frontend
ini. Referensi rollback frontend tetap tersedia tanpa mengubah backend Fase 1–3.

## Langkah pengguna

Buka **Manajemen Vendor → Dashboard Vendor**. Jika masih melihat tampilan lama,
lakukan **Ctrl+F5** atau tutup lalu buka kembali aplikasi PWA. Periksa ringkasan
operasional, kartu GPS/aset, tab Sourcing dan tautan Vendor Aktif/Peta sesuai izin.
Bandingkan angka master aktif dan lokasi dengan data aktual; jangan memakai angka
dari screenshot pengujian lokal sebagai angka yang diharapkan di produksi.
