-- Steam dan Thread Trimmer/Buang Benang adalah Bagian, bukan Subdepartemen.
DO $$
DECLARE
  v_project_department_id UUID;
  v_finishing_id UUID;
  v_steam_section_id UUID;
  v_thread_section_id UUID;
BEGIN
  SELECT id INTO v_project_department_id
  FROM public.departments
  WHERE department_code = 'PRJ-PROD'
  LIMIT 1;

  SELECT id INTO v_finishing_id
  FROM public.sub_departments
  WHERE department_id = v_project_department_id
    AND (
      LOWER(TRIM(sub_department_name)) = 'finishing'
      OR sub_department_code = 'PRJ-FINS'
      OR LOWER(sub_department_name) LIKE '%finishing%packing%'
    )
  ORDER BY CASE WHEN LOWER(TRIM(sub_department_name)) = 'finishing' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_finishing_id IS NULL THEN
    RAISE EXCEPTION 'Subdepartemen Finishing di bawah Project Production tidak ditemukan';
  END IF;

  UPDATE public.sub_departments
  SET sub_department_name = 'Finishing', is_active = true, updated_at = NOW()
  WHERE id = v_finishing_id;

  INSERT INTO public.employee_work_sections (sub_department_id, section_name, is_active)
  VALUES (v_finishing_id, 'Steam', true)
  ON CONFLICT (sub_department_id, section_name)
  DO UPDATE SET is_active = true, updated_at = NOW()
  RETURNING id INTO v_steam_section_id;

  INSERT INTO public.employee_work_sections (sub_department_id, section_name, is_active)
  VALUES (v_finishing_id, 'Buang Benang', true)
  ON CONFLICT (sub_department_id, section_name)
  DO UPDATE SET is_active = true, updated_at = NOW()
  RETURNING id INTO v_thread_section_id;

  UPDATE public.employees employee
  SET sub_department_id = v_finishing_id,
      work_section_id = CASE
        WHEN LOWER(source.sub_department_name) = 'steam' THEN v_steam_section_id
        ELSE v_thread_section_id
      END,
      updated_at = NOW()
  FROM public.sub_departments source
  WHERE employee.sub_department_id = source.id
    AND source.department_id = v_project_department_id
    AND (
      LOWER(TRIM(source.sub_department_name)) = 'steam'
      OR LOWER(source.sub_department_name) LIKE '%thread trimmer%'
      OR LOWER(source.sub_department_name) LIKE '%buang benang%'
    );

  UPDATE public.sub_departments
  SET is_active = false, updated_at = NOW()
  WHERE department_id = v_project_department_id
    AND id <> v_finishing_id
    AND (
      LOWER(TRIM(sub_department_name)) = 'steam'
      OR LOWER(sub_department_name) LIKE '%thread trimmer%'
      OR LOWER(sub_department_name) LIKE '%buang benang%'
    );
END $$;
