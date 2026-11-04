// ============================================================
// EKSEKUSI HARDENING exec_sql — DISETUJUI USER 4 Nov 2026
// Persetujuan khusus: REVOKE EXECUTE exec_sql(text) dari
// PUBLIC/anon/authenticated. TIDAK ADA perubahan lain.
// Isi identik dengan supabase/hardening/20261104_revoke_exec_sql.sql.
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY.
// ============================================================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Butuh env: SUPABASE_URL dan SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const SQL = `
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM authenticated;
`;

async function rpc(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  return { status: res.status, body: await res.text() };
}

console.log('1) Sebelum — grants exec_sql:');
let before = await rpc(`DO $$ DECLARE v TEXT; BEGIN
  SELECT string_agg(DISTINCT grantee, ',' ORDER BY grantee) INTO v
  FROM information_schema.routine_privileges
  WHERE routine_schema='public' AND routine_name='exec_sql';
  RAISE EXCEPTION '%', COALESCE(v,'(kosong)');
END $$;`);
console.log('   ', before.body.match(/"message":"([^"]*)"/)?.[1] || before.body.slice(0, 150));

console.log('2) Eksekusi REVOKE (persis file hardening)...');
const revoke = await rpc(SQL);
console.log('    status:', revoke.status, revoke.body === '' ? '(sukses, void)' : revoke.body.slice(0, 150));
if (revoke.status !== 200) { console.error('GAGAL — hentikan.'); process.exit(1); }

console.log('3) Sesudah — grants exec_sql:');
let after = await rpc(`DO $$ DECLARE v TEXT; BEGIN
  SELECT string_agg(DISTINCT grantee, ',' ORDER BY grantee) INTO v
  FROM information_schema.routine_privileges
  WHERE routine_schema='public' AND routine_name='exec_sql';
  RAISE EXCEPTION '%', COALESCE(v,'(kosong)');
END $$;`);
const grants = after.body.match(/"message":"([^"]*)"/)?.[1] || after.body.slice(0, 150);
console.log('   ', grants);

const ok = grants.includes('service_role') && !grants.includes('anon') && !grants.includes('authenticated') && !grants.includes('PUBLIC');
console.log(ok ? 'VERIFIKASI LOLOS: hanya postgres+service_role tersisa.' : '!!! PERIKSA: ' + grants);
process.exit(ok ? 0 : 1);
