-- Add division level above departments so the organization structure becomes:
-- Division -> Department -> Subdepartment.

CREATE TABLE IF NOT EXISTS public.divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_code VARCHAR(50) NOT NULL UNIQUE,
  division_name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS division_id UUID REFERENCES public.divisions(id);

WITH source_divisions(division_code, division_name, description, is_active) AS (
  VALUES
    ('PROD', 'Produksi', 'Divisi induk untuk Project Production, Stock Production, Operational Support, dan HRD & GA', true)
)
INSERT INTO public.divisions (division_code, division_name, description, is_active)
SELECT division_code, division_name, description, is_active
FROM source_divisions
ON CONFLICT (division_code)
DO UPDATE SET
  division_name = EXCLUDED.division_name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

UPDATE public.departments d
SET division_id = v.id,
    updated_at = NOW()
FROM public.divisions v
WHERE v.division_code = 'PROD'
  AND d.department_code IN ('PRJ-PROD', 'STK-PROD', 'OPS-SUP', 'HRGA');

ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read divisions" ON public.divisions;
CREATE POLICY "Read divisions"
  ON public.divisions
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Write divisions" ON public.divisions;
CREATE POLICY "Write divisions"
  ON public.divisions
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
