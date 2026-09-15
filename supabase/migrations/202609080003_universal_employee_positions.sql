-- Universal position options based on organizational level.
CREATE TABLE IF NOT EXISTS public.employee_position_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_name VARCHAR(150) NOT NULL,
  position_scope VARCHAR(30) NOT NULL
    CHECK (position_scope IN ('DEPARTMENT', 'SUB_DEPARTMENT')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (position_scope, position_name)
);

ALTER TABLE public.employee_position_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read employee positions"
  ON public.employee_position_options FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "HRD manages employee positions"
  ON public.employee_position_options FOR ALL
  USING (public.is_salary_manager())
  WITH CHECK (public.is_salary_manager());

INSERT INTO public.employee_position_options (position_name, position_scope) VALUES
  ('Kepala', 'DEPARTMENT'),
  ('Asisten Kepala', 'DEPARTMENT'),
  ('Supervisor', 'SUB_DEPARTMENT'),
  ('Operator', 'SUB_DEPARTMENT')
ON CONFLICT (position_scope, position_name) DO NOTHING;

