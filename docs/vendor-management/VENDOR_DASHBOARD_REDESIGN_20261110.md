# Dashboard Vendor: ringkasan operasional dan sourcing

Status 10 November 2026: **implementasi lokal selesai, belum di-deploy**.
User memilih implementasi lokal tanpa ekspor source ke Superdesign. Database produksi,
Git remote, environment cloud dan deployment aktif tidak diakses/diubah pada pekerjaan ini.

**Pembaruan kartu sesuai screenshot user:** kartu KPI kini memakai pola dashboard
utama HARMAS: ikon kiri atas, tint biru/hijau/rose/amber, label uppercase, nilai besar,
badge, progres GPS dan grafik mini komposisi jenis vendor (bukan tren waktu).
Header dan tanggal mengikuti pola dashboard utama. Definisi angka dan izin tetap.
**15/15 browser terbaru lulus**, build exit 0; 12 checksum Docker kembali identik.
Masalah paint kartu saat scroll mobile telah diperbaiki dan diverifikasi ulang.
[Pratinjau light](dashboard-cards-evidence/dashboard-reference-size.png),
[kartu](dashboard-cards-evidence/vendor-cards-light.png),
[bukti terbaru](dashboard-cards-evidence/VERIFICATION_SUMMARY.json),
[QA visual](../../design-qa.md). Belum deploy/push atau mengakses produksi.

## Perilaku

Dashboard `/vendor` kini membuka tab **Ringkasan operasional**:

- Kartu vendor aktif, vendor terpetakan, lokasi belum lengkap, aset di vendor aktif.
- Diagram cakupan GPS, jumlah fasilitas ber-GPS, lokasi utama lengkap/terverifikasi.
- Grafik komposisi jenis vendor dan daftar vendor yang perlu perhatian.
- Ringkasan calon vendor, tugas terbuka dan terlambat; tautan ke halaman terkait.
- Tab **Sourcing** mempertahankan KPI, filter kategori/PIC, prioritas, tahap proses,
  produktivitas PIC dan keterangan sampel/QC Fase 4.
- Tema dark/light mengikuti token aplikasi; mobile 390px tanpa overflow halaman.
  Tabel dapat digulir di dalam kartu; tab mendukung keyboard panah/Home/End.

**Calon Vendor** menyimpan profil dan tahap kualifikasi. **Follow-Up Vendor**
menyimpan aktivitas komunikasi serta tugas tindak lanjut. Satu profil dapat memiliki
banyak aktivitas; aktivitas dan tugas tidak dianggap sebagai jumlah vendor.

## Definisi angka

| Indikator | Sumber dan aturan |
|---|---|
| Vendor aktif | Master `vendors.is_active=true`, unik menurut ID; termasuk yang belum mempunyai profil lokasi |
| Sudah dipetakan | ID master aktif dengan minimal satu fasilitas ber-GPS; banyak fasilitas/profil tidak menggandakan vendor |
| Lokasi belum lengkap | Master aktif tanpa satu profil dengan lokasi utama lengkap menurut view Fase 3: alamat, kota, provinsi, GPS, foto EXTERIOR aktif |
| Lokasi terverifikasi | Master aktif dengan lokasi utama lengkap sekaligus terverifikasi pada profil yang sama |
| Titik fasilitas | ID lokasi ber-GPS yang unik milik master aktif; satuannya titik, bukan vendor |
| Aset di vendor aktif | Exact count relasi `assets.vendor_id` ke master aktif; bukan nilai aset atau skor kinerja |
| Sebaran jenis | Master aktif; label jenis legacy dan enum yang sama digabung untuk tampilan, tanpa mengubah data |
| Calon vendor pada ringkasan | Exact count profil `vendor_candidates.vendor_id IS NULL`; profil terhubung tidak ditambahkan sebagai calon baru |
| Tugas terbuka/terlambat | RPC Fase 2 sepanjang riwayat, seluruh profil pipeline termasuk profil terhubung; unit tugas |

Tab Sourcing memakai cakupan RPC existing (seluruh profil termasuk vendor terhubung),
sehingga kartu total diberi label **Total profil unik**. Filter tab tersebut tidak
mengubah ringkasan operasional. Jumlah vendor unik per PIC tidak boleh dijumlahkan
menjadi total vendor unik lintas PIC.

Query daftar dipaginasi 500 baris, dibuktikan melampaui 1.000 baris. Exact count aset
memakai kelompok ID maksimum 200, tanpa memotong hasil pada batas respons API.
Gagal memuat lokasi/aset tidak menyembunyikan total master atau menampilkan nol palsu;
angka yang tidak tersedia ditampilkan `—` dengan keterangan/retry.

## Akses dan keamanan

- Guard route, halaman, module key `vendor_management`, dan RLS existing dipertahankan.
- Ringkasan dapat dibaca role vendor berizin: Super Admin, HRD, Sourcing, Direksi.
- Tautan master `/vendors` tetap hanya SA/HRD dengan key `vendors`; Sourcing/Direksi
  tidak mendapat akses edit master baru.
- Query lokasi hanya jika memiliki `vendor_map`; query aset hanya jika memiliki `assets`.
- Semua query baru read-only. Tidak ada migration, rollback SQL, perubahan schema,
  policy, fungsi, role, data master atau kredensial produksi.
- Reminder existing tetap dapat menulis notifikasi ketika monitoring dibuka/Refresh
  oleh role berizin. Tidak ditambah scheduler atau mekanisme notifikasi baru;
  deduplikasi RPC existing tetap berlaku. Dalam uji dashboard baca, reminder di-mock;
  regresi Fase 2 menguji reminder nyata serentak di Docker dan menghasilkan satu notifikasi.

