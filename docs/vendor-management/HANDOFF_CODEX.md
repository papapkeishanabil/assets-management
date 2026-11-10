# HANDOFF — Modul Manajemen Vendor HARMAS Asset Management

**Dokumen serah terima untuk agent penerus (Codex).** Disusun 6 November 2026.
Dokumen induk: [AUDIT_DAN_RENCANA_IMPLEMENTASI.md](AUDIT_DAN_RENCANA_IMPLEMENTASI.md) · Spesifikasi user: [HARMAS_Spesifikasi_Modul_Vendor_untuk_Codex.md](HARMAS_Spesifikasi_Modul_Vendor_untuk_Codex.md)

**FASE 3 SUDAH AKTIF DI PRODUKSI, 10 November 2026 09.29 WIB.** User menyetujui
migration dengan “ya setuju”. Hanya `202611090001_vendor_management_phase3.sql`
dijalankan; 9 preflight, 25 SQL pasca-commit dan 11 HTTP lulus; 17 checksum tabel dan
11 fungsi/ACL/policy existing utuh. Tidak ada push/deploy tambahan, akun/fixture,
perubahan owner/role atau penulisan master. [Laporan aktivasi](PHASE3_PRODUCTION_ACTIVATION_20261110.md).
Lokasi/foto masih kosong; pin membutuhkan input GPS nyata dari pengguna. Langkah
berikut adalah UAT operasional, bukan mengulang migration. Catatan 9 Nov dan kesiapan
pra-migration di bawah bersifat historis.

**Keputusan terbaru 10 November 2026:** user memilih layanan GRATIS dan meminta rute
menuju fasilitas. Rancangan Google Maps JavaScript API diganti **Leaflet 1.9.4 +
OpenStreetMap tanpa key/billing**; Google Maps dipakai hanya sebagai tautan navigasi
yang dibuka pengguna. Implementasi lokal dan 64 pemeriksaan lulus, build lulus.
[Laporan perubahan peta gratis/rute](FREE_MAP_AND_DIRECTIONS_20261110.md).
Versi gratis `5ae0c673` **sudah production READY sekitar 09.06 WIB, 10 Nov**, deployment
`dpl_F3UijNeKStcKMe8nTQfUdvLVo7BC`; [bukti rilis](FREE_MAP_PRODUCTION_RELEASE_20261110.md).
User menyetujui deployment frontend; pada langkah frontend tidak ada push/migration/write bisnis.
Migration kemudian disetujui dan terpasang seperti catatan aktivasi di atas. Panduan Google Cloud lama menjadi opsional,
bukan prasyarat versi gratis. Jangan membuka billing atau meminta key Maps lagi.

**Backup/preflight terbaru 10 November, 09.09–09.16 WIB:** user mengisi password
PostgreSQL di terminal. `D:\Backups\harmas-pre-phase3-20261110-090939-f4bf7fbd`;
9 preflight PASS, restore logis **140 tabel/1.908 baris**, 95 blob/29.027.178 byte
terverifikasi. Migration dua kali hanya di clone lokal, executor `supabase_admin`;
17 baseline/helper/policy existing utuh. Container dihentikan; pada langkah backup tidak ada migration,
push atau deploy tambahan. Full platform/role global/restore layanan Storage belum
teruji. [Kesiapan terbaru dan kendala bootstrap](PHASE3_ACTIVATION_READINESS_20261110.md).
Persetujuan eksplisit migration kemudian diterima dan dieksekusi 09.29 WIB.
Pemeriksaan owner saja terlalu ketat: Supabase mengizinkan policy Storage melalui
`supautils.policy_grants`. Driver memeriksa grant platform tanpa mengubah owner atau
membership. Password helper sudah dibersihkan; jangan menjalankan migration ulang.

