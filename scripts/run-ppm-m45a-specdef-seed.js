import { SUPABASE_URL as SUPABASE_URL, SUPABASE_SERVICE_KEY as SERVICE_KEY, assertServiceKey } from './_ppm-env.js';
assertServiceKey();
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '202608120003_ppm_m45a_specdef_seed.sql');

async function runMigration() {
  try {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('Migration M4.5A specdef seed file loaded, chars:', sql.length);

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql })
    });

    const text = await response.text();
    console.log('Status:', response.status);
    console.log('Response:', text.slice(0, 1000));

    if (!response.ok) {
      console.error('Migration FAILED.');
      process.exit(1);
    }
    console.log('Migration M4.5A specdef seed applied successfully.');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

runMigration();
