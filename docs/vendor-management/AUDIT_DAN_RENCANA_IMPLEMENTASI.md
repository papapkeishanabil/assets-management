# Laporan Audit & Rencana Implementasi — Modul Manajemen Vendor

**Tanggal:** 3 November 2026 · **Status:** Menunggu persetujuan sebelum implementasi
**Referensi:** [Spesifikasi](HARMAS_Spesifikasi_Modul_Vendor_untuk_Codex.md) · [Prototipe HTML](HARMAS_Manajemen_Vendor_Preview.html) · 4 gambar referensi di folder ini · Excel `HARMAS_Database_Vendor_dan_Follow_Up_Final.xlsx` (di Downloads)

---

## A. Ringkasan Eksekutif

Aplikasi HARMAS Asset Management adalah **React 18 + Vite + Supabase (Postgres + Auth + Storage + RLS)** tanpa backend custom — semua akses data langsung dari client via supabase-js. Modul Manajemen Vendor **bisa dibangun penuh di atas arsitektur ini**, dengan tiga temuan utama yang memengaruhi desain:

1. **Tidak ada library maps sama sekali** — Google Maps harus dibangun dari nol (API key + Map ID + billing Google Cloud = setup manual oleh user, blocker untuk fase Peta).
2. **Role tidak punya "Sourcing" dan "QC"** — role yang ada hanya `super_admin, direksi, hrd, finance, pelaksana`. Kebutuhan spec butuh keputusan: tambah 2 role baru atau mapping ke existing (rekomendasi: tambah role baru, tidak bertabrakan — sistem role data-driven).
3. **Tabel `vendors` existing dipakai 16 aset** — modul baru TIDAK boleh menulis pipeline kualifikasi ke tabel ini. Solusi: tabel kandidat terpisah + aktivasi eksplisit yang baru mengisi `vendor_id` (identitas tunggal tetap terjaga).

Tidak ada perubahan kode/migrasi yang dilakukan pada tahap ini.

---

## B. Hasil Audit

### B.1 Stack & Arsitektur

| Komponen | Temuan |
|---|---|
| Framework | React 18 + Vite 5, react-router-dom v6 (App.jsx rute flat + ProtectedRoute) |
| Styling | Tailwind CSS 3 + tema **dark & light** (ThemeToggle), palet `ink/primary/warning/danger` kustom — prototipe ber-theme terang, jadi acuan UX saja, bukan CSS |
| Data | `@supabase/supabase-js` langsung dari client; **tanpa API layer** (satu-satunya Vercel function: `api/asset-qr.js`) |
| UI kit | lucide-react (ikon), react-hot-toast, modal & tabel manual (pola konsisten di semua page) |
| Lainnya | PWA (vite-plugin-pwa + service worker), qrcode, @dnd-kit, web push (VAPID) |
| Prod | Vercel `harmas-asset-management.vercel.app`; **DB produksi = DB yang dipakai lokal** (`uwlxkwyauxwewoexfgwi.supabase.co`) — migration wajib backup + idempotent |

### B.2 Vendor Existing (Master Data → Vendor)

**Tabel `vendors`** (schema-phase2.sql:55, terkonfirmasi di DB live):

```
id, vendor_code (unik), vendor_name, vendor_type, contact_person, whatsapp_number,
phone_number, email, address, city, tax_number, service_type, notes,
is_active, created_by, created_at, updated_at
```

- **10 baris, semuanya aktif** — 7 "Maklun Jahit" (VND-SEW1..8), TKN-BORDIR, ESC-COMP (Teknisi Komputer), Teknisi Mesin. Artinya: vendor jahit/bordir SUDAH dipakai operasional (aset mesin dipinjamkan ke vendor — lihat migration Kunjungan Vendor).
- **Direferensikan oleh:** `assets.vendor_id` (**16 aset**), `contracts.vendor_id` (0). Tidak boleh ada duplikasi entitas.
- **Halaman:** [VendorsPage.jsx](src/pages/VendorsPage.jsx) — CRUD modal sederhana + search + **hapus permanen** (confirm). Tidak menyentuh lokasi/GPS/foto.
- **RLS:** `Read master data` (semua authenticated boleh SELECT) + `Write vendors` (super_admin, hrd).
- **Module key:** `vendors` di `role_permissions` (sidebar Master Data).

### B.3 Role & Permission — 3 Lapis