**Pembaruan 9 November 2026:** Fase 2 **sudah terpasang di produksi**; isi empat fungsi cocok
dengan migration dan frontend publik memuat Fase 1+2. Commit Fase 2 `c02a66d5`, HEAD lokal
`12de0de4`; reflog mencatat push 6 November pukul 14.39 WIB. Jangan ulangi migration/deploy.
Uji lokal final: **71 SQL + 20 browser lulus**, build lulus. Pemeriksaan pascarilis read-only:
**9 kelompok lulus**, hardening existing tetap identik, checksum sepuluh tabel tidak berubah.
Backup pra-Fase 2 tanggal 6 November ditemukan dan hash cocok; restore aplikasi terverifikasi,
tetapi restore seluruh platform Supabase belum lengkap (extension/platform pada postgres:17).
**UAT baca login produksi selesai:** user menyetujui dua akun sementara Super Admin/Sourcing;
9 pemeriksaan browser/API dan 6 lifecycle lulus, kedua sesi logout dan akun/profil sudah dihapus.
Checksum 11 tabel kembali identik. Sourcing permanen belum ditetapkan; jangan meninggalkan
akun uji untuk operasional. [Status penerimaan terbaru](PRODUCTION_ACCEPTANCE_STATUS_20261109.md).
Jangan menjalankan skrip E2E lokal terhadap produksi: ia membuat/menghapus fixture.
Halaman monitoring dapat menulis notifikasi; harness baca menonaktifkan request tersebut.

