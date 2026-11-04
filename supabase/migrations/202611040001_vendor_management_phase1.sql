-- ============================================================
-- Migration: Modul Manajemen Vendor — Fase 1 (Core Sourcing)
-- Keputusan K1 final: HANYA role `sourcing` (tanpa role qc).
--
-- Isi (100% additive — tidak mengubah tabel/data existing):
--   1. Role `sourcing` + role_permissions module key vendor_*
--   2. Master: vendor_categories, vendor_specialties (+ seed)
--   3. Pipeline: vendor_candidates, vendor_candidate_specialties,
--      vendor_contacts
--   4. Jejak: vendor_status_history (trigger), vendor_activity_logs
--   5. RLS per tabel + index
--
-- Rollback: 202611040001_vendor_management_phase1_rollback.sql
-- Idempotent — aman dijalankan berulang.
-- ============================================================

-- ============================================================
-- 1. ROLE SOURCING + PERMISSIONS
-- ============================================================
INSERT INTO roles (role_name, description, is_active)
VALUES ('sourcing', 'Sourcing / Pengembangan Vendor', true)
ON CONFLICT (role_name) DO UPDATE
  SET description = EXCLUDED.description, is_active = true;

-- Module key vendor_* (konstanta MODULES di src/lib/permissions.js):
--   vendor_management, vendor_followups, vendor_samples,
--   vendor_qc, vendor_map, vendor_approval
-- Seed default (dapat diubah kapan saat lewat UI Akses Modul per Role):
--   sourcing = semua (pengelola pipeline)
--   direksi  = semua (baca seluruh info termasuk hasil QC + persetujuan fase 5)
--   hrd      = hanya vendor_management (fallback admin; perluas via UI bila perlu)
-- Super Admin bypass di kode.
INSERT INTO role_permissions (role_id, module_key, can_access)
SELECT r.id, k.module_key, true
FROM roles r
CROSS JOIN (
  VALUES ('vendor_management'), ('vendor_followups'), ('vendor_samples'),
         ('vendor_qc'), ('vendor_map'), ('vendor_approval')
) AS k(module_key)
WHERE r.role_name IN ('sourcing', 'direksi')
ON CONFLICT (role_id, module_key) DO NOTHING;

INSERT INTO role_permissions (role_id, module_key, can_access)
SELECT r.id, 'vendor_management', true
FROM roles r
WHERE r.role_name = 'hrd'
ON CONFLICT (role_id, module_key) DO NOTHING;

-- ============================================================
-- 2. MASTER KATEGORI & SPESIALISASI
-- ============================================================
CREATE TABLE IF NOT EXISTS vendor_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES vendor_categories(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (category_id, name)
);

-- Seed kategori (spec §3 — daftar dikendalikan administrator)
INSERT INTO vendor_categories (name, display_order, description) VALUES
  ('Jahit', 1, 'Konveksi / maklun jahit'),
  ('Bordir', 2, 'Bordir komputer, patch, emblem'),
  ('Supplier Kain', 3, 'Penjual / distributor kain'),
  ('Pabrik Kain', 4, 'Produsen kain (weaving/greige)'),
  ('Cutting', 5, 'Jasa potong kain'),
  ('Sablon/Printing', 6, 'Sablon & printing tekstil'),
  ('Finishing', 7, 'Cucian, setrika, finishing'),
  ('Packing', 8, 'Pengemasan produk'),
  ('Lainnya', 9, 'Kategori lain di luar daftar')
ON CONFLICT (name) DO NOTHING;

-- Seed spesialisasi (spec §3 menyebut eksplisit untuk Jahit & Bordir)
INSERT INTO vendor_specialties (category_id, name)
SELECT c.id, s.name
FROM vendor_categories c
JOIN (VALUES
  ('Jahit', 'Kemeja Kantor'), ('Jahit', 'Kemeja Lapangan'),
  ('Jahit', 'Celana'), ('Jahit', 'Jaket'),
  ('Jahit', 'Wearpack'), ('Jahit', 'Rompi'),
  ('Bordir', 'Bordir Komputer'), ('Bordir', 'Patch/Emblem'),
  ('Bordir', 'Bordir Nama'),
  ('Supplier Kain', 'Kain Drill'), ('Supplier Kain', 'Kain Tropical'),
  ('Supplier Kain', 'Kain Baby Canvas'), ('Supplier Kain', 'Kain Katun'),
  ('Supplier Kain', 'Kain Lainnya'),
  ('Pabrik Kain', 'Kain Drill'), ('Pabrik Kain', 'Kain Canvas'),
  ('Pabrik Kain', 'Kain Lainnya'),
  ('Cutting', 'Potong Massal'), ('Cutting', 'Potong Small Order'),
  ('Sablon/Printing', 'Plastisol'), ('Sablon/Printing', 'DTF'),
  ('Sablon/Printing', 'DTG'), ('Sablon/Printing', 'Large Format'),
  ('Finishing', 'Cucian (Washing)'), ('Finishing', 'Setrika & Packing'),
  ('Packing', 'Packing Polybag'), ('Packing', 'Packing Karton')
) AS s(category, name) ON s.category = c.name
ON CONFLICT (category_id, name) DO NOTHING;

-- ============================================================
-- 3. PIPELINE CALON VENDOR
-- ============================================================
-- Sequence kode kandidat: VR-0001, VR-0002, ...
CREATE SEQUENCE IF NOT EXISTS vendor_candidate_code_seq START 1;

CREATE TABLE IF NOT EXISTS vendor_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_code VARCHAR(20) UNIQUE NOT NULL
    DEFAULT 'VR-' || LPAD(nextval('vendor_candidate_code_seq')::text, 4, '0'),
  business_name VARCHAR(255) NOT NULL,
  business_type VARCHAR(20) NOT NULL DEFAULT 'USAHA'
    CHECK (business_type IN ('USAHA', 'PERORANGAN')),
  category_id UUID REFERENCES vendor_categories(id),
  internal_pic_id UUID REFERENCES user_profiles(id), -- PIC Harmas (Sourcing)
  source VARCHAR(50) CHECK (source IN (
    'REFERENSI', 'GOOGLE_MAPS', 'GOOGLE_SEARCH', 'INSTAGRAM',
    'MARKETPLACE', 'KUNJUNGAN', 'PAMERAN', 'LAINNYA')),
  -- Tiga dimensi status (spec §2) — perubahan tercatat di vendor_status_history
  process_stage VARCHAR(40) NOT NULL DEFAULT 'LEAD' CHECK (process_stage IN (
    'LEAD', 'CONTACTING', 'PROFILE_VERIFICATION', 'SITE_VERIFICATION',
    'SAMPLE_ASSIGNED', 'SAMPLE_IN_PROGRESS', 'SAMPLE_RECEIVED',
    'QC_REVIEW', 'SAMPLE_REVISION', 'AWAITING_APPROVAL',
    'CLOSED', 'ABANDONED')),
  qualification_status VARCHAR(40) NOT NULL DEFAULT 'PROSPECT' CHECK (qualification_status IN (
    'PROSPECT', 'UNDER_EVALUATION', 'PENDING_APPROVAL',
    'APPROVED', 'RESERVE', 'REJECTED', 'FROZEN')),
  operational_status VARCHAR(20) NOT NULL DEFAULT 'NOT_ACTIVE' CHECK (operational_status IN (
    'NOT_ACTIVE', 'ACTIVE', 'SUSPENDED', 'INACTIVE')),
  -- Profil komersial
  capacity_qty NUMERIC(12,2),
  capacity_unit VARCHAR(20) CHECK (capacity_unit IN (
    'pcs', 'meter', 'kg', 'roll', 'stitch', 'set', 'lainnya')),
  moq VARCHAR(100),
  lead_time_days INTEGER CHECK (lead_time_days >= 0),
  indicative_price NUMERIC(14,2),
  payment_term VARCHAR(100),
  service_area TEXT,
  legal_status VARCHAR(30) NOT NULL DEFAULT 'BELUM_DICEK' CHECK (legal_status IN (
    'BELUM_DICEK', 'PROSES_VERIFIKASI', 'LENGKAP', 'TIDAK_LENGKAP')),
  notes TEXT,
  -- Identitas tunggal ke master Vendor (K2): diisi HANYA oleh aktivasi eksplisit (fase 5)
  vendor_id UUID REFERENCES vendors(id),
  activated_at TIMESTAMPTZ,
  activated_by UUID REFERENCES user_profiles(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES user_profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_candidates_stage ON vendor_candidates(process_stage);
CREATE INDEX IF NOT EXISTS idx_vendor_candidates_qualification ON vendor_candidates(qualification_status);
CREATE INDEX IF NOT EXISTS idx_vendor_candidates_operational ON vendor_candidates(operational_status);
CREATE INDEX IF NOT EXISTS idx_vendor_candidates_category ON vendor_candidates(category_id);
CREATE INDEX IF NOT EXISTS idx_vendor_candidates_pic ON vendor_candidates(internal_pic_id);
CREATE INDEX IF NOT EXISTS idx_vendor_candidates_vendor ON vendor_candidates(vendor_id);

-- Kontak vendor (multi-kontak per kandidat)
CREATE TABLE IF NOT EXISTS vendor_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES vendor_candidates(id) ON DELETE CASCADE,
  contact_name VARCHAR(255) NOT NULL,
  role_title VARCHAR(100), -- Pemilik / Admin / dst.
  phone VARCHAR(50),
  whatsapp VARCHAR(50),
  email VARCHAR(255),
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vendor_contacts_candidate ON vendor_contacts(candidate_id);

-- Spesialisasi M:N
CREATE TABLE IF NOT EXISTS vendor_candidate_specialties (
  candidate_id UUID NOT NULL REFERENCES vendor_candidates(id) ON DELETE CASCADE,
  specialty_id UUID NOT NULL REFERENCES vendor_specialties(id) ON DELETE CASCADE,
  PRIMARY KEY (candidate_id, specialty_id)
);

-- ============================================================
-- 4. JEJAK STATUS & AKTIVITAS
-- ============================================================
CREATE TABLE IF NOT EXISTS vendor_status_history (
  id BIGSERIAL PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES vendor_candidates(id) ON DELETE CASCADE,
  field_name VARCHAR(50) NOT NULL, -- process_stage | qualification_status | operational_status
  old_value VARCHAR(40),
  new_value VARCHAR(40),
  changed_by UUID REFERENCES user_profiles(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  change_source VARCHAR(50) DEFAULT 'APP'
);
CREATE INDEX IF NOT EXISTS idx_vendor_status_history_candidate ON vendor_status_history(candidate_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS vendor_activity_logs (
  id BIGSERIAL PRIMARY KEY,
  candidate_id UUID REFERENCES vendor_candidates(id) ON DELETE CASCADE,
  entity_table VARCHAR(100) NOT NULL,
  entity_id UUID,
  action VARCHAR(50) NOT NULL, -- created | profile_updated | ...
  old_values JSONB,
  new_values JSONB,
  actor_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vendor_activity_logs_candidate ON vendor_activity_logs(candidate_id, created_at DESC);

-- ============================================================
-- 5. TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION vendor_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vendor_categories_updated_at ON vendor_categories;
CREATE TRIGGER trg_vendor_categories_updated_at BEFORE UPDATE ON vendor_categories
  FOR EACH ROW EXECUTE FUNCTION vendor_set_updated_at();
DROP TRIGGER IF EXISTS trg_vendor_specialties_updated_at ON vendor_specialties;
CREATE TRIGGER trg_vendor_specialties_updated_at BEFORE UPDATE ON vendor_specialties
  FOR EACH ROW EXECUTE FUNCTION vendor_set_updated_at();
DROP TRIGGER IF EXISTS trg_vendor_candidates_updated_at ON vendor_candidates;
CREATE TRIGGER trg_vendor_candidates_updated_at BEFORE UPDATE ON vendor_candidates
  FOR EACH ROW EXECUTE FUNCTION vendor_set_updated_at();

-- GUARD KEOLOSAN HAK AKSES (review poin 3):
-- RLS policy UPDATE hanya memeriksa role tulis; tanpa guard ini sourcing
-- bisa set qualification_status='APPROVED' atau operational_status='ACTIVE'
-- langsung lewat API Supabase. Trigger ini menolak perubahan:
--   - kelayakan MENJAUH/DARI nilai keputusan (APPROVED/RESERVE/REJECTED/FROZEN)
--   - operational_status / vendor_id / activated_at / activated_by (aktivasi)
-- kecuali aktor = direksi/super_admin (modul persetujuan) ATAU jalur
-- service/SECURITY DEFINER (auth.uid() NULL — dipakai RPC aktivasi fase 5).
-- Perpindahan pipeline non-keputusan (PROSPECT→UNDER_EVALUATION→PENDING_APPROVAL)
-- tetap boleh oleh sourcing.
CREATE OR REPLACE FUNCTION vendor_guard_restricted_columns()
RETURNS TRIGGER AS $$
DECLARE
  v_allowed BOOLEAN;
BEGIN
  IF (NEW.qualification_status IS DISTINCT FROM OLD.qualification_status
      AND (NEW.qualification_status IN ('APPROVED','RESERVE','REJECTED','FROZEN')
           OR OLD.qualification_status IN ('APPROVED','RESERVE','REJECTED','FROZEN')))
     OR NEW.operational_status IS DISTINCT FROM OLD.operational_status
     OR NEW.vendor_id IS DISTINCT FROM OLD.vendor_id
     OR NEW.activated_at IS DISTINCT FROM OLD.activated_at
     OR NEW.activated_by IS DISTINCT FROM OLD.activated_by THEN

    SELECT (auth.uid() IS NULL
            OR EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
                       WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
                         AND r.role_name IN ('direksi', 'super_admin')))
    INTO v_allowed;

    IF NOT v_allowed THEN
      RAISE EXCEPTION 'DITOLAK: keputusan kelayakan/aktivasi vendor hanya boleh direksi/super_admin melalui modul persetujuan';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vendor_candidates_guard ON vendor_candidates;
CREATE TRIGGER trg_vendor_candidates_guard BEFORE UPDATE ON vendor_candidates
  FOR EACH ROW EXECUTE FUNCTION vendor_guard_restricted_columns();

-- Perubahan 3 dimensi status → vendor_status_history (SECURITY DEFINER:
-- insert history tetap jalan apa pun RLS pemanggil)
CREATE OR REPLACE FUNCTION vendor_record_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.process_stage IS DISTINCT FROM NEW.process_stage THEN
    INSERT INTO vendor_status_history (candidate_id, field_name, old_value, new_value, changed_by)
    VALUES (NEW.id, 'process_stage', OLD.process_stage, NEW.process_stage, NEW.updated_by);
  END IF;
  IF OLD.qualification_status IS DISTINCT FROM NEW.qualification_status THEN
    INSERT INTO vendor_status_history (candidate_id, field_name, old_value, new_value, changed_by)
    VALUES (NEW.id, 'qualification_status', OLD.qualification_status, NEW.qualification_status, NEW.updated_by);
  END IF;
  IF OLD.operational_status IS DISTINCT FROM NEW.operational_status THEN
    INSERT INTO vendor_status_history (candidate_id, field_name, old_value, new_value, changed_by)
    VALUES (NEW.id, 'operational_status', OLD.operational_status, NEW.operational_status, NEW.updated_by);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_vendor_candidates_status_history ON vendor_candidates;
CREATE TRIGGER trg_vendor_candidates_status_history AFTER UPDATE ON vendor_candidates
  FOR EACH ROW EXECUTE FUNCTION vendor_record_status_change();

-- Aktivitas: created + perubahan profil (non-status) → vendor_activity_logs
CREATE OR REPLACE FUNCTION vendor_record_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO vendor_activity_logs (candidate_id, entity_table, entity_id, action, new_values, actor_id)
    VALUES (NEW.id, 'vendor_candidates', NEW.id, 'created',
            jsonb_build_object('business_name', NEW.business_name, 'process_stage', NEW.process_stage),
            NEW.created_by);
    RETURN NEW;
  END IF;
  -- UPDATE: log hanya jika ada kolom non-status/non-audit yang berubah
  IF NEW.business_name IS DISTINCT FROM OLD.business_name
     OR NEW.business_type IS DISTINCT FROM OLD.business_type
     OR NEW.category_id IS DISTINCT FROM OLD.category_id
     OR NEW.internal_pic_id IS DISTINCT FROM OLD.internal_pic_id
     OR NEW.source IS DISTINCT FROM OLD.source
     OR NEW.capacity_qty IS DISTINCT FROM OLD.capacity_qty
     OR NEW.capacity_unit IS DISTINCT FROM OLD.capacity_unit
     OR NEW.moq IS DISTINCT FROM OLD.moq
     OR NEW.lead_time_days IS DISTINCT FROM OLD.lead_time_days
     OR NEW.indicative_price IS DISTINCT FROM OLD.indicative_price
     OR NEW.payment_term IS DISTINCT FROM OLD.payment_term
     OR NEW.service_area IS DISTINCT FROM OLD.service_area
     OR NEW.legal_status IS DISTINCT FROM OLD.legal_status
     OR NEW.notes IS DISTINCT FROM OLD.notes THEN
    INSERT INTO vendor_activity_logs (candidate_id, entity_table, entity_id, action, old_values, new_values, actor_id)
    VALUES (NEW.id, 'vendor_candidates', NEW.id, 'profile_updated',
            jsonb_build_object('business_name', OLD.business_name, 'category_id', OLD.category_id,
                               'capacity_qty', OLD.capacity_qty, 'lead_time_days', OLD.lead_time_days,
                               'legal_status', OLD.legal_status, 'notes', OLD.notes),
            jsonb_build_object('business_name', NEW.business_name, 'category_id', NEW.category_id,
                               'capacity_qty', NEW.capacity_qty, 'lead_time_days', NEW.lead_time_days,
                               'legal_status', NEW.legal_status, 'notes', NEW.notes),
            NEW.updated_by);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_vendor_candidates_activity ON vendor_candidates;
CREATE TRIGGER trg_vendor_candidates_activity AFTER INSERT OR UPDATE ON vendor_candidates
  FOR EACH ROW EXECUTE FUNCTION vendor_record_activity();

-- ============================================================
-- 6. RLS
-- ============================================================
ALTER TABLE vendor_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_candidate_specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_activity_logs ENABLE ROW LEVEL SECURITY;

-- Predikat role konsisten dengan pola migration existing
-- (join user_profiles → roles, account_status ACTIVE).

-- Master: baca semua authenticated; tulis sourcing/hrd/super_admin
DROP POLICY IF EXISTS "Vendor master read" ON vendor_categories;
CREATE POLICY "Vendor master read" ON vendor_categories
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Vendor master write" ON vendor_categories;
CREATE POLICY "Vendor master write" ON vendor_categories
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
            WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
              AND r.role_name IN ('sourcing', 'hrd', 'super_admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
            WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
              AND r.role_name IN ('sourcing', 'hrd', 'super_admin'))
  );

DROP POLICY IF EXISTS "Vendor specialty read" ON vendor_specialties;
CREATE POLICY "Vendor specialty read" ON vendor_specialties
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Vendor specialty write" ON vendor_specialties;
CREATE POLICY "Vendor specialty write" ON vendor_specialties
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
            WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
              AND r.role_name IN ('sourcing', 'hrd', 'super_admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
            WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
              AND r.role_name IN ('sourcing', 'hrd', 'super_admin'))
  );

-- Kandidat: baca semua authenticated; tulis sourcing/hrd/super_admin;
-- TANPA policy DELETE → baris tidak bisa dihapus (jejak permanen, spec §2/§6)
DROP POLICY IF EXISTS "Vendor candidates read" ON vendor_candidates;
CREATE POLICY "Vendor candidates read" ON vendor_candidates
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Vendor candidates insert" ON vendor_candidates;
CREATE POLICY "Vendor candidates insert" ON vendor_candidates
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
            WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
              AND r.role_name IN ('sourcing', 'hrd', 'super_admin'))
  );
