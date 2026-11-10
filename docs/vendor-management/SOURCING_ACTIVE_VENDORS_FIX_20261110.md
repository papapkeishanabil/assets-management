# Akses lihat Vendor Aktif untuk Sourcing

Status 10 November 2026: **implementasi dan uji lokal selesai; belum dideploy**.
Pengguna menyetujui perbaikan setelah ditemukan izin `vendors` aktif di pengaturan,
tetapi sidebar dan route `/vendors` masih dibatasi Super Admin/HRD.

## Perilaku setelah perbaikan

| Role/izin | Vendor Aktif | Master vendor | Lokasi |
|---|---|---|---|
| Super Admin | Akses seperti sebelumnya, bypass modul | CRUD | Sesuai aturan existing |
| HRD + vendors ON | Dapat membuka | CRUD | Memerlukan vendor_map |
| Sourcing + vendors ON | Sidebar, tautan dashboard, URL langsung, cari dan lihat profil | Hanya lihat | Memerlukan vendor_map; input/edit lokasi di vendor_* mengikuti aturan existing |
| Sourcing/HRD + vendors OFF | Tidak tampil dan URL ditolak | Tidak diakses dari halaman ini | Tidak diakses dari halaman ini |
| Direksi/Finance/Pelaksana | Tetap ditolak dari master | Tidak ditambah haknya | Akses halaman lokasi lain tetap mengikuti aturan existing |
| Akun belum aktif | Ditolak ProtectedRoute | Tidak diakses | Tidak diakses |

Sourcing tidak mendapat hak tambah/edit/hapus master `vendors`, mengubah status
aktif/nonaktif master, memverifikasi lokasi, menyetujui atau mengaktifkan kandidat.
Tombol lihat profil membuka fieldset nonaktif tanpa tombol simpan. Handler submit
dan delete juga memeriksa hak tulis; pembatasan bukan sekadar tombol tersembunyi.
Backend tetap memakai RLS/trigger existing. Tidak ada perubahan policy atau migration.

## File implementasi

- `src/lib/vendor-constants.js`: pisahkan konstanta role baca dan tulis master.
- `src/components/layout/MainLayout.jsx`: sidebar memakai role baca dan izin vendors.
- `src/App.jsx`: route master memakai VendorRoute dengan module vendors dan role baca;
  guard HRD untuk modul lain tetap. Guard route menunggu pemuatan izin selesai.
- `src/pages/VendorsPage.jsx`: guard role/modul pada halaman dan query, profil hanya
  lihat untuk Sourcing, serta guard handler/tombol CRUD master. Lokasi tetap lewat
  komponen/RPC existing, tidak menulis alamat master dari form lokasi.
- `src/pages/vendor/VendorDashboardPage.jsx`: tautan Vendor Aktif selaras sidebar/route.
- `scripts/test-sourcing-active-vendors.mjs`: pengujian integrasi khusus Docker loopback.

## Verifikasi

**22/22 kelompok pemeriksaan PASS**, [bukti JSON](sourcing-active-vendors-evidence/RESULTS.json).

- Sourcing: menu, tautan dashboard, URL langsung/reload, pencarian dan profil hanya lihat.
- Field profil nonaktif, tombol CRUD/simpan hilang, submit yang dipicu melalui DOM
  tidak mengirim request tulis master.
- vendors ON bekerja walaupun vendor_management OFF; vendor_map OFF menghilangkan
  kontrol lokasi dan tidak memicu query kandidat/lokasi dari halaman master.
- vendors OFF menutup sidebar, tautan dashboard dan URL langsung Sourcing/HRD.
- Direksi, Finance, Pelaksana tetap ditolak walaupun modul vendors diberi true dalam fixture.
- Akun Sourcing PENDING ditolak sebelum halaman vendor diakses.
- Browser Sourcing menyimpan lokasi pertama melalui RPC retrofit existing dan
  mengubah koordinat nyata di Docker; master tetap identik. Kontrol verifikasi tidak muncul.
- Buka/batal form lokasi tidak membuat kandidat terhubung.
- Super Admin dan HRD tetap dapat tambah/edit/hapus fixture melalui browser;
  bypass module Super Admin tetap berlaku.
- Mobile 390px: menu dan dialog profil tanpa overflow. [Profil](sourcing-active-vendors-evidence/sourcing-profile-mobile.png),
  [menu](sourcing-active-vendors-evidence/sourcing-menu-mobile.png).
- Nol pageerror dan nol request tulis master oleh Sourcing; request ke host produksi diblokir.
- Tujuh akun sementara dibersihkan; checksum **14 tabel**, termasuk Auth users/identities,
  dan metadata RLS vendor kembali identik.

Fixture lama Docker mempunyai RLS vendors nonaktif dan hanya policy baca. Untuk
memeriksa aturan tulis produksi, test membuat policy writer dengan helper
`is_app_role(['super_admin','hrd'])` dan mengaktifkan RLS **hanya dalam transaksi
yang selalu di-ROLLBACK**. Sourcing gagal INSERT dan memengaruhi nol baris pada
UPDATE/DELETE; HRD/Super Admin dapat menulis. Ini simulasi lokal aturan role,
bukan pemeriksaan ulang policy produksi. Browser memakai API Auth/PostgREST Docker nyata;
switch module disimulasikan pada respons role_permissions agar izin produksi tidak diubah.

Run awal menemukan kode fixture CRUD melebihi batas varchar(20). Kode fixture
dipendekkan; run final seluruhnya PASS. Tidak perlu perubahan batas kolom aplikasi.

`npm run build` **exit 0**, 1585 modul; warning bundle utama existing >500 kB tetap ada.
Hash build dan sumber: [VERIFICATION_SUMMARY.json](sourcing-active-vendors-evidence/VERIFICATION_SUMMARY.json).

## Rilis

Tidak ada akses/penulisan DB produksi, perubahan RLS produksi, migration, push Git,
atau deployment untuk perbaikan ini. Data bisnis existing tidak disentuh.
Perubahan dapat dirilis sebagai frontend saja setelah persetujuan deployment.
Rilis harus memakai prosedur prebuilt dengan validasi public config Supabase,
karena environment cloud Vercel masih memiliki placeholder sebagaimana laporan rilis sebelumnya.

Sesudah rilis: login Sourcing dengan vendors ON, buka Vendor Aktif dari sidebar
dan URL, periksa profil hanya lihat dan lokasi sesuai vendor_map. Uji vendors OFF
setelah login ulang/reload izin. Refresh sesi diperlukan bila izin baru saja diubah;
sinkronisasi cache permission antar sesi bukan bagian perbaikan ini.
