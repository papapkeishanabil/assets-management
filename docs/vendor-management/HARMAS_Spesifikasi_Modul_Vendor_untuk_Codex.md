# HARMAS ASSET MANAGEMENT — Spesifikasi Implementasi Modul Manajemen Vendor

**Versi:** 1.0 · **Tanggal rancangan:** 3 November 2026  
**Tujuan:** menambah modul pencarian, kualifikasi, survei lokasi, sampling, QC, persetujuan, dan aktivasi vendor tanpa merusak fungsi **Master Data → Vendor** yang sudah digunakan untuk vendor aktif.

> **Instruksi ke Codex:** Laksanakan pekerjaan ini di repositori HARMAS Asset Management yang benar. Sebelum mengubah kode, audit struktur project, sistem autentikasi/RBAC, tabel vendor existing, tabel relasi modul lain, penyimpanan file, migrasi database, dan implementasi Google Maps yang mungkin sudah ada. Jangan mengasumsikan tech stack dari nama aplikasi atau menciptakan database kedua tanpa memeriksa skema. Lakukan implementasi modular bertahap dengan migration aman, pengujian, dan laporan file/fitur yang berubah. Jangan deploy ke production tanpa persetujuan.

## 1. Target Tampilan & Navigasi

Pertahankan look-and-feel saat ini: sidebar putih, header/breadcrumb, card metrik berwarna lembut, tipografi rapi, tabel/filter, dan aksen biru HARMAS. Jadikan file `HARMAS_Manajemen_Vendor_Preview.html` sebagai **referensi UX/visual**, bukan sumber data atau kode yang harus disalin mentah.

Tambahkan grup di sidebar **MANAJEMEN VENDOR** dengan halaman:

1. **Dashboard Vendor:** angka total, lead baru, perlu follow-up, overdue, sampel berjalan, menunggu QC, hasil QC, menunggu approval, approved/cadangan/ditolak, data lokasi belum lengkap; filter per kategori dan PIC.
2. **Database Calon Vendor:** tabel searchable/sortable/pagination, tambah/edit profil, status, lokasi, kategori, dan owner, impor ekspor jika aman.
3. **Detail Vendor:** tab Profil, Follow-Up, Sampel, QC, Lokasi & Foto, Harga/Penawaran, Keputusan, Riwayat.
4. **Follow-Up & Aktivitas:** log append-only per vendor dengan tanggal, PIC, media, hasil komunikasi, next action, deadline, dan lampiran.
5. **Pengujian Sampel:** spesifikasi/order sampel, bahan disediakan, qty, status, tanggal penugasan/target/tanggal diterima, bukti file/foto, revisi berulang.
6. **QC & Evaluasi:** form QC dinamis berdasarkan kategori vendor, skor, dokumentasi temuan/foto, keputusan lulus/revisi/tidak lulus, QC ulang dan audit setiap putaran.
7. **Peta Lokasi Vendor:** peta **Google Maps** internal dengan pin dari database; filter, marker detail, foto, dan rute. Dapat menampilkan **semua calon maupun vendor aktif** sesuai akses pengguna dan pilihan filter.
8. **Persetujuan Vendor:** keputusan manajemen disetujui/cadangan/ditolak, dengan checklist kelengkapan dan audit.
9. **Kinerja Vendor:** tahap lanjutan untuk nilai kualitas order, keterlambatan, kapasitas, dan harga vendor aktif (jangan jadikan penghalang MVP).

## 2. Prinsip Data Penting

- **Identitas vendor tunggal:** vendor yang kemudian aktif tidak boleh muncul sebagai dua entitas berbeda. Pertahankan mapping / `vendor_id` konsisten. Periksa vendor master existing sebelum menentukan apakah calon vendor disimpan di master dengan status atau di tabel prospect khusus dengan relasi idempotent ke master.
- **Tiga dimensi status berbeda:**
  - `process_stage`: `LEAD`, `CONTACTING`, `PROFILE_VERIFICATION`, `SITE_VERIFICATION`, `SAMPLE_ASSIGNED`, `SAMPLE_IN_PROGRESS`, `SAMPLE_RECEIVED`, `QC_REVIEW`, `SAMPLE_REVISION`, `AWAITING_APPROVAL`, `CLOSED`.
  - `qualification_status`: `PROSPECT`, `UNDER_EVALUATION`, `APPROVED`, `RESERVE`, `REJECTED`.
  - `operational_status`: `NOT_ACTIVE`, `ACTIVE`, `SUSPENDED`, `INACTIVE`.
