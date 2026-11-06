// Pemeriksaan produksi READ-ONLY. Tidak menjalankan migration atau fungsi fitur.
// Kredensial hanya process.env; jangan menulis key atau .env ke output/commit.
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
assert.equal(url, 'https://uwlxkwyauxwewoexfgwi.supabase.co', 'Target harus project HARMAS produksi yang disetujui untuk SELECT');
assert.ok(key, 'Butuh SUPABASE_SERVICE_KEY melalui env');
const query = `SELECT jsonb_build_object(
 'table_security',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('vendors','assets','user_profiles','roles','notifications','vendor_candidates','vendor_contacts','vendor_candidate_specialties','vendor_activity_logs','vendor_status_history')),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_policies p WHERE schemaname='public' AND tablename IN ('vendors','assets','user_profiles','roles','notifications','vendor_candidates','vendor_contacts','vendor_candidate_specialties','vendor_activity_logs','vendor_status_history')),
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definer',p.prosecdef,'config',p.proconfig,'owner',pg_get_userbyid(p.proowner),'definition',pg_get_functiondef(p.oid),'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE')) ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('is_app_role','my_profile_id','vendor_guard_restricted_columns','profiles_guard_admin_fields','vendor_record_activity','vendor_record_status_change','exec_sql')),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) ORDER BY c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('vendor_candidates','user_profiles') AND NOT t.tgisinternal),
 'columns',(SELECT jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',data_type,'nullable',is_nullable) ORDER BY table_name,ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('vendor_candidates','vendor_activity_logs','user_profiles','notifications')),
 'notification_constraints',(SELECT coalesce(jsonb_agg(pg_get_constraintdef(oid)),'[]'::jsonb) FROM pg_constraint WHERE conrelid='public.notifications'::regclass),
 'notification_indexes',(SELECT jsonb_agg(indexdef ORDER BY indexname) FROM pg_indexes WHERE schemaname='public' AND tablename='notifications'),
 'roles',(SELECT jsonb_agg(role_name ORDER BY role_name) FROM public.roles),
 'module_permissions',(SELECT jsonb_agg(jsonb_build_object('role',r.role_name,'module',p.module_key,'access',p.can_access) ORDER BY r.role_name,p.module_key) FROM public.role_permissions p JOIN public.roles r ON r.id=p.role_id WHERE p.module_key LIKE 'vendor%'),
 'phase2_collisions',jsonb_build_object('table',to_regclass('public.vendor_followups')::text,'sequence',to_regclass('public.vendor_followup_code_seq')::text,'dashboard',to_regprocedure('public.vendor_sourcing_dashboard(uuid,uuid)')::text,'reminder',to_regprocedure('public.vendor_remind_overdue_followups()')::text),
 'baseline',(SELECT jsonb_object_agg(name,jsonb_build_object('count',n,'checksum',checksum)) FROM (
   SELECT 'vendors' name,count(*) n,md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) checksum FROM public.vendors x
   UNION ALL SELECT 'assets',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.assets x
   UNION ALL SELECT 'user_profiles',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.user_profiles x
   UNION ALL SELECT 'roles',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.roles x
   UNION ALL SELECT 'role_permissions',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.role_permissions x
   UNION ALL SELECT 'notifications',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.notifications x
   UNION ALL SELECT 'employees',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.employees x
   UNION ALL SELECT 'contracts',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.contracts x
   UNION ALL SELECT 'vendor_candidates',count(*),md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) FROM public.vendor_candidates x
 ) s),
 'asset_vendor_relations',(SELECT count(*) FROM public.assets WHERE vendor_id IS NOT NULL),
 'asset_vendor_orphans',(SELECT count(*) FROM public.assets a LEFT JOIN public.vendors v ON v.id=a.vendor_id WHERE a.vendor_id IS NOT NULL AND v.id IS NULL)
)`;
// Isi hanya SELECT katalog/agregat dan exception yang memaksa rollback transaksi,
// meskipun exec_sql memakai SECURITY DEFINER. Tidak memanggil RPC fitur.
const sql = `DO $probe$ DECLARE v jsonb; BEGIN ${query} INTO v; RAISE EXCEPTION 'PHASE2_READONLY:%',v::text; END $probe$;`;
const response = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
  method:'POST', headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(45000)
});
const body = await response.json();
assert.equal(response.status,400,`Status tidak terduga ${response.status}`);
assert.equal(body.code,'P0001','Probe harus berakhir dengan exception disengaja, bukan sukses/mutation');
assert.ok(body.message.startsWith('PHASE2_READONLY:'),'Hasil probe tidak sesuai');
const data = JSON.parse(body.message.slice('PHASE2_READONLY:'.length));
const evidencePath = new URL('../docs/vendor-management/PHASE2_PRODUCTION_READONLY.json',import.meta.url);
if (process.argv.includes('--compare')) {
  assert.ok(existsSync(evidencePath),'Baseline awal belum tersedia');
  const before = JSON.parse(readFileSync(evidencePath,'utf8'));
  assert.deepEqual(data,before.data,'Objek/data produksi berubah sejak probe pertama; periksa aktivitas aplikasi atau drift');
  writeFileSync(new URL('../docs/vendor-management/PHASE2_PRODUCTION_READONLY_RECHECK.txt',import.meta.url),`PASS | Second read-only probe matches baseline exactly\nChecked at: ${new Date().toISOString()}\nSQL contains SELECT only and terminates with forced rollback (P0001).\n`);
  console.log('PASS | Probe kedua: definisi objek, policy, baseline dan checksum produksi identik');
} else {
  writeFileSync(evidencePath,JSON.stringify({checked_at:new Date().toISOString(),target:url,mode:'SELECT only; forced transaction rollback',data},null,2)+'\n');
  console.log('PASS | Snapshot metadata produksi read-only tersimpan; tidak ada data personal atau kredensial dalam output');
}
console.log(JSON.stringify({baseline:Object.fromEntries(Object.entries(data.baseline).map(([k,v])=>[k,v.count])),asset_vendor_relations:data.asset_vendor_relations,phase2_collisions:data.phase2_collisions}));
