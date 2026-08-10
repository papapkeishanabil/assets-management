-- ============================================================
-- PPM M3 Migration - Annotation & Component Discussion
-- Meeting -> PO -> Product Item -> Component -> (optional) Specification
--
-- ADDITIVE migration. Does not drop/rename existing tables.
-- Reuses existing RLS patterns (M1 / M2) — WRITE: meeting creator
-- / super_admin; READ: authenticated ACTIVE.
--
--  1. Transaksi : ppm_annotations (pin pada gambar/dokumen PO)
--  2. Transaksi : ppm_annotation_notes (diskusi flat per pin)
--  3. RLS mengikuti pola ppm_item_components / ppm_component_specifications
-- ============================================================

-- ============================================================
-- 1. TRANSACTION: PPM ANNOTATIONS (PIN)
-- Menjawab: "Di mana (dokumen/PO) dan pada konteks apa (item -> komponen
--           -> optional spesifikasi) tanda ini berada?"
-- Koordinat RELATIVE 0-100 (% dari ukuran gambar) agar tahan
-- resize / desktop / proyektor / responsive mobile.
-- ============================================================
CREATE TABLE IF NOT EXISTS ppm_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_po_id UUID NOT NULL REFERENCES ppm_meeting_pos(id) ON DELETE CASCADE,
  po_document_id UUID,
  page_number INTEGER,
  po_item_id UUID NOT NULL REFERENCES ppm_po_items(id) ON DELETE CASCADE,
  item_component_id UUID NOT NULL REFERENCES ppm_item_components(id) ON DELETE CASCADE,
  component_specification_id UUID REFERENCES ppm_component_specifications(id) ON DELETE SET NULL,
  pin_number INTEGER NOT NULL,
  x_percent NUMERIC NOT NULL CHECK (x_percent >= 0 AND x_percent <= 100),
  y_percent NUMERIC NOT NULL CHECK (y_percent >= 0 AND y_percent <= 100),
  status VARCHAR NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','RESOLVED')),
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ppm_annotations_po ON ppm_annotations(meeting_po_id);
CREATE INDEX IF NOT EXISTS idx_ppm_annotations_item ON ppm_annotations(po_item_id);
CREATE INDEX IF NOT EXISTS idx_ppm_annotations_component ON ppm_annotations(item_component_id);
CREATE INDEX IF NOT EXISTS idx_ppm_annotations_status ON ppm_annotations(status);

-- Pin number unik dalam scope: dokumen/page dalam satu PO.
-- po_document_id / page_number nullable -> COALESCE sentinel agar NULL
-- diperlakukan sebagai satu scope (dokumen tunggal saat ini), siap
-- menampung V1 -> V2 nanti tanpa pin V1 otomatis menjadi pin V2.
-- Tidak ada unique constraint pada item_component_id: MULTI-PIN pada
-- komponen yang SAMA HARUS valid.
CREATE UNIQUE INDEX IF NOT EXISTS ppm_annotations_pin_scope_unique
  ON ppm_annotations (
    meeting_po_id,
    COALESCE(po_document_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(page_number, 0),
    pin_number
  );

-- ============================================================
-- 2. TRANSACTION: PPM ANNOTATION NOTES
-- Flat notes per pin (bukan nested reply). Satu pin punya BANYAK notes.
-- ============================================================
CREATE TABLE IF NOT EXISTS ppm_annotation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id UUID NOT NULL REFERENCES ppm_annotations(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL CHECK (btrim(note_text) <> ''),
  note_type VARCHAR NOT NULL DEFAULT 'DISCUSSION'
    CHECK (note_type IN ('DISCUSSION','DECISION','INFO')),
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ppm_annotation_notes_annotation ON ppm_annotation_notes(annotation_id);

-- ============================================================
-- 3. ENABLE RLS
-- ============================================================
ALTER TABLE ppm_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppm_annotation_notes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. DROP EXISTING POLICIES (idempotent)
-- ============================================================
DROP POLICY IF EXISTS "ppm_annotations: read via po" ON ppm_annotations;
DROP POLICY IF EXISTS "ppm_annotations: insert via po" ON ppm_annotations;
DROP POLICY IF EXISTS "ppm_annotations: update via po" ON ppm_annotations;
DROP POLICY IF EXISTS "ppm_annotations: delete via po" ON ppm_annotations;
DROP POLICY IF EXISTS "ppm_annotation_notes: read via annotation" ON ppm_annotation_notes;
DROP POLICY IF EXISTS "ppm_annotation_notes: insert via annotation" ON ppm_annotation_notes;
DROP POLICY IF EXISTS "ppm_annotation_notes: update via annotation" ON ppm_annotation_notes;
DROP POLICY IF EXISTS "ppm_annotation_notes: delete via annotation" ON ppm_annotation_notes;

-- ============================================================
-- 5. RLS: ppm_annotations
-- ============================================================
-- Read: any authenticated ACTIVE user (pola PPM existing)
CREATE POLICY "ppm_annotations: read via po"
  ON ppm_annotations FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
    )
  );