| Lapis | Mekanisme | Lokasi |
|---|---|---|
| 1. Sidebar/modul | `role_permissions(module_key, can_access)` → `hasAccess()`; super_admin bypass semua | [permissions.js](src/lib/permissions.js), [useRolePermissions.js](src/hooks/useRolePermissions.js) |
| 2. Halaman | Guard `role.role_name` di-setiap page (mis. `['super_admin','hrd']`) | tiap Page.jsx |
| 3. Database | RLS policy Postgres: join `user_profiles → roles`, syarat `account_status='ACTIVE'` | file migration .sql |

- **Role yang ada:** `super_admin, direksi, hrd, finance, pelaksana` ([constants.js](src/lib/constants.js)). **Tidak ada role Sourcing/QC/Kepala Produksi** → gap terhadap spec §7.
- `RolePermissionsPage` merender dari konstanta `MODULES` — **menambah module key baru otomatis muncul di UI pengaturan akses per role** (pola granular sudah ada: ppm punya 8 module key aksi).
- `user_profiles` punya `id` (UUID internal, dipakai sebagai `user_id` notifikasi & FK audit) dan `auth_user_id` (auth.uid()) — FK PIC internal harus ke `user_profiles(id)`.

### B.4 Storage & Upload

- **6 bucket:** `assets`, `maintenance-photos`, `inspection-photos`, `ppm-documents`, `employee-photos` (semua **public**) + `asset-service-photos` (**private** — preseden bucket privat sudah ada).
- **Pola upload existing:** `supabase.storage.upload()` → `getPublicUrl()` → simpan path di tabel (`asset_photos`, foto karyawan, dsb).
- **Belum ada:** validasi signature file (hanya ekstensi/MIME), kompresi/thumbnail client-side, stripping EXIF, dan **pemakaian signed URL** (belum ada `createSignedUrl` di src — perlu pola baru untuk foto lokasi privat).
- Spec §4.7 & §6 mewajibkan foto lokasi vendor (rumah pribadi!) **privat** → bucket baru private + signed URL terikat sesi login.

### B.5 Google Maps — BELUM ADA

- Tidak ada library maps (tidak di package.json, tidak ada script di index.html); satu-satunya "google" di src adalah font Google Fonts.
- `navigator.geolocation` juga belum pernah dipakai di aplikasi.
- Konsekuensi (sesuai spec §4 "Teknis Google Maps"): perlu **Google Cloud project + Maps JavaScript API + billing + Map ID** (AdvancedMarkerElement mensyaratkan `mapId`), API key dibatasi HTTP-referrer domain HARMAS, dimuat via env `VITE_*`. **Ini setup manual yang hanya bisa dilakukan user** — dan fallback tanpa key wajib ada (spec §8.15).

### B.6 Sistem Lain yang Relevan

- **Notifikasi & reminder:** tabel `notifications` (dikelola dari dalam aplikasi), `user_id = user_profiles.id`, web-push VAPID aktif — bisa dipakai untuk reminder follow-up overdue & deadline revisi QC.
- **Audit log:** pola `asset_activity_logs` (actor, old/new values) — bisa direplikasi untuk vendor.
- **Status historis:** trigger Postgres sudah dipakai (mis. trigger jadwal kunjungan vendor) — pola trigger untuk `vendor_status_history` konsisten dengan gaya existing.

---

## C. Kesenjangan & Keputusan Desain (PERLU PERSETUJUAN)