**Fase 3 lokal (9 November 2026):** implementasi lokasi multi-fasilitas, GPS, foto privat,
verifikasi, retrofit master aktif dan peta/fallback selesai dan difinalisasi dalam commit lokal. Migration baru
`202611090001_vendor_management_phase3.sql` hanya diterapkan pada Docker sintetis;
belum migration produksi atau push. Preview frontend kemudian dideploy atas permintaan
user; frontend produksi kemudian juga dirilis ketika user mengonfirmasi alamat utama.
Pada tahap lokal/preview 9 Nov, database Fase 3 belum dipasang. Hasil final dan batas pengujian:
[Laporan Fase 3](PHASE3_IMPLEMENTATION_REPORT.md). Google Maps nyata belum diuji karena
API key/Map ID belum tersedia; pengujian SDK tiruan tidak menggantikan UAT layanan Google.
Preflight/backup historis 9 November lulus setelah user mengisi password melalui terminal:
9 kelompok preflight, restore logis 139 tabel dan salinan 95 blob terverifikasi.
[Kesiapan aktivasi](PHASE3_ACTIVATION_READINESS_20261109.md) menjelaskan hasil dan batas
restore platform; migration produksi masih menunggu izin eksplisit. Pengambilan
service key dari file legacy pernah ditolak auto-review; gunakan environment yang
disediakan user, sesuai pilihan koneksi PostgreSQL langsung.
**Preview READY 9 Nov, 12.59 WIB:** [buka preview](https://harmas-asset-management-7qi0mttcc.vercel.app)
dan [catatan verifikasi](PHASE3_PREVIEW_DEPLOYMENT_20261109.md). Commit frontend `d3beb8f5`.
Login Vercel/HARMAS diperlukan; backend lokasi belum aktif, dashboard tetap dapat
dipakai. Domain produksi terbukti tidak berubah. Jangan menganggap preview sebagai
persetujuan migration produksi.
**Frontend alamat utama READY sekitar 15.41 WIB, 9 Nov:**
[Peta Vendor](https://harmas-asset-management.vercel.app/vendor/map), deployment
`dpl_AGnmtsEyyNuTFCP3EkmKCLsDFM8R`, source `d3beb8f5`. User menegaskan alamat utama
setelah meminta deploy; frontend dirilis tanpa migration/push atau perubahan role.
[Catatan rilis produksi frontend](PHASE3_PRODUCTION_FRONTEND_20261109.md).
**Persiapan aktivasi selanjutnya:** user belum memiliki key/Map ID dan meminta panduan;
lihat [setup Google Maps](GOOGLE_MAPS_SETUP.md). Helper interaktif
`scripts/start-vendor-phase3-backup.ps1` dibuka agar user memasukkan PGPASSWORD sendiri
di terminal tersembunyi, lalu menjalankan driver preflight/backup existing. Status
runtime ada di `.vercel/phase3-activation-status.json` (diabaikan Git); cek state dan
manifest terbaru, jangan menganggap backup selesai hanya karena terminal dibuka.
Helper tidak menjalankan migration atau mengubah environment cloud.
**Backup/preflight 9 November (historis):** user memasukkan password di terminal. Backup
`D:\Backups\harmas-pre-phase3-20261109-162946-b0c15d41`; 9 preflight PASS, restore
139 tabel COPY/1.905 baris cocok, 95 blob cocok ukuran/ETag/hash. Migration dua kali
hanya di clone; produksi belum dimigration. Container restore dihentikan. Lihat
[kesiapan aktivasi terbaru dan batas restore platform](PHASE3_ACTIVATION_READINESS_20261109.md).
Pilihan key/Map ID kemudian diganti peta gratis pada 10 November; frontend gratis sudah
dirilis dengan persetujuan user. Backup/preflight sudah diperbarui 10 November, lihat
catatan terbaru di atas. Persetujuan dan migration Fase 3 sudah selesai 09.29 WIB;
tidak perlu mengulang migration atau deployment untuk penggunaan lokasi sekarang.

---

## 1. Baca Dulu — 7 Aturan yang TIDAK BOLEH Dilanggar

1. **Database produksi = database "lokal".** `.env` lokal dan aplikasi Vercel menunjuk project Supabase yang SAMA (`uwlxkwyauxwewoexfgwi.supabase.co`). TIDAK ADA dev-DB terpisah. Setiap tulis = menulis produksi. Verifikasi target koneksi sebelum setiap perintah DB.
2. **Gerbang persetujuan user (eksplisit, per aksi):** eksekusi migration produksi · deployment Vercel · push Git · perubahan DB di luar yang disetujui · pembuatan akun berprivilese. Pola kerja yang diterima: bangun → uji lokal → laporkan → tunggu persetujuan → eksekusi → verifikasi → laporkan.
3. **Fase 1 dan Fase 2 sudah TEREKSEKUSI di produksi** (diverifikasi 9 Nov 2026). Jangan jalankan ulang migration keduanya tanpa alasan dan persetujuan. Frontend publik memuat Fase 1+2; UAT baca login kedua role lulus dengan akun sementara yang sudah dihapus. CRUD/reminder produksi belum diuji pada data bisnis.
4. **Invariant keamanan yang wajib dipertahankan** (lihat §4): guard keputusan/aktivasi vendor, helper SECURITY DEFINER anti-rekursi, RLS 3 tabel, `exec_sql` ter-revoke, guard kolom administratif profil.
5. **Tabel `vendors` existing + 16 relasi aset TIDAK boleh disentuh** pipeline vendor. Kandidat hidup di `vendor_candidates`; hubungan ke master melalui RPC aktivasi Fase 5. Pengecualian K3 untuk Fase 3: RPC `vendor_link_existing_active` membuat kandidat ter-link hanya untuk master yang SUDAH aktif, tanpa menulis master/aset atau menyetujui prospect existing. Guard keputusan langsung tetap utuh.
6. **Tidak ada role QC.** Keputusan K1 final: hanya role `sourcing`. Petugas QC HARMAS tanpa akun; hasil QC diinput Sourcing atas nama petugas (`inspector_name` + opsional `inspector_employee_id → employees`), dengan jejak koreksi (`vendor_qc_run_revisions`).
7. **Laporan jujur berbasis bukti.** User menuntut verifikasi nyata, melaporkan kegagalan apa adanya, dan tabel hasil pemeriksaan. Setiap push/deploy baru memerlukan persetujuan eksplisit; status pascarilis bukan izin untuk tindakan rilis berikutnya.

## 2. Snapshot Status (10 Nov 2026)

| Area | Status |
|---|---|
| Migration Fase 1 di produksi | ✅ TEREKSEKUSI 5 Nov — 7 tabel `vendor_*`, role `sourcing`, 15 policy, guard, seed 9 kategori/27 spesialisasi, sequence `VR-####` |
| Frontend Fase 1+2 | Bundle publik HTTP 200, akses anonim terlindungi; UAT baca Super Admin/Sourcing lulus, tanpa error browser/API |
| Security hardening produksi | ✅ `exec_sql` di-revoke dari PUBLIC/anon/authenticated · RLS aktif di `user_profiles`/`roles`/`notifications` (8 policy v3 + trigger guard profil) |
| Backup pra-Fase 2 | Historis: `D:\Backups\harmas-pre-phase2-2026-11-06.dump`; lihat catatan keterbatasan restore lama |
| Backup pra-Fase 3 terbaru | `D:\Backups\harmas-pre-phase3-20261110-090939-f4bf7fbd`; restore logis 140 tabel/1.908 baris cocok, 95 blob cocok ETag/hash; full stack platform belum direstore |
| Git | Fase 2 `c02a66d5`, origin lokal `12de0de4`; dokumentasi penerimaan Fase 1+2 `73b8680a`, implementasi Fase 3 pada commit lokal berikutnya (lihat git log). Tidak ada push baru |
| Fase 2 | Schema dan frontend produksi; UAT baca 9 PASS + lifecycle 6 PASS, akun uji bersih; kandidat/follow-up masih 0 |
| Fase 3 | Backend lokasi/foto SUDAH AKTIF 10 Nov 09.29 WIB; 25 SQL + 11 HTTP lulus, baseline/keamanan existing utuh. Frontend gratis `5ae0c673`; pin menunggu input lokasi asli dan UAT operasional |
| Fase 4–5 | Belum dimulai. Rancangan lengkap di dokumen induk §D–G |

## 3. Stack & Konvensi Kode

- **React 18 + Vite 5 + Tailwind 3 + lucide-react + react-hot-toast**, router react-router v6 (route flat di `src/App.jsx` + guard wrapper `ProtectedRoute`/`HRDRoute`/`VendorRoute`).
- **Supabase client-side tanpa API layer** (satu-satunya Vercel function: `api/asset-qr.js`). Semua akses via `src/lib/supabase.js`; RLS database adalah penjaga utama — frontend hanya menyembunyikan tombol.
- **UI idiom** (kelas CSS di `src/index.css`): `card`, `table`, `input`, `label`, `btn-primary/btn-secondary/btn-danger`, `badge-{blue,green,indigo,orange,red,yellow,gray}`, `empty-state`, `nav-active-glow`. Tema dark+light. Ikuti gaya page existing (contoh terbaru: `src/pages/vendor/VendorDatabasePage.jsx`).
- **RBAC 3 lapis**: (1) sidebar/menu via tabel `role_permissions(module_key, can_access)` → `useRolePermissions()` (super_admin bypass); (2) guard halaman by `role.role_name`; (3) RLS Postgres. Role existing: `super_admin, direksi, hrd, finance, pelaksana, sourcing` (baru).
- **Module key vendor**: `vendor_management, vendor_followups, vendor_samples, vendor_qc, vendor_map, vendor_approval` (konstanta `MODULES` di `src/lib/permissions.js`; UI "Akses Modul per Role" otomatis menampilkannya).
- **Konvensi file migration**: `supabase/migrations/YYYYMMDDNNNN_nama.sql` (12-digit, repo-consistent), HARUS idempotent + additive + 100% aman diulang. **Rollback dipisah di `supabase/rollbacks/`** (JANGAN taruh di `migrations/` — berisiko tereksekusi runner CLI). File hardening khusus di `supabase/hardening/`.
- **Akses kredensial**: service key JANGAN hardcode di script. Gunakan `SUPABASE_SERVICE_KEY` yang disediakan user melalui environment; untuk koneksi PostgreSQL/backup gunakan `PGPASSWORD` dari environment. Pengambilan service key dari file legacy ditolak auto-review pada persiapan rilis Fase 3, jangan mengulanginya lewat jalur lain. Kunci publishable frontend ada di `.env` (`VITE_SUPABASE_PUBLISHABLE_KEY`), bukan pengganti password PostgreSQL.

## 4. Invariant Keamanan yang Sudah Terpasang (WAJIB dipertahankan)

### Database (produksi, aktif)
- **`vendor_guard_restricted_columns`** (trigger on `vendor_candidates`): perubahan `qualification_status` KE/DARI nilai keputusan (`APPROVED/RESERVE/REJECTED/FROZEN`) serta `operational_status`/`vendor_id`/`activated_at`/`activated_by` → HANYA boleh via konteks `auth.role()='service_role'` atau `current_user IN ('postgres','supabase_admin')`. **Tidak ada role aplikasi (termasuk direksi/super_admin) boleh set APPROVED/ACTIVE lewat UPDATE** — menunggu RPC aktivasi Fase 5 yang memvalidasi syarat (disetujui, identitas valid, anti-duplikasi vendors, relasi, audit log).
- **RLS 3 tabel** (`user_profiles`, `roles`, `notifications`) + **`profiles_guard_admin_fields`** (trigger on `user_profiles`): `role_id`/`account_status`/`approved_by`/`approved_at`/`auth_user_id` hanya boleh diubah admin (hrd/super_admin) atau konteks service. Registrasi self-insert dibatasi role `pelaksana`/NULL + status `PENDING` (persis alur `RegisterPage.jsx`).
- **Helper SECURITY DEFINER** `public.is_app_role(text[])` & `public.my_profile_id()` — schema-qualified, `SET search_path = public, pg_temp`, EXECUTE hanya `authenticated`. Ini pola WAJIB untuk pengecekan role di dalam policy (mencegah infinite recursion — lihat §6).
- **`exec_sql(text)`** sudah di-revoke dari PUBLIC/anon/authenticated (pernah jadi celah kritikal: anon key publik bisa eksekusi SQL sebagai postgres). Hanya postgres+service_role. Frontend & api/ tidak memakainya; hanya script maintenance service-key.
- Tabel pipeline `vendor_candidates` TANPA policy DELETE (jejak permanen). `vendor_status_history`/`vendor_activity_logs` append-only via trigger SECURITY DEFINER (aktor dari `auth.uid()` otoritatif, fallback kolom `*_by`).
- Fungsi gaji (`set_employee_salary` dll.) punya cek izin internal — jangan "perbaiki" dengan menghapus ceknya.

### Frontend
- Opsi keputusan kelayakan disembunyikan dari SEMUA role di Fase 1 (`DECISION_QUALIFICATION_STATUSES` di `src/lib/vendor-constants.js`); select terkunci bila nilai saat ini adalah keputusan.
- `VendorRoute` (App.jsx) = guard role (`super_admin/hrd/direksi/sourcing`) + `hasAccess('vendor_management')`.

## 5. Model Data Fase 1 (yang sudah ada di produksi)

```
roles: + 'sourcing'
role_permissions: sourcing=6 key, direksi=6, hrd=vendor_management (+ key 'vendors' lama utk direksi/hrd)
vendor_categories (9 seed) → vendor_specialties (27 seed, UNIQUE(category_id,name))
vendor_candidates (VR-#### via sequence; 3 dimensi status CHECK:
  process_stage: LEAD→…→CLOSED, ABANDONED
  qualification_status: PROSPECT, UNDER_EVALUATION, PENDING_APPROVAL, APPROVED, RESERVE, REJECTED, FROZEN
  operational_status: NOT_ACTIVE, ACTIVE, SUSPENDED, INACTIVE
  kolom komersial: capacity_qty/unit, moq, lead_time_days, indicative_price, payment_term,
  service_area, legal_status, source, internal_pic_id→user_profiles, vendor_id→vendors NULL)
vendor_candidate_specialties (M:N) · vendor_contacts (multi-kontak, boleh DELETE utk sinkron form)
vendor_status_history + vendor_activity_logs (trigger otomatis)
```
Label Indonesia + kelas badge ada di `src/lib/vendor-constants.js`; query/sinkronisasi di `src/lib/vendor-helpers.js`.

## 6. Pelajaran Teknis Penting (jangan ulangi kesalahan ini)

1. **RLS infinite recursion**: policy tabel X tidak boleh membaca tabel X (langsung/melingkar via tabel lain). SOLUSI: helper SECURITY DEFINER (`is_app_role`). Terjadi 2× di proyek ini.
2. **Policy dorman**: sebelum mengaktifkan RLS di tabel yang RLS-nya lama mati, **audit dulu `pg_policies` di DB target** — policy lama tak terdokumentasi ikut menyala (pernah menyebabkan insiden recursion + celah anon INSERT notifikasi; pemulihan: 5 DROP POLICY disetujui darurat user).
3. **`auth.uid() IS NULL` ≠ service role.** Deteksi backend: `auth.role()='service_role' OR current_user IN ('postgres','supabase_admin')`. Kasus uid-NULL palsu harus tetap diblokir.
4. **Trigger function tak bisa dipanggil langsung** (Postgres menolak) — aman; tapi SET ROLE tidak bisa dalam SECURITY DEFINER — simulasi role via exec_sql tidak mungkin; gunakan lingkungan uji Docker.
5. **exec_sql return void 204** (bukan 200) — cek statusnya jangan salah baca gagal/sukses. Hasil SELECT tidak bisa dikembalikan — bawa keluar via `RAISE EXCEPTION` di blok DO.
6. **Git Bash (Windows)**: prefix `MSYS_NO_PATHCONV=1` untuk path docker `/backup...`; CRLF warning normal.
7. **GoTrue local**: insert manual `auth.users` butuh kolom token non-NULL string kosong (cek nama kolom via information_schema — beda antar versi) + hash bcrypt asli (ambil via admin API createUser).
8. **Classifier/harness**: tag psql `INSERT 0 1`/`UPDATE n`; SELECT tanpa tag — gunakan marker `ADA_BARIS/KOSONG_BARIS` di hasil query. Sequence tidak ikut rollback (gap nomor normal).
9. **Backup**: user menjalankan pg_dump via Docker (`postgres:17` + env `PGPASSWORD` + pooler `aws-0-ap-southeast-1.pooler.supabase.com:6543`, user `postgres.uwlxkwyauxwewoexfgwi`; koneksi langsung 5432 diblokir jaringan user). Verifikasi restore: container terisolasi + role `authenticated/anon/service_role` dibuat dulu (CREATE POLICY TO authenticated butuh role itu) + cocokkan baseline: vendors=10, assets=55 (16 ber-vendor), user_profiles=6, employees=44, contracts=27, 0 orphan.

## 7. Lingkungan Uji Lokal (masih hidup)

Stack Supabase CLI v3 di `%TEMP%\harmas-vendor-test` (container `supabase_db_harmas-vendor-test`, psql via `docker exec`, Studio `http://127.0.0.1:54323`, kunci demo standar lokal). Skrip uji di folder yang sama: `base-schema.sql` (skema minimal sintetis), `test-structure.sql`, `test-guard-v3.sh` (21 skenario), `test-features.sh` (D4–D13), `test-rls-v2.sh` (matriks RLS profil), `test-guard.sh`/`v2` (versi lama). User uji: `<role>.test@harmas.local`; password diberikan lewat env sesi `HARMAS_LOCAL_TEST_PASSWORD`, jangan disimpan dalam kode/dokumen yang di-commit. Struktur: base-schema → migration → RLS hardening (urutan ini meniru produksi). Ulangi pola ini untuk menguji setiap fase berikutnya SEBELUM produksi.

Skrip produksi berguna (baca env, tidak hardcode): `check-prod-compat.js` (probe read-only), `compare-policies-prod-local.js`, `verify-post-recovery.js`, `apply-exec-sql-hardening.js`, `apply-phase1-migration.js`, `e2e-temp-account.js` (akun uji sementara — PEMBUATAN akun privilese butuh persetujuan user).

## 8. Roadmap Fase Berikutnya (rancangan sudah disetujui user)

**Fase 2 — Follow-Up & Dashboard Monitoring Sourcing** *(sudah produksi; UAT baca kedua role selesai)*
- Tabel `vendor_followups` (append-only; UPDATE hanya `task_status`/`completed_at`): `contact_at, candidate_id, internal_pic_id, channel (TELEPON/WHATSAPP/KUNJUNGAN/EMAIL/VIDEO_CALL/PAMERAN/LAINNYA), contact_result, new_info, next_action, next_action_due, task_status (OPEN/SELESAI/DIBATALKAN), completed_at, attachment_path, notes, created_by/at`.
- Halaman `/vendor/followups` (log lintas vendor + filter overdue), tab Follow-Up di detail, tombol "Catat Follow-Up" (modal).
- Dashboard `/vendor` : KPI (total kandidat, perlu follow-up, overdue, lokasi belum lengkap, sampel berjalan, menunggu QC/approval, approved) + tabel prioritas + alur kualifikasi. Trigger/penyesuaian `process_stage` saat follow-up dicatat (opsional).
- Reminder overdue → tabel `notifications` existing (`user_id = user_profiles.id`, insert by authenticated — policy sudah ada).
- Module key: `vendor_followups`; tulis = sourcing/hrd/super_admin (RLS mengikuti pola fase 1).

**Fase 3 — Lokasi & Peta Gratis (keputusan user 10 Nov menggantikan penyedia Google awal):**
`vendor_locations` multi-fasilitas + partial unique primary, alamat terstruktur, koordinat
DECIMAL nullable berpasangan/rentang, sumber dan verifikasi lokasi; `vendor_location_photos`
multi-jenis/cover/mime/size; bucket PRIVATE `vendor-photos` dan signed URL. Halaman
`/vendor/map` serta MapPicker memakai **Leaflet 1.9.4 + OpenStreetMap**, lazy-load tanpa
API key/billing, cluster/viewport/resize dan fallback ketika tile gagal. Atribusi OSM,
referrer origin, cache HTTP serta larangan bulk/offline tile harus dipertahankan.
Input manual/URL Maps/GPS tetap didukung; GPS hanya dipakai setelah konfirmasi.
Retrofit master aktif tetap via kandidat ter-link dan view `vendor_map_points`.
Tombol **Rute ke Lokasi** membuka Google Maps memakai Maps URLs tanpa API key, tujuan
GPS fasilitas, origin ditentukan oleh Google Maps/pengguna. Tidak memanggil Directions API
atau memalsukan rute jalan berupa garis lurus. Data/guard migration tetap sama.

**Fase 4 — Sampling & QC**: `vendor_samples` (`sample_code S-####`, `sample_type`, `product_code`, brief/techpack_path, `material_source HARMAS/VENDOR/GABUNGAN/TIDAK_RELEVAN`, qty/unit/cost, assigned/target/received, `status`, `related_sample_id` self-FK) + `vendor_qc_parameters` (master rubrik per kategori; seed 6 dari Excel: Kesesuaian Spek, Ukuran/Gramasi, Hasil Pengerjaan, Bahan/Warna, Finishing, Fungsi/Ketahanan — skor 1–5) + `vendor_sample_qc_runs` (1 baris=1 putaran; `UNIQUE(sample_id, run_no)`; **`inspector_name` NOT NULL + `inspector_employee_id→employees` NULL + `inspected_at`** = data petugas QC; `parameter_scores JSONB`, avg, decision LULUS/REVISI/TIDAK_LULUS, findings, required_fixes, revision_due, photos, `document_path`, `input_by/input_at` = Sourcing penginput) + `vendor_qc_run_revisions` (koreksi hasil wajib `edit_reason`, trigger ON UPDATE mencatat old/new + siapa/kapan; DELETE hasil QC dilarang; revisi sampel = putaran QC baru). Hasil QC ≠ approval.

**Fase 5 — Persetujuan & Aktivasi**: `vendor_decisions` (append-only; approver = direksi/super_admin; `decision APPROVED/RESERVE/REJECTED/FROZEN`, basis_reason, sample/qc_ref, effective_from, reeval_date, `override_reason` wajib bila bypass syarat lokasi) + halaman `/vendor/approvals` (checklist kelengkapan) + **RPC `activate_vendor_candidate(uuid)`** SECURITY DEFINER: validasi (ada decision APPROVED, lokasi utama ber-koordinat valid, ≥1 foto EXTERIOR, QC akhir LULUS atau override tercatat) → deteksi duplikat `vendors` (nama+telepon) → pakai row existing atau insert baru (vendor_code digenerate) → set `vendor_id`/`operational_status='ACTIVE'`/`activated_at/by` → copy alamat utama → audit log. Baru setelah ini guard mengizinkan status keputusan/aktif (jalur service). Policy UPDATE direksi diaktifkan kembali HANYA untuk mekanisme keputusan.

**Fase 6 (opsional)** — KPI kinerja vendor aktif.

**Rencana rilis Fase 3:** jangan mengulang migration Fase 1+2 yang sudah produksi. Review/snapshot produksi read-only terbaru → backup baru + verifikasi restore aplikasi dan Storage → persetujuan migration Fase 3 → verifikasi schema/RLS → persetujuan terpisah push/deploy → UAT Super Admin/Sourcing. Halaman peta dimuat lazy; bundle utama masih memberi warning >500 kB. PWA perlu diperiksa setelah rilis. Jangan melakukan reset/stash massal pada working tree yang berisi pekerjaan lain.

## 9. Hal yang Menunggu Keputusan User

1. **Penetapan petugas Sourcing permanen** untuk penggunaan operasional: belum dilakukan. UAT baca dengan dua akun sementara yang disetujui sudah selesai, akun/sesi sudah dibersihkan; jangan menjalankan ulang lifecycle tanpa persetujuan baru.
2. Tentukan scope pengujian tulis/reminder nyata bila diperlukan. Jangan membuat riwayat follow-up dummy permanen atau mengubah akun existing tanpa izin. Migration/push/deploy Fase 1+2 sudah teramati; jangan ulangi untuk UAT.
3. Peta gratis Leaflet/OSM menggantikan kebutuhan Google Cloud. Deploy versi baru setelah disetujui; jangan menganggap tile publik layanan tanpa batas/SLA.
4. UAT operasional Fase 3 setelah [aktivasi terverifikasi](PHASE3_PRODUCTION_ACTIVATION_20261110.md). Backend dan frontend gratis sudah aktif; tidak perlu Google Cloud. Push Git belum dilakukan. Jangan menjalankan harness lokal terhadap produksi atau membuat data dummy/akun tanpa scope yang diizinkan.

## 10. Cara Memulai (untuk Codex)

1. Baca dokumen ini + dokumen induk + spesifikasi user (folder ini).
2. `git log --oneline -12` untuk riwayat; `npm run build` harus lolos.
3. Untuk perubahan DB: migration idempotent + rollback terpisah → uji di fixture dan clone restore → laporan → persetujuan eksplisit → eksekusi melalui koneksi PostgreSQL langsung dengan password yang disediakan user → verifikasi schema/RLS/ACL/checksum → lapor. Jangan beralih ke service key legacy untuk menghindari pilihan koneksi user.
4. Untuk frontend: ikuti idiom §3, guard 3 lapis, jangan sentuh fungsi existing.
5. Laporkan dengan format yang biasa: tabel status, bukti verifikasi, kendala jujur, langkah berikut + apa yang butuh persetujuan.

— Disusun setelah: audit penuh, Fase 1 end-to-end (build→uji lokal→hardening 2 celah kritis→backup×2 tervalidasi→eksekusi produksi→verifikasi), dan insiden recursion yang dipulihkan. Semua keputusan desain (K1–K8) final dan terdokumentasi.
