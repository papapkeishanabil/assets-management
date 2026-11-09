# Laporan Implementasi Fase 2 — Follow-Up & Dashboard Sourcing

> Status produksi diperbarui 9 November: [laporan penerimaan](PRODUCTION_ACCEPTANCE_STATUS_20261109.md).
> Migration dan frontend kini sudah terpasang. Laporan bertanggal 6 November berikut adalah
> bukti milestone implementasi/finalisasi; pernyataan “belum rilis” di dalamnya bersifat historis.

Tanggal: 6 November 2026 (WIB). Status: **finalisasi lokal untuk commit yang disetujui user; belum push, migration produksi, atau deploy**. Hash commit dicatat pada laporan akhir dan git log. [Kesiapan rilis Fase 1+2](PHASE1_PHASE2_RELEASE_READINESS.md).

Tiga dokumen wajib dibaca berurutan sebelum kode ditulis. Keputusan K1–K8 dipertahankan: hanya role sourcing; tidak menambah role/halaman QC atau mekanisme approval/aktivasi.

## Hasil implementasi

- `/vendor`: 15 KPI, produktivitas PIC, filter kategori/PIC kandidat, 20 kandidat prioritas, dan distribusi seluruh tahap proses. Vendor unik, kontak berhasil, aktivitas dan status tugas dihitung terpisah. Agregasi melalui RPC SECURITY INVOKER sehingga tidak terpotong batas 1.000 baris REST.
- `/vendor/followups`: catatan lintas kandidat, filter kandidat/PIC/status/overdue, pagination 25 catatan, tombol Catat Follow-Up, penyelesaian dan pembatalan tugas.
- Detail kandidat: tab Follow-Up setelah Ringkasan, modal catatan baru, serta riwayat audit pembuatan dan penutupan tugas.
- Catatan komunikasi append-only. UPDATE dibatasi status tugas dan waktu selesai oleh trigger; DELETE ditolak. Tugas terminal tidak dibuka kembali. Koreksi informasi melalui catatan baru.
- `created_by` memakai identitas JWT, `created_at` dan `completed_at` ditetapkan database. Kanal/status, hasil komunikasi, deadline/aksi, dan foreign key divalidasi database.
- Nomor `FU-0001` berurutan, tetap benar saat melewati `FU-9999`. Gap sequence akibat rollback pengujian adalah perilaku normal PostgreSQL.
- Reminder overdue ke tabel notifications existing: `user_id = user_profiles.id`, PIC aktif, satu per kejadian tugas/PIC tanpa pengiriman ulang saat pergantian hari. Dipicu saat monitoring dibuka/di-refresh dan tombol Ingatkan PIC. Dua request REST serentak dan pergantian hari telah diuji.
- Hasil keterhubungan dicatat eksplisit (TERHUBUNG/TIDAK_TERHUBUNG/BELUM_DINILAI), sehingga adanya log tidak dianggap kontak berhasil. Produktivitas membedakan created_by pencatat dari internal_pic_id penanggung jawab tugas.
- Sidebar mengikuti module key; route menunggu permission selesai dimuat. Guard role/modul halaman dan RLS tetap terpisah. HRD membutuhkan akses `vendor_followups` yang diberikan melalui pengaturan role jika ingin memakai halaman tersebut; migration tidak mengubah role_permissions existing.

## File baru dan berubah

