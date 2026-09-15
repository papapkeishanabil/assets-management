-- Salary data is isolated from employees/contracts so non-HRD roles cannot read it.
CREATE OR REPLACE FUNCTION public.is_salary_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    JOIN public.roles r ON r.id = up.role_id
    WHERE up.auth_user_id = auth.uid()
      AND up.account_status = 'ACTIVE'
      AND r.role_name IN ('super_admin', 'hrd')
  );
$$;

CREATE TABLE IF NOT EXISTS public.employee_salary_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  amount NUMERIC(18,2) NOT NULL CHECK (amount >= 0),
  previous_amount NUMERIC(18,2) CHECK (previous_amount IS NULL OR previous_amount >= 0),
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source_type VARCHAR(20) NOT NULL DEFAULT 'MANUAL'
    CHECK (source_type IN ('INITIAL', 'MANUAL', 'CONTRACT')),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  changed_by UUID REFERENCES public.user_profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contract_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_salary_history_employee_date
  ON public.employee_salary_history(employee_id, effective_date DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.employee_contract_compensation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL UNIQUE REFERENCES public.contracts(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  current_salary NUMERIC(18,2) NOT NULL CHECK (current_salary >= 0),
  has_adjustment BOOLEAN NOT NULL DEFAULT false,
  adjusted_salary NUMERIC(18,2) CHECK (adjusted_salary IS NULL OR adjusted_salary >= 0),
  effective_date DATE NOT NULL,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (has_adjustment = false AND adjusted_salary IS NULL)
    OR (has_adjustment = true AND adjusted_salary IS NOT NULL)
  )
);

ALTER TABLE public.employee_salary_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_contract_compensation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salary managers read history"
  ON public.employee_salary_history FOR SELECT USING (public.is_salary_manager());
CREATE POLICY "Salary managers insert history"
  ON public.employee_salary_history FOR INSERT WITH CHECK (public.is_salary_manager());
CREATE POLICY "Salary managers read compensation"
  ON public.employee_contract_compensation FOR SELECT USING (public.is_salary_manager());
CREATE POLICY "Salary managers insert compensation"
  ON public.employee_contract_compensation FOR INSERT WITH CHECK (public.is_salary_manager());
CREATE POLICY "Salary managers update compensation"
  ON public.employee_contract_compensation FOR UPDATE
  USING (public.is_salary_manager()) WITH CHECK (public.is_salary_manager());

ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_contract_status_check;
ALTER TABLE public.contracts ADD CONSTRAINT contracts_contract_status_check
  CHECK (contract_status IN ('DRAFT', 'SUBMITTED', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWED', 'CANCELLED'));

CREATE OR REPLACE FUNCTION public.set_employee_salary(
  p_employee_id UUID,
  p_amount NUMERIC,
  p_effective_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_previous NUMERIC(18,2);
  v_profile_id UUID;
  v_id UUID;
BEGIN
  IF NOT public.is_salary_manager() THEN
    RAISE EXCEPTION 'Akses data gaji ditolak';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'Nominal gaji tidak valid';
  END IF;

  SELECT amount INTO v_previous
  FROM public.employee_salary_history
  WHERE employee_id = p_employee_id
  ORDER BY effective_date DESC, created_at DESC
  LIMIT 1;

  IF v_previous IS NOT DISTINCT FROM p_amount THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_profile_id FROM public.user_profiles WHERE auth_user_id = auth.uid();
  INSERT INTO public.employee_salary_history (
    employee_id, amount, previous_amount, effective_date, source_type, changed_by, notes
  ) VALUES (
    p_employee_id, p_amount, v_previous, COALESCE(p_effective_date, CURRENT_DATE),
    CASE WHEN v_previous IS NULL THEN 'INITIAL' ELSE 'MANUAL' END, v_profile_id, p_notes
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_submitted_contract_salary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comp public.employee_contract_compensation%ROWTYPE;
  v_new_salary NUMERIC(18,2);
  v_profile_id UUID;
BEGIN
  IF NEW.contract_status = 'SUBMITTED'
     AND OLD.contract_status IS DISTINCT FROM 'SUBMITTED'
     AND NEW.employee_ref_id IS NOT NULL THEN
    SELECT * INTO v_comp
    FROM public.employee_contract_compensation
    WHERE contract_id = NEW.id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Informasi gaji kontrak belum dilengkapi';
    END IF;
    IF v_comp.employee_id <> NEW.employee_ref_id THEN
      RAISE EXCEPTION 'Data karyawan pada kompensasi tidak sesuai kontrak';
    END IF;

    v_new_salary := CASE WHEN v_comp.has_adjustment THEN v_comp.adjusted_salary ELSE v_comp.current_salary END;
    IF v_comp.has_adjustment AND v_new_salary IS DISTINCT FROM v_comp.current_salary THEN
      SELECT id INTO v_profile_id FROM public.user_profiles WHERE auth_user_id = auth.uid();
      INSERT INTO public.employee_salary_history (
        employee_id, amount, previous_amount, effective_date, source_type,
        contract_id, changed_by, notes
      ) VALUES (
        v_comp.employee_id, v_new_salary, v_comp.current_salary,
        v_comp.effective_date, 'CONTRACT', NEW.id, v_profile_id,
        'Penyesuaian gaji melalui kontrak ' || NEW.contract_number
      ) ON CONFLICT (contract_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_submitted_contract_salary ON public.contracts;
CREATE TRIGGER trg_apply_submitted_contract_salary
  BEFORE UPDATE OF contract_status ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.apply_submitted_contract_salary();

