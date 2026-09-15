-- Pusatkan Bagian operasional finishing pada:
-- Project Production -> Finishing.
DO $$
DECLARE
  v_target_sub_department_id UUID;
  v_section_name TEXT;
BEGIN
  SELECT sd.id
  INTO v_target_sub_department_id
  FROM public.sub_departments sd
  JOIN public.departments d ON d.id = sd.department_id
  WHERE d.department_code = 'PRJ-PROD'
    AND LOWER(TRIM(sd.sub_department_name)) = 'finishing'
  LIMIT 1;

  -- Kompatibel dengan master awal yang memakai nama "Project Finishing & Packing".
  IF v_target_sub_department_id IS NULL THEN
    SELECT sd.id
    INTO v_target_sub_department_id
    FROM public.sub_departments sd
    JOIN public.departments d ON d.id = sd.department_id
    WHERE d.department_code = 'PRJ-PROD'
      AND sd.sub_department_code = 'PRJ-FINS'
    LIMIT 1;
  END IF;

  IF v_target_sub_department_id IS NULL THEN
    RAISE EXCEPTION 'Subdepartemen Finishing di bawah Project Production tidak ditemukan';
  END IF;

  FOREACH v_section_name IN ARRAY ARRAY['Packing', 'Steam', 'Buang Benang']
  LOOP
    INSERT INTO public.employee_work_sections (sub_department_id, section_name, is_active)
    VALUES (v_target_sub_department_id, v_section_name, true)
    ON CONFLICT (sub_department_id, section_name)
    DO UPDATE SET is_active = true, updated_at = NOW();

    UPDATE public.employees employee
    SET work_section_id = target.id,
        updated_at = NOW()
    FROM public.employee_work_sections source,
         public.employee_work_sections target
    WHERE employee.work_section_id = source.id
      AND LOWER(source.section_name) = LOWER(v_section_name)
      AND source.sub_department_id <> v_target_sub_department_id
      AND target.sub_department_id = v_target_sub_department_id
      AND LOWER(target.section_name) = LOWER(v_section_name);

    DELETE FROM public.employee_work_sections section
    WHERE LOWER(section.section_name) = LOWER(v_section_name)
      AND section.sub_department_id <> v_target_sub_department_id;
  END LOOP;
END $$;