| Jenis | File | Isi / tujuan |
|---|---|---|
| Baru | [migration](../../supabase/migrations/202611060001_vendor_management_phase2.sql) | Satu tabel, sequence, tiga policy RLS, guard/audit trigger, dua RPC |
| Baru | [rollback](../../supabase/rollbacks/202611060001_vendor_management_phase2_rollback.sql) | Menghapus hanya objek Fase 2, tanpa CASCADE ke tabel existing |
| Baru | [vendor-followup-helpers.js](../../src/lib/vendor-followup-helpers.js) | Query, pagination, opsi, penyimpanan, RPC, format waktu WIB |
| Baru | [FollowUpModal.jsx](../../src/components/vendor/FollowUpModal.jsx) | Modal native dialog, validasi, fokus dan Escape |
| Baru | [VendorFollowupsPanel.jsx](../../src/components/vendor/VendorFollowupsPanel.jsx) | Filter, daftar/timeline, pagination, penutupan dan reminder |
| Baru | [VendorFollowupsPage.jsx](../../src/pages/vendor/VendorFollowupsPage.jsx) | Halaman lintas kandidat; mendukung tautan dari notifikasi |
| Baru | [VendorDashboardPage.jsx](../../src/pages/vendor/VendorDashboardPage.jsx) | KPI, prioritas, filter, alur kualifikasi |
| Berubah | [App.jsx](../../src/App.jsx) | Dua route; parameter moduleKey dan loading permission pada VendorRoute |
| Berubah | [MainLayout.jsx](../../src/components/layout/MainLayout.jsx) | Sidebar vendor; ID sidebar sesuai aria-controls; membatasi dekorasi agar tidak menyebabkan overflow mobile |
| Berubah | [VendorDetailPage.jsx](../../src/pages/vendor/VendorDetailPage.jsx) | Tab Follow-Up dan label audit/riwayat |
| Berubah | [VendorFormModal.jsx](../../src/components/vendor/VendorFormModal.jsx) | Memperbaiki import QUALIFICATION_STATUS/OPERATIONAL_STATUS yang sebelumnya belum ada |
| Berubah | [vendor-constants.js](../../src/lib/vendor-constants.js) | Label kanal, status dan badge follow-up |
| Berubah | [notification-helpers.js](../../src/lib/notification-helpers.js) | Label, ikon, warna dan filter overdue untuk notifikasi vendor |
| Baru | [test-vendor-phase2-local.mjs](../../scripts/test-vendor-phase2-local.mjs) | 71 pemeriksaan SQL melalui container Docker tetap |
| Baru | [test-vendor-phase2-browser.mjs](../../scripts/test-vendor-phase2-browser.mjs) | 20 pemeriksaan browser/REST lokal dan screenshot; cleanup fixture |
| Baru | [probe-vendor-phase2-production.mjs](../../scripts/probe-vendor-phase2-production.mjs) | SELECT katalog/agregat produksi, exception rollback, kredensial hanya env |
| Baru | [review-vendor-phase2-readiness.mjs](../../scripts/review-vendor-phase2-readiness.mjs) | Perbandingan snapshot produksi dengan definisi policy/helper lokal |
| Baru | [PHASE2_PRODUCTION_READONLY.json](PHASE2_PRODUCTION_READONLY.json) | Snapshot metadata/checksum produksi tanpa data personal/kredensial |
| Baru | [PHASE2_PRODUCTION_READONLY_RECHECK.txt](PHASE2_PRODUCTION_READONLY_RECHECK.txt) | Probe kedua identik dengan baseline pertama |
| Baru | [PHASE2_READINESS_CHECKS.txt](PHASE2_READINESS_CHECKS.txt) | Delapan pemeriksaan kesiapan migration |
| Baru | [PHASE2_BUILD_RESULTS.txt](PHASE2_BUILD_RESULTS.txt) | Output build final |
| Baru | [PHASE1_PHASE2_RELEASE_READINESS.md](PHASE1_PHASE2_RELEASE_READINESS.md) | Gate backup, migration, push/deploy dan checklist pascarilis |
| Baru | [PHASE2_SCHEDULED_REMINDER_DESIGN.md](PHASE2_SCHEDULED_REMINDER_DESIGN.md) | Rancangan scheduler berikutnya; belum diaktifkan |
| Baru | [PHASE2_LOCAL_TEST_RESULTS.txt](PHASE2_LOCAL_TEST_RESULTS.txt) | Bukti per skenario SQL dan checksum |
| Baru | [BROWSER_RESULTS.txt](phase2-evidence/BROWSER_RESULTS.txt) | Bukti per skenario browser, REST error, host eksternal yang diblokir |
| Baru | [dashboard-desktop.png](phase2-evidence/dashboard-desktop.png) | Screenshot dashboard dark desktop |
| Baru | [followups-desktop.png](phase2-evidence/followups-desktop.png) | Screenshot tiga follow-up |
| Baru | [detail-followups.png](phase2-evidence/detail-followups.png) | Screenshot tab detail kandidat |
| Baru | [followups-mobile-light.png](phase2-evidence/followups-mobile-light.png) | Screenshot daftar mobile/light 390 px |
| Baru | [followup-modal-mobile.png](phase2-evidence/followup-modal-mobile.png) | Screenshot modal pada viewport mobile |
| Berubah | [HANDOFF_CODEX.md](HANDOFF_CODEX.md) | Pembaruan status dan peringatan target koneksi untuk agent berikutnya |
| Baru | Dokumen ini | Laporan, inventaris, batas fitur, SQL lengkap di bawah |

Tidak mengubah package.json/package-lock atau menambah dependency. `.superdesign/` dan `scripts/check-finance-policies.js` sudah ada sebagai file untracked sebelum pekerjaan ini dan tidak disentuh.