| # | Isu | Opsi | Rekomendasi |
|---|---|---|---|
| K1 | Role Sourcing & QC tidak ada | **KEPUTUSAN FINAL (4 Nov 2026): tambah HANYA role `sourcing`** — tanpa role/halaman/login QC. Petugas QC HARMAS tidak pakai akun; Sourcing menyerahkan sampel, petugas QC memeriksa di luar sistem, **Sourcing menginput hasil QC atas nama petugas**. Nama pemeriksa dari data `employees` (atau teks bebas); hasil QC selalu tercatat: nama petugas, tanggal periksa, parameter, temuan, instruksi perbaikan, foto, dokumen (bila ada), identitas + waktu Sourcing penginput. Perbaikan hasil QC setelah input → wajib alasan + riwayat revisi (siapa/kapan/mengapa). Hasil QC ≠ persetujuan vendor. Keputusan akhir: `direksi` + `super_admin` | ✅ DIPUTUSKAN |
| K2 | Tempat menyimpan calon vendor | (a) di `vendors` + kolom status → **ditolak**: 10 vendor aktif akan tercampur pipeline, dropdown aset/kontrak & view QR ikut terpengaruh; (b) **tabel `vendor_candidates` terpisah** + kolom `vendor_id` NULL yang diisi **hanya saat aktivasi eksplisit** | **(b)** — identitas tunggal tetap terjaga, tabel existing tidak tersentuh |
| K3 | Lokasi untuk vendor AKTIF existing (7 maklun jahit butuh GPS juga) | (a) kolom lat/lng di `vendors` (menyentuh tabel existing); (b) `vendor_locations` polymorphic (candidate_id XOR vendor_id); (c) **semua lokasi via kandidat** — vendor aktif dibuatkan record kandidat "ter-link" (`vendor_id` terisi, stage CLOSED, kualifikasi APPROVED) via tombol *"Lokasikan Vendor Aktif"* | **(c)** — satu jalur data lokasi, zero perubahan tabel `vendors` |
| K4 | Enum status | Spec punya 11 tahap proses + 5 kualifikasi; Excel menambah tahap `99 Tidak Dilanjutkan`, status `Menunggu Approval`, `Dibekukan` | **Superset**: proses + `ABANDONED`; kualifikasi + `PENDING_APPROVAL`, `FROZEN` (label Indonesia di UI, kode English di DB — konsisten pola existing) |
| K5 | Approver vendor | direksi? super_admin? hrd? | `direksi` + `super_admin` (approver); bypass kelengkapan lokasi hanya approver + alasan wajib (spec §4.6) |
| K6 | Foto lokasi privat | ikut pola public (risiko: alamat rumah pribadi tersebar) vs bucket private + signed URL | **Bucket private `vendor-photos`** + signed URL berbatas waktu; bukan URL publik permanen |
| K7 | Penomoran kode | existing `VND-SEW1..` bebas; Excel `V-0001`; prototipe `V-2026-0001` | Kandidat: `VR-0001` (sequence DB); sampel `S-0001`, QC `QC-0001`, keputusan `K-0001`, follow-up `FU-0001` (ikuti Excel) |
| K8 | Google Maps API key | belum ada akun/billing | User setup Google Cloud (panduan akan disertakan di fase Peta); MVP fase 1–2 tidak terblokir karena Maps hanya fase 3 |

---

## D. Rancangan Database (12 tabel + 1 bucket + 1 RPC + 1 view)

Semua tabel baru prefix `vendor_`, additive, idempotent, bisa di-rollback (`DROP TABLE ... CASCADE`). Tidak mengubah tabel existing sama sekali.

```
vendor_candidates ──┬── vendor_candidate_specialties ── vendor_specialties ── vendor_categories (master)
                    ├── vendor_contacts
                    ├── vendor_locations ──── vendor_location_photos ──→ storage: vendor-photos (PRIVATE)
                    ├── vendor_followups (append-only)
                    ├── vendor_samples ──── vendor_sample_qc_runs ──→ vendor_qc_parameters (master rubrik)
                    ├── vendor_decisions (append-only)
                    ├── vendor_status_history  } trigger otomatis
                    └── vendor_activity_logs  } audit trail
```

### Tabel inti

**`vendor_candidates`** — pipeline utama
`id, candidate_code (VR-####, unik), business_name*, business_type (USAHA/PERORANGAN), category_id → vendor_categories, internal_pic_id → user_profiles (PIC Harmas), source (Referensi/Google Maps/Google Search/Instagram/Marketplace/Kunjungan/Pameran/Lainnya), process_stage*, qualification_status*, operational_status*, capacity_qty, capacity_unit (pcs/meter/kg/roll/stitch/set), moq, lead_time_days, indicative_price, payment_term, service_area, legal_status (BELUM_DICEK/PROSES_VERIFIKASI/LENGKAP/TIDAK_LENGKAP), notes, vendor_id → vendors (NULL — diisi saat aktivasi), activated_at, activated_by, created_by/at, updated_by/at`

Enum (CHECK constraint):
- `process_stage`: `LEAD, CONTACTING, PROFILE_VERIFICATION, SITE_VERIFICATION, SAMPLE_ASSIGNED, SAMPLE_IN_PROGRESS, SAMPLE_RECEIVED, QC_REVIEW, SAMPLE_REVISION, AWAITING_APPROVAL, CLOSED, ABANDONED`
- `qualification_status`: `PROSPECT, UNDER_EVALUATION, PENDING_APPROVAL, APPROVED, RESERVE, REJECTED, FROZEN`
- `operational_status`: `NOT_ACTIVE, ACTIVE, SUSPENDED, INACTIVE`

