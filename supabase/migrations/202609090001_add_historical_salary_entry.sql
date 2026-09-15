-- Memungkinkan HRD/Super Admin mencatat gaji lama secara kronologis.
CREATE OR REPLACE FUNCTION public.add_employee_salary_history(
  p_employee_id UUID,
  p_amount NUMERIC,
  p_effective_date DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_history_id UUID;
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

  SELECT join_date INTO v_join_date
  FROM public.employees
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Data karyawan tidak ditemukan';
  END IF;
  IF v_join_date IS NOT NULL AND p_effective_date < v_join_date THEN
    RAISE EXCEPTION 'Tanggal efektif tidak boleh sebelum tanggal masuk karyawan';
  END IF;

  SELECT id INTO v_profile_id
  FROM public.user_profiles
  WHERE auth_user_id = auth.uid();

  INSERT INTO public.employee_salary_history (
    employee_id, amount, effective_date, source_type, changed_by, notes
  ) VALUES (
    p_employee_id, p_amount, p_effective_date, 'MANUAL', v_profile_id,
    NULLIF(TRIM(p_notes), '')
  )
  RETURNING id INTO v_history_id;

  -- Susun ulang nominal sebelumnya setelah data backdate ditambahkan.
  WITH ordered_history AS (
    SELECT id,
      LAG(amount) OVER (ORDER BY effective_date, created_at, id) AS calculated_previous
    FROM public.employee_salary_history
    WHERE employee_id = p_employee_id
  )
  UPDATE public.employee_salary_history history
  SET previous_amount = ordered.calculated_previous
  FROM ordered_history ordered
  WHERE history.id = ordered.id
    AND history.previous_amount IS DISTINCT FROM ordered.calculated_previous;

  -- Entri pertama secara kronologis menjadi gaji awal; sumber kontrak tetap dipertahankan.
  WITH first_history AS (
    SELECT id
    FROM public.employee_salary_history
    WHERE employee_id = p_employee_id
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
  WHERE history.employee_id = p_employee_id;

  RETURN v_history_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_employee_salary_history(UUID, NUMERIC, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_employee_salary_history(UUID, NUMERIC, DATE, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