## Hasil pengujian dan bukti

Lingkungan: stack `%TEMP%\harmas-vendor-test`, container **supabase_db_harmas-vendor-test**, API **http://127.0.0.1:54321**. Semua data sintetis. Tidak membaca `.env` produksi dalam skrip pengujian.

| Skenario | Hasil | Bukti |
|---|---|---|
| Migration dua kali dan reapply dengan log terisi | Lulus | Data follow-up tetap tiga baris; checksum existing identik |
| Struktur dan ACL | Lulus | RLS aktif, 3 policy, 0 policy DELETE, RPC invoker, anon tidak dapat memanggil RPC |
| Sourcing/HRD/super_admin | Lulus | INSERT dan tutup tugas berhasil; DELETE ditolak |
| Direksi/finance/pelaksana | Lulus | Baca sesuai pola Fase 1; INSERT ditolak; UPDATE memengaruhi 0 baris |
| Anon/JWT tanpa sub/akun disabled | Lulus | Baca anon kosong; tulis ditolak |
| Guard keputusan/aktivasi Fase 1 | Lulus | Sourcing, HRD, super_admin tetap tidak dapat mengubah APPROVED/ACTIVE |
| Append-only / audit | Lulus | Sembilan kolom immutable dicoba termasuk outcome; actor JWT dan old/new status terverifikasi; audit palsu ditolak |
| Tiga follow-up | Lulus | Tiga hasil berbeda tersimpan; browser mengisi kanal, PIC, informasi, aksi, deadline dan catatan |
| Penutupan tugas | Lulus | Timestamp dari DB, pembatalan tanpa completed_at, terminal tidak bisa dibuka ulang |
| KPI / prioritas / filter | Lulus | Fixture enam kandidat menghasilkan KPI persis; filter kategori/PIC dan hasil kosong benar; 1.011 kandidat terhitung utuh |
| Reminder / RLS notifications | Lulus | Deduplikasi berulang/lintas pengirim/lintas hari, tepat satu baris dari dua request serentak; hanya penerima bisa membaca |
| Rollback dua kali + apply ulang | Lulus | Objek Fase 2 hilang lalu pulih; data dan policy existing tetap sama |
| Kode >9.999 | Lulus | FU-10000, FU-10001, FU-10002 tidak terpotong atau bertabrakan |
| UI/route | Lulus | Direksi tanpa tombol tulis; HRD tanpa module key dialihkan saat membuka URL langsung |
| Responsif dan modal | Lulus | 390 px/light tanpa overflow; modal native dapat ditutup dengan Escape; screenshot tersedia |
| Browser error dan target data | Lulus | 0 pageerror, 0 REST error, 0 request ke Supabase produksi; Google Fonts diblokir selama uji |
| Produktivitas dan hasil keterhubungan | Lulus | Satu vendor unik berbeda dari tiga aktivitas; atribusi pencatat/tugas, status selesai/batal dan outcome belum dinilai benar |
| Policy dorman / Master Vendor | Lulus | Policy asing memblokir reapply; smoke test Master Vendor Super Admin menampilkan data existing |
| Build | Lulus | `npm.cmd run build` exit 0: 1.562 modul, bundle JS 1.218,10 kB (gzip 294,82 kB), build service worker juga berhasil |

**Total finalisasi: 71 pemeriksaan SQL PASS / 0 FAIL; 20 pemeriksaan browser PASS / 0 FAIL**, ditambah delapan review kesiapan migration dan dua probe read-only produksi. Pengujian awal 64/16 sudah diterima user. `git diff --check` lulus. Warning CRLF berasal dari konfigurasi Git existing.

Cara mengulang (PowerShell; hanya lokal):

```powershell
node scripts/test-vendor-phase2-local.mjs
# Gunakan instalasi Playwright yang sudah tersedia; jangan menunjuk ke kredensial produksi.
$env:PLAYWRIGHT_PACKAGE_PATH = '<path absolut paket playwright>/index.mjs'
# Siapkan HARMAS_LOCAL_TEST_PASSWORD melalui env sesi dari pengelola lingkungan uji; jangan commit nilainya.
node scripts/test-vendor-phase2-browser.mjs
npm.cmd run build
```

Jangan menjalankan dua skrip uji database/browser bersamaan: keduanya berbagi stack Docker lokal. Skrip SQL menguji rollback hanya saat tabel follow-up lokal kosong. Skrip browser menghapus fixture hanya berdasarkan UUID khusus, lalu mengembalikan trigger dalam transaksi cleanup. Tidak ada pembuatan akun produksi atau akun uji baru; browser memakai akun sintetis lokal yang sudah tersedia.

