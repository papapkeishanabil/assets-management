# HANDOFF — Modul Manajemen Vendor HARMAS Asset Management

**Dokumen serah terima untuk agent penerus (Codex).** Disusun 6 November 2026.
Dokumen induk: [AUDIT_DAN_RENCANA_IMPLEMENTASI.md](AUDIT_DAN_RENCANA_IMPLEMENTASI.md) · Spesifikasi user: [HARMAS_Spesifikasi_Modul_Vendor_untuk_Codex.md](HARMAS_Spesifikasi_Modul_Vendor_untuk_Codex.md)

**Pembaruan Fase 2 (6 November 2026):** implementasi lokal selesai atas instruksi user.
Migration `202611060001_vendor_management_phase2.sql` dan rollback terpisah sudah diuji
di Docker lokal awal: 64 pemeriksaan SQL dan 16 browser diterima user; finalisasi memperluas
verifikasi menjadi **71 pemeriksaan SQL lulus**, **20 pemeriksaan browser lulus**, build lulus.
Lihat [laporan Fase 2](PHASE2_IMPLEMENTATION_REPORT.md) untuk file, SQL lengkap, hasil uji,
screenshot, dan batas fitur. User mengizinkan commit lokal Fase 2 dengan pesan
`feat(vendor): implement phase 2 sourcing followup and dashboard` (lihat git log/laporan akhir untuk hash).
Push/deploy dan migration produksi belum diizinkan. Lihat [kesiapan rilis](PHASE1_PHASE2_RELEASE_READINESS.md).
Finalisasi mencakup dua probe produksi SELECT-only: baseline/checksum, delapan policy hardening,
dan enam definisi helper/guard/audit identik dengan lokal. Tidak ada write produksi.
**Migration Fase 2 BELUM dieksekusi di produksi. Jangan membuka aplikasi dengan env produksi
untuk menguji Fase 2; halaman monitoring dapat membuat notifikasi ketika RPC tersedia.**

---

## 1. Baca Dulu — 7 Aturan yang TIDAK BOLEH Dilanggar

1. **Database produksi = database "lokal".** `.env` lokal dan aplikasi Vercel menunjuk project Supabase yang SAMA (`uwlxkwyauxwewoexfgwi.supabase.co`). TIDAK ADA dev-DB terpisah. Setiap tulis = menulis produksi. Verifikasi target koneksi sebelum setiap perintah DB.
2. **Gerbang persetujuan user (eksplisit, per aksi):** eksekusi migration produksi · deployment Vercel · push Git · perubahan DB di luar yang disetujui · pembuatan akun berprivilese. Pola kerja yang diterima: bangun → uji lokal → laporkan → tunggu persetujuan → eksekusi → verifikasi → laporkan.
3. **Fase 1 sudah TEREKSEKUSI di produksi (5 Nov 2026).** Jangan jalankan ulang `202611040001_vendor_management_phase1.sql` di produksi tanpa alasan (idempotent sih, tapi tak perlu). Frontend-nya **belum dideploy**.
4. **Invariant keamanan yang wajib dipertahankan** (lihat §4): guard keputusan/aktivasi vendor, helper SECURITY DEFINER anti-rekursi, RLS 3 tabel, `exec_sql` ter-revoke, guard kolom administratif profil.
5. **Tabel `vendors` existing + 16 relasi aset TIDAK boleh disentuh** pipeline vendor. Kandidat hidup di `vendor_candidates`; hubungan ke master hanya via kolom `vendor_id` yang diisi RPC aktivasi Fase 5.
6. **Tidak ada role QC.** Keputusan K1 final: hanya role `sourcing`. Petugas QC HARMAS tanpa akun; hasil QC diinput Sourcing atas nama petugas (`inspector_name` + opsional `inspector_employee_id → employees`), dengan jejak koreksi (`vendor_qc_run_revisions`).
7. **Laporan jujur berbasis bukti.** User menuntut verifikasi nyata (bukan "harusnya jalan"), melaporkan kegagalan apa adanya, dan tabel hasil pemeriksaan. Commit lokal diterima; push/deploy tidak.

## 2. Snapshot Status (6 Nov 2026)

| Area | Status |
|---|---|
| Migration Fase 1 di produksi | ✅ TEREKSEKUSI 5 Nov — 7 tabel `vendor_*`, role `sourcing`, 15 policy, guard, seed 9 kategori/27 spesialisasi, sequence `VR-####` |
| Frontend Fase 1 | ✅ Selesai & build lolos, ada di commit lokal — **BELUM deploy** (menu "Manajemen Vendor" baru muncul setelah deploy) |
| Security hardening produksi | ✅ `exec_sql` di-revoke dari PUBLIC/anon/authenticated · RLS aktif di `user_profiles`/`roles`/`notifications` (8 policy v3 + trigger guard profil) |
| Backup terverifikasi | ✅ `D:\Backups\harmas-2026-11-04.dump` & `harmas-2026-11-05.dump` (yang kedua memuat RLS final; keduanya sudah diuji restore penuh) |
| Git | Lokal s/d `91b8d092` + commit handoff ini. `origin/main` masih di `db2ee7cb` — **belum di-push** |
| Fase 2 | Selesai dan diuji lokal; migration produksi, push, dan deploy menunggu persetujuan eksplisit |
| Fase 3–5 | Belum dimulai. Rancangan lengkap di dokumen induk §D–G |

