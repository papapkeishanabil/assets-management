-- ============================================================
-- PPM M4.5A Migration - Specification Template + Simple Technical Standards
--
-- Menjawab: "Untuk Product Type tertentu, komponen/spec field apa yang
--   seharusnya ada, nilai apa yang disarankan, mana yang wajib, dan apa
--   standar teknis resmi Harmas/Ofissio?"
--
-- BUKAN menjawab "Apa model WIKA Kemeja HSE R01?" — itu M4.5B (Customer
-- Model Reference). TIDAK ada tabel customer model di migration ini.
--
-- ADDITIVE ONLY:
--   * Tidak DROP/RENAME/destructive ALTER pada tabel existing.
--   * Reuse master M1/M2 (product_types, component_definitions,
--     component_specification_definitions) — template = KOMPOSISI,
--     bukan duplikat master.
--   * Reuse trigger helper update_ppm_m1_updated_at_column().
--   * Seed product types KEMEJA_LAPANGAN/KEMEJA_KANTOR idempotent
--     (legacy KEMEJA TIDAK disentuh).
--   * TIDAK ada seed WIKA/business data (diinput user via UI, M4.5B).
--
-- SEMANTICS (eksplisit, jangan dicampur):
--   DEFAULT  = nilai awal yang disarankan (template_specs.default_value_*)
--   STANDARD = aturan teknis resmi Harmas/Ofissio (company_technical_standards)
--   REQUIRED = spec wajib punya nilai untuk kelengkapan
--   standard_id = referensi standard eksplisit per template spec, DIPAKAI
--                 SAAT KOMPOSE (future M4.5B). BUKAN rule engine —
--                 conditional standard (IF ... THEN ...) = DEFERRED.
--
-- UNIQUENESS STRATEGY (NULL-SAFE — PostgreSQL UNIQUE memperlakukan NULL
-- sebagai nilai BERBEDA, jadi ordinary UNIQUE TIDAK cukup):
--   ppm_spec_template_components:
--     * standard component (component_definition_id NOT NULL):
--       UNIQUE (template_id, component_definition_id, (location_label IS NULL),
--               location_label)  — mirror M1.1
--     * custom component (component_definition_id IS NULL):
--       UNIQUE partial (template_id, component_name_snapshot,
--               (location_label IS NULL), location_label)
--       WHERE component_definition_id IS NULL
--       -> custom component yang sama tidak bisa dobel di template sama.
--   ppm_spec_template_specs:
--     * standard spec (specification_definition_id NOT NULL):
--       UNIQUE partial (template_component_id, specification_definition_id)
--       WHERE specification_definition_id IS NOT NULL  — mirror M2
--     * custom spec (specification_definition_id IS NULL):
--       UNIQUE partial (template_component_id, spec_key_snapshot)
--       WHERE specification_definition_id IS NULL
--       -> custom spec key tidak bisa dobel dalam satu template component.
--   ppm_company_technical_standard_specs:
--       UNIQUE (standard_id, spec_key_snapshot)  — satu key per standard
--       (spec_key_snapshot NOT NULL, aman dari NULL-trap).
-- ============================================================

