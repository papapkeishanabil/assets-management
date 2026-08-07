-- ============================================
-- ADD ORGANIZATION COLUMNS TO EMPLOYEES TABLE
-- ============================================

-- Add division_id column
ALTER TABLE employees ADD COLUMN IF NOT EXISTS division_id UUID REFERENCES divisions(id);

-- Add sub_department_id column
ALTER TABLE employees ADD COLUMN IF NOT EXISTS sub_department_id UUID REFERENCES sub_departments(id);

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_employees_division ON employees(division_id);
CREATE INDEX IF NOT EXISTS idx_employees_sub_department ON employees(sub_department_id);

-- Update RLS policies (if needed, they should already work since they were created in the previous migration)
-- The existing policies should still work since they check user_profiles and roles

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'employees' 
AND column_name IN ('division_id', 'department_id', 'sub_department_id');