**`vendor_locations`** — sesuai spec §4 (multi-fasilitas per vendor)
`id, candidate_id*, location_name, location_type (RUMAH_PRODUKSI/WORKSHOP_JAHIT/WORKSHOP_BORDIR/PABRIK/GUDANG/TOKO/KANTOR/LAINNYA), is_primary, address_line, village, district, city, province, postal_code, latitude DECIMAL(9,6) NULL, longitude DECIMAL(10,6) NULL, google_place_id, coordinate_source (MANUAL/PICK_ON_MAP/DEVICE_GPS/MAPS_LINK/GEOCODE), verification_status (UNVERIFIED/NEEDS_REVISIT/VERIFIED), verified_by → user_profiles, verified_at, verification_notes, created_*/updated_*`
- `CHECK (latitude BETWEEN -90 AND 90)`, `CHECK (longitude BETWEEN -180 AND 180)`, `CHECK ((latitude IS NULL) = (longitude IS NULL))` — tidak pernah "0,0" palsu
- **Partial unique index** `ON (candidate_id) WHERE is_primary` → maksimal satu lokasi utama (spec §6 constraint)
- Index: `(city)`, `(verification_status)`, GIST/btree lat-lng bila perlu radius search

**`vendor_location_photos`**: `id, location_id*, storage_path, photo_type (EXTERIOR/ENTRANCE/PRODUCTION_AREA/MACHINES/WAREHOUSE/OTHER), caption, taken_at, uploaded_by, uploaded_at, is_cover, sort_order, file_mime, file_size`

**`vendor_followups`** (append-only — spec §2): `id, candidate_id*, contact_at TIMESTAMPTZ, internal_pic_id, channel (TELEPON/WHATSAPP/KUNJUNGAN/EMAIL/VIDEO_CALL/PAMERAN/LAINNYA), contact_result*, new_info, next_action, next_action_due, task_status (OPEN/SELESAI/DIBATALKAN), completed_at, attachment_path, notes, created_by/at`
- Riwayat tidak bisa di-UPDATE/DELETE (RLS + trigger guard; pengecualian kolom `task_status/completed_at` untuk menutup tugas)

**`vendor_samples`**: `id, sample_code (S-####), candidate_id*, sample_type (JAHIT_PRODUK/BORDIR/SWATCH_KAIN/UJI_KAIN/PRINTING/CUTTING/FINISHING/AKSESORIS/LAINNYA), product_code (mis. KK-006), brief, techpack_path, material_source (HARMAS/VENDOR/GABUNGAN/TIDAK_RELEVAN), quantity, unit, cost, assigned_at, target_date, received_at, internal_pic_id, status (BRIEF_DIBUAT/DITUGASKAN/DIKERJAKAN/SAMPEL_DITERIMA/SEDANG_QC/PERLU_REVISI/SELESAI/DIBATALKAN), revision_note, related_sample_id → vendor_samples, created_*/updated_*`

**`vendor_qc_parameters`** (master rubrik per kategori, dikelola admin): `id, category_id NULL (NULL=umum), parameter_name, weight NUMERIC DEFAULT 1, is_active, display_order` — seed 6 parameter dari Excel: Kesesuaian Spek, Ukuran/Gramasi, Hasil Pengerjaan, Bahan/Warna, Finishing, Fungsi/Ketahanan (skor 1–5)

**`vendor_sample_qc_runs`** (1 baris = 1 putaran; revisi sampel = baris baru — spec §5 & keputusan K1):
`id, sample_id*, candidate_id, run_no INT, inspector_name TEXT* (nama petugas QC — dari employees atau teks), inspector_employee_id → employees(id) NULL, inspected_at TIMESTAMPTZ* (tanggal pemeriksaan oleh QC), parameter_scores JSONB ({param_id: skor 1..5}), avg_score, pass_mark, decision (LULUS/REVISI/TIDAK_LULUS), findings (temuan/ketidaksesuaian), required_fixes (instruksi perbaikan), revision_due, photos JSONB (foto temuan), document_path (dokumen hasil pemeriksaan bila ada), notes, reinspection_note, input_by → user_profiles (Sourcing penginput), input_at TIMESTAMPTZ DEFAULT now(), created_by/at` + `UNIQUE(sample_id, run_no)`