-- ============================================================
-- 0. SEED: PRODUCT TYPES (idempotent, additive)
-- ============================================================
INSERT INTO product_types (code, name, description, is_active)
VALUES
  ('KEMEJA_LAPANGAN', 'Kemeja Lapangan', 'Kemeja kerja lapangan (HSE/operasional)', true),
  ('KEMEJA_KANTOR', 'Kemeja Kantor', 'Kemeja kerja kantor', true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 1. MASTER: SPEC TEMPLATES
-- "Kumpulan komponen+spec yang dipakai membuat produk tipe ini."
-- ============================================================
CREATE TABLE IF NOT EXISTS ppm_spec_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  product_type_id UUID REFERENCES product_types(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pst_product_type ON ppm_spec_templates(product_type_id);

-- ============================================================
-- 2. MASTER: SPEC TEMPLATE COMPONENTS
-- Komponen yang berpartisipasi + urutan + required + lokasi.
-- component_definition_id NULL = custom component (snapshot name).
-- ============================================================
CREATE TABLE IF NOT EXISTS ppm_spec_template_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES ppm_spec_templates(id) ON DELETE CASCADE,
  component_definition_id UUID REFERENCES component_definitions(id) ON DELETE SET NULL,
  component_name_snapshot VARCHAR(255) NOT NULL,
  location_label VARCHAR(255),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pstc_template ON ppm_spec_template_components(template_id);
CREATE INDEX IF NOT EXISTS idx_pstc_definition ON ppm_spec_template_components(component_definition_id);

-- NULL-SAFE uniqueness (lihat header):
-- * standard component: unik per (template, definition, lokasi).
--   COALESCE(location_label,'') = NULL-safe — tanpanya, NULL location_label
--   dianggap BEDA oleh PostgreSQL sehingga duplicate dengan lokasi NULL
--   akan lolos (NULL-trap).
CREATE UNIQUE INDEX IF NOT EXISTS ppm_spec_template_components_std_unique
  ON ppm_spec_template_components (
    template_id,
    component_definition_id,
    COALESCE(location_label, '')
  )
  WHERE component_definition_id IS NOT NULL;

-- * custom component: unik per (template, nama snapshot, lokasi), NULL-safe
CREATE UNIQUE INDEX IF NOT EXISTS ppm_spec_template_components_custom_unique
  ON ppm_spec_template_components (
    template_id,
    component_name_snapshot,
    COALESCE(location_label, '')
  )
  WHERE component_definition_id IS NULL;

-- ============================================================
-- 3. MASTER: COMPANY TECHNICAL STANDARDS
-- Aturan teknis resmi Harmas/Ofissio. V1 = simple scoped value.
-- product_type_id = scope display/filter, BUKAN lookup resolusi.
-- ============================================================
CREATE TABLE IF NOT EXISTS ppm_company_technical_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  product_type_id UUID REFERENCES product_types(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pcts_product_type ON ppm_company_technical_standards(product_type_id);

-- ============================================================
-- 4. MASTER: COMPANY TECHNICAL STANDARD SPECS
-- Nilai standar per spec field (typed).
-- ============================================================
CREATE TABLE IF NOT EXISTS ppm_company_technical_standard_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_id UUID NOT NULL REFERENCES ppm_company_technical_standards(id) ON DELETE CASCADE,
  component_definition_id UUID REFERENCES component_definitions(id) ON DELETE SET NULL,
  specification_definition_id UUID REFERENCES component_specification_definitions(id) ON DELETE SET NULL,
  spec_key_snapshot VARCHAR NOT NULL,
  value_type VARCHAR NOT NULL
    CHECK (value_type IN ('TEXT','NUMBER','BOOLEAN','SELECT','MULTI_SELECT')),
  unit VARCHAR,
  value_text TEXT,
  value_number NUMERIC,
  value_boolean BOOLEAN,
  value_json JSONB,
  is_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pctss_standard ON ppm_company_technical_standard_specs(standard_id);
CREATE INDEX IF NOT EXISTS idx_pctss_component ON ppm_company_technical_standard_specs(component_definition_id);

-- Satu key per standard (spec_key_snapshot NOT NULL — aman dari NULL-trap).
CREATE UNIQUE INDEX IF NOT EXISTS ppm_company_technical_standard_specs_key_unique
  ON ppm_company_technical_standard_specs (standard_id, spec_key_snapshot);

-- ============================================================
-- 5. MASTER: SPEC TEMPLATE SPECS
-- Field apa yang perlu diketahui + DEFAULT + REQUIRED + standard link.
-- specification_definition_id NULL = custom spec.
-- standard_id = referensi eksplisit (simple mapping, BUKAN rule engine).
-- ============================================================
CREATE TABLE IF NOT EXISTS ppm_spec_template_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_component_id UUID NOT NULL REFERENCES ppm_spec_template_components(id) ON DELETE CASCADE,
  specification_definition_id UUID REFERENCES component_specification_definitions(id) ON DELETE SET NULL,
  spec_key_snapshot VARCHAR NOT NULL,
  spec_label_snapshot VARCHAR NOT NULL,
  value_type VARCHAR NOT NULL
    CHECK (value_type IN ('TEXT','NUMBER','BOOLEAN','SELECT','MULTI_SELECT')),
  unit VARCHAR,
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  default_value_text TEXT,
  default_value_number NUMERIC,
  default_value_boolean BOOLEAN,
  default_value_json JSONB,
  standard_id UUID REFERENCES ppm_company_technical_standards(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_psts_template_component ON ppm_spec_template_specs(template_component_id);
CREATE INDEX IF NOT EXISTS idx_psts_definition ON ppm_spec_template_specs(specification_definition_id);
CREATE INDEX IF NOT EXISTS idx_psts_standard ON ppm_spec_template_specs(standard_id);

-- NULL-SAFE uniqueness (lihat header):
-- * standard spec: satu per (component, definition)
CREATE UNIQUE INDEX IF NOT EXISTS ppm_spec_template_specs_std_unique
  ON ppm_spec_template_specs (template_component_id, specification_definition_id)
  WHERE specification_definition_id IS NOT NULL;

-- * custom spec: satu per (component, spec_key_snapshot)
CREATE UNIQUE INDEX IF NOT EXISTS ppm_spec_template_specs_custom_unique
  ON ppm_spec_template_specs (template_component_id, spec_key_snapshot)
  WHERE specification_definition_id IS NULL;

-- ============================================================
-- 6. ENABLE RLS
-- ============================================================
ALTER TABLE ppm_spec_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppm_spec_template_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppm_spec_template_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppm_company_technical_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppm_company_technical_standard_specs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. DROP EXISTING POLICIES (idempotent)
-- ============================================================
DROP POLICY IF EXISTS "ppm_spec_templates: authenticated read" ON ppm_spec_templates;
DROP POLICY IF EXISTS "ppm_spec_templates: super_admin manage" ON ppm_spec_templates;
DROP POLICY IF EXISTS "ppm_spec_template_components: authenticated read" ON ppm_spec_template_components;
DROP POLICY IF EXISTS "ppm_spec_template_components: super_admin manage" ON ppm_spec_template_components;
DROP POLICY IF EXISTS "ppm_spec_template_specs: authenticated read" ON ppm_spec_template_specs;
DROP POLICY IF EXISTS "ppm_spec_template_specs: super_admin manage" ON ppm_spec_template_specs;
DROP POLICY IF EXISTS "ppm_company_technical_standards: authenticated read" ON ppm_company_technical_standards;
DROP POLICY IF EXISTS "ppm_company_technical_standards: super_admin manage" ON ppm_company_technical_standards;
DROP POLICY IF EXISTS "ppm_company_technical_standard_specs: authenticated read" ON ppm_company_technical_standard_specs;
DROP POLICY IF EXISTS "ppm_company_technical_standard_specs: super_admin manage" ON ppm_company_technical_standard_specs;

-- ============================================================
-- 8. RLS POLICIES (pola master M1/M2: Pattern A read, super_admin write)
-- ============================================================

-- READ: authenticated ACTIVE (Pattern A)
CREATE POLICY "ppm_spec_templates: authenticated read"
  ON ppm_spec_templates FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
    )
  );

-- WRITE: super_admin only (Pattern B master)
CREATE POLICY "ppm_spec_templates: super_admin manage"
  ON ppm_spec_templates FOR ALL
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

CREATE POLICY "ppm_spec_template_components: authenticated read"
  ON ppm_spec_template_components FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
    )
  );

