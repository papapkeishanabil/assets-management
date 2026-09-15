CREATE TABLE IF NOT EXISTS public.sub_department_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_department_id UUID NOT NULL REFERENCES public.sub_departments(id) ON DELETE CASCADE,
  position_name VARCHAR(150) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sub_department_id, position_name)
);

CREATE INDEX IF NOT EXISTS idx_sub_department_positions_sub_department
  ON public.sub_department_positions(sub_department_id, position_name);

ALTER TABLE public.sub_department_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read subdepartment positions"
  ON public.sub_department_positions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "HRD manages subdepartment positions"
  ON public.sub_department_positions FOR ALL
  USING (public.is_salary_manager())
  WITH CHECK (public.is_salary_manager());

INSERT INTO public.sub_department_positions (sub_department_id, position_name)
SELECT sd.id, p.position_name
FROM public.sub_departments sd
CROSS JOIN (VALUES ('Supervisor'), ('Operator')) AS p(position_name)
WHERE sd.sub_department_name ILIKE '%finishing%'
ON CONFLICT (sub_department_id, position_name) DO NOTHING;
