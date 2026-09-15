-- Give Finance role same baseline permissions as Pelaksana.
-- This keeps Finance functional by default and manageable via Role Permissions page.
INSERT INTO public.role_permissions (role_id, module_key, can_access)
SELECT r.id, m.module_key, true
FROM public.roles r
CROSS JOIN (
  SELECT 'dashboard' AS module_key UNION ALL
  SELECT 'assets' UNION ALL
  SELECT 'maintenance_schedules' UNION ALL
  SELECT 'maintenance_executions' UNION ALL
  SELECT 'ppm' UNION ALL
  SELECT 'inspections' UNION ALL
  SELECT 'notifications' UNION ALL
  SELECT 'profile'
) m
WHERE r.role_name = 'finance'
ON CONFLICT (role_id, module_key) DO NOTHING;
