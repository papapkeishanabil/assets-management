-- PPM M1.1: Default Component Set per Product Type (additive, idempotent)
CREATE TABLE IF NOT EXISTS product_type_default_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id UUID NOT NULL REFERENCES product_types(id) ON DELETE CASCADE,
  component_definition_id UUID NOT NULL REFERENCES component_definitions(id) ON DELETE RESTRICT,
  default_location_label VARCHAR(255),
  sort_order INTEGER DEFAULT 0 NOT NULL,
  is_default BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ptdc_product_type ON product_type_default_components(product_type_id);
CREATE INDEX IF NOT EXISTS idx_ptdc_component_def ON product_type_default_components(component_definition_id);
CREATE UNIQUE INDEX IF NOT EXISTS product_type_default_components_unique_idx
  ON product_type_default_components (product_type_id, component_definition_id, (default_location_label IS NULL), default_location_label);

ALTER TABLE product_type_default_components ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_type_default_components: authenticated read" ON product_type_default_components;
DROP POLICY IF EXISTS "product_type_default_components: super_admin manage" ON product_type_default_components;

CREATE POLICY "product_type_default_components: authenticated read"
  ON product_type_default_components FOR SELECT USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
    )
  );

CREATE POLICY "product_type_default_components: super_admin manage"
  ON product_type_default_components FOR ALL USING (
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

DROP TRIGGER IF EXISTS trigger_ptdc_updated_at ON product_type_default_components;
CREATE TRIGGER trigger_ptdc_updated_at
  BEFORE UPDATE ON product_type_default_components
  FOR EACH ROW EXECUTE FUNCTION update_ppm_m1_updated_at_column();

-- SEED KEMEJA (8)
INSERT INTO product_type_default_components(product_type_id, component_definition_id, default_location_label, sort_order, is_default)
SELECT pt.id, cd.id, NULL, v.sort, true
FROM product_types pt
CROSS JOIN (VALUES
  ('KERAH',1),('BAH_YOKE',2),('ARMHOLE',3),('PLAKET',4),
  ('LENGAN',5),('SAKU_DADA',6),('KANCING',7),('LABEL',8)
) v(code,sort)
JOIN component_definitions cd ON cd.code = v.code
WHERE pt.code = 'KEMEJA'
  AND NOT EXISTS (
    SELECT 1 FROM product_type_default_components x
    WHERE x.product_type_id = pt.id
      AND x.component_definition_id = cd.id
      AND x.default_location_label IS NOT DISTINCT FROM NULL
  );

-- SEED CELANA (7)
INSERT INTO product_type_default_components(product_type_id, component_definition_id, default_location_label, sort_order, is_default)
SELECT pt.id, cd.id, NULL, v.sort, true
FROM product_types pt
CROSS JOIN (VALUES
  ('PINGGANG',1),('GOLPI',2),('SAKU_SAMPING',3),('SAKU_BELAKANG',4),
  ('RETSLETING',5),('KANCING',6),('LABEL',7)
) v(code,sort)
JOIN component_definitions cd ON cd.code = v.code
WHERE pt.code = 'CELANA'
  AND NOT EXISTS (
    SELECT 1 FROM product_type_default_components x
    WHERE x.product_type_id = pt.id
      AND x.component_definition_id = cd.id
      AND x.default_location_label IS NOT DISTINCT FROM NULL
  );

SELECT 'PPM M1.1 migration completed successfully!' AS message;
