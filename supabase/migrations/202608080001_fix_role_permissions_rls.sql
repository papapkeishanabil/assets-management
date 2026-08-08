-- Fix RLS for role_permissions so authenticated super admins can manage permissions
-- Previous policy used user_profiles.id = auth.uid(), but the app links auth users through auth_user_id.

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
