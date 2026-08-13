-- ============================================================
-- PPM M4.5A.1 Migration — Simple Conditional Technical Standards V1
-- (2026-08-13, user-approved scope "Master Patch + M4.5A.1")
--
-- V1 SEMANTICS (eksplisit, JANGAN diperluas tanpa task baru):
--   ONE CONDITION -> ONE RESULT
--   * operator: EQUALS saja. TIDAK ada AND/OR/nested/formula/scripting/
--     arbitrary expression.
--   * condition & result spec WAJIB milik komponen rule (DB trigger
--     memastikan; cross-component DITOLAK).
--   * duplicate rule (kondisi sama, nilai typed sama, standard sama)
--     DITOLAK unique index.
--   * contradiction (kondisi sama tapi hasil beda) otomatis TERBLOKIR
--     oleh unique index yang sama — satu kondisi hanya boleh muncul
--     sekali per standard.
--   * conflict lintas standard = DEFERRED (tidak dibuat).
--   * Simple Standard (FIXED, ppm_company_technical_standard_specs)
--     tetap didukung penuh (standard_type='FIXED' default).
--   * WIKA override tetap pure-evaluation concern (M4.5B) — migration
--     ini TIDAK menyentuh customer model.
--
-- TYPE SAFETY:
--   - condition_value_type / result_value_type memakai whitelist yang
--     sama dengan M2/M4.5A (TEXT/NUMBER/BOOLEAN/SELECT/MULTI_SELECT).
--   - nilai typed tersimpan di kolom typed terpisah (mirror
--     ppm_company_technical_standard_specs).
--   - unique index NULL-SAFE via COALESCE (+ sentinel NUMBER -1e300,
--     BOOLEAN false, JSONB 'null') — mencegah NULL-trap sehingga
--     duplicate rule TIDAK bisa lolos lewat kolom NULL.
--
-- ADDITIVE ONLY: tanpa DROP/RENAME/destructive ALTER/RLS disable.
-- ============================================================

-- ============================================================
-- 1. PPM COMPANY TECHNICAL STANDARDS — tambah tipe standard
--    FIXED = Nilai Standar Tetap (simple, existing)
--    CONDITIONAL = Aturan Bersyarat (V1: EQUALS)
-- ============================================================
ALTER TABLE ppm_company_technical_standards ADD COLUMN IF NOT EXISTS standard_type VARCHAR;

DO $add_std_type_check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ppm_company_technical_standards_standard_type_check'
                 AND conrelid='ppm_company_technical_standards'::regclass) THEN
    ALTER TABLE ppm_company_technical_standards
      ADD CONSTRAINT ppm_company_technical_standards_standard_type_check
      CHECK (standard_type IN ('FIXED','CONDITIONAL'));
  END IF;
END
$add_std_type_check$;

-- Backfill + default FIXED (additive, aman untuk data existing).
UPDATE ppm_company_technical_standards SET standard_type = 'FIXED' WHERE standard_type IS NULL;
ALTER TABLE ppm_company_technical_standards ALTER COLUMN standard_type SET DEFAULT 'FIXED';
ALTER TABLE ppm_company_technical_standards ALTER COLUMN standard_type SET NOT NULL;

