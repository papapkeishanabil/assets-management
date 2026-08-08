-- Seed PPM module access for the main operational roles.
INSERT INTO public.role_permissions (role_id, module_key, can_access)
SELECT r.id, 'ppm', true
FROM public.roles r
WHERE r.is_active = true
  AND r.role_name IN ('super_admin', 'hrd', 'direksi', 'pelaksana')
ON CONFLICT (role_id, module_key) DO NOTHING;