- Lulus QC **tidak otomatis** disetujui; disetujui **tidak otomatis** aktif. Aktivasi vendor ke sistem operasional existing melalui tindakan eksplisit yang dapat diaudit.
- Semua perubahan penting menyimpan `actor_user_id`, `timestamp`, sumber perubahan, alasan, old/new values yang aman, dan foreign key entity. Riwayat follow-up/QC/keputusan tidak boleh terhapus saat edit profil.
- Search by nama, nomor kontak, kategori, spesialisasi, wilayah, PIC, status, kesiapan lokasi. Pertimbangkan deteksi duplikat nama + nomor telepon + alamat.

## 3. Kategori & Kriteria Vendor

Kategori awal: Jahit, Bordir, Supplier Kain, Pabrik Kain, Cutting, Sablon/Printing, Finishing, Packing, Lainnya. Daftar dikendalikan administrator.

Setiap vendor mempunyai banyak spesialisasi: misal vendor Jahit → `Kemeja Kantor`, `Kemeja Lapangan`, `Celana`, `Jaket`, `Wearpack`, `Rompi`; vendor Bordir → `Bordir Komputer`, `Patch/Emblem`, `Bordir Nama`; supplier/pabrik → kategori kain dan kemampuan supply. Nama spesialisasi juga master data yang dapat dikembangkan.

Profil mencakup nama usaha/perorangan, nama & telepon PIC vendor, WhatsApp, kategori, kapasitas, mesin, tenaga kerja, harga indikatif, minimum order, lead time, payment term, area layanan, sumber lead, PIC internal, catatan, dokumen pendukung.

## 4. Modul Lokasi Vendor & Foto Fisik — **WAJIB**

Ini adalah kebutuhan utama pengguna. Lokasi harus menjadi **entitas terstruktur yang terhubung ke vendor**, tidak hanya kolom alamat di profil. Satu vendor dapat mempunyai banyak titik: rumah produksi, workshop, pabrik, gudang, toko, kantor, lokasi cabang.

**Data per lokasi (`vendor_locations` atau padanan skema existing):**

| Field | Aturan |
|---|---|
| `id`, `vendor_id` | PK dan FK ke vendor canonical |
| `location_name` | Contoh: Workshop Utama / Gudang Bahan |
| `location_type` | Rumah Produksi, Workshop Jahit, Workshop Bordir, Pabrik, Gudang, Toko, Kantor, Lainnya |
| `is_primary` | Tepat satu lokasi utama per vendor bila ada lokasi |
| `address_line`, `village`, `district`, `city`, `province`, `postal_code` | Alamat teks; pecah sesuai kebutuhan UI |
| `latitude`, `longitude` | **DECIMAL**, nullable saat lead baru; validasi -90..90 / -180..180; jangan dipaksakan `0,0` |
| `google_place_id` | Opsional; jangan wajibkan vendor harus terdaftar di Google Maps |
| `coordinate_source` | `MANUAL`, `PICK_ON_MAP`, `DEVICE_GPS`, `MAPS_LINK`, `GEOCODE` |
| `verification_status` | `UNVERIFIED`, `NEEDS_REVISIT`, `VERIFIED` |
| `verified_by`, `verified_at`, `verification_notes` | Audit lokasi |
| `created_by`, `updated_by`, `created_at`, `updated_at` | Audit umum |

**Foto lokasi (`vendor_location_photos`):** `id`, `vendor_location_id`, `storage_path`, `photo_type`, `caption`, `taken_at` jika benar-benar diketahui, `uploaded_by`, `uploaded_at`, `is_cover`, `sort_order`, `file_mime`, `file_size`. Contoh jenis: `EXTERIOR`, `ENTRANCE`, `PRODUCTION_AREA`, `MACHINES`, `WAREHOUSE`, `OTHER`. Foto lebih dari satu dan dapat diganti tanpa kehilangan histori penting; simpan lokasi file privat di storage existing atau mekanisme yang konsisten dengan aplikasi.

**Alur input lokasi di UI:**

