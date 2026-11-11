# Acuan sampel dari katalog Ofissio — 11 November 2026

**Implementasi lokal selesai; belum migration, deploy Edge Function/frontend, atau push.**
User memilih satu koneksi **Ofissio**, karena produk Sasienala juga tersedia di
katalog tersebut. Input manual untuk pesanan klien Harmas tetap tersedia.
Persetujuan rilis Fase 4/5 sebelumnya sudah dikonsumsi dan tidak dipakai untuk
merilis penyempurnaan ini.

## Alur penggunaan

1. Pengujian Sampel → Tambah Sampel → sumber **Katalog Ofissio (termasuk Sasienala)**.
2. Cari kode/nama, pilih kartu produk dengan foto, nama, SKU dan bahan.
3. Kode produk terisi dan terkunci; isi vendor, jenis pekerjaan, brief, warna/
   ukuran, penyedia bahan, jumlah, PIC dan tanggal. Harga toko tidak otomatis
   menjadi biaya sampel.
4. Simpan: backend memeriksa ulang produk dari API, mengunduh foto publik,
   memeriksa host/MIME/signature/ukuran, menghitung SHA-256, lalu menyimpan salinan
   privat. Sampel + acuan + audit dibuat dalam satu transaksi database.
5. Detail sampel dan form QC menampilkan salinan foto/informasi acuan. Perubahan
   katalog toko tidak mengubah acuan lama. Tombol produk mengarah ke versi toko
   saat ini dan dibedakan dari foto tersimpan.

Acuan bersifat permanen sejak sampel dibuat. Produk berbeda memakai sampel
terkait baru. Pada sampel terkait, pilihan katalog dilakukan kembali secara
eksplisit; sistem tidak diam-diam mengganti atau menyalin acuan lama sebagai
produk terbaru. Brief tetap mengikuti kunci QC existing.

## Katalog live yang terverifikasi

- `GET https://ofissio.com/api/catalog/search?q=KS-003` → HTTP 200,
  `wc-462`, Kemeja Safety KS-003, American Drill, URL foto WebP publik.
- Foto KS-003 → HTTP 200, **86.460 byte**, signature WebP valid.
- `GET https://ofissio.com/api/catalog/search?q=SN` → HTTP 200, **7 produk SN
  Basic** yang lolos normalisasi, seluruh foto pada `woo.ofissio.com`.
- API live lebih baru daripada clone Ofissio lokal `5eee041`: field `mainImage`
  dan `material` sudah tersedia live. Tidak mengubah atau fetch/push repository
  Ofissio. Tidak memerlukan API key Ofissio untuk endpoint publik saat pemeriksaan.
- Endpoint belum mengirim pilihan varian/size chart. Warna/ukuran/detail pekerjaan
  tetap di brief. Pencarian dibatasi hingga 12 hasil; gunakan kode/nama spesifik.

[Bukti GET read-only](ofissio-catalog-evidence/PUBLIC_READONLY_PROBE.json).
Probe tidak membaca `.env`, tidak memakai kredensial, tidak mengakses database,
dan tidak menulis ke Ofissio. Foto publik disimpan sebagai fixture pengujian.

## File dan backend

| File | Perubahan |
| --- | --- |
| `src/components/vendor/OfissioProductPicker.jsx` | Pencarian, kartu foto, pemilihan, loading/empty/error |
| `src/components/vendor/SampleProductReference.jsx` | Foto privat signed URL, waktu salinan dan tautan toko |
| `src/lib/vendor-product-catalog.js` | Invoke fungsi, pembuatan sampel dan pembacaan acuan |
| `SampleFormModal.jsx` | Pilihan manual/katalog, SKU terkunci, request ID tetap untuk retry |
| `SampleDetailModal.jsx`, `SampleQCModal.jsx` | Acuan tersimpan pada detail/edit/QC |
| `supabase/functions/vendor-ofissio-catalog/index.ts`, `handler.js` | Backend terautentikasi, GET katalog/foto, validasi, Storage dan RPC |
| `scripts/test-vendor-ofissio-catalog.mjs` | Uji database/Auth/Storage/handler/browser di Docker tetap |
| `scripts/probe-ofissio-public-catalog.mjs` | Probe GET publik dan fixture foto |
| `test-fixtures/vendor-ofissio/ks-003.webp` | Foto publik untuk pengujian offline |

