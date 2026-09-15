INSERT INTO public.employee_position_options (position_name, position_scope)
VALUES ('Staff', 'SUB_DEPARTMENT')
ON CONFLICT (position_scope, position_name) DO NOTHING;