**`vendor_qc_run_revisions`** (jejak koreksi hasil QC — K1 §4): `id, qc_run_id*, edited_by → user_profiles, edited_at, edit_reason*, old_values JSONB, new_values JSONB`. Trigger ON UPDATE menulis otomatis; UPDATE tanpa `edit_reason` ditolak; DELETE hasil QC tidak diizinkan sama sekali.

**`vendor_decisions`** (append-only): `id, candidate_id*, decided_by → user_profiles, decision (APPROVED/RESERVE/REJECTED/FROZEN), basis_reason*, scope_limit, sample_ref_id, qc_ref_id, effective_from, reeval_date, follow_up_action, pic_id, proof_path, override_reason (WAJIB bila bypass syarat lokasi — spec §4.6), created_at`

**`vendor_status_history`** (trigger saat perubahan 3 kolom status): `id, candidate_id, field_name, old_value, new_value, changed_by, changed_at, change_source`

**`vendor_activity_logs`** (pola `asset_activity_logs`): `id, candidate_id, entity_table, entity_id, action, old_values JSONB, new_values JSONB, actor_id, created_at`

**Master:** `vendor_categories` (Jahit, Bordir, Supplier Kain, Pabrik Kain, Cutting, Sablon/Printing, Finishing, Washing, Packing, Aksesoris, Lainnya — admin bisa kelola), `vendor_specialties` (per kategori: Kemeja Kantor/Lapangan, Celana, Jaket, Wearpack, Rompi, Bordir Komputer, Patch/Emblem, …), `vendor_candidate_specialties` (M:N), `vendor_contacts` (multi-kontak: nama, jabatan, telepon, WA, email, is_primary).

### RLS (diterapkan di DB, bukan cuma sembunyi tombol — spec §6)

| Tabel | SELECT | INSERT/UPDATE | DELETE |
|---|---|---|---|
| master (categories/specialties/parameters) | authenticated | super_admin, hrd | — |
| candidates/contacts/specialties | authenticated | sourcing, hrd, super_admin | ❌ (arsip saja) |
| locations/photos | authenticated | sourcing, hrd, super_admin (insert/update) | super_admin saja (foto replace) |
| locations.verification_status | authenticated | hrd, super_admin (verifikasi lokasi) | — |
| followups | authenticated | sourcing, hrd, super_admin; UPDATE hanya task_status/completed_at | ❌ append-only |
| samples | authenticated | sourcing, hrd, super_admin | ❌ |
| qc_runs | authenticated | **sourcing** (menginput atas nama petugas QC), hrd, super_admin; UPDATE wajib `edit_reason` (K1 final — tanpa role qc) | ❌ never (jejak permanen) |
| qc_run_revisions | authenticated | via trigger (SECURITY DEFINER) | ❌ |
| decisions | authenticated | **direksi, super_admin** — dengan CHECK override_reason saat bypass | ❌ |
| status_history/activity_logs | authenticated | via trigger (SECURITY DEFINER) | ❌ |

Bucket `vendor-photos` **private**: policy storage SELECT/INSERT untuk authenticated (internal), akses file via **signed URL berbatas waktu** (mis. 1 jam), bukan public URL.

### RPC aktivasi `activate_vendor_candidate(candidate_id)`

`SECURITY DEFINER`, dipanggil approver, **transaksi atomik**:
1. Validasi: `qualification_status='APPROVED'` + ada baris decision APPROVED; lokasi utama ber-koordinat valid; ≥1 foto EXTERIOR; QC putaran terakhir LULUS (atau `override_reason` terisi → bypass tercatat).
2. Deteksi duplikat ke `vendors` (nama mirilike + telepon) → pakai vendor existing **atau** insert `vendors` baru (vendor_code generate).
3. Set `candidates.vendor_id, operational_status='ACTIVE', activated_at/by` + copy alamat lokasi utama → `vendors.address/city` (sinkron ringan).
4. Tulis `vendor_activity_logs`.
5. Return `vendor_id` → UI menampilkan link ke Master Vendor. Relasi aset/kontrak lama tidak tersentuh (spec §8.10).

### View `vendor_map_points`

Union semua `vendor_locations` ber-koordinat + join kategori/status (untuk peta: calon DAN vendor aktif via `vendor_id`), plus daftar "belum dipetakan" (kandidat tanpa koordinat).

---

## E. Rancangan Frontend

