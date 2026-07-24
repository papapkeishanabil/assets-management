-- Master data for asset responsible persons/roles and many-to-many assignments.

CREATE TABLE IF NOT EXISTS public.asset_responsibles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  responsible_code VARCHAR(50) NOT NULL UNIQUE,
  responsible_name VARCHAR(255) NOT NULL,
  role_title VARCHAR(255),
  department_id UUID REFERENCES public.departments(id),
  sub_department_id UUID REFERENCES public.sub_departments(id),
  user_profile_id UUID REFERENCES public.user_profiles(id),
  phone VARCHAR(50),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.asset_responsible_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  responsible_id UUID NOT NULL REFERENCES public.asset_responsibles(id),
  responsibility_type VARCHAR(100) DEFAULT 'penanggung_jawab',
  is_primary BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (asset_id, responsible_id)
);

INSERT INTO public.asset_responsibles (
  responsible_code,
  responsible_name,
  role_title,
  user_profile_id,
  created_by
)
SELECT
  'USR-' || upper(substr(replace(up.id::text, '-', ''), 1, 10)),
  up.full_name,
  up.position,
  up.id,
  up.id
FROM public.user_profiles up
WHERE up.id IN (
  SELECT DISTINCT responsible_user_id
  FROM public.assets
  WHERE responsible_user_id IS NOT NULL
)
ON CONFLICT (responsible_code)
DO UPDATE SET
  responsible_name = EXCLUDED.responsible_name,
  role_title = EXCLUDED.role_title,
  user_profile_id = EXCLUDED.user_profile_id,
  updated_at = NOW();

INSERT INTO public.asset_responsible_assignments (
  asset_id,
  responsible_id,
  responsibility_type,
  is_primary
)
SELECT
  a.id,
  ar.id,
  'penanggung_jawab',
  true
FROM public.assets a
JOIN public.user_profiles up ON up.id = a.responsible_user_id
JOIN public.asset_responsibles ar ON ar.user_profile_id = up.id
WHERE a.responsible_user_id IS NOT NULL
ON CONFLICT (asset_id, responsible_id)
DO UPDATE SET
  responsibility_type = EXCLUDED.responsibility_type,
  is_primary = EXCLUDED.is_primary;

ALTER TABLE public.asset_responsibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_responsible_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read asset responsibles" ON public.asset_responsibles;
CREATE POLICY "Read asset responsibles"
  ON public.asset_responsibles
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Write asset responsibles" ON public.asset_responsibles;
CREATE POLICY "Write asset responsibles"
  ON public.asset_responsibles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
        AND r.role_name IN ('super_admin', 'hrd')
        AND up.account_status = 'ACTIVE'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
        AND r.role_name IN ('super_admin', 'hrd')
        AND up.account_status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "Read asset responsible assignments" ON public.asset_responsible_assignments;
CREATE POLICY "Read asset responsible assignments"
  ON public.asset_responsible_assignments
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Write asset responsible assignments" ON public.asset_responsible_assignments;
CREATE POLICY "Write asset responsible assignments"
  ON public.asset_responsible_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
        AND r.role_name IN ('super_admin', 'hrd')
        AND up.account_status = 'ACTIVE'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
        AND r.role_name IN ('super_admin', 'hrd')
        AND up.account_status = 'ACTIVE'
    )
  );
