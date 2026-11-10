# Rilis gabungan Manajemen Vendor — 10 November 2026

**Production READY, diverifikasi 11.14 WIB.** User menyetujui deployment dengan
**“ok deploy”** untuk gabungan integrasi menu dan input koordinat Master Vendor.
Tidak ada migration tambahan, push Git, perubahan role/permission atau akun baru.

## Hasil rilis

- Aplikasi: https://harmas-asset-management.vercel.app
- Dashboard Vendor: `/vendor`; Vendor Aktif: `/vendors`; Calon Vendor:
  `/vendor/database`; Follow-Up: `/vendor/followups`; Peta: `/vendor/map`.
- Source frontend: **`09b980ce`**, mencakup input koordinat master `ec617b81`.
- Deployment: **`dpl_2SpGpZVPrLNzJSFJ4HpcziZURWtE`**, target production, React/Vite.
- Artifact: https://harmas-asset-management-mx0a0umhv.vercel.app
- Build production: 1580 modul, 5,39 detik; service worker 130 ms; exit 0.
- Deployment sebelumnya, referensi rollback: `dpl_F3UijNeKStcKMe8nTQfUdvLVo7BC`
  (https://harmas-asset-management-1qkkw7fbc.vercel.app). Tidak dihapus.

Kelima menu kini berada pada kelompok **Manajemen Vendor**, mengikuti izin pengguna.
Vendor Aktif memakai halaman master dan URL existing, sehingga relasi aset/kontrak
tetap sama. Tombol Koordinat dan tab Lokasi & Koordinat memungkinkan input lokasi
langsung dari master; vendor baru dapat memilih Simpan dan Isi Koordinat. Lokasi,
foto dan rute memakai backend Fase 3 yang sudah aktif sebelumnya.

## Pemeriksaan

| Pemeriksaan | Hasil |
|---|---|
| Sebelum rilis | 7 browser navigasi + 16 regresi input master PASS; fitur koordinat sebelumnya 16 + 22 regresi lokasi/foto PASS |
| Target | Project/team/link Vercel dikonfirmasi, commit `09b980ce`, environment production |
| Konfigurasi publik | Project Supabase cocok, key publishable valid; GET konfigurasi Auth HTTP 200 |
| Artifact | **80 file** dipindai; label menu/form, chunk master, OSM/rute benar; tidak ada pola kredensial privat atau file environment/dump |
| Staging terlindungi | **8 file** HTML/JS/CSS/SW identik SHA-256 dengan build lokal; domain utama masih versi lama sebelum promotion |
| Promotion | Artifact production yang sama dipromosikan; `vercel inspect` mengonfirmasi domain utama menunjuk deployment baru READY |
| File publik | **8 HTTP 200**, seluruh hash cocok dengan build/staging |
| Guard anonim | **5 route** vendor mengarah ke login dengan tujuan kembali |
| Browser | 0 pageerror, 0 asset origin aplikasi gagal, 0 request tulis |
| Log Vercel | 0 entri error pada query deployment baru, rentang 10 menit terakhir |

Entry `/assets/index-B6D9i4wz.js`, SHA-256:

```text
ffe044c82933c74ace1f21371f204591be553955cbbcb90e9459263a013d5ce5
```

Bukti: [preflight artifact/config](phase3-evidence/INTEGRATED_VENDOR_RELEASE_PREFLIGHT.json),
[staging](phase3-evidence/INTEGRATED_VENDOR_STAGING_CHECKS.json),
[domain utama](phase3-evidence/INTEGRATED_VENDOR_PRODUCTION_CHECKS.json),
[error scan](phase3-evidence/INTEGRATED_VENDOR_ERROR_SCAN.json),
[login setelah rilis](phase3-evidence/integrated-vendor-production-login.png).
Screenshot navigasi/input yang berisi vendor pada laporan implementasi berasal dari
Docker sintetis, bukan data bisnis produksi.

## Konfigurasi dan batas pemeriksaan

Konfigurasi Vercel production ditarik ke cache lokal yang diabaikan Git. Nilai publik
Supabase dari cloud masih tidak valid, sehingga hanya cache build lokal dikoreksi
memakai URL/key publishable `.env` standar dan diuji melalui GET Auth. **Environment
cloud tidak diubah.** Build Git/remote berikutnya harus memeriksa konfigurasi cloud;
jangan menganggap hasil pull mentah siap dipakai. Rilis ini memakai artifact prebuilt
yang sudah divalidasi, bukan build remote dengan nilai tidak valid tersebut.

Pemeriksaan produksi dilakukan tanpa login akun bisnis. Tidak membuat akun uji,
fixture, vendor, lokasi atau foto produksi. UAT input nyata dan navigasi Google Maps
di ponsel belum dilakukan oleh pemeriksaan ini. Tile OSM tidak diuji melalui headless
automation; test lokal memakai mock untuk menghormati kapasitas tile publik.

Query log hanya snapshot waktu rilis, bukan monitoring berkelanjutan; drains tidak
diperiksa. Warning bundle utama >500 kB tetap ada. Tidak mengklaim checksum database
baru diperiksa pada rilis frontend ini; tidak ada perintah tulis database yang dijalankan.
Backend/RLS Fase 3 sebelumnya sudah diverifikasi pada
[laporan aktivasi 09.29 WIB](PHASE3_PRODUCTION_ACTIVATION_20261110.md).

## Penggunaan setelah rilis

Muat ulang dengan **Ctrl+F5** atau tutup/buka aplikasi PWA. Buka **Manajemen Vendor →
Vendor Aktif**, pilih **Koordinat**, kemudian **Tambah Lokasi**. Isi alamat dan GPS
asli, simpan, lalu periksa titik pada Peta Vendor dan tombol Rute ke Lokasi.

Menu Vendor Aktif hanya terlihat bagi role/module yang diizinkan; Sourcing/Direksi
tetap memakai alur sourcing existing. Pengelolaan status aktif/nonaktif master
tetap tersedia. Tidak ada aktivasi calon vendor otomatis atau perubahan KPI sourcing
dalam rilis navigasi ini. Tidak perlu mengulang migration atau deployment untuk
mulai mengisi lokasi nyata pada frontend yang sudah aktif.
