// Bandingkan policy RLS 3 tabel: PRODUKSI vs lingkungan uji lokal
// (yang lulus matriks 12/12). Env: SUPABASE_URL, SUPABASE_SERVICE_KEY.
import { execSync } from 'node:child_process';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) { console.error('Butuh env SUPABASE_URL, SUPABASE_SERVICE_KEY'); process.exit(1); }

const PROD_SQL = `
DO $$ DECLARE v TEXT; BEGIN
  SELECT string_agg(policyname, chr(10)) INTO v
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('user_profiles', 'roles', 'notifications');
  RAISE EXCEPTION '%', COALESCE(v, '(kosong)');
END $$;`;

const r = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ sql: PROD_SQL }),
});
const prodRaw = JSON.parse(await r.text()).message || '';
const prod = new Set(prodRaw.split('\n').map((s) => s.trim()).filter(Boolean));

const localRaw = execSync(
  `docker exec supabase_db_harmas-vendor-test psql -U postgres -d postgres -t -A -c "SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('user_profiles','roles','notifications') ORDER BY policyname"`
).toString();
const local = new Set(
  localRaw.split('\n').map((s) => s.trim()).filter(Boolean).filter((n) => n !== 'test read profiles')
);

console.log('PRODUKSI      :', [...prod].sort().join(', '));
console.log('LOKAL (uji)   :', [...local].sort().join(', '));

const onlyProd = [...prod].filter((x) => !local.has(x));
const onlyLocal = [...local].filter((x) => !prod.has(x));
console.log('Hanya di prod :', onlyProd.join(', ') || '(tidak ada)');
console.log('Hanya di lokal:', onlyLocal.join(', ') || '(tidak ada)');
console.log(
  onlyProd.length === 0 && onlyLocal.length === 0
    ? 'KESIMPULAN: policy produksi IDENTIK dengan set yang tervalidasi lokal 12/12.'
    : 'KESIMPULAN: ADA BEDA — periksa baris di atas.'
);
