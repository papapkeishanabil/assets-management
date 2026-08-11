import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY, assertServiceKey } from './_ppm-env.js';

assertServiceKey();

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(scriptDir, '../supabase/migrations/202608100001_allow_indefinite_contracts.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ sql })
});

const body = await response.text();
if (!response.ok) {
  throw new Error(`Migration failed (${response.status}): ${body}`);
}

console.log('PKWTT migration applied successfully.');