Migration baru:
[202611110003_vendor_sample_ofissio_references.sql](../../supabase/migrations/202611110003_vendor_sample_ofissio_references.sql).
Rollback terpisah:
[202611110003_vendor_sample_ofissio_references_rollback.sql](../../supabase/rollbacks/202611110003_vendor_sample_ofissio_references_rollback.sql).
Hash dan ringkasan build terdapat pada
[BUILD_AND_REVIEW.json](ofissio-catalog-evidence/BUILD_AND_REVIEW.json).

Migration additive membuat satu tabel `vendor_sample_product_references`, empat
fungsi, dua trigger baru, satu policy tabel dan lima policy khusus bucket baru
`vendor-product-references`. Tidak mengubah view/fungsi/policy Fase 1–5, tidak
mengubah tabel master, dan tidak mengisi sampel/referensi existing. Trigger baru
di `vendor_samples` hanya mengunci SKU jika sampel mempunyai acuan katalog.

## Keamanan dan audit

- Browser memanggil Edge Function; credential backend berasal dari environment
  standar Supabase. Tidak ada service key di frontend/kode/dokumen.
- Handler memvalidasi token melalui Auth `getUser`, profil ACTIVE, role dan izin
  `vendor_samples`. Sourcing/HRD/Super Admin dapat membuat; Direksi hanya mencari/
  membaca. Database kembali mengecek aktor aktif/izin saat RPC berjalan.
- RPC pembuatan hanya dapat dieksekusi service role. Klien tidak mengirim nama,
  bahan, URL foto, hash atau aktor untuk dipercaya sebagai data katalog.
- Hanya ID produk WooCommerce (`wc-*`) dari respons aktual diterima. Mock/demo,
  URL di luar host publik yang diizinkan, redirect, SVG, MIME/signature salah,
  dan foto >5 MB ditolak. URL fetch tidak berasal dari input browser.
- Tabel acuan tidak memberi INSERT/UPDATE/DELETE maupun privilege administratif
  kepada authenticated. RLS SELECT mengikuti empat role vendor aktif, memakai
  helper `is_app_role` existing tanpa policy yang membaca tabelnya sendiri.
- Foto privat hanya dapat dibaca melalui referensi yang sudah tersimpan. Policy
  restrictive menolak upload/update/delete klien, meskipun ada policy Storage
  umum lain. Signed URL berlaku 10 menit dan dapat diperbarui dari UI.
- Baris acuan tidak dapat diubah/dihapus, termasuk lewat DML service role.
  Audit umum menyimpan kode sampel/produk, sumber, hash dan waktu saja; payload
  permintaan dan path privat tidak disalin ke feed umum.
- ID permintaan tetap, perbandingan payload dan advisory lock mencegah duplikasi
  saat retry/concurrency. Jika respons RPC hilang setelah COMMIT, retry menemukan
  sampel/foto yang sama, tanpa menghapus file tersimpan.
- Fungsi checklist/keputusan/aktivasi tidak diubah. Acuan dibuat atomik bersama
  sampel dan permanen; basis Fase 5 tetap terikat sample ID/updated_at dan hasil QC.
  Lulus QC tidak otomatis menyetujui/mengaktifkan kandidat.

## Bukti pengujian

| Pengujian | Hasil |
| --- | --- |
| Integrasi baru, Docker + handler + browser | **40/40** (31 database/API + 9 browser) |
| Regresi Fase 4 | **75/75** |
| Regresi Fase 5 | **69/69** |
| Build Vite/PWA | Lulus; warning bundle utama >500 kB existing masih ada |
| GET publik KS-003, foto, pencarian SN | HTTP 200, tanpa autentikasi |

[Hasil integrasi](ofissio-catalog-evidence/RESULTS.json),
[regresi Fase 4](ofissio-catalog-evidence/regression-phase4/RESULTS.json),
[regresi Fase 5](ofissio-catalog-evidence/regression-phase5/RESULTS.json),
[desktop](ofissio-catalog-evidence/picker-desktop.png),
[mobile terang](ofissio-catalog-evidence/reference-mobile.png),
[computed style terang](ofissio-catalog-evidence/LIGHT_STYLES.json).

Pengujian mencakup RLS per role, izin modul, anon/token palsu/nonaktif, acuan
permanen, kode terkunci, QC nyata, basis approval, idempotensi/concurrency,
respons hilang sesudah COMMIT, kegagalan transaksi, orphan tidak terbaca,
Storage privat/tidak dapat ditimpa, kegagalan API/gambar, rollback dan manual
Harmas. Handler memakai Auth/PostgREST/Storage lokal sebenarnya. Respons upstream
Ofissio diinjeksi dari fixture agar uji gagal/rollback tidak memakai layanan live.
Browser meneruskan invoke ke handler yang sama; permissions tidak dimock.
Font eksternal bawaan direspons CSS kosong lokal, foto preview memakai fixture.