## Konfirmasi data dan keamanan existing

- Implementasi awal tidak menghubungi produksi. Atas instruksi finalisasi, dua probe **SELECT-only katalog/agregat** dilakukan melalui exec_sql existing dan diakhiri exception yang memaksa rollback. Tidak menjalankan DDL/DML, RPC fitur atau perubahan data produksi. Definisi objek, policy dan checksum baseline kedua probe identik. Bukti pada file READONLY dan RECHECK.
- Migration tidak memiliki ALTER/DML terhadap vendors, assets, user_profiles, roles, role_permissions, employees, contracts, maupun policy existing. Tidak menambah akun, role, atau mengubah status kandidat.
- Satu-satunya penulisan ke tabel existing oleh fitur baru adalah **INSERT notifikasi saat RPC reminder dipanggil**, sesuai ruang lingkup yang disetujui. Migration sendiri tidak memanggil RPC tersebut.
- SQL lokal membandingkan checksum data vendors/assets/user_profiles/roles/role_permissions/notifications, seluruh policy existing, dan definisi helper/guard kritis sebelum/sesudah migration serta pengujian: **identik**. Browser juga membandingkan checksum keenam tabel setelah fixture dibersihkan: **identik**.
- Semua penambahan data pipeline terjadi pada tabel vendor_*. Jejak follow-up masuk vendor_activity_logs melalui trigger SECURITY DEFINER dengan search_path terkunci. Tidak mengubah trigger atau guard Fase 1, helper is_app_role/my_profile_id, guard profil, atau izin exec_sql.
- Bukti lokal tetap terpisah dari produksi. Probe produksi finalisasi memverifikasi vendors=10, assets=55, aset ber-vendor=16, orphan=0, user_profiles=6, employees=44, contracts=27, notifications=115, vendor_candidates=0; checksum sembilan tabel identik sebelum/sesudah pemeriksaan.

## Kendala, perbaikan dan batas fitur

1. Fixture notifications lokal lama hanya memiliki lima kolom. Skrip uji melengkapinya dan relasi pendukung layout **hanya pada Docker sintetis**, mengikuti schema-only backup lokal 5 November. Perubahan fixture tersebut tidak ada dalam migration produksi.
2. Percobaan awal `INSERT ... ON CONFLICT` pada notifikasi PIC lain terkena RLS SELECT. Diperbaiki menjadi INSERT biasa dengan penanganan unique_violation. RPC tetap SECURITY INVOKER, policy existing tidak dilonggarkan. Skenario lintas PIC dan serentak kini lulus.
3. Ditemukan dua konstanta yang belum diimport pada modal vendor Fase 1; diperbaiki dan dibuktikan modal profil terbuka di browser.
4. Uji mobile menemukan pagination melebar dan dekorasi orb layout existing bergerak di luar viewport. Pagination kini wrap; dekorasi dibatasi pada viewport. Ditambahkan ID sidebar sesuai aria-controls existing. Screenshot dan assertion lebar halaman sudah lulus.
5. PowerShell memblokir npm.ps1. Build dijalankan memakai `npm.cmd run build`, tanpa mengubah execution policy.
6. Warning bundle >500 kB masih ada (bukan build failure). Code splitting dapat dibahas pada pekerjaan terpisah atau fase Maps.
7. **Lampiran Fase 2 disimpan sebagai referensi path teks internal**, ditampilkan sebagai teks aman; belum ada uploader, bucket baru, atau signed URL dokumen. Jangan menganggap file diunggah ketika mengisi field ini.
8. **Reminder bersifat pemeriksaan saat monitoring dipakai**, bukan cron/push latar belakang. Tidak menjanjikan pengiriman saat aplikasi tidak dibuka. Status notifikasi adalah snapshot saat dibuat; notifikasi lama tidak dihapus saat tugas selesai, dan tautannya membuka daftar overdue terkini.
9. **Lokasi belum dinilai** ditampilkan sebagai “— / tersedia Fase 3”; tidak mengarang angka kelengkapan tanpa tabel lokasi. KPI sampel/QC menghitung kandidat berdasarkan process_stage sampai Fase 4, bukan jumlah entitas sampel/QC.
10. Penyesuaian process_stage otomatis saat follow-up dibuat bersifat opsional pada handoff dan tidak diaktifkan. Pencatatan follow-up tidak memindahkan tahap atau memberi keputusan kelayakan/aktivasi.
11. Finalisasi memperketat reminder menjadi sekali per kejadian tugas/PIC (bukan harian), menambah outcome kontak dan metrik produktivitas. Migration juga gagal cepat bila menemukan policy asing pada tabel follow-up; tidak mengaktifkannya diam-diam.

