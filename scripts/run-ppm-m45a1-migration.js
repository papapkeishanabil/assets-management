import { SUPABASE_URL, SUPABASE_SERVICE_KEY, assertServiceKey } from './_ppm-env.js';
assertServiceKey();
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '202608130002_ppm_m45a1_conditional_rules.sql');

const sql = fs.readFileSync(migrationPath, 'utf8');
const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ sql }),
});
const t = await r.text();
console.log('status:', r.status);
console.log('body:', t.slice(0, 1200));
if (!r.ok) { console.error('MIGRATION FAILED'); process.exit(1); }
console.log('M4.5A.1 applied. Run lagi = idempotent (IF NOT EXISTS / DO NOTHING pattern).');