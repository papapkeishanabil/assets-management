# Rilis frontend peta gratis dan rute — 10 November 2026

Status **READY**, diverifikasi sekitar 09.06 WIB. User menjawab “ok selanjutnya apa”
setelah pertanyaan persetujuan deployment frontend ke alamat utama, tanpa migration.
Persetujuan tersebut dipakai hanya untuk deployment frontend ini.

## Hasil deployment

- URL utama: https://harmas-asset-management.vercel.app
- Peta: https://harmas-asset-management.vercel.app/vendor/map
- Target: production; framework React/Vite.
- Source: `5ae0c673` — `feat(vendor): use free maps and add facility directions`.
- Deployment: `dpl_F3UijNeKStcKMe8nTQfUdvLVo7BC`.
- Artifact: https://harmas-asset-management-1qkkw7fbc.vercel.app
- Build production: 1.579 modul, 5,39 detik; service worker 131 ms; exit 0.
- Deployment sebelumnya, referensi rollback: `dpl_AGnmtsEyyNuTFCP3EkmKCLsDFM8R`
  (https://harmas-asset-management-pnudvowo3.vercel.app). Tidak dihapus.

Peta memakai Leaflet 1.9.4 dan tile publik OpenStreetMap tanpa key/billing. Tombol
**Rute ke Lokasi** membuka Google Maps menuju koordinat fasilitas yang dipilih;
Google menangani titik awal, pilihan kendaraan dan navigasi. Rute jalan tidak dihitung
di HARMAS. Batas layanan tile dan privasi dijelaskan pada
[laporan implementasi](FREE_MAP_AND_DIRECTIONS_20261110.md).

## Pemeriksaan rilis

Project/tim diverifikasi melalui CLI resmi. Konfigurasi production ditarik ke cache
lokal `.vercel/` yang diabaikan Git. Dua konfigurasi publik Supabase dari cloud masih
tidak valid; hanya cache build lokal dikoreksi memakai URL/key publishable `.env`
standar, dan GET konfigurasi Auth berhasil HTTP 200. **Environment cloud tidak diubah.**
Build Git/remote berikutnya tetap perlu memeriksa konfigurasi cloud; jangan memakai
hasil pull mentah tanpa validasi. Tidak menggunakan service key atau PGPASSWORD.

Pemindaian 79 file artifact lulus pola kredensial privat yang diperiksa, tanpa file
environment/dump/SQL privat. Artifact prebuilt diunggah sebagai production dengan
`--skip-domain`, diperiksa melalui `vercel curl`, lalu artifact yang sama dipromosikan.
Tidak ada push Git, migration, perubahan role, pembuatan akun atau write data bisnis.

| Pemeriksaan | Hasil |
|---|---|
| Lokal sebelum rilis | 64 pemeriksaan PASS; build PASS |
| Staging terlindungi | 5 file HTML/JS/CSS identik SHA-256 dengan artifact lokal |
| Domain utama | `vercel inspect`: deployment baru, target production, READY |
| File publik | 6 file HTML/JS/CSS/SW HTTP 200 dan hash identik dengan artifact |
| Akses anonim | `/vendors`, `/vendor`, `/vendor/map` menuju login dengan tujuan kembali |
| Browser produksi | 0 pageerror, 0 asset origin aplikasi gagal, 0 request tulis |
| Log Vercel | Query error deployment baru selama 10 menit terakhir mengembalikan 0 entri |

Entry: `/assets/index-Bv4kaRUk.js`; SHA-256:

```text
c8e8d766625be31675c730f4c39e8cf4bfce0ee20284be8613ae77556419a790
```

Bukti: [staging](phase3-evidence/FREE_MAP_STAGING_CHECKS.json),
[produksi](phase3-evidence/FREE_MAP_PRODUCTION_DEPLOYMENT_CHECKS.json),
[tampilan login](phase3-evidence/free-map-production-login.png).
Harness awal salah mencocokkan URL login tanpa query dan timeout; diperbaiki agar
memeriksa pathname `/login`, lalu ketiga route lulus. Tidak ada perubahan aplikasi
untuk memperbaiki harness tersebut.

Pemeriksaan produksi ini anonim. Belum UAT akun bisnis, pin vendor produksi, tile OSM
nyata atau navigasi di ponsel. Pengujian lokal memakai Docker sintetis dan mock tile
untuk menghindari beban otomatis pada layanan publik. Query log hanya snapshot waktu
rilis, bukan pemantauan berkelanjutan; konfigurasi drains tidak diperiksa. Warning
bundle utama >500 kB masih ada.

## Aktivasi selanjutnya

Database lokasi/foto Fase 3 **belum diaktifkan**. Peta dasar dapat tampil, tetapi pin
vendor dan input lokasi/foto masih menunggu backend. Jangan memasukkan data dummy
atau menulis master vendor agar peta terlihat terisi.

1. Muat ulang aplikasi (Ctrl+F5, atau tutup/buka aplikasi PWA) dan buka Peta Vendor.
2. Perbarui preflight read-only, backup database/blob dan verifikasi backup sebelum
   migration. Bukti backup yang ada berasal dari 9 November, bukan kondisi live 10 November.
3. Minta persetujuan eksplisit untuk migration Fase 3
   `202611090001_vendor_management_phase3.sql`, lalu verifikasi RLS/guard/data existing.
4. Setelah backend aktif, uji memakai akun operasional yang diizinkan dan isi koordinat
   serta foto lokasi vendor nyata; klik pin dan **Rute ke Lokasi** untuk UAT ponsel.

Tidak mengklaim checksum database produksi baru pada rilis frontend ini. Tidak ada
perintah tulis database yang dijalankan; bukti rilis adalah artifact, HTTP/browser
dan pemeriksaan log. Persetujuan deployment ini bukan persetujuan migration berikutnya.