## 3. Stack & Konvensi Kode

- **React 18 + Vite 5 + Tailwind 3 + lucide-react + react-hot-toast**, router react-router v6 (route flat di `src/App.jsx` + guard wrapper `ProtectedRoute`/`HRDRoute`/`VendorRoute`).
- **Supabase client-side tanpa API layer** (satu-satunya Vercel function: `api/asset-qr.js`). Semua akses via `src/lib/supabase.js`; RLS database adalah penjaga utama — frontend hanya menyembunyikan tombol.
- **UI idiom** (kelas CSS di `src/index.css`): `card`, `table`, `input`, `label`, `btn-primary/btn-secondary/btn-danger`, `badge-{blue,green,indigo,orange,red,yellow,gray}`, `empty-state`, `nav-active-glow`. Tema dark+light. Ikuti gaya page existing (contoh terbaru: `src/pages/vendor/VendorDatabasePage.jsx`).
- **RBAC 3 lapis**: (1) sidebar/menu via tabel `role_permissions(module_key, can_access)` → `useRolePermissions()` (super_admin bypass); (2) guard halaman by `role.role_name`; (3) RLS Postgres. Role existing: `super_admin, direksi, hrd, finance, pelaksana, sourcing` (baru).
- **Module key vendor**: `vendor_management, vendor_followups, vendor_samples, vendor_qc, vendor_map, vendor_approval` (konstanta `MODULES` di `src/lib/permissions.js`; UI "Akses Modul per Role" otomatis menampilkannya).
- **Konvensi file migration**: `supabase/migrations/YYYYMMDDNNNN_nama.sql` (12-digit, repo-consistent), HARUS idempotent + additive + 100% aman diulang. **Rollback dipisah di `supabase/rollbacks/`** (JANGAN taruh di `migrations/` — berisiko tereksekusi runner CLI). File hardening khusus di `supabase/hardening/`.
- **Akses kredensial**: service key JANGAN hardcode di script (classifier memblok). Ambil dari script lama via env: `export SUPABASE_SERVICE_KEY=$(grep -o "SERVICE_KEY = '[^']*'" scripts/run-migration.js | cut -d"'" -f2)` dan `SUPABASE_URL` dari `grep -o 'https://[a-z0-9]*\.supabase\.co' ...`. Kunci anon/publishable ada di `.env` (`VITE_SUPABASE_PUBLISHABLE_KEY`).

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

**Fase 2 — Follow-Up & Dashboard Monitoring Sourcing** *(implementasi lokal selesai; belum produksi)*
- Tabel `vendor_followups` (append-only; UPDATE hanya `task_status`/`completed_at`): `contact_at, candidate_id, internal_pic_id, channel (TELEPON/WHATSAPP/KUNJUNGAN/EMAIL/VIDEO_CALL/PAMERAN/LAINNYA), contact_result, new_info, next_action, next_action_due, task_status (OPEN/SELESAI/DIBATALKAN), completed_at, attachment_path, notes, created_by/at`.
- Halaman `/vendor/followups` (log lintas vendor + filter overdue), tab Follow-Up di detail, tombol "Catat Follow-Up" (modal).
- Dashboard `/vendor` : KPI (total kandidat, perlu follow-up, overdue, lokasi belum lengkap, sampel berjalan, menunggu QC/approval, approved) + tabel prioritas + alur kualifikasi. Trigger/penyesuaian `process_stage` saat follow-up dicatat (opsional).
- Reminder overdue → tabel `notifications` existing (`user_id = user_profiles.id`, insert by authenticated — policy sudah ada).
- Module key: `vendor_followups`; tulis = sourcing/hrd/super_admin (RLS mengikuti pola fase 1).

**Fase 3 — Lokasi & Peta Google Maps**: `vendor_locations` (multi-fasilitas; `location_type`, `is_primary` + **partial unique index** per kandidat, alamat terstruktur `address_line/village/district/city/province/postal_code`, `latitude DECIMAL(9,6)/longitude DECIMAL(10,6)` + CHECK pasangan-lengkap & rentang, `coordinate_source`, `verification_status UNVERIFIED/NEEDS_REVISIT/VERIFIED`, `verified_by/at/notes`) + `vendor_location_photos` (`photo_type EXTERIOR/ENTRANCE/PRODUCTION_AREA/MACHINES/WAREHOUSE/OTHER`, `is_cover`, file mime/size) + **bucket PRIVATE `vendor-photos`** + signed URL (pola upload publik lama TIDAK dipakai untuk foto lokasi — rumah pribadi) + halaman `/vendor/map` (Google Maps JS API, AdvancedMarkerElement + `mapId`, lazy-load `VITE_GOOGLE_MAPS_API_KEY`/`VITE_GOOGLE_MAPS_MAP_ID` — **API key belum ada, user harus setup Google Cloud**; wajib fallback daftar+tombol navigasi `google.com/maps/search/?api=1&query=lat,lng`) + MapPicker (paste koordinat/URL Maps parser pola `@lat,lng` & `?q=`, GPS perangkat `navigator.geolocation` — baru dipakai setelah konfirmasi petugas) + retrofit lokasi vendor aktif via kandidat ter-link. View `vendor_map_points` untuk pin gabungan.

