-- Run this in the Supabase SQL editor to fix role_permissions RLS.

DROP POLICY IF EXISTS "Super admin can view all role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Role member can view own role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Super admin can manage role permissions" ON public.role_permissions;

CREATE POLICY "Super admin can view all role permissions"
  ON public.role_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
        AND r.role_name = 'super_admin'
    )
  );

CREATE POLICY "Role member can view own role permissions"
  ON public.role_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.auth_user_id = auth.uid()
        AND up.role_id = public.role_permissions.role_id
    )
  );

CREATE POLICY "Super admin can manage role permissions"
  ON public.role_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
        AND r.role_name = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
        AND r.role_name = 'super_admin'
    )
  );

INSERT INTO public.role_permissions (role_id, module_key, can_access)
SELECT r.id, 'ppm', true
FROM public.roles r
WHERE r.is_active = true
  AND r.role_name IN ('super_admin', 'hrd', 'direksi', 'pelaksana')
ON CONFLICT (role_id, module_key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, module_key, can_access)
SELECT r.id, 'inspections', true
FROM public.roles r
WHERE r.is_active = true
  AND r.role_name IN ('super_admin', 'hrd', 'direksi')
ON CONFLICT (role_id, module_key) DO NOTHING;
