-- Memungkinkan koreksi nominal/tanggal riwayat manual dan menyusun ulang kronologi.
CREATE OR REPLACE FUNCTION public.update_employee_salary_history(
  p_history_id UUID,
  p_amount NUMERIC,
  p_effective_date DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id UUID;
  v_contract_id UUID;
  v_join_date DATE;
BEGIN
  IF NOT public.is_salary_manager() THEN
    RAISE EXCEPTION 'Akses data gaji ditolak';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'Nominal gaji tidak valid';
  END IF;
  IF p_effective_date IS NULL THEN
    RAISE EXCEPTION 'Tanggal efektif wajib diisi';
  END IF;

  SELECT history.employee_id, history.contract_id, employee.join_date
  INTO v_employee_id, v_contract_id, v_join_date
  FROM public.employee_salary_history history
  JOIN public.employees employee ON employee.id = history.employee_id
  WHERE history.id = p_history_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Riwayat gaji tidak ditemukan';
  END IF;
  IF v_contract_id IS NOT NULL THEN
    RAISE EXCEPTION 'Riwayat dari kontrak tidak dapat diedit manual';
  END IF;
  IF v_join_date IS NOT NULL AND p_effective_date < v_join_date THEN
    RAISE EXCEPTION 'Tanggal efektif tidak boleh sebelum tanggal masuk karyawan';
  END IF;

  UPDATE public.employee_salary_history
  SET amount = p_amount,
      effective_date = p_effective_date,
      notes = NULLIF(TRIM(p_notes), '')
  WHERE id = p_history_id;

  WITH ordered_history AS (
    SELECT id,
      LAG(amount) OVER (ORDER BY effective_date, created_at, id) AS calculated_previous
    FROM public.employee_salary_history
    WHERE employee_id = v_employee_id
  )
  UPDATE public.employee_salary_history history
  SET previous_amount = ordered.calculated_previous
  FROM ordered_history ordered
  WHERE history.id = ordered.id
    AND history.previous_amount IS DISTINCT FROM ordered.calculated_previous;

  WITH first_history AS (
    SELECT id
    FROM public.employee_salary_history
    WHERE employee_id = v_employee_id
    ORDER BY effective_date, created_at, id
    LIMIT 1
  )
  UPDATE public.employee_salary_history history
  SET source_type = CASE
    WHEN history.contract_id IS NOT NULL THEN 'CONTRACT'
    WHEN history.id = (SELECT id FROM first_history) THEN 'INITIAL'
    WHEN history.source_type = 'INITIAL' THEN 'MANUAL'
    ELSE history.source_type
  END
  WHERE history.employee_id = v_employee_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_employee_salary_history(UUID, NUMERIC, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_employee_salary_history(UUID, NUMERIC, DATE, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