1. Ketik/pilih alamat. Boleh cari tempat via Places Autocomplete jika diaktifkan; jangan bergantung pada Autocomplete untuk rumah produksi yang tidak terdaftar.
2. Dapat menempel koordinat langsung (`-7.0, 107.7`), tempel URL Maps berisi koordinat (parse aman yang mendukung pola umum; untuk shortlink yang tak dapat diurai jangan mengarang koordinat), pilih pin pada peta, atau tekan **Ambil Lokasi Saya** saat karyawan survei fisik.
3. Tampilkan preview peta Google yang dapat digeser; penggeseran titik hanya dilakukan dalam mode edit dan perubahan dicatat.
4. Unggah minimal satu **foto asli tampak luar** tempat kerja; sebaiknya juga bagian produksi, mesin, bahan dan fasilitas. Perlihatkan thumbnail, jenis foto, siapa yang unggah, tanggal, dan preview besar. Foto tidak otomatis dianggap sebagai bukti GPS yang sah.
5. Tampilkan badge **Data Lokasi Belum Lengkap**, **Koordinat Belum Diverifikasi**, atau **Lokasi Terverifikasi**.
6. Sebelum status kelayakan menjadi `APPROVED`, **wajib** ada lokasi utama dengan latitude+longitude valid, minimal satu foto exterior riil, dan hasil verifikasi lokasi (sesuai kebijakan pimpinan). Jika diperlukan bypass, hanya role approver, dengan alasan tertulis serta audit log. Penginputan awal vendor tidak diblokir meski lokasi belum lengkap.
7. Pastikan alamat rumah pribadi, koordinat tepat, kontak dan foto hanya muncul pada UI internal bagi role yang diizinkan, tidak pada situs publik, response API anonim, atau file URL publik tanpa otorisasi.

**Halaman Peta Vendor (Google Maps):**

- Gunakan **Google Maps JavaScript API** dan `google.maps.marker.AdvancedMarkerElement` dengan Maps `mapId` yang disetel; muat library `marker` seperlunya. Jangan membuat marker lama deprecated pada pengembangan baru.
- Seluruh lokasi yang memiliki GPS ditampilkan sebagai pin, **bukan satu pin per vendor jika vendor punya banyak fasilitas**. Untuk jumlah besar, gunakan clustering / optimisasi marker dan fit bounds, dengan pagination atau query berbasis viewport bila perlu.
- Warna/icon pin membedakan kategori vendor atau status kelayakan (perlihatkan legenda). Filter: category, specialty, process stage, qualification, operational, PIC, city, verified/unverified, lokasi utama/semua.
- Klik pin → `InfoWindow`/panel: nama vendor, jenis fasilitas (Rumah/Workshop/Pabrik/Gudang/dll), alamat, foto utama, nomor telepon berizin, status, PIC, koordinat, tautan **Detail Vendor** dan **Buka Google Maps / Rute**.
- Vendor tanpa koordinat tidak dipetakan secara keliru; tampil pada daftar **Belum Dipetakan** dan dapat dibuka untuk dilengkapi.
- Peta bisa dicapai dari Dashboard, menu Peta Vendor, dan tab Detail Vendor. `Pin Lokasi` dari detail harus konsisten dengan data peta global.
- Tombol navigasi: `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>` atau Google Maps directions yang valid; escape parameter.
- Jika API gagal, peta menampilkan status error dan tombol retry; daftar vendor dan profil tetap dapat dipakai.

**Teknis Google Maps:**

- Buat konfigurasi Google Cloud untuk **Maps JavaScript API** dengan billing/kuota dan Map ID; implementasikan lazy loading dan tampilkan loading state.
- API key browser yang digunakan peta boleh dimuat sisi client sesuai mekanisme Google Maps, **tetapi wajib dibatasi HTTP referrer/domain HARMAS dan hanya API yang dipakai**. Jangan menganggap kunci browser sebagai rahasia server, dan jangan menaruh unrestricted key di Git.
- Jika menggunakan Geocoding API atau Places API (New), aktifkan hanya yang diperlukan serta gunakan kunci/restriksi yang tepat. Batasi kuota untuk mencegah biaya tidak terduga.
- Tinjau izin/persetujuan penggunaan Google Maps/Geocoding dan kebijakan lokasi/privasi aplikasi internal.

**Referensi resmi:**

