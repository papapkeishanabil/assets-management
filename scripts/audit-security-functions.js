// AUDIT KEAMANAN TAMBAHAN (poin B) — SEMUA READ-ONLY via RAISE EXCEPTION.
// Fokus: SECURITY DEFINER yang diakses anon/authenticated, SQL dinamis,
// tabel tanpa RLS, indikasi penyalahgunaan. Env: SUPABASE_URL, SUPABASE_SERVICE_KEY.
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
  try { console.log(JSON.parse(body).message); }
  catch { console.log(`${label}: [${res.status}] ${body.slice(0, 180)}`); }
}

console.log('=== B1. Fungsi SECURITY DEFINER + siapa yang boleh eksekusi ===');
await probe('DEFINER_ANON_DAN_AUTH', `
  SELECT COALESCE(string_agg(f.proname, ', ' ORDER BY f.proname), 'TIDAK ADA') FROM (
    SELECT p.proname, p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE p.prosecdef AND n.nspname='public'
      AND EXISTS (SELECT 1 FROM information_schema.routine_privileges rp
                  WHERE rp.routine_schema='public' AND rp.routine_name=p.proname
                    AND rp.grantee IN ('PUBLIC','anon','authenticated'))
  ) f`);

console.log('=== B2. Fungsi dengan SQL dinamis (EXECUTE/format) di public ===');
await probe('DYNAMIC_SQL', `
  SELECT COALESCE(string_agg(p.proname, ', ' ORDER BY p.proname), 'TIDAK ADA')
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND pg_get_functiondef(p.oid) ~* 'EXECUTE\\s|format\\('`);

console.log('=== B3. Tabel public TANPA RLS (risiko bypass) ===');
await probe('TABEL_TANPA_RLS', `
  SELECT COALESCE(string_agg(c.relname, ', ' ORDER BY c.relname), 'SEMUA SUDAH RLS')
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity`);

console.log('=== B4. Fungsi public selain milik schema standar (deteksi artefak asing) ===');
await probe('SEMUA_FUNGSI_PUBLIC', `
  SELECT COALESCE(string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ' | '), '(kosong)')
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prokind='f'`);

console.log('=== B5. Indikasi penyalahgunaan: user & aktivitas mencurigakan ===');
await probe('AUTH_USERS', `
  SELECT count(*) || ' user; ' || string_agg(email, ',') FROM (SELECT email FROM auth.users ORDER BY created_at DESC LIMIT 20) t`);
await probe('LOG_ASET_TERBARU', `
  SELECT to_char(max(created_at), 'YYYY-MM-DD') || ' (aktivitas log terakhir)' FROM asset_activity_logs`);
await probe('TABEL_BARU_MENCURIGAKAN', `
  SELECT COALESCE(string_agg(table_name, ','), 'TIDAK ADA') FROM information_schema.tables
  WHERE table_schema='public' AND table_name NOT IN (
    'roles','user_profiles','role_permissions','vendors','assets','asset_categories','asset_locations',
    'asset_conditions','asset_statuses','departments','sub_departments','divisions','employees','employee_positions',
    'employee_work_sections','employee_salary_history','employee_position_options','contracts','contract_types',
    'contract_reminders','maintenance_types','maintenance_schedules','maintenance_executions','maintenance_records',
    'maintenance_drafts','asset_photos','asset_documents','asset_responsibles','asset_responsible_assignments',
    'asset_activity_logs','notifications','push_subscriptions','product_types','product_type_default_components',
    'asset_service_photos','inspection_reviews')`);
