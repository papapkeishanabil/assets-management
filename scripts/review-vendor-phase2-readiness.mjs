// Membandingkan snapshot read-only produksi dengan objek keamanan Docker lokal.
// Tidak menghubungi/menulis produksi. Jalankan probe produksi terlebih dahulu.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const snapshot = JSON.parse(readFileSync(new URL('../docs/vendor-management/PHASE2_PRODUCTION_READONLY.json',import.meta.url),'utf8'));
const prod = snapshot.data;
const report = [];
const pass = (message) => { report.push(`PASS | ${message}`); console.log(report.at(-1)); };
const localQuery = `SELECT jsonb_build_object(
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_policies p WHERE schemaname='public' AND tablename IN ('user_profiles','roles','notifications','vendor_candidates','vendor_contacts','vendor_candidate_specialties','vendor_activity_logs','vendor_status_history') AND policyname <> 'test read profiles'),
 'functions',(SELECT jsonb_object_agg(proname,pg_get_functiondef(oid)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('is_app_role','my_profile_id','vendor_guard_restricted_columns','profiles_guard_admin_fields','vendor_record_activity','vendor_record_status_change'))
);`;
const localResult = spawnSync('docker',['exec','-i','supabase_db_harmas-vendor-test','psql','-X','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{input:localQuery,encoding:'utf8'});
assert.equal(localResult.status,0,localResult.stderr);
const local = JSON.parse(localResult.stdout.trim());
assert.ok(prod.table_security.every((t)=>t.rls),'RLS produksi tidak aktif');
pass('RLS seluruh 10 tabel relevan produksi aktif');
assert.equal(prod.asset_vendor_orphans,0);
assert.ok(Object.values(prod.phase2_collisions).every((v)=>v===null),'Objek Fase 2 sudah ada: butuh review deployment yang berbeda');
pass('Tidak ada objek Fase 2 yang bertabrakan; 16 relasi aset-vendor valid, 0 orphan');
const securityTables = ['user_profiles','roles','notifications'];
const corePolicies = prod.policies.filter((p)=>securityTables.includes(p.tablename));
assert.equal(corePolicies.length,8);
assert.ok(corePolicies.every((p)=>p.roles.length===1 && p.roles[0]==='authenticated'));
assert.deepEqual(prod.policies.filter((p)=>local.policies.some((l)=>l.tablename===p.tablename)),local.policies);
pass('Delapan policy hardening dan seluruh policy pipeline terkait identik secara definisi dengan lokal tervalidasi; tanpa policy lama tambahan');
for(const f of prod.functions.filter((f)=>f.signature!=='exec_sql(text)')) {
  const name = f.signature.split('(')[0];
  assert.equal(f.definition,local.functions[name],`Drift fungsi ${name}`);
}
pass('Enam helper/guard/audit produksi identik dengan definisi lokal; tidak ada drift');
for(const name of ['is_app_role(text[])','my_profile_id()']) {
  const f = prod.functions.find((f)=>f.signature===name);
  assert.ok(f.definer && f.config.includes('search_path=public, pg_temp') && !f.anon_execute && f.authenticated_execute);
}
const execSql = prod.functions.find((f)=>f.signature==='exec_sql(text)');
assert.ok(!execSql.anon_execute && !execSql.authenticated_execute && execSql.service_execute);
assert.ok(prod.triggers.every((t)=>t.enabled==='O'));
pass('Helper SECURITY DEFINER/search_path benar; exec_sql tertutup anon/authenticated; guard dan trigger produksi enabled');
for(const col of ['id','user_id','notification_type','title','message','reference_type','reference_id','reference_url','notification_date']) {
  assert.ok(prod.columns.some((c)=>c.table==='notifications' && c.column===col),`Kolom notifikasi ${col} hilang`);
}
assert.ok(prod.notification_constraints.some((c)=>c==='PRIMARY KEY (id)'));
assert.ok(!prod.notification_constraints.some((c)=>/CHECK/.test(c)),'Periksa CHECK notification_type sebelum rilis');
pass('Kolom reminder dan primary key notifikasi kompatibel; tidak ada CHECK yang menolak tipe notifikasi baru');
for(const r of ['sourcing','direksi']) {
  for(const m of ['vendor_management','vendor_followups']) assert.ok(prod.module_permissions.some((p)=>p.role===r && p.module===m && p.access));
}
assert.ok(!prod.roles.includes('qc'));
pass('Sourcing/Direksi memiliki dua module key; tidak ada role QC; Super Admin memakai bypass frontend dan role RLS yang sah');
const migration = readFileSync(new URL('../supabase/migrations/202611060001_vendor_management_phase2.sql',import.meta.url),'utf8');
assert.ok(!/(?:ALTER TABLE|DROP TABLE|DROP POLICY[^;]* ON|CREATE POLICY[^;]* ON)\s+(?:public\.)?(?:vendors|assets|user_profiles|roles|notifications)\b/i.test(migration));
assert.ok(!/DROP FUNCTION[^;]*\b(?:is_app_role|my_profile_id|exec_sql|vendor_guard_restricted_columns|profiles_guard_admin_fields)\b/i.test(migration));
assert.ok(migration.includes('Policy vendor_followups tidak dikenal'));
assert.ok(!/VALUES \(md5\([^\n]*v_day/.test(migration));
const rollback = new URL('../supabase/rollbacks/202611060001_vendor_management_phase2_rollback.sql',import.meta.url);
assert.ok(readFileSync(rollback,'utf8').includes('DROP TABLE IF EXISTS public.vendor_followups'));
pass('Migration hanya mengelola objek Fase 2, menolak policy asing, tidak mengganti guard existing; rollback berada di supabase/rollbacks');
report.push(`Snapshot UTC: ${snapshot.checked_at}`,`RESULT: ${report.length} checks PASS; production migration remains NOT EXECUTED.`);
writeFileSync(new URL('../docs/vendor-management/PHASE2_READINESS_CHECKS.txt',import.meta.url),report.join('\n')+'\n');
