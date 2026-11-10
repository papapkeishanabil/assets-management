# Setup Google Maps untuk HARMAS

**Catatan 10 November 2026:** user memilih peta gratis Leaflet/OpenStreetMap dan
navigasi melalui Maps URLs. Google Cloud/API key/Map ID pada panduan ini **tidak
diperlukan** untuk pilihan terbaru. Dokumen disimpan sebagai referensi rancangan
Google yang lama. Lihat [implementasi peta gratis](FREE_MAP_AND_DIRECTIONS_20261110.md).

Tujuan: menampilkan Google Maps pada `/vendor/map` dan pemilih pin lokasi.
Frontend sudah tersedia di produksi; konfigurasi Google Cloud belum dibuat.
Panduan diperiksa dengan dokumentasi resmi pada 9 November 2026.

## 1. Project dan billing

Buka [Google Cloud Console](https://console.cloud.google.com/), login dengan akun
perusahaan yang akan mengelola Maps, lalu pilih atau buat project, misalnya
`HARMAS Vendor Maps`. Hubungkan billing project. Maps produksi memerlukan billing
aktif; biaya bergantung pemakaian. Penetapan metode pembayaran dilakukan oleh pemilik
akun, bukan oleh skrip aplikasi. [Panduan billing resmi](https://developers.google.com/maps/documentation/javascript/usage-and-billing).

## 2. Aktifkan API dan buat key

Di **APIs & Services → Library**, cari **Maps JavaScript API** lalu Enable.
Di **Google Maps Platform → Keys & Credentials** (atau **APIs & Services → Credentials**),
buat API key dengan nama `HARMAS Vendor Web`. Gunakan key standar untuk produksi.
[Panduan resmi API key](https://developers.google.com/maps/documentation/javascript/get-api-key).

Pada pengaturan key:

- **Application restrictions:** Websites / HTTP referrers.
- Website produksi yang diizinkan: `https://harmas-asset-management.vercel.app/*`.
- **API restrictions:** Restrict key → hanya **Maps JavaScript API**.
- Simpan perubahan. Jangan mengizinkan seluruh domain Vercel.

Jika kelak menguji pada preview atau localhost, tambahkan alamat yang benar-benar
dipakai secara spesifik, atau gunakan key development terpisah. Implementasi saat ini
tidak membutuhkan Places, Geocoding atau Routes API. Pembatasan aplikasi dan API adalah
pengaman pemakaian key browser. [Panduan keamanan Google](https://developers.google.com/maps/api-security-best-practices).

## 3. Buat Map ID

Di **Google Maps Platform → Map Management**, pilih **Create map ID**:

- Nama: `HARMAS Vendor Map`.
- Map type: **JavaScript**.
- Rendering: **Vector** (pilihan untuk implementasi HARMAS).
- Save, lalu simpan Map ID yang ditampilkan.

Map ID berbeda dari API key dan project ID. Tidak perlu membuat style khusus untuk
memulai. [Panduan Map ID resmi](https://developers.google.com/maps/documentation/javascript/map-ids/get-map-id).

## 4. Masukkan konfigurasi aplikasi

Di Vercel, buka project **harmas-asset-management → Settings → Environment Variables**.
Tambahkan dua konfigurasi untuk environment **Production**:

| Nama | Isi |
|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | API key yang sudah dibatasi pada langkah 2 |
| `VITE_GOOGLE_MAPS_MAP_ID` | Map ID JavaScript dari langkah 3 |

Masukkan nilainya langsung di dashboard Vercel; jangan kirim key dalam chat, screenshot
atau commit Git. Variabel `VITE_*` akan menjadi bagian bundle browser setelah build;
key ini tidak dianggap rahasia server, sehingga pembatasan Google Cloud wajib tepat.
Jangan mengubah `VITE_SUPABASE_URL` atau publishable key Supabase pada pekerjaan ini.

Sesudah keduanya disimpan, beri tahu agent bahwa konfigurasi Production sudah siap,
tanpa mengirim nilainya. Perubahan ini masih memerlukan rebuild/rilis frontend untuk
terpakai. Agent harus memverifikasi target dan artifact; tidak cukup hanya refresh.

## 5. Pemeriksaan setelah konfigurasi dan aktivasi database

Periksa map tiles, pin fasilitas, klik panel, cluster, drag pada mode edit, serta
error key/referrer/billing. Jalankan UAT hanya pada data bisnis yang disetujui.
Tidak membuat koordinat 0,0, foto dummy atau vendor produksi palsu untuk mengisi peta.

Konfigurasi Maps tidak membuat tabel lokasi atau menghubungkan master secara otomatis.
Database Fase 3 tetap memerlukan backup terbaru, preflight, verifikasi restore dan
persetujuan migration tersendiri. Setelah backend siap, lokasi dapat dimasukkan
manual/GPS walaupun Maps belum tersedia; fallback daftar tetap digunakan saat perlu.

## Backup yang berjalan terpisah

Agent menyiapkan terminal berjudul **HARMAS - Preflight dan Backup Fase 3 (tanpa
migration)**. Masukkan password koneksi PostgreSQL Supabase di jendela itu (bukan
password login HARMAS). Input tersembunyi; password hanya menjadi PGPASSWORD proses,
tidak disimpan ke file atau dicetak, dan dibersihkan setelah selesai.

Driver hanya menjalankan SELECT READ ONLY dan pg_dump, menyimpan bukti ke direktori
baru `D:\Backups\harmas-pre-phase3-*`. Tidak ada migration/push/deploy otomatis.
Setelah dump, verifikasi restore aplikasi/platform dan blob Storage masih diperlukan.
Jika terminal gagal, jangan mengubah guard atau menjalankan SQL migration sendiri.

Jika jendela terminal tidak terlihat, periksa taskbar Windows. Untuk menjalankannya
manual setelah memastikan jendela sebelumnya sudah ditutup:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "E:\ASSET MANAGEMENTS\harmas-asset-management\scripts\start-vendor-phase3-backup.ps1"
```

`ExecutionPolicy Bypass` berlaku hanya untuk proses skrip ini, tidak mengubah kebijakan
mesin. Password database yang belum diketahui perlu didapatkan melalui pengelolaan
kredensial perusahaan; panduan ini tidak menyuruh reset password database produksi.