-- Insert: authenticated AND meeting creator OR super_admin
CREATE POLICY "ppm_annotations: insert via po"
  ON ppm_annotations FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM ppm_meeting_pos pos
      JOIN ppm_meetings pm ON pm.id = pos.meeting_id
      WHERE pos.id = meeting_po_id
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
CREATE POLICY "ppm_annotations: update via po"
  ON ppm_annotations FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM ppm_meeting_pos pos
      JOIN ppm_meetings pm ON pm.id = pos.meeting_id
      WHERE pos.id = meeting_po_id
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
      SELECT 1 FROM ppm_meeting_pos pos
      JOIN ppm_meetings pm ON pm.id = pos.meeting_id
      WHERE pos.id = meeting_po_id
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
CREATE POLICY "ppm_annotations: delete via po"
  ON ppm_annotations FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM ppm_meeting_pos pos
      JOIN ppm_meetings pm ON pm.id = pos.meeting_id
      WHERE pos.id = meeting_po_id
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
-- 6. RLS: ppm_annotation_notes (permission mengikuti parent annotation)
-- ============================================================
-- Read: any authenticated ACTIVE user
CREATE POLICY "ppm_annotation_notes: read via annotation"
  ON ppm_annotation_notes FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
    )
  );

-- Insert: authenticated AND parent annotation -> PO -> meeting creator OR super_admin
CREATE POLICY "ppm_annotation_notes: insert via annotation"
  ON ppm_annotation_notes FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM ppm_annotations a
      JOIN ppm_meeting_pos pos ON pos.id = a.meeting_po_id
      JOIN ppm_meetings pm ON pm.id = pos.meeting_id
      WHERE a.id = annotation_id
      AND (
        pm.created_by = (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
          WHERE up.auth_user_id = auth.uid() AND r.role_name = 'super_admin' AND up.account_status = 'ACTIVE'
        )
      )
    )
  );

-- Update: authenticated AND parent annotation -> PO -> meeting creator OR super_admin
CREATE POLICY "ppm_annotation_notes: update via annotation"
  ON ppm_annotation_notes FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM ppm_annotations a
      JOIN ppm_meeting_pos pos ON pos.id = a.meeting_po_id
      JOIN ppm_meetings pm ON pm.id = pos.meeting_id
      WHERE a.id = annotation_id
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
      SELECT 1 FROM ppm_annotations a
      JOIN ppm_meeting_pos pos ON pos.id = a.meeting_po_id
      JOIN ppm_meetings pm ON pm.id = pos.meeting_id
      WHERE a.id = annotation_id
      AND (
        pm.created_by = (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
          WHERE up.auth_user_id = auth.uid() AND r.role_name = 'super_admin' AND up.account_status = 'ACTIVE'
        )
      )
    )
  );

-- Delete: authenticated AND parent annotation -> PO -> meeting creator OR super_admin
CREATE POLICY "ppm_annotation_notes: delete via annotation"
  ON ppm_annotation_notes FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM ppm_annotations a
      JOIN ppm_meeting_pos pos ON pos.id = a.meeting_po_id
      JOIN ppm_meetings pm ON pm.id = pos.meeting_id
      WHERE a.id = annotation_id
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
-- 7. TRIGGER: updated_at (reuse existing M1 function)
-- ============================================================
DROP TRIGGER IF EXISTS trigger_ppm_annotations_updated_at ON ppm_annotations;
DROP TRIGGER IF EXISTS trigger_ppm_annotation_notes_updated_at ON ppm_annotation_notes;

CREATE TRIGGER trigger_ppm_annotations_updated_at
  BEFORE UPDATE ON ppm_annotations
  FOR EACH ROW EXECUTE FUNCTION update_ppm_m1_updated_at_column();

CREATE TRIGGER trigger_ppm_annotation_notes_updated_at
  BEFORE UPDATE ON ppm_annotation_notes
  FOR EACH ROW EXECUTE FUNCTION update_ppm_m1_updated_at_column();

-- ============================================================
-- 8. VERIFY
-- ============================================================
SELECT 'PPM M3 migration completed successfully!' AS message;
