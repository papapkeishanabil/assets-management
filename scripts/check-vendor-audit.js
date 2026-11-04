// Audit read-only modul vendor untuk perencanaan Modul Manajemen Vendor.
// Kredensial dari env: SUPABASE_URL, SUPABASE_SERVICE_KEY. Tidak mengubah data.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Butuh env: SUPABASE_URL dan SUPABASE_SERVICE_KEY');
  process.exit(1);
}

async function rpc(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  return { status: res.status, body: await res.text() };
}

const probes = [
  ['ROLES', `SELECT string_agg(role_name, ',' ORDER BY role_name) FROM roles;`],
  ['VENDOR_COUNT', `SELECT count(*) || ' rows; aktif=' || count(*) FILTER (WHERE is_active) FROM vendors;`],
  ['VENDOR_SAMPLE', `SELECT string_agg(vendor_name || ' [' || COALESCE(vendor_type,'-') || ']', ' | ') FROM (SELECT * FROM vendors ORDER BY created_at LIMIT 15) t;`],
  ['VENDOR_COLUMNS', `SELECT string_agg(column_name || ':' || data_type, ', ' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='vendors';`],
  ['VENDOR_POLICIES', `SELECT COALESCE(string_agg(policyname || '/' || cmd, ', '),'TIDAK ADA POLICY') FROM pg_policies WHERE schemaname='public' AND tablename='vendors';`],
  ['BUCKETS', `SELECT COALESCE(string_agg(id || (CASE WHEN public THEN '(pub)' ELSE '(priv)' END), ', '),'-') FROM storage.buckets;`],
  ['VENDOR_REFS', `SELECT 'assets=' || (SELECT count(*) FROM assets WHERE vendor_id IS NOT NULL) || ' contracts=' || (SELECT count(*) FROM contracts WHERE vendor_id IS NOT NULL);`],
  ['ROLE_PERMISSIONS_MODULES', `SELECT COALESCE(string_agg(DISTINCT module_key, ',' ORDER BY module_key),'-') FROM role_permissions WHERE can_access;`],
  ['VENDOR_CODE_SEQ', `SELECT COALESCE(string_agg(vendor_code, ','),'-') FROM (SELECT vendor_code FROM vendors ORDER BY vendor_code LIMIT 10) t;`],
];

for (const [label, inner] of probes) {
  const sql = `DO $$ DECLARE v TEXT; BEGIN ${inner.replace(/\bSELECT\b/, 'SELECT').replace(/;(\s*)$/, '').replace(/^SELECT/, 'SELECT INTO v')} ; RAISE EXCEPTION '${label}=%%', v; END $$;`.replace('%%', '%');
  const { status, body } = await rpc(sql);
  try {
    const parsed = JSON.parse(body);
    console.log(`${label}: ${parsed.message || body}`);
  } catch {
    console.log(`${label}: [status ${status}] ${body}`);
  }
}
