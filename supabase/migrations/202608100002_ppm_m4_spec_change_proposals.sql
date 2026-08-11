-- ============================================================
-- PPM M4 Migration - Decision ↔ Technical Specification Reconciliation
-- Meeting -> PO -> Product Item -> Component -> Specification
--
-- ADDITIVE migration. Does not drop/rename existing tables. Does NOT
-- alter ppm_component_specifications / ppm_annotations / ppm_annotation_notes
-- (M2/M3 LOCKED). APPLY proposal mutates spec via the EXISTING helper
-- resolveSpecification() (RESOLVED + source MEETING) — no new spec-mutation
-- path, no new RPC. This migration only adds a governance/proposal layer.
--
-- Reuses existing RLS patterns (M1/M2/M3) — WRITE: meeting creator
-- / super_admin; READ: authenticated ACTIVE.
--
--  1. Transaksi : ppm_spec_change_proposals
--     (governance record: keputusan meeting yang menarget satu spec)
--  2. RLS mengikuti pola ppm_annotations (via meeting_po_id)
--
-- Business rule (user):
--   Technical Specification = FINAL STRUCTURED PRODUCT TRUTH.
--   Annotation Decision      = keputusan meeting (visual evidence).
--   Proposal                 = jembatan governed: keputusan -> spec,
--                              dengan baseline snapshot + lifecycle +
--                              stale protection + idempotency record.
-- ============================================================

