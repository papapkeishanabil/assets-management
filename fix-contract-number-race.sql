-- Fix race condition in contract number generation
-- Jalankan di Supabase SQL Editor

-- 1. Drop existing function
DROP FUNCTION IF EXISTS generate_contract_number;

-- 2. Create improved function with sequence table
CREATE OR REPLACE FUNCTION generate_contract_number(category TEXT, year_val INTEGER)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  prefix TEXT;
  seq_num INTEGER;
  new_code TEXT;
BEGIN
  -- Determine prefix
  prefix := CASE category
    WHEN 'EMPLOYEE' THEN 'EMP'
    WHEN 'VENDOR' THEN 'VND'
    ELSE 'CTR'
  END;
  
  -- Use advisory lock to prevent race condition
  PERFORM pg_advisory_xact_lock(hashtext('contract_seq_' || prefix || '_' || year_val::TEXT));
  
  -- Get next sequence
  SELECT COALESCE(MAX(CAST(SUBSTRING(contract_number FROM '\d{4}$') AS INTEGER)), 0) + 1
  INTO seq_num
  FROM contracts
  WHERE contract_number LIKE prefix || '-' || year_val || '-%';
  
  -- Validate no duplicate exists
  FOR i IN 1..10 LOOP
    new_code := prefix || '-' || year_val || '-' || LPAD(seq_num::TEXT, 4, '0');
    
    -- Check if this number already exists (in case of concurrent insert)
    IF NOT EXISTS (SELECT 1 FROM contracts WHERE contract_number = new_code) THEN
      RETURN new_code;
    END IF;
    
    seq_num := seq_num + 1;
  END LOOP;
  
  -- If all attempts fail, return with timestamp
  RETURN prefix || '-' || year_val || '-' || LPAD(seq_num::TEXT, 4, '0') || '-' || EXTRACT(EPOCH FROM NOW())::INTEGER;
END;
$$;

-- 3. Check existing contracts
SELECT contract_number, COUNT(*) 
FROM contracts 
GROUP BY contract_number 
HAVING COUNT(*) > 1;

-- 4. Test the function
SELECT generate_contract_number('EMPLOYEE', 2026);
SELECT generate_contract_number('VENDOR', 2026);
SELECT generate_contract_number('OTHER', 2026);