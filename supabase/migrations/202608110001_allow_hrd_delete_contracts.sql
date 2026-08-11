-- HRD dapat menghapus kontrak (sesuai lingkup pekerjaan HRD).
-- Sebelumnya policy "Delete contracts" hanya mengizinkan super_admin.
-- Perubahan dilakukan dengan men-drop policy lama lalu membuat ulang dengan
-- role super_admin + hrd. Hanya kebijakan yang diubah; struktur tabel & data tetap utuh.

DROP POLICY IF EXISTS "Delete contracts" ON contracts;

CREATE POLICY "Delete contracts"
  ON contracts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
        AND r.role_name IN ('super_admin', 'hrd')
        AND up.account_status = 'ACTIVE'
    )
  );