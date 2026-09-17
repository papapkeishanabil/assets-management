-- ============================================================
-- Migration: Finance boleh input + edit aset
--  Policy TAMBAHAN (additive) — tidak menyentuh policy
--  super_admin/hrd yang sudah ada. Predicate sama dengan
--  policy "Insert/Update assets" (schema-phase2.sql) tapi
--  khusus role finance dengan account_status ACTIVE:
--    assets                        : INSERT, UPDATE
--    asset_photos                  : INSERT, DELETE
--    asset_documents               : INSERT, DELETE
--  Mengikuti alur simpan form aset: insert/update aset →
--  delete+insert penanggung jawab → insert foto → log.
--  Hapus permanen aset TETAP super_admin saja.
-- Idempotent — aman dijalankan berulang.
-- ============================================================

-- ---------- assets ----------
DROP POLICY IF EXISTS "Finance insert assets" ON assets;
CREATE POLICY "Finance insert assets" ON assets
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
        AND r.role_name = 'finance'
        AND up.account_status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "Finance update assets" ON assets;
CREATE POLICY "Finance update assets" ON assets
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
        AND r.role_name = 'finance'
        AND up.account_status = 'ACTIVE'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
        AND r.role_name = 'finance'
        AND up.account_status = 'ACTIVE'
    )
  );

-- ---------- asset_photos ----------
DROP POLICY IF EXISTS "Finance insert asset photos" ON asset_photos;
CREATE POLICY "Finance insert asset photos" ON asset_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
        AND r.role_name = 'finance'
        AND up.account_status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "Finance delete asset photos" ON asset_photos;
CREATE POLICY "Finance delete asset photos" ON asset_photos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
        AND r.role_name = 'finance'
        AND up.account_status = 'ACTIVE'
    )
  );

-- ---------- asset_documents ----------
DROP POLICY IF EXISTS "Finance insert asset documents" ON asset_documents;
CREATE POLICY "Finance insert asset documents" ON asset_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
        AND r.role_name = 'finance'
        AND up.account_status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "Finance delete asset documents" ON asset_documents;
CREATE POLICY "Finance delete asset documents" ON asset_documents
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
        AND r.role_name = 'finance'
        AND up.account_status = 'ACTIVE'
    )
  );

-- ---------- asset_responsible_assignments ----------
-- Form aset selalu menulis ulang penanggung jawab:
-- DELETE semua baris aset tsb lalu INSERT ulang.
DROP POLICY IF EXISTS "Finance insert responsible assignments" ON asset_responsible_assignments;
CREATE POLICY "Finance insert responsible assignments" ON asset_responsible_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
        AND r.role_name = 'finance'
        AND up.account_status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "Finance delete responsible assignments" ON asset_responsible_assignments;
CREATE POLICY "Finance delete responsible assignments" ON asset_responsible_assignments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
        AND r.role_name = 'finance'
        AND up.account_status = 'ACTIVE'
    )
  );

-- ---------- asset_activity_logs ----------
-- Dipakai oleh: Catat Service (INSERT), edit catatan service
-- (UPDATE), dan log perpindahan penanggung jawab (INSERT).
DROP POLICY IF EXISTS "Finance insert activity logs" ON asset_activity_logs;
CREATE POLICY "Finance insert activity logs" ON asset_activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
        AND r.role_name = 'finance'
        AND up.account_status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "Finance update activity logs" ON asset_activity_logs;
CREATE POLICY "Finance update activity logs" ON asset_activity_logs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
        AND r.role_name = 'finance'
        AND up.account_status = 'ACTIVE'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
        AND r.role_name = 'finance'
        AND up.account_status = 'ACTIVE'
    )
  );
