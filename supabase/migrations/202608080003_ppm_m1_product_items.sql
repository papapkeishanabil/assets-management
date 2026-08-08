-- ============================================
-- PPM M1 Migration - Product Item & Component
-- Pre-Production Meeting structure:
-- Meeting -> PO -> Product Item -> Component
--
-- ADDITIVE migration. Does not drop or rename
-- existing tables/columns.
-- ============================================

-- ============================================
-- 1. MASTER: PRODUCT TYPES
-- ============================================
CREATE TABLE IF NOT EXISTS product_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_types_code ON product_types(code);

-- ============================================
-- 2. MASTER: COMPONENT DEFINITIONS
-- ============================================
CREATE TABLE IF NOT EXISTS component_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_component_definitions_code ON component_definitions(code);

-- ============================================
-- 3. TRANSACTION: PPM PO ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS ppm_po_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_po_id UUID NOT NULL REFERENCES ppm_meeting_pos(id) ON DELETE CASCADE,
  product_type_id UUID REFERENCES product_types(id),
  item_name VARCHAR(255) NOT NULL,
  quantity INTEGER,
  gender_category VARCHAR(30),
  sort_order INTEGER DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ppm_po_items_po ON ppm_po_items(meeting_po_id);
CREATE INDEX IF NOT EXISTS idx_ppm_po_items_product_type ON ppm_po_items(product_type_id);

-- ============================================
-- 4. TRANSACTION: PPM ITEM COMPONENTS
-- ============================================
CREATE TABLE IF NOT EXISTS ppm_item_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_item_id UUID NOT NULL REFERENCES ppm_po_items(id) ON DELETE CASCADE,
  component_definition_id UUID REFERENCES component_definitions(id),
  component_name_snapshot VARCHAR(255) NOT NULL,
  location_label VARCHAR(255),
  sort_order INTEGER DEFAULT 0,
  is_custom BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ppm_item_components_item ON ppm_item_components(po_item_id);
CREATE INDEX IF NOT EXISTS idx_ppm_item_components_definition ON ppm_item_components(component_definition_id);

-- ============================================
-- 5. SEED: PRODUCT TYPES
-- ============================================
INSERT INTO product_types (code, name) VALUES
  ('KEMEJA', 'Kemeja'),
  ('CELANA', 'Celana'),
  ('JAKET', 'Jaket'),
  ('ROMPI', 'Rompi'),
  ('KAOS', 'Kaos'),
  ('POLO', 'Polo'),
  ('BLAZER', 'Blazer'),
  ('RAINCOAT', 'Raincoat'),
  ('COVERALL', 'Coverall'),
  ('OTHER', 'Lainnya')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 6. SEED: COMPONENT DEFINITIONS
-- ============================================
INSERT INTO component_definitions (code, name) VALUES
  ('KERAH', 'Kerah'),
  ('BAH_YOKE', 'Bah / Yoke'),
  ('ARMHOLE', 'Armhole'),
  ('PLAKET', 'Plaket'),
  ('LENGAN', 'Lengan'),
  ('MANSET', 'Manset'),
  ('SLIT_LENGAN', 'Slit Lengan'),
  ('SAKU_DADA', 'Saku Dada'),
  ('SAKU_LENGAN', 'Saku Lengan'),
  ('VENTILASI', 'Ventilasi'),
  ('SCOTCHLIGHT', 'Scotchlight'),
  ('BORDIR', 'Bordir'),
  ('EMBLEM', 'Emblem'),
  ('VELCRO', 'Velcro'),
  ('LABEL', 'Label'),
  ('PINGGANG', 'Pinggang'),
  ('GOLPI', 'Golpi'),
  ('KUPNAT', 'Kupnat'),
  ('SAKU_SAMPING', 'Saku Samping'),
  ('SAKU_BELAKANG', 'Saku Belakang'),
  ('HOODIE', 'Hoodie'),
  ('FURING', 'Furing'),
  ('RETSLETING', 'Resleting'),
  ('WEBBING', 'Webbing'),
  ('KANCING', 'Kancing'),
  ('LAINNYA', 'Lainnya')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 7. ENABLE RLS