CREATE POLICY "ppm_spec_template_components: super_admin manage"
  ON ppm_spec_template_components FOR ALL
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

CREATE POLICY "ppm_spec_template_specs: authenticated read"
  ON ppm_spec_template_specs FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
    )
  );

CREATE POLICY "ppm_spec_template_specs: super_admin manage"
  ON ppm_spec_template_specs FOR ALL
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

CREATE POLICY "ppm_company_technical_standards: authenticated read"
  ON ppm_company_technical_standards FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
    )
  );

CREATE POLICY "ppm_company_technical_standards: super_admin manage"
  ON ppm_company_technical_standards FOR ALL
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

CREATE POLICY "ppm_company_technical_standard_specs: authenticated read"
  ON ppm_company_technical_standard_specs FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
    )
  );

CREATE POLICY "ppm_company_technical_standard_specs: super_admin manage"
  ON ppm_company_technical_standard_specs FOR ALL
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
-- 9. TRIGGER: updated_at (reuse M1 helper)
-- ============================================================
DROP TRIGGER IF EXISTS trigger_pst_updated_at ON ppm_spec_templates;
DROP TRIGGER IF EXISTS trigger_pstc_updated_at ON ppm_spec_template_components;
DROP TRIGGER IF EXISTS trigger_psts_updated_at ON ppm_spec_template_specs;
DROP TRIGGER IF EXISTS trigger_pcts_updated_at ON ppm_company_technical_standards;
DROP TRIGGER IF EXISTS trigger_pctss_updated_at ON ppm_company_technical_standard_specs;

CREATE TRIGGER trigger_pst_updated_at
  BEFORE UPDATE ON ppm_spec_templates
  FOR EACH ROW EXECUTE FUNCTION update_ppm_m1_updated_at_column();

CREATE TRIGGER trigger_pstc_updated_at
  BEFORE UPDATE ON ppm_spec_template_components
  FOR EACH ROW EXECUTE FUNCTION update_ppm_m1_updated_at_column();

CREATE TRIGGER trigger_psts_updated_at
  BEFORE UPDATE ON ppm_spec_template_specs
  FOR EACH ROW EXECUTE FUNCTION update_ppm_m1_updated_at_column();

CREATE TRIGGER trigger_pcts_updated_at
  BEFORE UPDATE ON ppm_company_technical_standards
  FOR EACH ROW EXECUTE FUNCTION update_ppm_m1_updated_at_column();

CREATE TRIGGER trigger_pctss_updated_at
  BEFORE UPDATE ON ppm_company_technical_standard_specs
  FOR EACH ROW EXECUTE FUNCTION update_ppm_m1_updated_at_column();

-- ============================================================
-- 10. VERIFY
-- ============================================================
SELECT 'PPM M4.5A migration completed successfully!' AS message;
