-- Correct QC sub-department parents so the hierarchy follows
-- Department -> Subdepartment, like asset category -> subcategory.

UPDATE public.sub_departments sd
SET department_id = d.id,
    sub_department_name = 'Project Production QC',
    updated_at = NOW()
FROM public.departments d
WHERE sd.sub_department_code = 'QC-PROJ'
  AND d.department_code = 'PRJ-PROD';

UPDATE public.sub_departments sd
SET department_id = d.id,
    sub_department_name = 'Stock Production QC',
    updated_at = NOW()
FROM public.departments d
WHERE sd.sub_department_code = 'QC-STK'
  AND d.department_code = 'STK-PROD';