-- ============================================
ALTER TABLE product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppm_po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppm_item_components ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. DROP EXISTING POLICIES (idempotent)
-- ============================================
DROP POLICY IF EXISTS "product_types: authenticated read" ON product_types;
DROP POLICY IF EXISTS "product_types: super_admin manage" ON product_types;
DROP POLICY IF EXISTS "component_definitions: authenticated read" ON component_definitions;
DROP POLICY IF EXISTS "component_definitions: super_admin manage" ON component_definitions;
DROP POLICY IF EXISTS "ppm_po_items: read via po" ON ppm_po_items;
DROP POLICY IF EXISTS "ppm_po_items: insert via po" ON ppm_po_items;
DROP POLICY IF EXISTS "ppm_po_items: update via po" ON ppm_po_items;
DROP POLICY IF EXISTS "ppm_po_items: delete via po" ON ppm_po_items;
DROP POLICY IF EXISTS "ppm_item_components: read via item" ON ppm_item_components;
DROP POLICY IF EXISTS "ppm_item_components: insert via item" ON ppm_item_components;
DROP POLICY IF EXISTS "ppm_item_components: update via item" ON ppm_item_components;
DROP POLICY IF EXISTS "ppm_item_components: delete via item" ON ppm_item_components;

-- ============================================
-- 9. RLS POLICIES: product_types (master)
-- ============================================
-- Any authenticated active user can read product types
CREATE POLICY "product_types: authenticated read"
  ON product_types FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
      AND up.account_status = 'ACTIVE'
    )
  );

-- Only super_admin can insert/update/delete product types
CREATE POLICY "product_types: super_admin manage"
  ON product_types FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
      AND r.role_name = 'super_admin'
      AND up.account_status = 'ACTIVE'
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
      AND r.role_name = 'super_admin'
      AND up.account_status = 'ACTIVE'
    )
  );

-- ============================================
-- 10. RLS POLICIES: component_definitions (master)
-- ============================================
-- Any authenticated active user can read component definitions
CREATE POLICY "component_definitions: authenticated read"
  ON component_definitions FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
      AND up.account_status = 'ACTIVE'
    )
  );

-- Only super_admin can insert/update/delete component definitions
CREATE POLICY "component_definitions: super_admin manage"
  ON component_definitions FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
      AND r.role_name = 'super_admin'
      AND up.account_status = 'ACTIVE'
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
      AND r.role_name = 'super_admin'
      AND up.account_status = 'ACTIVE'
    )
  );

-- ============================================
-- 11. RLS POLICIES: ppm_po_items (transaction)
-- ============================================
-- Read: any authenticated active user can read PO items
-- (through the same pattern as reading POS)
CREATE POLICY "ppm_po_items: read via po"
  ON ppm_po_items FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
      AND up.account_status = 'ACTIVE'
    )
  );

-- Insert: authenticated AND is the meeting creator OR super_admin
CREATE POLICY "ppm_po_items: insert via po"
  ON ppm_po_items FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM ppm_meeting_pos pos
      JOIN ppm_meetings pm ON pm.id = pos.meeting_id
      WHERE pos.id = meeting_po_id
      AND (
        pm.created_by = (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_profiles up
          JOIN roles r ON up.role_id = r.id
          WHERE up.auth_user_id = auth.uid()
          AND r.role_name = 'super_admin'
          AND up.account_status = 'ACTIVE'
        )
      )
    )
  );

-- Update: authenticated AND is the meeting creator OR super_admin
CREATE POLICY "ppm_po_items: update via po"
  ON ppm_po_items FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM ppm_meeting_pos pos
      JOIN ppm_meetings pm ON pm.id = pos.meeting_id
      WHERE pos.id = meeting_po_id
      AND (
        pm.created_by = (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_profiles up
          JOIN roles r ON up.role_id = r.id
          WHERE up.auth_user_id = auth.uid()
          AND r.role_name = 'super_admin'
          AND up.account_status = 'ACTIVE'
        )
      )
    )
  );