-- ============================================================
-- 1. TRANSACTION: PPM SPEC CHANGE PROPOSALS
-- Satu proposal = satu keputusan meeting yang menarget SATU spec.
-- Nilai terstruktur (value_* typed) DIPISAH dari discussion note
-- (decision_note free text). Baseline snapshot (spec's current value
-- at propose time) dipakai untuk deteksi stale saat APPLY.
--
-- Lifecycle: PROPOSED -> {APPROVED|REJECTED|DEFERRED}
--   APPROVED  = terminal; spec dimutasi via resolveSpecification()
--   REJECTED  = terminal; spec tidak disentuh
--   DEFERRED  = ditunda; bisa re-open -> PROPOSED, atau langsung APPLY/reject
--
-- Evidence link (annotation_id / annotation_note_id) nullable SET NULL
-- supaya audit trail proposal + snapshot tetap utuh walau pin/note dihapus.
-- component_specification_id nullable SET NULL supaya proposal selamat
-- walau spec dihapus. item_component_id NOT NULL snapshot (cascade).
-- ============================================================
CREATE TABLE IF NOT EXISTS ppm_spec_change_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- TARGET (the spec to change)
  component_specification_id UUID REFERENCES ppm_component_specifications(id) ON DELETE SET NULL,
  item_component_id          UUID NOT NULL REFERENCES ppm_item_components(id) ON DELETE CASCADE,
  po_item_id                 UUID REFERENCES ppm_po_items(id) ON DELETE CASCADE,
  meeting_po_id              UUID NOT NULL REFERENCES ppm_meeting_pos(id) ON DELETE CASCADE,

  -- EVIDENCE (the meeting decision that prompted this proposal)
  annotation_id      UUID REFERENCES ppm_annotations(id) ON DELETE SET NULL,
  annotation_note_id UUID REFERENCES ppm_annotation_notes(id) ON DELETE SET NULL,

  -- PROPOSED VALUE (typed — mirrors spec value_* so proposalValueInfo/
  -- formatProposalValue/buildValuePayload reuse the same value_type model)
  value_type      VARCHAR NOT NULL
    CHECK (value_type IN ('TEXT','NUMBER','BOOLEAN','SELECT','MULTI_SELECT')),
  value_text      TEXT,
  value_number    NUMERIC,
  value_boolean   BOOLEAN,
  value_json      JSONB,
  proposed_unit   VARCHAR,
  decision_note   TEXT,   -- free-text discussion note (SEPARATE from structured value)

  -- BASELINE (spec's current value at propose time — for stale detection)
  baseline_value_text     TEXT,
  baseline_value_number   NUMERIC,
  baseline_value_boolean  BOOLEAN,
  baseline_value_json     JSONB,

  -- LIFECYCLE
  status           VARCHAR NOT NULL DEFAULT 'PROPOSED'
    CHECK (status IN ('PROPOSED','APPROVED','REJECTED','DEFERRED')),
  proposed_by      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  proposed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by       UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  decided_at       TIMESTAMPTZ,
  rejection_reason TEXT,

  -- APPLY audit
  applied_despite_conflict BOOLEAN NOT NULL DEFAULT false,
  conflict_snapshot_json   JSONB,   -- {baseline, currentAtConflict, proposed} when conflict detected

  created_by      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmscp_spec       ON ppm_spec_change_proposals(component_specification_id);
CREATE INDEX IF NOT EXISTS idx_pmscp_component  ON ppm_spec_change_proposals(item_component_id);
CREATE INDEX IF NOT EXISTS idx_pmscp_po         ON ppm_spec_change_proposals(meeting_po_id);
CREATE INDEX IF NOT EXISTS idx_pmscp_annotation ON ppm_spec_change_proposals(annotation_id);
CREATE INDEX IF NOT EXISTS idx_pmscp_status     ON ppm_spec_change_proposals(status);

-- ============================================================
-- 2. ENABLE RLS
-- ============================================================
ALTER TABLE ppm_spec_change_proposals ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. DROP EXISTING POLICIES (idempotent)
-- ============================================================
DROP POLICY IF EXISTS "ppm_spec_change_proposals: read via po"     ON ppm_spec_change_proposals;
DROP POLICY IF EXISTS "ppm_spec_change_proposals: insert via po"   ON ppm_spec_change_proposals;
DROP POLICY IF EXISTS "ppm_spec_change_proposals: update via po"   ON ppm_spec_change_proposals;
DROP POLICY IF EXISTS "ppm_spec_change_proposals: delete via po"   ON ppm_spec_change_proposals;

-- ============================================================
-- 4. RLS: ppm_spec_change_proposals
-- Pattern identik dengan ppm_annotations (M3): authority menelusuri
-- meeting_po_id -> meeting_pos -> meetings.created_by (creator) atau
-- super_admin. Tidak ada helper is_ppm_manager() — sesuai konvensi PPM.
-- ============================================================

-- Read: any authenticated ACTIVE user (Pattern A)
CREATE POLICY "ppm_spec_change_proposals: read via po"
  ON ppm_spec_change_proposals FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
    )
  );

-- Insert: authenticated AND meeting creator OR super_admin (Pattern B via meeting_po_id)
CREATE POLICY "ppm_spec_change_proposals: insert via po"
  ON ppm_spec_change_proposals FOR INSERT
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

-- Update: authenticated AND meeting creator OR super_admin (Pattern B via meeting_po_id)
CREATE POLICY "ppm_spec_change_proposals: update via po"
  ON ppm_spec_change_proposals FOR UPDATE
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

-- Delete: authenticated AND meeting creator OR super_admin (Pattern B via meeting_po_id)
CREATE POLICY "ppm_spec_change_proposals: delete via po"
  ON ppm_spec_change_proposals FOR DELETE
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
-- 5. TRIGGER: updated_at (reuse existing M1 function — same as every PPM table)
-- ============================================================
DROP TRIGGER IF EXISTS trigger_pmscp_updated_at ON ppm_spec_change_proposals;

CREATE TRIGGER trigger_pmscp_updated_at
  BEFORE UPDATE ON ppm_spec_change_proposals
  FOR EACH ROW EXECUTE FUNCTION update_ppm_m1_updated_at_column();

-- ============================================================
-- 6. VERIFY
-- ============================================================
SELECT 'PPM M4 migration completed successfully!' AS message;