-- ============================================================
-- 2. CONDITIONAL RULES
--    Satu baris = satu aturan: JIKA <condition> = <nilai> MAKA
--    <result> = <nilai>. Semua snapshot disimpan untuk audit display.
-- ============================================================
CREATE TABLE IF NOT EXISTS ppm_company_technical_standard_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_id UUID NOT NULL REFERENCES ppm_company_technical_standards(id) ON DELETE CASCADE,
  component_definition_id UUID NOT NULL REFERENCES component_definitions(id) ON DELETE SET NULL,
  -- ---- CONDITION (JIKA) --------------------------------------
  condition_specification_definition_id UUID NOT NULL REFERENCES component_specification_definitions(id) ON DELETE SET NULL,
  condition_spec_key_snapshot VARCHAR NOT NULL,
  condition_spec_label_snapshot VARCHAR NOT NULL,
  condition_operator VARCHAR NOT NULL DEFAULT 'EQUALS'
    CHECK (condition_operator IN ('EQUALS')),
  condition_value_type VARCHAR NOT NULL
    CHECK (condition_value_type IN ('TEXT','NUMBER','BOOLEAN','SELECT','MULTI_SELECT')),
  condition_unit VARCHAR,
  condition_value_text TEXT,
  condition_value_number NUMERIC,
  condition_value_boolean BOOLEAN,
  condition_value_json JSONB,
  -- ---- RESULT (MAKA) -----------------------------------------
  result_specification_definition_id UUID NOT NULL REFERENCES component_specification_definitions(id) ON DELETE SET NULL,
  result_spec_key_snapshot VARCHAR NOT NULL,
  result_spec_label_snapshot VARCHAR NOT NULL,
  result_value_type VARCHAR NOT NULL
    CHECK (result_value_type IN ('TEXT','NUMBER','BOOLEAN','SELECT','MULTI_SELECT')),
  result_unit VARCHAR,
  result_value_text TEXT,
  result_value_number NUMERIC,
  result_value_boolean BOOLEAN,
  result_value_json JSONB,
  -- ---- META ----------------------------------------------------
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pctsr_standard ON ppm_company_technical_standard_rules(standard_id);
CREATE INDEX IF NOT EXISTS idx_pctsr_component ON ppm_company_technical_standard_rules(component_definition_id);
CREATE INDEX IF NOT EXISTS idx_pctsr_condition ON ppm_company_technical_standard_rules(condition_specification_definition_id);
CREATE INDEX IF NOT EXISTS idx_pctsr_result ON ppm_company_technical_standard_rules(result_specification_definition_id);
CREATE INDEX IF NOT EXISTS idx_pctsr_active ON ppm_company_technical_standard_rules(is_active);

-- DUPLICATE + CONTRADICTION BLOCKER (satu unique index untuk keduanya):
-- (standard, komponen, condition spec, typed value) unik. Dengan ini:
--   * "1 inch -> Single" lalu "1 inch -> Double" (kontradiksi) DITOLAK
--     (kondisi sama).
--   * "1 inch -> Single" dobel (duplicate) DITOLAK.
-- NULL-SAFE: COALESCE untuk text/boolean/jsonb + sentinel -1e300 untuk
-- numeric — tanpa ini NULL dianggap berbeda (NULL-trap) dan duplikat
-- TLEBAT. condition_value_type ikut & index sehingga TEXT '1' dan
-- NUMBER 1 dianggap beda (type distinct + typed compare tetap aman).
CREATE UNIQUE INDEX IF NOT EXISTS ppm_company_technical_standard_rules_cond_unique
  ON ppm_company_technical_standard_rules (
    standard_id,
    component_definition_id,
    condition_spec_key_snapshot,
    condition_value_type,
    COALESCE(condition_value_text, ''),
    COALESCE(condition_value_number, -1e300),
    COALESCE(condition_value_boolean, false),
    COALESCE(condition_value_json, 'null'::jsonb)
  );

-- ============================================================
-- 3. TRIGGER: komponen-konsistensi + typed value sanity
--    condition/result spec WAJIB milik component rule. Tanpa ini,
--    "Scotchlight -> Tinggi Kerah" bisa masuk lewat REST.
-- ============================================================
CREATE OR REPLACE FUNCTION check_ppm_std_rule_consistency() RETURNS TRIGGER AS $$
DECLARE
  v_cond_comp UUID;
  v_res_comp UUID;
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    -- condition spec must belong to rule component
    SELECT component_definition_id INTO v_cond_comp
      FROM component_specification_definitions
      WHERE id = NEW.condition_specification_definition_id;
    IF v_cond_comp IS DISTINCT FROM NEW.component_definition_id THEN
      RAISE EXCEPTION 'CONDITION_COMPONENT_MISMATCH: condition spec % bukan milik component %',
        NEW.condition_spec_key_snapshot, NEW.component_definition_id;
    END IF;
    -- result spec must belong to rule component
    SELECT component_definition_id INTO v_res_comp
      FROM component_specification_definitions
      WHERE id = NEW.result_specification_definition_id;
    IF v_res_comp IS DISTINCT FROM NEW.component_definition_id THEN
      RAISE EXCEPTION 'RESULT_COMPONENT_MISMATCH: result spec % bukan milik component %',
        NEW.result_spec_key_snapshot, NEW.component_definition_id;
    END IF;
    -- typed value must actually be present for the declared type
    IF NEW.condition_value_type = 'NUMBER' AND NEW.condition_value_number IS NULL THEN
      RAISE EXCEPTION 'CONDITION_VALUE_REQUIRED: NUMBER condition tanpa nilai';
    END IF;
    IF NEW.condition_value_type = 'TEXT' AND (NEW.condition_value_text IS NULL OR NEW.condition_value_text = '') THEN
      RAISE EXCEPTION 'CONDITION_VALUE_REQUIRED: TEXT condition tanpa nilai';
    END IF;
    IF NEW.condition_value_type = 'SELECT' AND NEW.condition_value_json IS NULL THEN
      RAISE EXCEPTION 'CONDITION_VALUE_REQUIRED: SELECT condition tanpa nilai';
    END IF;
    IF NEW.result_value_type = 'NUMBER' AND NEW.result_value_number IS NULL THEN
      RAISE EXCEPTION 'RESULT_VALUE_REQUIRED: NUMBER result tanpa nilai';
    END IF;
    IF NEW.result_value_type = 'TEXT' AND (NEW.result_value_text IS NULL OR NEW.result_value_text = '') THEN
      RAISE EXCEPTION 'RESULT_VALUE_REQUIRED: TEXT result tanpa nilai';
    END IF;
    IF NEW.result_value_type = 'SELECT' AND NEW.result_value_json IS NULL THEN
      RAISE EXCEPTION 'RESULT_VALUE_REQUIRED: SELECT result tanpa nilai';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pctsr_consistency ON ppm_company_technical_standard_rules;
CREATE TRIGGER trigger_pctsr_consistency
  BEFORE INSERT OR UPDATE ON ppm_company_technical_standard_rules
  FOR EACH ROW EXECUTE FUNCTION check_ppm_std_rule_consistency();

-- ============================================================
-- 4. RLS (pola master M4.5A: Pattern A read + super_admin write)
-- ============================================================
ALTER TABLE ppm_company_technical_standard_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ppm_company_technical_standard_rules: authenticated read" ON ppm_company_technical_standard_rules;
DROP POLICY IF EXISTS "ppm_company_technical_standard_rules: super_admin manage" ON ppm_company_technical_standard_rules;

CREATE POLICY "ppm_company_technical_standard_rules: authenticated read"
  ON ppm_company_technical_standard_rules FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
    )
  );

CREATE POLICY "ppm_company_technical_standard_rules: super_admin manage"
  ON ppm_company_technical_standard_rules FOR ALL
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
-- 5. TRIGGER: updated_at (reuse M1 helper)
-- ============================================================
DROP TRIGGER IF EXISTS trigger_pctsr_updated_at ON ppm_company_technical_standard_rules;
CREATE TRIGGER trigger_pctsr_updated_at
  BEFORE UPDATE ON ppm_company_technical_standard_rules
  FOR EACH ROW EXECUTE FUNCTION update_ppm_m1_updated_at_column();

-- ============================================================
-- 6. VERIFY
-- ============================================================
DO $verify$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='ppm_company_technical_standard_rules')
    THEN RAISE EXCEPTION 'MISSING_OBJECT: ppm_company_technical_standard_rules';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='ppm_company_technical_standard_rules_cond_unique'
                 AND tablename='ppm_company_technical_standard_rules')
    THEN RAISE EXCEPTION 'MISSING_OBJECT: rules_cond_unique';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE tablename='ppm_company_technical_standard_rules') <> 2
    THEN RAISE EXCEPTION 'MISSING_POLICY: rules harus 2 policies';
  END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgname='trigger_pctsr_consistency'
      AND tgrelid='ppm_company_technical_standard_rules'::regclass) <> 1
    THEN RAISE EXCEPTION 'MISSING_TRIGGER: trigger_pctsr_consistency';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_name='ppm_company_technical_standards' AND column_name='standard_type')
    THEN RAISE EXCEPTION 'MISSING_COLUMN: standard_type';
  END IF;
  IF EXISTS (SELECT 1 FROM ppm_company_technical_standards WHERE standard_type IS NULL)
    THEN RAISE EXCEPTION 'MISSING_BACKFILL: standard_type NULL masih ada';
  END IF;
END
$verify$;

SELECT 'PPM M4.5A.1 Conditional Standards V1 applied successfully! (FIXED tetap didukung)' AS message;