- Advanced markers: https://developers.google.com/maps/documentation/javascript/advanced-markers/add-marker
- Google Maps JS API setup: https://developers.google.com/maps/documentation/javascript/get-api-key
- API security: https://developers.google.com/maps/api-security-best-practices
- Embed (untuk peta satu titik bila dibutuhkan): https://developers.google.com/maps/documentation/embed/embedding-map

## 5. Follow-Up dan Sampling

**Follow-Up:** tanggal/jam, vendor, PIC internal, metode komunikasi, hasil kontak, informasi baru, aksi berikutnya, deadline, status tugas, lampiran; tampilan timeline kronologis; reminder overdue. Catatan baru tidak menimpa yang lama.

**Sampling:** per sampel bisa ada berbagai item/putaran; kode sampel, jenis uji, kode produk (misalnya KK-006), techpack, spesifikasi/brief, bahan, qty, target, tanggal terima aktual, bukti, progres, nilai biaya sampel jika perlu. Satu vendor dapat memiliki banyak sampel dengan produk berbeda.

**QC:** setiap putaran terkait satu sampel, penilai QC, tanggal, parameter/rubrik master berdasarkan kategori, bobot opsional, skor, standar lulus, foto defect, catatan, keputusan Lulus/Revisi/Tidak Lulus, rencana perbaikan, due revisi. Hasil revisi memiliki putaran QC baru, menjaga histori dan tanggung jawab.

## 6. Arsitektur Data yang Direkomendasikan

Ini **bukan migrasi final**. Codex harus menyesuaikan skema existing:

```text
vendor_canonical (atau master vendor existing)
  ├── vendor_profiles / vendor_candidates (jika diperlukan)
  ├── vendor_contacts
  ├── vendor_specialties (M:N)
  ├── vendor_locations
  │     └── vendor_location_photos
  ├── vendor_followups
  ├── vendor_samples
  │     └── vendor_sample_qc_runs
  │            └── vendor_sample_qc_findings / qc_attachments
  ├── vendor_decisions
  ├── vendor_status_history
  └── vendor_audit_logs
```

- Index pada vendor ID/FK, status, next_followup_date, kategori, PIC, dan GPS. Gunakan geo-index bila teknologi database mendukung dan fitur radius benar-benar diperlukan.
- DB constraints menjaga maksimal satu lokasi utama; memastikan koordinat pasangan lat/lng lengkap dan valid; menjaga relasi foto ke lokasi.
- Pertahankan data existing dan performa; migrasi dapat di-rollback. **Backup/snapshot sebelum deploy production** dan verifikasi data sebelum/sesudah.
- API menegakkan RBAC di server, tidak hanya sembunyikan tombol frontend. Periksa authorization setiap operasi vendor, lokasi, foto, QC, dan keputusan. Validasi payload (Zod atau padanan sesuai stack).
- File upload: pemeriksaan ekstensi *dan* signature file, tipe JPG/PNG/WebP, batas ukuran yang wajar (mis. 5 MB), compression/thumbnail, path aman dan unik, private storage/signed URL terikat role, file size limits di backend, EXIF berisiko (hindari publikasi metadata GPS sensitif yang tidak diperlukan).
- Hindari penghapusan permanen rekam jejak; gunakan archive/soft-delete hanya bila sesuai kebijakan. Audit tanpa menyimpan rahasia.

## 7. Hak Akses

| Role | Akses inti |
|---|---|
| Sourcing / Vendor Resources | Tambah/edit calon vendor, follow-up, usul lokasi, unggah foto, input brief sampel |
| QC | Baca profil dan sample, input hasil QC dan foto temuan, tidak bisa approve vendor |
| Kepala Produksi / PPIC | Lihat evaluasi dan sampel, penjadwalan, usul vendor |
| Manajemen / Approver | Lihat semua, putuskan kelayakan, override beralasan, setujui aktivasi |
| Admin sistem | Kelola kategori, checklist, parameter QC, mapping master, akses teknis sesuai kebijakan |

Role existing harus digunakan/reused dan dicek implementasinya; jangan membuat role baru yang bertabrakan dengan RBAC saat ini.

## 8. Skenario Uji (Acceptance Criteria)