-- Delete: authenticated AND is the meeting creator OR super_admin
CREATE POLICY "ppm_po_items: delete via po"
  ON ppm_po_items FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM ppm_meeting_pos pos
      JOIN ppm_meetings pm ON pm.id = pos.meeting_id
      WHERE pos.id = meeting_po_id
      AND (
        pm.created_by = (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_profiles up
          JOIN roles r ON up.role_id = r.id
          WHERE up.auth_user_id = auth.uid()
          AND r.role_name = 'super_admin'
          AND up.account_status = 'ACTIVE'
        )
      )
    )
  );

-- ============================================
-- 12. RLS POLICIES: ppm_item_components (transaction)
-- ============================================
-- Read: any authenticated active user
CREATE POLICY "ppm_item_components: read via item"
  ON ppm_item_components FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
      AND up.account_status = 'ACTIVE'
    )
  );

-- Insert: authenticated AND is the item's PO meeting creator OR super_admin
CREATE POLICY "ppm_item_components: insert via item"
  ON ppm_item_components FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM ppm_po_items item
      JOIN ppm_meeting_pos pos ON pos.id = item.meeting_po_id
      JOIN ppm_meetings pm ON pm.id = pos.meeting_id
      WHERE item.id = po_item_id
      AND (
        pm.created_by = (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_profiles up
          JOIN roles r ON up.role_id = r.id
          WHERE up.auth_user_id = auth.uid()
          AND r.role_name = 'super_admin'
          AND up.account_status = 'ACTIVE'
        )
      )
    )
  );

-- Update: authenticated AND is the item's PO meeting creator OR super_admin
CREATE POLICY "ppm_item_components: update via item"
  ON ppm_item_components FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM ppm_po_items item
      JOIN ppm_meeting_pos pos ON pos.id = item.meeting_po_id
      JOIN ppm_meetings pm ON pm.id = pos.meeting_id
      WHERE item.id = po_item_id
      AND (
        pm.created_by = (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_profiles up
          JOIN roles r ON up.role_id = r.id
          WHERE up.auth_user_id = auth.uid()
          AND r.role_name = 'super_admin'
          AND up.account_status = 'ACTIVE'
        )
      )
    )
  );

-- Delete: authenticated AND is the item's PO meeting creator OR super_admin
CREATE POLICY "ppm_item_components: delete via item"
  ON ppm_item_components FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM ppm_po_items item
      JOIN ppm_meeting_pos pos ON pos.id = item.meeting_po_id
      JOIN ppm_meetings pm ON pm.id = pos.meeting_id
      WHERE item.id = po_item_id
      AND (
        pm.created_by = (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_profiles up
          JOIN roles r ON up.role_id = r.id
          WHERE up.auth_user_id = auth.uid()
          AND r.role_name = 'super_admin'
          AND up.account_status = 'ACTIVE'
        )
      )
    )
  );

-- ============================================
-- 13. TRIGGER FOR updated_at (reuse existing function)
-- ============================================
CREATE OR REPLACE FUNCTION update_ppm_m1_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_product_types_updated_at ON product_types;
DROP TRIGGER IF EXISTS trigger_component_definitions_updated_at ON component_definitions;
DROP TRIGGER IF EXISTS trigger_ppm_po_items_updated_at ON ppm_po_items;
DROP TRIGGER IF EXISTS trigger_ppm_item_components_updated_at ON ppm_item_components;

CREATE TRIGGER trigger_product_types_updated_at
  BEFORE UPDATE ON product_types
  FOR EACH ROW EXECUTE FUNCTION update_ppm_m1_updated_at_column();

CREATE TRIGGER trigger_component_definitions_updated_at
  BEFORE UPDATE ON component_definitions
  FOR EACH ROW EXECUTE FUNCTION update_ppm_m1_updated_at_column();

CREATE TRIGGER trigger_ppm_po_items_updated_at
  BEFORE UPDATE ON ppm_po_items
  FOR EACH ROW EXECUTE FUNCTION update_ppm_m1_updated_at_column();

CREATE TRIGGER trigger_ppm_item_components_updated_at
  BEFORE UPDATE ON ppm_item_components
  FOR EACH ROW EXECUTE FUNCTION update_ppm_m1_updated_at_column();

-- ============================================
-- 14. VERIFY
-- ============================================
SELECT 'PPM M1 migration completed successfully!' as message;