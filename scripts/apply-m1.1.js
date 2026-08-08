import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://uwlxkwyauxwewoexfgwi.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3bHhrd3lhdXh3ZXdvZXhmZ3dpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDYwODk4MiwiZXhwIjoyMTAwMTg0OTgyfQ.1Axuw7mObIbzeFiG7ZeKQCmzm-AVtyxaPbbAxfbeo3k';

async function rpc(sql) {
  const res = await globalThis.fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql })
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text };
}

async function main() {
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '202608080004_product_type_default_components.sql');
  const migration = fs.readFileSync(sqlPath, 'utf8');
  console.log('Migration file chars:', migration.length, 'lines:', migration.split('\n').length);

  const statements = migration.split(';').map(s => s.trim()).filter(s => s.length > 0);
  console.log('Statements to execute:', statements.length);

  for (let i = 0; i < statements.length; i++) {
    const sql = statements[i];
    const r = await rpc(sql);
    console.log(`[${i + 1}] status=${r.status} ok=${r.ok} body=${r.body.slice(0, 300)}`);
    if (!r.ok) { console.error('FAILED at stmt', i + 1); process.exitCode = 1; break; }
  }

  const v = await rpc('SELECT pt.code, COUNT(*) AS c FROM product_types pt JOIN product_type_default_components ptdc ON ptdc.product_type_id=pt.id GROUP BY pt.code ORDER BY pt.code;');
  console.log('VERIFY_DEFAULTS:', v.body);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });