-- ============================================================
-- PPM M2 Migration - Technical Specification Foundation
-- Meeting -> PO -> Product Item -> Component -> Specification
--
-- ADDITIVE migration. Does not drop/rename existing tables.
-- Reuses existing RLS patterns (M1 / M1.1).
--
--  1. Master    : component_specification_definitions
--  2. Transaksi : ppm_component_specifications
--  3. Seed definition awal (aman, berbasis PO nyata)
--  4. Original value preservation trigger
--  5. RLS mengikuti pattern ppm_item_components
-- ============================================================

-- ============================================================
-- 1. MASTER: COMPONENT SPECIFICATION DEFINITIONS
-- Menjawab: "Atribut apa yang dapat dimiliki komponen ini?"
-- Shared master. READ: authenticated active. WRITE: super_admin.
-- ============================================================
CREATE TABLE IF NOT EXISTS component_specification_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_definition_id UUID NOT NULL REFERENCES component_definitions(id) ON DELETE CASCADE,
  spec_key VARCHAR NOT NULL,
  spec_label VARCHAR NOT NULL,
  value_type VARCHAR NOT NULL
    CHECK (value_type IN ('TEXT','NUMBER','BOOLEAN','SELECT','MULTI_SELECT')),
  default_unit VARCHAR,
  options_json JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT component_spec_defs_unique UNIQUE (component_definition_id, spec_key)
);

CREATE INDEX IF NOT EXISTS idx_csd_component ON component_specification_definitions(component_definition_id);
CREATE INDEX IF NOT EXISTS idx_csd_active ON component_specification_definitions(is_active);

-- ============================================================
-- 2. TRANSACTION: PPM COMPONENT SPECIFICATIONS
-- Menjawab: "Untuk PO ini nilainya berapa?"
-- READ: authenticated active. WRITE: meeting creator / super_admin.
-- ============================================================
CREATE TABLE IF NOT EXISTS ppm_component_specifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_component_id UUID NOT NULL REFERENCES ppm_item_components(id) ON DELETE CASCADE,
  specification_definition_id UUID REFERENCES component_specification_definitions(id) ON DELETE SET NULL,
  spec_key_snapshot VARCHAR NOT NULL,
  spec_label_snapshot VARCHAR NOT NULL,
  value_type VARCHAR NOT NULL,
  value_text TEXT,
  value_number NUMERIC,
  value_boolean BOOLEAN,
  value_json JSONB,
  unit VARCHAR,
  source_type VARCHAR NOT NULL DEFAULT 'MANUAL'
    CHECK (source_type IN ('PO','MANUAL','MEETING','REFERENCE')),
  review_status VARCHAR NOT NULL DEFAULT 'NOT_REVIEWED'
    CHECK (review_status IN ('NOT_REVIEWED','CONFIRMED','DISCUSSION_REQUIRED','PENDING','RESOLVED')),
  is_custom BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  -- ORIGINAL VALUE (nilai awal tidak boleh hilang/overwrite setelah tersimpan)
  original_value_text TEXT,
  original_value_number NUMERIC,
  original_value_boolean BOOLEAN,
  original_value_json JSONB,
  reviewed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


CREATE INDEX IF NOT EXISTS idx_pcs_component ON ppm_component_specifications(item_component_id);
CREATE INDEX IF NOT EXISTS idx_pcs_definition ON ppm_component_specifications(specification_definition_id);
CREATE INDEX IF NOT EXISTS idx_pcs_review ON ppm_component_specifications(review_status);

-- Anti-duplikat: satu komponen hanya boleh punya SATU row per standard definition.
-- Custom spec (specification_definition_id IS NULL) boleh diulang.
CREATE UNIQUE INDEX IF NOT EXISTS ppm_component_specifications_std_unique
  ON ppm_component_specifications (item_component_id, specification_definition_id)
  WHERE specification_definition_id IS NOT NULL;

-- ============================================================
-- 3. ENABLE RLS
-- ============================================================
ALTER TABLE component_specification_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppm_component_specifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. DROP EXISTING POLICIES (idempotent)
-- ============================================================
DROP POLICY IF EXISTS "component_specification_definitions: authenticated read" ON component_specification_definitions;
DROP POLICY IF EXISTS "component_specification_definitions: super_admin manage" ON component_specification_definitions;
DROP POLICY IF EXISTS "ppm_component_specifications: read via component" ON ppm_component_specifications;
DROP POLICY IF EXISTS "ppm_component_specifications: insert via component" ON ppm_component_specifications;
DROP POLICY IF EXISTS "ppm_component_specifications: update via component" ON ppm_component_specifications;
DROP POLICY IF EXISTS "ppm_component_specifications: delete via component" ON ppm_component_specifications;
-- ============================================================
-- 5. RLS: component_specification_definitions (master)
-- ============================================================
CREATE POLICY "component_specification_definitions: authenticated read"
  ON component_specification_definitions FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
    )
  );

CREATE POLICY "component_specification_definitions: super_admin manage"
  ON component_specification_definitions FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid() AND r.role_name = 'super_admin' AND up.account_status = 'ACTIVE'
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid() AND r.role_name = 'super_admin' AND up.account_status = 'ACTIVE'
    )
  );

-- ============================================================
-- 6. RLS: ppm_component_specifications (transaksi)
-- ============================================================
-- Read: any authenticated active user
CREATE POLICY "ppm_component_specifications: read via component"
  ON ppm_component_specifications FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
    )
  );

-- Insert: authenticated AND is the component's PO meeting creator OR super_admin
CREATE POLICY "ppm_component_specifications: insert via component"
  ON ppm_component_specifications FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM ppm_item_components ic
      JOIN ppm_po_items item ON item.id = ic.po_item_id
      JOIN ppm_meeting_pos pos ON pos.id = item.meeting_po_id
      JOIN ppm_meetings pm ON pm.id = pos.meeting_id
      WHERE ic.id = item_component_id
      AND (
        pm.created_by = (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
          WHERE up.auth_user_id = auth.uid() AND r.role_name = 'super_admin' AND up.account_status = 'ACTIVE'
        )
      )
    )
  );

-- Update: authenticated AND meeting creator OR super_admin
CREATE POLICY "ppm_component_specifications: update via component"
  ON ppm_component_specifications FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM ppm_item_components ic
      JOIN ppm_po_items item ON item.id = ic.po_item_id
      JOIN ppm_meeting_pos pos ON pos.id = item.meeting_po_id
      JOIN ppm_meetings pm ON pm.id = pos.meeting_id
      WHERE ic.id = item_component_id
      AND (
        pm.created_by = (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
          WHERE up.auth_user_id = auth.uid() AND r.role_name = 'super_admin' AND up.account_status = 'ACTIVE'
        )
      )
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM ppm_item_components ic
      JOIN ppm_po_items item ON item.id = ic.po_item_id
      JOIN ppm_meeting_pos pos ON pos.id = item.meeting_po_id
      JOIN ppm_meetings pm ON pm.id = pos.meeting_id
      WHERE ic.id = item_component_id
      AND (
        pm.created_by = (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
          WHERE up.auth_user_id = auth.uid() AND r.role_name = 'super_admin' AND up.account_status = 'ACTIVE'
        )
      )
    )
  );

-- Delete: authenticated AND meeting creator OR super_admin
CREATE POLICY "ppm_component_specifications: delete via component"
  ON ppm_component_specifications FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM ppm_item_components ic
      JOIN ppm_po_items item ON item.id = ic.po_item_id
      JOIN ppm_meeting_pos pos ON pos.id = item.meeting_po_id
      JOIN ppm_meetings pm ON pm.id = pos.meeting_id
      WHERE ic.id = item_component_id
      AND (
        pm.created_by = (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
          WHERE up.auth_user_id = auth.uid() AND r.role_name = 'super_admin' AND up.account_status = 'ACTIVE'
        )
      )
    )
  );

-- ============================================================
-- 7. SEED: SPECIFICATION DEFINITIONS (idempotent, additive)
-- Hanya definisi yang cukup aman berdasarkan PO nyata.
-- JANGAN mengarang puluhan field.
-- ============================================================
INSERT INTO component_specification_definitions
  (component_definition_id, spec_key, spec_label, value_type, default_unit, sort_order, is_required_default)
SELECT cd.id, v.key, v.label, v.typ, v.unit, v.sort, v.req
FROM component_definitions cd
JOIN (VALUES
  -- KERAH
  ('KERAH','MODEL_KERAH','Model Kerah','TEXT',NULL,1,true),
  ('KERAH','TINGGI_KERAH','Tinggi Kerah','NUMBER','cm',2,true),
  -- SAKU_DADA
  ('SAKU_DADA','MODEL_SAKU','Model Saku','TEXT',NULL,1,true),
  ('SAKU_DADA','LEBAR_SAKU','Lebar Saku','NUMBER','cm',2,false),
  ('SAKU_DADA','TINGGI_SAKU','Tinggi Saku','NUMBER','cm',3,false),
  -- BAH_YOKE
  ('BAH_YOKE','STITCH_BAH','Stitch Bah / Yoke','TEXT',NULL,1,false),
  -- ARMHOLE
  ('ARMHOLE','STITCH_ARMHOLE','Stitch Armhole','TEXT',NULL,1,false),
  -- PLAKET
  ('PLAKET','LEBAR_PLAKET','Lebar Plaket','NUMBER','cm',1,false),
  -- MANSET
  ('MANSET','TINGGI_MANSET','Tinggi Manset','NUMBER','cm',1,false),
  -- BORDIR
  ('BORDIR','UKURAN_BORDIR','Ukuran Bordir','TEXT',NULL,1,false),
  ('BORDIR','POSISI_BORDIR','Posisi Bordir','TEXT',NULL,2,false),
  ('BORDIR','ARTWORK_BORDIR','Artwork / Logo','TEXT',NULL,3,false),
  -- VELCRO
  ('VELCRO','UKURAN_VELCRO','Ukuran Velcro','TEXT',NULL,1,false)
) v(code, key, label, typ, unit, sort, req) ON v.code = cd.code
ON CONFLICT (component_definition_id, spec_key) DO NOTHING;

-- ============================================================
-- 8. TRIGGER: updated_at (reuse existing M1 function)
-- ============================================================
DROP TRIGGER IF EXISTS trigger_csd_updated_at ON component_specification_definitions;
DROP TRIGGER IF EXISTS trigger_pcs_updated_at ON ppm_component_specifications;

CREATE TRIGGER trigger_csd_updated_at
  BEFORE UPDATE ON component_specification_definitions
  FOR EACH ROW EXECUTE FUNCTION update_ppm_m1_updated_at_column();

CREATE TRIGGER trigger_pcs_updated_at
  BEFORE UPDATE ON ppm_component_specifications
  FOR EACH ROW EXECUTE FUNCTION update_ppm_m1_updated_at_column();

-- ============================================================
-- 9. TRIGGER: ORIGINAL VALUE PRESERVATION
-- Nilai awal (original) disimpan PERTAMA KALI nilai muncul.
-- Setelah tersimpan, original TIDAK PERNAH di-overwrite.
-- Contoh: PO 'Tempel' -> Meeting 'Gamblok'
--   original_value_text = 'Tempel'
--   value_text          = 'Gamblok'
-- ============================================================
CREATE OR REPLACE FUNCTION ppm_preserve_spec_original_values()
RETURNS TRIGGER AS $$
BEGIN
  -- ============ INVALIDATE REVIEW on value edit ============
  -- Jika statement TIDAK mengubah review_status secara eksplisit
  -- (NEW.review_status = OLD.review_status) tetapi nilai BERUBAH pada spec
  -- yang statusnya CONFIRMED / RESOLVED, maka review di-reset ke
  -- NOT_REVIEWED (+ reviewed_by/at = null).
  -- TIDAK mengganggu Set Keputusan karena resolve mengubah review_status
  -- secara eksplisit (mis. DISCUSSION_REQUIRED/PENDING -> RESOLVED).
  IF TG_OP = 'UPDATE' AND NEW.review_status = OLD.review_status THEN
    IF OLD.review_status IN ('CONFIRMED','RESOLVED')
      AND (
        NEW.value_text IS DISTINCT FROM OLD.value_text
        OR NEW.value_number IS DISTINCT FROM OLD.value_number
        OR NEW.value_boolean IS DISTINCT FROM OLD.value_boolean
        OR NEW.value_json IS DISTINCT FROM OLD.value_json
      ) THEN
      NEW.review_status := 'NOT_REVIEWED';
      NEW.reviewed_by := NULL;
      NEW.reviewed_at := NULL;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.original_value_text IS NULL AND NEW.value_text IS NOT NULL THEN
      NEW.original_value_text := NEW.value_text;
    END IF;
    IF NEW.original_value_number IS NULL AND NEW.value_number IS NOT NULL THEN
      NEW.original_value_number := NEW.value_number;
    END IF;
    IF NEW.original_value_boolean IS NULL AND NEW.value_boolean IS NOT NULL THEN
      NEW.original_value_boolean := NEW.value_boolean;
    END IF;
    IF NEW.original_value_json IS NULL AND NEW.value_json IS NOT NULL THEN
      NEW.original_value_json := NEW.value_json;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: hanya set original jika masih null (nilai pertama kali tersimpan)
  IF TG_OP = 'UPDATE' THEN
    IF NEW.original_value_text IS NULL AND NEW.value_text IS NOT NULL THEN
      NEW.original_value_text := NEW.value_text;
    END IF;
    IF NEW.original_value_number IS NULL AND NEW.value_number IS NOT NULL THEN
      NEW.original_value_number := NEW.value_number;
    END IF;
    IF NEW.original_value_boolean IS NULL AND NEW.value_boolean IS NOT NULL THEN
      NEW.original_value_boolean := NEW.value_boolean;
    END IF;
    IF NEW.original_value_json IS NULL AND NEW.value_json IS NOT NULL THEN
      NEW.original_value_json := NEW.value_json;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pcs_preserve_original ON ppm_component_specifications;
CREATE TRIGGER trigger_pcs_preserve_original
  BEFORE INSERT OR UPDATE ON ppm_component_specifications
  FOR EACH ROW EXECUTE FUNCTION ppm_preserve_spec_original_values();

-- ============================================================
-- 10. VERIFY
-- ============================================================
SELECT 'PPM M2 migration completed successfully!' AS message;

