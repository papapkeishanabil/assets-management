CREATE TABLE IF NOT EXISTS public.employee_work_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_department_id UUID NOT NULL REFERENCES public.sub_departments(id) ON DELETE CASCADE,
  section_name VARCHAR(150) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sub_department_id, section_name)
);

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS work_section_id UUID REFERENCES public.employee_work_sections(id);

CREATE INDEX IF NOT EXISTS idx_employee_work_sections_subdepartment
  ON public.employee_work_sections(sub_department_id, section_name);
CREATE INDEX IF NOT EXISTS idx_employees_work_section ON public.employees(work_section_id);

ALTER TABLE public.employee_work_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read work sections"
  ON public.employee_work_sections FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "HRD manages work sections"
  ON public.employee_work_sections FOR ALL
  USING (public.is_salary_manager())
  WITH CHECK (public.is_salary_manager());

INSERT INTO public.employee_work_sections (sub_department_id, section_name)
SELECT sd.id, item.section_name
FROM public.sub_departments sd
CROSS JOIN (VALUES ('Buang Benang'), ('Steam'), ('Packing')) AS item(section_name)
WHERE sd.sub_department_name ILIKE '%finishing%'
ON CONFLICT (sub_department_id, section_name) DO NOTHING;