## Langkah berikut yang menunggu persetujuan

1. Review migration/rollback dan batas fitur di laporan ini.
2. Dengan persetujuan eksplisit untuk operasi produksi: buat backup baru, verifikasi target produksi dan prasyarat helper/hardening, jalankan **hanya** migration Fase 2, lalu verifikasi struktur, RLS, guard dan baseline data existing. Tidak mengulang migration Fase 1 tanpa alasan.
3. Dengan persetujuan terpisah untuk push/deploy: commit perubahan yang direview, push frontend Fase 1+2, lalu deploy setelah migration Fase 2 berhasil. Verifikasi aplikasi dan refresh PWA.
4. Bila HRD perlu mengelola follow-up, berikan module key melalui Akses Modul per Role sesuai kebijakan user. Tidak dilakukan otomatis oleh migration ini.

**Pekerjaan berhenti setelah laporan. Tidak ada migration produksi, push atau deploy pada sesi ini.** Rollback di bawah menghapus data follow-up Fase 2; simpan backup jika data sudah dipakai. Audit vendor_activity_logs dan notifikasi existing sengaja dipertahankan sebagai riwayat.

## SQL migration lengkap

Disalin persis dari file finalisasi yang diajukan untuk commit.

```sql
-- Fase 2: Follow-Up & Dashboard Sourcing. Additive, idempotent.
-- Prasyarat: Fase 1 + hardening is_app_role/my_profile_id (v3).
-- Tidak mengubah tabel, policy, guard, atau data existing.
-- RPC reminder hanya INSERT notifikasi baru ketika dipanggil authenticated.
-- Rollback TERPISAH: supabase/rollbacks/202611060001_vendor_management_phase2_rollback.sql
BEGIN;
DO $$
BEGIN
  IF to_regprocedure('public.is_app_role(text[])') IS NULL OR to_regprocedure('public.my_profile_id()') IS NULL THEN
    RAISE EXCEPTION 'Prasyarat Fase 1 + hardening helper v3 belum tersedia';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_followups'
    AND policyname NOT IN ('Vendor followups read','Vendor followups insert','Vendor followups close task')) THEN
    RAISE EXCEPTION 'Policy vendor_followups tidak dikenal; audit dahulu, jangan aktifkan policy dorman';
  END IF;
END;
$$;

CREATE SEQUENCE IF NOT EXISTS public.vendor_followup_code_seq START 1;
CREATE TABLE IF NOT EXISTS public.vendor_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Padding minimal 4 digit; jangan LPAD(...,4) yang memotong nomor >=10000.
  followup_code text UNIQUE NOT NULL DEFAULT 'FU-' || regexp_replace('000' || nextval('public.vendor_followup_code_seq')::text, '^0+(?=[0-9]{4})', ''),
  candidate_id uuid NOT NULL REFERENCES public.vendor_candidates(id) ON DELETE RESTRICT,
  contact_at timestamptz NOT NULL DEFAULT now(),
  internal_pic_id uuid NOT NULL REFERENCES public.user_profiles(id),
  channel text NOT NULL CHECK (channel IN ('TELEPON','WHATSAPP','KUNJUNGAN','EMAIL','VIDEO_CALL','PAMERAN','LAINNYA')),
  contact_outcome text NOT NULL DEFAULT 'BELUM_DINILAI'
    CHECK (contact_outcome IN ('TERHUBUNG','TIDAK_TERHUBUNG','BELUM_DINILAI')),
  contact_result text NOT NULL CHECK (length(btrim(contact_result)) > 0),
  new_info text,
  next_action text,
  next_action_due timestamptz,
  task_status text NOT NULL DEFAULT 'OPEN' CHECK (task_status IN ('OPEN','SELESAI','DIBATALKAN')),
  completed_at timestamptz,
  attachment_path text,
  notes text,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (next_action_due IS NULL OR nullif(btrim(next_action), '') IS NOT NULL),
  CHECK ((task_status = 'SELESAI') = (completed_at IS NOT NULL))
);
-- Kompatibilitas iterasi lokal sebelum rilis; log lama tetap BELUM_DINILAI,
-- tidak diasumsikan sebagai kontak berhasil dan tidak ditulis ulang.
ALTER TABLE public.vendor_followups ADD COLUMN IF NOT EXISTS contact_outcome text NOT NULL DEFAULT 'BELUM_DINILAI'
  CHECK (contact_outcome IN ('TERHUBUNG','TIDAK_TERHUBUNG','BELUM_DINILAI'));
CREATE INDEX IF NOT EXISTS idx_vendor_followups_candidate ON public.vendor_followups(candidate_id, contact_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_vendor_followups_pic ON public.vendor_followups(internal_pic_id);
CREATE INDEX IF NOT EXISTS idx_vendor_followups_open_due ON public.vendor_followups(next_action_due) WHERE task_status = 'OPEN';

-- INVOKER: jangan jadikan guard SECURITY DEFINER (konteks pemanggil penting).
CREATE OR REPLACE FUNCTION public.vendor_followups_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Follow-up permanen: DELETE tidak diizinkan' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - ARRAY['task_status','completed_at']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['task_status','completed_at']) THEN
      RAISE EXCEPTION 'Follow-up permanen: hanya task_status/completed_at boleh diubah' USING ERRCODE = '42501';
    END IF;
    IF OLD.task_status <> 'OPEN' AND NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Tugas sudah ditutup; catat follow-up baru' USING ERRCODE = '42501';
    END IF;
  ELSE
    -- JWT otoritatif, bukan identitas/timestamp kiriman browser.
    IF auth.role() = 'authenticated' THEN
      NEW.created_by := public.my_profile_id();
    END IF;
    NEW.created_at := now();
  END IF;
  NEW.completed_at := CASE WHEN NEW.task_status = 'SELESAI'
    THEN CASE WHEN TG_OP = 'UPDATE' AND OLD.task_status = 'SELESAI' THEN OLD.completed_at ELSE now() END
    ELSE NULL END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.vendor_followups_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_vendor_followups_guard ON public.vendor_followups;
CREATE TRIGGER trg_vendor_followups_guard BEFORE INSERT OR UPDATE OR DELETE ON public.vendor_followups
  FOR EACH ROW EXECUTE FUNCTION public.vendor_followups_guard();

CREATE OR REPLACE FUNCTION public.vendor_followups_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW IS DISTINCT FROM OLD THEN
    INSERT INTO public.vendor_activity_logs(candidate_id, entity_table, entity_id, action, old_values, new_values, actor_id)
    VALUES (NEW.candidate_id, 'vendor_followups', NEW.id,
      CASE WHEN TG_OP = 'INSERT' THEN 'followup_created' ELSE 'followup_task_closed' END,
      CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END, to_jsonb(NEW),
      coalesce(public.my_profile_id(), NEW.created_by));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.vendor_followups_audit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_vendor_followups_audit ON public.vendor_followups;
CREATE TRIGGER trg_vendor_followups_audit AFTER INSERT OR UPDATE ON public.vendor_followups
  FOR EACH ROW EXECUTE FUNCTION public.vendor_followups_audit();

ALTER TABLE public.vendor_followups ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.vendor_followups TO authenticated;
REVOKE DELETE ON public.vendor_followups FROM anon, authenticated;
GRANT USAGE ON SEQUENCE public.vendor_followup_code_seq TO authenticated;
DROP POLICY IF EXISTS "Vendor followups read" ON public.vendor_followups;
CREATE POLICY "Vendor followups read" ON public.vendor_followups FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Vendor followups insert" ON public.vendor_followups;
CREATE POLICY "Vendor followups insert" ON public.vendor_followups FOR INSERT TO authenticated
  WITH CHECK (public.is_app_role(ARRAY['sourcing','hrd','super_admin']) AND created_by = public.my_profile_id());
DROP POLICY IF EXISTS "Vendor followups close task" ON public.vendor_followups;
CREATE POLICY "Vendor followups close task" ON public.vendor_followups FOR UPDATE TO authenticated
  USING (public.is_app_role(ARRAY['sourcing','hrd','super_admin']))
  WITH CHECK (public.is_app_role(ARRAY['sourcing','hrd','super_admin']));

-- Agregasi di server: tidak terpotong batas REST 1.000 baris.
-- KPI sampel/QC = jumlah kandidat pada tahap pipeline, bukan jumlah sampel.
-- Lokasi belum dinilai sampai tabel lokasi Fase 3 tersedia (NULL, bukan angka palsu).
CREATE OR REPLACE FUNCTION public.vendor_sourcing_dashboard(p_category_id uuid DEFAULT NULL, p_pic_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public.is_app_role(ARRAY['sourcing','hrd','super_admin','direksi']) THEN
    RAISE EXCEPTION 'Akses dashboard vendor ditolak' USING ERRCODE = '42501';
  END IF;
  WITH candidates AS (
    SELECT c.*, cat.name AS category_name, up.full_name AS pic_name
    FROM public.vendor_candidates c
    LEFT JOIN public.vendor_categories cat ON cat.id = c.category_id
    LEFT JOIN public.user_profiles up ON up.id = c.internal_pic_id
    WHERE (p_category_id IS NULL OR c.category_id = p_category_id)
      AND (p_pic_id IS NULL OR c.internal_pic_id = p_pic_id)
  ), monitoring AS (
    SELECT c.*, f.total_followups, f.successful_contacts, f.open_tasks, f.completed_tasks,
      f.cancelled_tasks, f.overdue_tasks, f.next_due,
      (c.process_stage NOT IN ('CLOSED','ABANDONED') AND
        (f.total_followups = 0 OR f.open_tasks > 0)) AS needs_followup
    FROM candidates c
    CROSS JOIN LATERAL (
      SELECT count(*) AS total_followups,
        count(*) FILTER (WHERE contact_outcome = 'TERHUBUNG') AS successful_contacts,
        count(*) FILTER (WHERE task_status = 'OPEN') AS open_tasks,
        count(*) FILTER (WHERE task_status = 'SELESAI') AS completed_tasks,
        count(*) FILTER (WHERE task_status = 'DIBATALKAN') AS cancelled_tasks,
        count(*) FILTER (WHERE task_status = 'OPEN' AND next_action_due < now()) AS overdue_tasks,
        min(next_action_due) FILTER (WHERE task_status = 'OPEN') AS next_due
      FROM public.vendor_followups WHERE candidate_id = c.id
    ) f
  ), activities AS (
    SELECT f.* FROM public.vendor_followups f JOIN candidates c ON c.id = f.candidate_id
  ), recorded AS (
    SELECT created_by AS pic_id, count(*) AS activities_recorded,
      count(DISTINCT candidate_id) AS vendors_attempted,
      count(DISTINCT candidate_id) FILTER (WHERE contact_outcome = 'TERHUBUNG') AS vendors_contacted
    FROM activities GROUP BY created_by
  ), assigned AS (
    SELECT internal_pic_id AS pic_id,
      count(*) FILTER (WHERE task_status = 'OPEN') AS open_tasks,
      count(*) FILTER (WHERE task_status = 'OPEN' AND next_action_due < now()) AS overdue_tasks,
      count(*) FILTER (WHERE task_status = 'SELESAI') AS completed_tasks,
      count(*) FILTER (WHERE task_status = 'DIBATALKAN') AS cancelled_tasks
    FROM activities GROUP BY internal_pic_id
  ), productivity AS (
    SELECT up.id AS pic_id, up.full_name AS pic_name, r.role_name,
      coalesce(rec.activities_recorded,0) AS activities_recorded,
      coalesce(rec.vendors_attempted,0) AS vendors_attempted,
      coalesce(rec.vendors_contacted,0) AS vendors_contacted,
      coalesce(a.open_tasks,0) AS open_tasks, coalesce(a.overdue_tasks,0) AS overdue_tasks,
      coalesce(a.completed_tasks,0) AS completed_tasks, coalesce(a.cancelled_tasks,0) AS cancelled_tasks
    FROM public.user_profiles up JOIN public.roles r ON r.id = up.role_id
    LEFT JOIN recorded rec ON rec.pic_id = up.id LEFT JOIN assigned a ON a.pic_id = up.id
    WHERE (r.role_name = 'sourcing' AND up.account_status = 'ACTIVE') OR rec.pic_id IS NOT NULL OR a.pic_id IS NOT NULL
  )
  SELECT jsonb_build_object(
    'kpis', (SELECT jsonb_build_object(
      'total', count(*), 'new_leads', count(*) FILTER (WHERE process_stage = 'LEAD'),
      'vendors_attempted', count(*) FILTER (WHERE total_followups > 0),
      'vendors_contacted', count(*) FILTER (WHERE successful_contacts > 0),
      'followup_activities', coalesce(sum(total_followups),0),
      'open_tasks', coalesce(sum(open_tasks),0),
      'completed_tasks', coalesce(sum(completed_tasks),0),
      'cancelled_tasks', coalesce(sum(cancelled_tasks),0),
      'needs_followup', count(*) FILTER (WHERE needs_followup),
      'overdue', coalesce(sum(overdue_tasks),0), 'location_incomplete', NULL,
      'samples_running', count(*) FILTER (WHERE process_stage IN ('SAMPLE_ASSIGNED','SAMPLE_IN_PROGRESS','SAMPLE_REVISION')),
      'awaiting_qc', count(*) FILTER (WHERE process_stage IN ('SAMPLE_RECEIVED','QC_REVIEW')),
      'awaiting_approval', count(*) FILTER (WHERE process_stage = 'AWAITING_APPROVAL' OR qualification_status = 'PENDING_APPROVAL'),
      'approved', count(*) FILTER (WHERE qualification_status = 'APPROVED')
    ) FROM monitoring),
    'priority', (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.overdue_tasks DESC, p.next_due NULLS LAST, p.created_at), '[]'::jsonb)
      FROM (SELECT id,candidate_code,business_name,category_name,pic_name,process_stage,
          total_followups,open_tasks,overdue_tasks,next_due,created_at
        FROM monitoring WHERE needs_followup OR overdue_tasks > 0
        ORDER BY overdue_tasks DESC, next_due NULLS LAST, created_at LIMIT 20) p),
    'stages', (SELECT coalesce(jsonb_object_agg(process_stage, n), '{}'::jsonb)
      FROM (SELECT process_stage,count(*) AS n FROM candidates GROUP BY process_stage) s),
    'pic_productivity', (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.activities_recorded DESC,p.pic_name,p.pic_id), '[]'::jsonb) FROM productivity p)
  ) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.vendor_sourcing_dashboard(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_sourcing_dashboard(uuid,uuid) TO authenticated;

-- Dipicu saat halaman monitoring dibuka/di-refresh; bukan scheduler latar belakang.
-- INVOKER: INSERT memakai policy notifications authenticated yang SUDAH ADA.
-- Satu kejadian overdue = satu tugas/PIC; tanpa tanggal pada ID, sehingga
-- refresh, pengirim serentak, atau pergantian hari tidak mengirim ulang kejadian sama.
CREATE OR REPLACE FUNCTION public.vendor_remind_overdue_followups()
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_count integer := 0; v_day date := (now() AT TIME ZONE 'Asia/Jakarta')::date; v_row record;
BEGIN
  IF NOT public.is_app_role(ARRAY['sourcing','hrd','super_admin']) THEN
    RAISE EXCEPTION 'Akses reminder vendor ditolak' USING ERRCODE = '42501';
  END IF;
  FOR v_row IN
    SELECT f.id, f.internal_pic_id, f.next_action, f.candidate_id, c.business_name
    FROM public.vendor_followups f JOIN public.vendor_candidates c ON c.id = f.candidate_id
    JOIN public.user_profiles up ON up.id = f.internal_pic_id AND up.account_status = 'ACTIVE'
    WHERE f.task_status = 'OPEN' AND f.next_action_due < now()
  LOOP
    BEGIN
      -- Jangan ON CONFLICT: itu memerlukan SELECT atas notifikasi PIC lain,
      -- sedangkan policy existing hanya mengizinkan penerima membaca miliknya.
      INSERT INTO public.notifications(id,user_id,notification_type,title,message,reference_type,reference_id,reference_url,notification_date)
      VALUES (md5('vendor-followup:' || v_row.id::text || ':' || v_row.internal_pic_id::text)::uuid,
        v_row.internal_pic_id, 'VENDOR_FOLLOWUP_OVERDUE', 'Follow-up vendor terlambat',
        v_row.business_name || ': ' || v_row.next_action, 'vendor_followup', v_row.id,
        '/vendor/followups?candidate=' || v_row.candidate_id::text || '&overdue=1', v_day);
      v_count := v_count + 1;
    EXCEPTION WHEN unique_violation THEN
      NULL; -- ID deterministik; aman terhadap pemanggilan serentak.
    END;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.vendor_remind_overdue_followups() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_remind_overdue_followups() TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;

```

## SQL rollback lengkap

```sql
-- HANYA rollback Fase 2 setelah persetujuan. Menghapus permanen log Fase 2!
-- Tidak CASCADE ke tabel existing; riwayat audit dan notifikasi tetap tersimpan.
BEGIN;
DROP FUNCTION IF EXISTS public.vendor_remind_overdue_followups();
DROP FUNCTION IF EXISTS public.vendor_sourcing_dashboard(uuid,uuid);
DROP TABLE IF EXISTS public.vendor_followups;
DROP FUNCTION IF EXISTS public.vendor_followups_audit();
DROP FUNCTION IF EXISTS public.vendor_followups_guard();
DROP SEQUENCE IF EXISTS public.vendor_followup_code_seq;
NOTIFY pgrst, 'reload schema';
COMMIT;

```