Target selalu `127.0.0.1:54321`, container `supabase_db_harmas-vendor-test`, Vite
`envFile:false`. Tujuh akun fixture per run dibersihkan. Checksum 17 tabel baseline,
fungsi/ACL/policy kembali identik; helper/guard Fase 1–5 juga dibandingkan setelah
migration baru. Tidak ada koneksi/penulisan Supabase produksi pada implementasi ini.
Uji clone restore produksi terbaru dan UAT Edge gateway produksi belum dilakukan.

Untuk mengulang: set `PLAYWRIGHT_PACKAGE_PATH` ke modul Playwright lokal, lalu
`node scripts/test-vendor-ofissio-catalog.mjs`. Skrip menolak instalasi Fase 4/5
existing pada stack uji; jangan arahkan harness ke produksi. Checkpoint fixture
tanpa password/token disimpan privat di `.vercel/ofissio-test-state.json`.

## Kendala dan batasan

- Parser SQL ekspresi path diperbaiki saat uji lokal; transaksi gagal dibatalkan.
  Harness awal juga diperbaiki agar font existing tidak dihitung sebagai request
  produksi dan tema terang ditunggu selesai transisinya sebelum screenshot.
- Satu run sempat berhenti saat cleanup akhir; tepat tujuh akun/profil fixture
  serta resource kosong milik run tersebut dibersihkan lokal. Pengujian diulang
  dengan checkpoint dan log privat sampai baseline final terverifikasi.
- Pengunduhan foto dan transaksi database merupakan dua layanan. Jika validasi
  database gagal setelah upload, file staging dapat tersisa, tetapi tidak terbaca
  oleh akun aplikasi. Tidak otomatis menghapusnya karena hasil COMMIT bisa belum
  pasti. Pembersihan orphan memerlukan inventaris referensi dan review tersendiri.
- Throttle 30 pencarian/6 pembuatan per menit per pengguna berlaku per instance
  handler; belum rate limiter terdistribusi. Tidak ada sinkronisasi terjadwal.
- Preview katalog memerlukan koneksi Ofissio. Foto tersimpan tetap berasal dari
  Storage HARMAS. Integrasi menggunakan kuota Functions/Storage/transfer paket
  Supabase yang tersedia; tidak menjanjikan pemakaian tanpa batas.
- Katalog yang tidak mempunyai foto valid tidak ditawarkan oleh picker. Produk
  dengan identitas ID/SKU yang berubah/hilang saat simpan ditolak; staf mencari
  ulang. Nama/bahan/foto mengikuti versi katalog saat penyimpanan, bukan dikunci
  sejak hasil pencarian. Tidak mengubah produk, stok, pesanan atau harga di Ofissio.

## Rencana rilis — masih menunggu persetujuan

1. Preflight produksi **read-only terbaru**: Fase 4/5 telah terpasang, hash/ACL/
   RLS/policy/trigger existing, belum ada objek `202611110003`, kondisi bucket.
2. Backup database dan Storage terbaru; verifikasi checksum/restore ke clone
   terisolasi, uji migration baru/rollback pada clone dan pembanding data existing.
3. **Persetujuan migration `202611110003` terpisah**; setelah COMMIT, verifikasi
   data/guard existing tetap utuh, tabel acuan kosong, bucket privat dan hak baru.
4. **Persetujuan deploy backend + frontend**. Deploy dengan nama persis
   `vendor-ofissio-catalog` (bukan nama otomatis Dashboard). Sertakan `index.ts`
   dan `handler.js`. Gunakan reserved environment Supabase standar; tidak meminta
   key WooCommerce atau mengambil service key legacy. Pertahankan verifikasi JWT
   gateway dan uji kompatibilitas token login aktual sebelum promosi frontend.
5. Uji anonim ditolak, Sourcing berizin dapat mencari KS-003/SN; UI lama/manual
   tetap berfungsi. Pembuatan sampel/QC produksi hanya pada data/cakupan yang
   disepakati pengguna. Periksa PWA, desktop/mobile, role dan akses foto privat.
6. Push Git tetap memerlukan izin tersendiri.

Rollback manual menolak jika tabel acuan atau bucket masih berisi. Jangan
menghapus bukti/audit hanya untuk melewati guard. Setelah inventaris/ekspor dan
rencana pemulihan disetujui, rollback hanya menghapus objek tambahan; sampel,
QC, keputusan dan master tetap dipertahankan. Bucket kosong sengaja ditinggalkan
dan hanya dihapus lewat Storage API/Dashboard setelah review.