DROP POLICY IF EXISTS "Vendor candidates update" ON vendor_candidates;
CREATE POLICY "Vendor candidates update" ON vendor_candidates
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
            WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
              AND r.role_name IN ('sourcing', 'hrd', 'super_admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
            WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
              AND r.role_name IN ('sourcing', 'hrd', 'super_admin'))
  );

DROP POLICY IF EXISTS "Vendor candidate specialties read" ON vendor_candidate_specialties;
CREATE POLICY "Vendor candidate specialties read" ON vendor_candidate_specialties
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Vendor candidate specialties write" ON vendor_candidate_specialties;
CREATE POLICY "Vendor candidate specialties write" ON vendor_candidate_specialties
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
            WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
              AND r.role_name IN ('sourcing', 'hrd', 'super_admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
            WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
              AND r.role_name IN ('sourcing', 'hrd', 'super_admin'))
  );

DROP POLICY IF EXISTS "Vendor contacts read" ON vendor_contacts;
CREATE POLICY "Vendor contacts read" ON vendor_contacts
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Vendor contacts insert" ON vendor_contacts;
CREATE POLICY "Vendor contacts insert" ON vendor_contacts
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
            WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
              AND r.role_name IN ('sourcing', 'hrd', 'super_admin'))
  );
DROP POLICY IF EXISTS "Vendor contacts update" ON vendor_contacts;
CREATE POLICY "Vendor contacts update" ON vendor_contacts
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
            WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
              AND r.role_name IN ('sourcing', 'hrd', 'super_admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
            WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
              AND r.role_name IN ('sourcing', 'hrd', 'super_admin'))
  );
-- Kontak adalah data operasional profil (bukan jejak audit) — boleh dihapus
-- saat sinkronisasi form (pola delete+insert sama seperti penanggung jawab aset).
DROP POLICY IF EXISTS "Vendor contacts delete" ON vendor_contacts;
CREATE POLICY "Vendor contacts delete" ON vendor_contacts
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
            WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
              AND r.role_name IN ('sourcing', 'hrd', 'super_admin'))
  );

-- History & log: baca semua authenticated; insert hanya via trigger
-- (SECURITY DEFINER bypass RLS). Tanpa policy write → tabel immutable
-- dari sisi aplikasi (append-only penuh).
DROP POLICY IF EXISTS "Vendor status history read" ON vendor_status_history;
CREATE POLICY "Vendor status history read" ON vendor_status_history
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Vendor activity logs read" ON vendor_activity_logs;
CREATE POLICY "Vendor activity logs read" ON vendor_activity_logs
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 7. SELESAI
-- ============================================================
NOTIFY pgrst, 'reload schema';
