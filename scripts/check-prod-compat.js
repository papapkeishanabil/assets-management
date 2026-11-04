// Pemeriksaan READ-ONLY kompatibilitas migration Fase 1 terhadap DB PRODUKSI.
// Poin 5 review user: hanya SELECT/information_schema via RAISE EXCEPTION.
// Tidak ada penulisan apa pun. Env: SUPABASE_URL, SUPABASE_SERVICE_KEY.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Butuh env: SUPABASE_URL dan SUPABASE_SERVICE_KEY');
  process.exit(1);
}

async function probe(label, inner) {
  const sql = `DO $$ DECLARE v TEXT; BEGIN ${inner} INTO v; RAISE EXCEPTION '${label}=%%', COALESCE(v,'(kosong)'); END $$;`.replace('%%', '%');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  const body = await res.text();
  try { console.log(JSON.parse(body).message || body); }
  catch { console.log(`${label}: [${res.status}] ${body.slice(0, 150)}`); }
}

// --- Kompatibilitas struktur (poin 5) ---
await probe('P1_VERSI', `SELECT version()`);
await probe('P2_ROLE_ROWS', `SELECT string_agg(role_name, ',' ORDER BY role_name) FROM roles`);
await probe('P3_USER_PROFILES_KOLOM', `SELECT count(*) || ' kolom; auth_user_id=' || (SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='auth_user_id') THEN 'ADA' ELSE 'HILANG' END) FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles'`);
await probe('P4_VENDORS', `SELECT count(*) || ' baris; ' || (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='vendors') || ' kolom' FROM vendors`);
await probe('P5_ASSET_VENDOR_REL', `SELECT count(*) || ' aset ber-vendor' FROM assets WHERE vendor_id IS NOT NULL`);
await probe('P6_ROLE_PERMS_UNIQUE', `SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='role_permissions' AND indexdef ILIKE '%UNIQUE%role_id%module_key%') THEN 'UNIQUE(role_id,module_key) ADA' ELSE 'TANPA UNIQUE!' END`);
await probe('P7_GEN_RANDOM_UUID', `SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='pg_catalog' AND p.proname='gen_random_uuid') THEN 'ADA (native)' ELSE 'TIDAK ADA' END`);
await probe('P8_SCHEMA_BERSIH', `SELECT 'vm_atomic_probe=' || (SELECT count(*) FROM information_schema.schemata WHERE schema_name='vm_atomic_probe') || '; vendor_candidates=' || (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='vendor_candidates')`);
await probe('P9_POLICY_VENDORS', `SELECT string_agg(policyname || '/' || cmd, ', ') FROM pg_policies WHERE schemaname='public' AND tablename='vendors'`);

// --- Audit SECURITY DEFINER (poin 3) ---
await probe('P10_FUNC_DEFINER_PUBLIC', `SELECT COALESCE(string_agg(n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ' | '), 'TIDAK ADA') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prosecdef AND n.nspname IN ('public','storage') AND pg_get_functiondef(p.oid) NOT ILIKE '% RETURNS trigger%'`);
await probe('P11_EXEC_SQL_DEF', `SELECT COALESCE(string_agg(n.nspname || '.' || p.proname || ' definer=' || p.prosecdef, ', '),'TIDAK ADA') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname='exec_sql'`);
await probe('P12_EXEC_SQL_GRANTS', `SELECT COALESCE(string_agg(grantee, ','),'tanpa grant eksplisit') FROM information_schema.routine_privileges WHERE routine_name='exec_sql' AND routine_schema='public'`);
await probe('P13_PUBLIC_SCHEMA_DEFAULT', `SELECT COALESCE(string_agg(nspname, ','),'-') FROM pg_namespace WHERE nspname='public' AND nspacl::text LIKE '%=#%'`);
