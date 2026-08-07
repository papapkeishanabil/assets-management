-- ============================================
-- PPM Module Migration - Phase 1
-- Pre-Production Meeting tables
-- ============================================

-- 1. PPM MEETINGS TABLE
CREATE TABLE IF NOT EXISTS ppm_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_code VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  meeting_date DATE NOT NULL,
  meeting_time TIME,
  moderator_id UUID REFERENCES user_profiles(id),
  notes TEXT,
  status VARCHAR(30) DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PPM MEETING POS TABLE
CREATE TABLE IF NOT EXISTS ppm_meeting_pos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES ppm_meetings(id) ON DELETE CASCADE,
  po_number VARCHAR(100) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  project_name VARCHAR(255),
  description TEXT,
  deadline DATE,
  document_url TEXT NOT NULL,
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('jpg', 'jpeg', 'png', 'pdf')),
  document_name VARCHAR(255),
  status VARCHAR(30) DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'IN_REVIEW', 'COMPLETED')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ENABLE RLS
ALTER TABLE ppm_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppm_meeting_pos ENABLE ROW LEVEL SECURITY;

-- 4. DROP EXISTING POLICIES
DROP POLICY IF EXISTS "ppm_meetings: authenticated read" ON ppm_meetings;
DROP POLICY IF EXISTS "ppm_meetings: authenticated create" ON ppm_meetings;
DROP POLICY IF EXISTS "ppm_meetings: own update" ON ppm_meetings;
DROP POLICY IF EXISTS "ppm_meeting_pos: read via meeting" ON ppm_meeting_pos;
DROP POLICY IF EXISTS "ppm_meeting_pos: insert via meeting" ON ppm_meeting_pos;
DROP POLICY IF EXISTS "ppm_meeting_pos: update via meeting" ON ppm_meeting_pos;
DROP POLICY IF EXISTS "ppm_meeting_pos: delete via meeting" ON ppm_meeting_pos;

-- 5. RLS POLICIES FOR ppm_meetings
CREATE POLICY "ppm_meetings: authenticated read"
  ON ppm_meetings FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "ppm_meetings: authenticated create"
  ON ppm_meetings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "ppm_meetings: own update"
  ON ppm_meetings FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND (
      created_by = (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM user_profiles up
        JOIN roles r ON up.role_id = r.id
        WHERE up.auth_user_id = auth.uid()
        AND r.role_name = 'super_admin'
        AND up.account_status = 'ACTIVE'
      )
    )
  );

-- 6. RLS POLICIES FOR ppm_meeting_pos
CREATE POLICY "ppm_meeting_pos: read via meeting"
  ON ppm_meeting_pos FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM ppm_meetings pm
      WHERE pm.id = meeting_id
      AND EXISTS (
        SELECT 1 FROM user_profiles up
        JOIN roles r ON up.role_id = r.id
        WHERE up.auth_user_id = auth.uid()
        AND up.account_status = 'ACTIVE'
      )
    )
  );

CREATE POLICY "ppm_meeting_pos: insert via meeting"
  ON ppm_meeting_pos FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM ppm_meetings pm
      WHERE pm.id = meeting_id
      AND pm.created_by = (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
    )
  );

CREATE POLICY "ppm_meeting_pos: update via meeting"
  ON ppm_meeting_pos FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM ppm_meetings pm
      WHERE pm.id = meeting_id
      AND (
        pm.created_by = (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_profiles up
          JOIN roles r ON up.role_id = r.id
          WHERE up.auth_user_id = auth.uid()
          AND r.role_name = 'super_admin'
        )
      )
    )
  );

CREATE POLICY "ppm_meeting_pos: delete via meeting"
  ON ppm_meeting_pos FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM ppm_meetings pm
      WHERE pm.id = meeting_id
      AND pm.created_by = (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid())
    )
  );

-- 7. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_ppm_meetings_code ON ppm_meetings(meeting_code);
CREATE INDEX IF NOT EXISTS idx_ppm_meetings_status ON ppm_meetings(status);
CREATE INDEX IF NOT EXISTS idx_ppm_meetings_date ON ppm_meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_ppm_meetings_created_by ON ppm_meetings(created_by);
CREATE INDEX IF NOT EXISTS idx_ppm_meeting_pos_meeting ON ppm_meeting_pos(meeting_id);
CREATE INDEX IF NOT EXISTS idx_ppm_meeting_pos_status ON ppm_meeting_pos(status);
CREATE INDEX IF NOT EXISTS idx_ppm_meeting_pos_sort ON ppm_meeting_pos(meeting_id, sort_order);

-- 8. TRIGGER FOR updated_at
CREATE OR REPLACE FUNCTION update_ppm_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_ppm_meetings_updated_at ON ppm_meetings;
DROP TRIGGER IF EXISTS trigger_update_ppm_meeting_pos_updated_at ON ppm_meeting_pos;

CREATE TRIGGER trigger_update_ppm_meetings_updated_at
  BEFORE UPDATE ON ppm_meetings
  FOR EACH ROW EXECUTE FUNCTION update_ppm_updated_at_column();

CREATE TRIGGER trigger_update_ppm_meeting_pos_updated_at
  BEFORE UPDATE ON ppm_meeting_pos
  FOR EACH ROW EXECUTE FUNCTION update_ppm_updated_at_column();

-- 9. VERIFY
SELECT 'PPM module migration completed successfully!' as message;