**Halaman baru (folder `src/pages/vendor/`), mengikuti design system aplikasi (Tailwind ink/primary, dark+light, komponen card/tabel/modal/badge existing) — prototipe hanya acuan UX:**

| Route | Halaman | Isi |
|---|---|---|
| `/vendor` | VendorDashboardPage | KPI (total, lead baru, perlu FU, overdue, sampel berjalan, menunggu QC/approval, approved, lokasi belum lengkap), tabel prioritas, alur kualifikasi, mini-map |
| `/vendor/database` | VendorDatabasePage | Tabel searchable/sortable/paginated + filter kategori/status/PIC + tambah/edit + deteksi duplikat |
| `/vendor/database/:id` | VendorDetailPage | Tab: Ringkasan, Follow-Up, Sampel & QC, Lokasi & Foto, Keputusan, Riwayat |
| `/vendor/followups` | VendorFollowupsPage | Log lintas vendor + filter overdue |
| `/vendor/samples` | VendorSamplesPage | Monitor sampel + status + putaran QC |
| `/vendor/map` | VendorMapPage | Google Maps (AdvancedMarkerElement, filter, InfoWindow, navigasi, daftar belum dipetakan) |
| `/vendor/approvals` | VendorApprovalsPage | Checklist kelengkapan + keputusan + aktivasi |

**Komponen baru `src/components/vendor/`:** StatusBadge (3 dimensi status), VendorFormModal, FollowUpModal, LocationFormModal + **MapPicker** (pilih pin/gps/tempel link — parser URL Maps), PhotoUploader (validasi tipe+ukuran 5MB, thumbnail, preview), QcRunFormModal (skor dinamis per kategori), DecisionModal, GoogleMapsLoader (lazy-load script + fallback tanpa key), VendorTimeline.

**Integrasi existing (file yang diubah — minim):**
- [App.jsx](src/App.jsx): +7 route
- [MainLayout.jsx](src/components/layout/MainLayout.jsx): grup sidebar "MANAJEMEN VENDOR"
- [permissions.js](src/lib/permissions.js): +module keys `vendor_management, vendor_followups, vendor_samples, vendor_qc, vendor_map, vendor_approval` (granular ala ppm)
- `.env.example`: `VITE_GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAPS_MAP_ID`
- RolePermissionsPage/UsersPage: otomatis (render dari MODULES/roles)

**Fitur lokasi (spec §4):** input alamat terstruktur; paste koordinat/URL Maps (parser pola `@lat,lng`, `?q=`, koma; shortlink tak terurai → tolak, jangan mengarang); GPS perangkat (geolocation, izin browser, tidak otomatis jadi koordinat final); badge kelengkapan (Belum Lengkap / Koordinat Belum Diverifikasi / Terverifikasi); foto multi-jenis dengan cover; navigasi `google.com/maps/search/?api=1&query=lat,lng` (escape parameter).

**Notifikasi:** reminder follow-up overdue & deadline revisi QC via tabel `notifications` + pola web-push existing.

---

## F. Potensi Konflik & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Data pipeline bocor ke Master Vendor / dropdown aset & kontrak | 16 aset memakai `vendors` | Kandidat di tabel terpisah; hanya RPC aktivasi yang menulis `vendors` |
| Duplikat identitas vendor (kandidat ≠ vendor aktif) | Pelacakan rusak | RPC cek duplikat nama+telepon sebelum insert; `vendor_id` canonical; tombol "Lokasikan Vendor Aktif" untuk retrofit |
| Migration merusak data (prod DB = DB lokal!) | Fatal | Migration idempotent + additive saja; **backup/snapshot sebelum eksekusi**; skrip rollback disertakan; file arsip di `supabase/migrations/` pola existing |
| Menu/module key bentrok | Akses kacau | Semua key baru prefix `vendor_*`; tidak menyentuh key `vendors` existing |
| Role baru bertabrakan RBAC | Konflik | Role `sourcing`/`qc` murni tambahan; tidak mengubah 5 role existing; akses diatur via RolePermissionsPage |
| API key Google tersebar/biaya | Sekuritas/biaya | Key browser referrer-restricted + hanya Maps JS API; tidak di-commit (`.env`); fallback tanpa key (spec §8.15) |
| Foto rumah pribadi terpublikasi | Privasi | Bucket private + signed URL berbatas waktu; EXIF GPS distrip saat kompresi client-side |
| PWA cache menyajikan UI lama | Bug "hilang" pasca-deploy | Hard-refresh + bump service worker (pola existing) |
| Bundle membesar (Maps JS) | Performa | Lazy-load Maps hanya di halaman peta |