1. Saat calon vendor `Siti Maemunah` dibuat, muncul di Database Calon Vendor tanpa otomatis muncul sebagai vendor aktif.
2. Follow-up 1, 2, 3 tercatat dengan PIC, tanggal, hasil, dan next action yang berbeda, tidak saling menimpa.
3. Vendor dapat memiliki lokasi `Workshop Utama` serta `Gudang` dengan koordinat dan beberapa foto per lokasi; lokasi utama hanya satu.
4. Saat koordinat valid dan foto asli sudah tercatat, status kelengkapan lokasinya berubah; QC/approval tetap independen.
5. Vendor dengan lokasi tanpa koordinat tidak mempunyai pin, tetapi masuk daftar perlu dilengkapi.
6. Pada Peta Vendor, filter `Jahit` menampilkan hanya titik milik kategori Jahit; klik pin membuka foto fasad, kategori, status, lokasi, dan tautan Detail Vendor; tombol Google Maps mengarah ke titik yang sesuai.
7. GPS perangkat meminta izin browser dan tidak dipakai otomatis sebagai koordinat vendor tanpa tindakan petugas.
8. Sampel `KK-006` bisa mendapat QC `Revisi` lalu QC putaran kedua `Lulus`, dengan kedua hasil tetap tercatat.
9. Vendor **tidak bisa** menjadi approved jika tidak mempunyai lokasi utama berkoordinat, minimal satu foto exterior, dan verifikasi lokasi sesuai kebijakan; bypass manajemen bila memang disediakan harus mencatat alasan.
10. Vendor approved tidak otomatis tampil sebagai vendor aktif. Aktivasi eksplisit membuat hubungan ke master Vendor existing tanpa duplikat dan tidak memutus relasi order/aset sebelumnya.
11. Sourcing tidak bisa memanipulasi hasil QC final atau memberi keputusan approval; akses diuji juga langsung pada API.
12. Storage foto tidak dapat diakses tanpa otorisasi atau menggunakan URL publik yang permanen jika kebijakannya internal.
13. Migrasi tidak menghapus, menduplikasi, atau mengubah data vendor existing. Backup/migrasi rollback diverifikasi.
14. Tampilan responsif desktop/mobile, sidebar HARMAS tidak rusak, status loading/empty/error tersedia.
15. Jika Google Maps key/config tidak tersedia, aplikasi tetap bisa menampilkan tabel vendor dan informasi koordinat (fallback), dengan pesan konfigurasi yang jelas.

## 9. Urutan Pengerjaan yang Direkomendasikan

**Phase 0 — Audit:** jelaskan stack, skema vendor existing, RBAC, file storage, existing Maps/GIS; buat rencana migrasi dan daftar risiko. Jangan mulai migrasi sebelum mapping jelas.

**Phase 1 — Core Sourcing:** database calon vendor, master kategori & spesialisasi, detail vendor, status proses/kelayakan/operasional, follow-up timeline, dashboard dasar, pengujian RBAC.

**Phase 2 — Survei Lokasi & Maps:** multi-fasilitas, latitude/longitude, foto asli, upload aman, verifikasi, pin di Google Maps, panel informasi dan filter, navigasi.

**Phase 3 — Sampling, QC, Approval:** penugasan sampel, parameter QC, revisi bertingkat, persetujuan, audit dan activation mapping ke Vendor Aktif.

**Phase 4 — Kinerja Vendor:** KPI realisasi order, kualitas, keterlambatan, harga, grading kapasitas vendor, laporan.

**Hasil yang diharapkan dari Codex setiap fase:** daftar file yang diubah, perubahan database/migration, endpoint/API, RBAC, screenshot hasil (jika lingkungan memungkinkan), hasil test, kendala, daftar manual setup yang diperlukan, dan langkah rollback. Jangan mengaku sudah deploy sebelum dilakukan dan diverifikasi.

---

### Catatan penting mengenai preview

File HTML yang menyertai dokumen ini adalah **prototipe interaktif frontend dengan data simulasi**; marker/latar peta di preview bukan Google Maps live. Tombol **Buka Google Maps** hanya membuka koordinat contoh. Upload foto pada preview hanya ditampilkan dalam sesi browser dan **tidak tersimpan ke server**. Rancangan aplikasi sebenarnya harus memakai koordinat vendor yang telah diverifikasi, Google Maps JavaScript API, dan penyimpanan foto yang aman.