**Fase 4 — Sampling & QC**: `vendor_samples` (`sample_code S-####`, `sample_type`, `product_code`, brief/techpack_path, `material_source HARMAS/VENDOR/GABUNGAN/TIDAK_RELEVAN`, qty/unit/cost, assigned/target/received, `status`, `related_sample_id` self-FK) + `vendor_qc_parameters` (master rubrik per kategori; seed 6 dari Excel: Kesesuaian Spek, Ukuran/Gramasi, Hasil Pengerjaan, Bahan/Warna, Finishing, Fungsi/Ketahanan — skor 1–5) + `vendor_sample_qc_runs` (1 baris=1 putaran; `UNIQUE(sample_id, run_no)`; **`inspector_name` NOT NULL + `inspector_employee_id→employees` NULL + `inspected_at`** = data petugas QC; `parameter_scores JSONB`, avg, decision LULUS/REVISI/TIDAK_LULUS, findings, required_fixes, revision_due, photos, `document_path`, `input_by/input_at` = Sourcing penginput) + `vendor_qc_run_revisions` (koreksi hasil wajib `edit_reason`, trigger ON UPDATE mencatat old/new + siapa/kapan; DELETE hasil QC dilarang; revisi sampel = putaran QC baru). Hasil QC ≠ approval.

**Fase 5 — Persetujuan & Aktivasi**: `vendor_decisions` (append-only; approver = direksi/super_admin; `decision APPROVED/RESERVE/REJECTED/FROZEN`, basis_reason, sample/qc_ref, effective_from, reeval_date, `override_reason` wajib bila bypass syarat lokasi) + halaman `/vendor/approvals` (checklist kelengkapan) + **RPC `activate_vendor_candidate(uuid)`** SECURITY DEFINER: validasi (ada decision APPROVED, lokasi utama ber-koordinat valid, ≥1 foto EXTERIOR, QC akhir LULUS atau override tercatat) → deteksi duplikat `vendors` (nama+telepon) → pakai row existing atau insert baru (vendor_code digenerate) → set `vendor_id`/`operational_status='ACTIVE'`/`activated_at/by` → copy alamat utama → audit log. Baru setelah ini guard mengizinkan status keputusan/aktif (jalur service). Policy UPDATE direksi diaktifkan kembali HANYA untuk mekanisme keputusan.

**Fase 6 (opsional)** — KPI kinerja vendor aktif.

**Rencana deploy frontend Fase 1 (+2)**: setelah user setujui — push Git + deploy Vercel (pola deploy user: `git reset` → stage subset → `git stash push --keep-index` → build → commit/push → `stash pop`; PWA perlu hard refresh; bundle >500 kB warning — pertimbangkan code-split Maps nanti).

## 9. Hal yang Menunggu Keputusan User

1. Review hasil **Fase 2**, persetujuan migration produksi (setelah backup baru), push Git, dan deploy secara eksplisit. Implementasi lokal sudah disetujui dan selesai; laporan di `PHASE2_IMPLEMENTATION_REPORT.md`.
2. **Deploy/push frontend Fase 1** (menu vendor baru muncul di aplikasi setelah ini; user juga perlu menugaskan role Sourcing ke user tertentu via Pengguna).
3. Setup **Google Cloud Maps** (untuk Fase 3) — bisa diperlambat.

## 10. Cara Memulai (untuk Codex)

1. Baca dokumen ini + dokumen induk + spesifikasi user (folder ini).
2. `git log --oneline -12` untuk riwayat; `npm run build` harus lolos.
3. Untuk perubahan DB: tulis migration idempotent + rollback di `supabase/rollbacks/` → uji di stack lokal (§7, pola: base → semua migration berurutan → hardening) → laporan → tunggu persetujuan → eksekusi via `exec_sql` service key (pola `scripts/apply-phase1-migration.js`) → verifikasi pasca (pola `check-prod-compat.js`) → lapor.
4. Untuk frontend: ikuti idiom §3, guard 3 lapis, jangan sentuh fungsi existing.
5. Laporkan dengan format yang biasa: tabel status, bukti verifikasi, kendala jujur, langkah berikut + apa yang butuh persetujuan.

— Disusun setelah: audit penuh, Fase 1 end-to-end (build→uji lokal→hardening 2 celah kritis→backup×2 tervalidasi→eksekusi produksi→verifikasi), dan insiden recursion yang dipulihkan. Semua keputusan desain (K1–K8) final dan terdokumentasi.
