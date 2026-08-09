import { SUPABASE_URL as SUPABASE_URL, SUPABASE_SERVICE_KEY as SERVICE_KEY , assertServiceKey} from './_ppm-env.js';
assertServiceKey();



async function runMigration() {
  const sql = `
ALTER TABLE employees ADD COLUMN IF NOT EXISTS division_id UUID REFERENCES divisions(id);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS sub_department_id UUID REFERENCES sub_departments(id);
CREATE INDEX IF NOT EXISTS idx_employees_division ON employees(division_id);
CREATE INDEX IF NOT EXISTS idx_employees_sub_department ON employees(sub_department_id);
  `;

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql })
    });

    const text = await response.text();
    console.log('Status:', response.status);
    console.log('Response:', text);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

runMigration();