---

## G. Rencana Implementasi Bertahap

Setiap fase menghasilkan: daftar file berubah, migration + rollback, hasil test (skenario spec §8), manual setup, dan **tidak deploy tanpa persetujuan**.

| Fase | Isi | Deliverable teknis | Estimasi |
|---|---|---|---|
| **0. Persiapan** | Persetujuan keputusan K1–K8, backup DB, setup Google Cloud (user) | Snapshot DB, key Maps di `.env` | 0,5 hari |
| **1. Core Sourcing** | Migration master + candidates + contacts + specialties + history/log; role sourcing/qc + module keys; Database Calon Vendor + form + Detail (tab Ringkasan/Riwayat); guard RBAC 3 lapis | 1 migration, 3 page, sidebar, test RBAC | 2–3 sesi |
| **2. Follow-Up & Dashboard** | Tabel followups + trigger status; halaman Follow-Up; Dashboard KPI + prioritas; reminder overdue via notifications | 1 migration, 2 page, integrasi notifikasi | 1–2 sesi |
| **3. Lokasi & Peta** | Locations + photos + bucket private + upload/signed URL + verifikasi; Google Maps (AdvancedMarker, filter, InfoWindow, navigasi, belum-terpetakan); MapPicker + GPS + parser link; retrofit lokasi vendor aktif | 1 migration, 1 bucket, halaman Peta + tab Lokasi | 3–4 sesi |
| **4. Sampling & QC** | Samples + qc_parameters + qc_runs multi-putaran; halaman Sampel; form QC dinamis per kategori; revisi berjenjang; tab QC | 1 migration, 1 page + modal | 2–3 sesi |
| **5. Persetujuan & Aktivasi** | decisions + RPC aktivasi + checklist; halaman Approval; link ke Master Vendor; audit lengkap | 1 migration + RPC, 1 page | 1–2 sesi |
| **6. (Opsional) Kinerja** | KPI realisasi order, keterlambatan, grading kapasitas, laporan; impor/ekspor | menyusul | menyusul |

Urutan ini mengikuti spec §9 (Phase 1–3) dengan Maps tidak menghalangi: fase 1–2, 4, 5 sepenuhnya berjalan tanpa Google Maps.

---

## H. Setup Manual yang Diperlukan (di luar kode)

1. **Google Cloud Console** (fase 3): aktifkan Maps JavaScript API + billing, buat **Map ID**, generate API key browser, restrict HTTP referrer `harmas-asset-management.vercel.app` (+ localhost utk dev). Panduan langkah-per-langkah akan saya sertakan.
2. **Backup DB** sebelum tiap migration (prod = DB lokal) — via Supabase Dashboard → Database → Backups, atau `pg_dump`.
3. **Eksekusi migration** di Supabase SQL Editor (pola kerja existing) setelah review.
4. **Keputusan K1–K8** di tabel bagian C.

---

## I. Persetujuan (status)

1. ~~**K1 — Role**~~ ✅ **FINAL 4 Nov 2026:** hanya role `sourcing`; tanpa role QC — hasil QC diinput Sourcing atas nama petugas (lihat bagian C).
2. **K2/K3 — Struktur:** setuju kandidat di tabel terpisah + lokasi via kandidat (retrofit untuk vendor aktif)?
3. **K4 — Status:** setuju enum superset (+ABANDONED, +PENDING_APPROVAL, +FROZEN)?
4. **K5 — Approver:** keputusan vendor = `direksi` + `super_admin`?
5. **K8 — Google Maps:** siap setup Google Cloud billing? (bisa ditunda; fase 1–2 jalan duluan)
6. **Prioritas fase:** mulai sesuai urutan G, atau ada yang ingin dimajukan?

> Catatan: pesan persetujuan user menyebut "K2 sampai K8 tetap mengikuti persetujuan dan penyesuaian sebelumnya" — K2–K8 dianggap disetujui sesuai rekomendasi. Fase 1 dimulai dengan backup + pengujian aman + tanpa migrasi/deploy produksi tanpa persetujuan.

---

*Dokumen referensi dari folder Downloads telah disalin ke folder ini. Script audit read-only: `scripts/check-vendor-audit.js` (probe DB via env, tanpa hardcode key).*