## File implementasi dan uji

| File | Perubahan |
|---|---|
| `src/pages/vendor/VendorDashboardPage.jsx` | Dashboard operasional, tab, ringkasan, permission dan error terpisah |
| `src/components/vendor/VendorSourcingPanel.jsx` | Memindahkan monitoring sourcing existing ke panel terpisah/lazy load |
| `src/lib/vendor-dashboard-helpers.js` | Pagination, exact counts, pemisahan kegagalan dan akses query |
| `src/lib/vendor-dashboard-utils.js` | Agregasi unik master/fasilitas, status lokasi, normalisasi jenis hanya untuk tampilan |
| `scripts/test-vendor-dashboard-{utils,queries,browser}.mjs` | Uji agregasi, kontrak query, browser Docker |
| `scripts/test-vendor-phase2-browser.mjs` | Memilih tab Sourcing sebelum assertion existing, label total profil, folder bukti opsional |
| `scripts/test-vendor-navigation-browser.mjs` | Folder bukti opsional agar regresi tidak menimpa bukti rilis historis |
| `scripts/test-vendor-phase3-browser.mjs` | Assertion sourcing memilih tab baru; suite penuh tidak diulang untuk perubahan ini |
| `scripts/test-vendor-phase3-split-release-browser.mjs` | Assertion sourcing memilih tab baru; suite penuh tidak diulang untuk perubahan ini |
| `.gitignore` | Mengabaikan `.superdesign/tmp/` untuk konteks/pratinjau lokal sementara |

Bukti baru berada di [`dashboard-evidence/`](dashboard-evidence/).
Pratinjau awal sintetis (sebelum implementasi) berada di `design-evidence/`.
Folder `.superdesign/` dan skrip finance untracked sudah ada sebelum pekerjaan ini;
jangan memasukkannya sebagai perubahan aplikasi atau merilisnya tanpa review tersendiri.

## Verifikasi dasar sebelum penyempurnaan kartu

| Kelompok | Hasil | Bukti |
|---|---|---|
| Agregasi | 9/9 PASS | [UTILS_RESULTS.json](dashboard-evidence/UTILS_RESULTS.json) |
| Kontrak query/pagination >1.000 | 6/6 PASS | [QUERIES_RESULTS.json](dashboard-evidence/QUERIES_RESULTS.json) |
| Browser dashboard | 14/14 PASS | [BROWSER_RESULTS.json](dashboard-evidence/BROWSER_RESULTS.json) |
| Regresi CRUD follow-up, reminder, audit, role | 20/20 PASS | [BROWSER_RESULTS.txt](dashboard-evidence/regression-phase2/BROWSER_RESULTS.txt) |
| Regresi navigasi, master, akses role | 7/7 PASS | [VENDOR_NAVIGATION_BROWSER_RESULTS.json](dashboard-evidence/regression-navigation/VENDOR_NAVIGATION_BROWSER_RESULTS.json) |
| Build | PASS (exit 0) | [VERIFICATION_SUMMARY.json](dashboard-evidence/VERIFICATION_SUMMARY.json) |

Total **56/56** pemeriksaan lulus. Build menyisakan peringatan ukuran bundle utama
existing >500 kB. Panel sourcing baru sudah di-lazy-load; perombakan bundle global
di luar ruang lingkup perubahan ini.

Alur diuji: browser `/vendor` → Supabase REST/RPC loopback → tabel/view/RLS Docker →
angka dan tautan dashboard. Fixture dashboard mencakup master aktif tanpa profil,
master dengan dua fasilitas, master nonaktif ber-GPS, profil calon tanpa master,
dan relasi aset. Setelah cleanup, checksum **12 tabel** kembali identik. Regresi
follow-up dan navigasi masing-masing juga membuktikan enam checksum baseline utuh.
Nol pageerror, nol write bisnis dari browser dashboard, dan nol request ke Supabase
produksi. Simulasi penolakan query lokasi/izin modul diuji di browser; backend lokasi
pending serta kegagalan master/aset/jumlah kandidat diuji pada kontrak query.

Screenshot memakai data sintetis Docker, **bukan angka produksi**:
[desktop](dashboard-evidence/dashboard-desktop.png),
[mobile](dashboard-evidence/dashboard-mobile.png),
[light](dashboard-evidence/dashboard-light.png).
Tidak ada pengujian login/CRUD baru di produksi pada pekerjaan ini.

## Rilis berikutnya

Perubahan frontend siap ditinjau. Deployment/push belum dijalankan dan memerlukan
persetujuan tersendiri. Tidak diperlukan migration atau rollback database.
Jika deployment disetujui, ikuti prosedur build/env/artifact rilis terintegrasi
existing; environment cloud pernah berisi placeholder sehingga jangan mengandalkan
remote build tanpa validasi (lihat laporan rilis 10 November).

Setelah rilis: verifikasi artifact pada domain utama, login SA dan Sourcing/Direksi,
bandingkan total aktif dengan master, periksa GPS/fasilitas/aset, buka tab Sourcing,
uji filter/prioritas, dan pastikan master/koordinat/Follow-Up/Peta tetap dapat dipakai.
Penulisan data bisnis tetap dilakukan pengguna operasional berizin. Rollback frontend
dapat memakai deployment sebelumnya; jangan mengubah backend untuk rollback tampilan.
