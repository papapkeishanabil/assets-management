// Pure SQL/validation helpers. No network or production write on import.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {snapshotSql as archiveSnapshot,target,quote} from './vendor-candidate-archive-release-checks.mjs';
export {target,quote};
export const same=isDeepStrictEqual;
export const hash=s=>createHash('sha256').update(s).digest('hex');
export const migrations=['supabase/migrations/202611110001_vendor_management_phase4.sql','supabase/migrations/202611110002_vendor_management_phase5.sql'];
const reviewFile='docs/vendor-management/phase45-release-evidence/SQL_REVIEW.json';
const reviewed=JSON.parse(fs.readFileSync(fs.existsSync(reviewFile)?reviewFile:'docs/vendor-management/phase5-evidence/BUILD_AND_REVIEW.json','utf8'));
export const source=migrations.map(file=>{const sql=fs.readFileSync(file,'utf8'),expected=reviewed.sql_files.find(x=>x.file===file);assert.ok(expected);assert.equal(hash(sql),expected.sha256,'SQL differs from reviewed local tests: '+file);return{file,sha256:hash(sql),sql};});
export const newTables=['vendor_samples','vendor_qc_parameters','vendor_sample_qc_runs','vendor_qc_run_revisions','vendor_sample_change_history','vendor_decisions','vendor_activations'];
export const newBuckets=['vendor-sample-files','vendor-decision-files'];
export const functions=source.flatMap(({sql})=>[...sql.replaceAll('\r','').matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(([\s\S]*?)\)\s*\nRETURNS ([\s\S]*?)AS \$\$([\s\S]*?)\$\$;/g)].map(m=>({name:m[1],body:m[4],definer:/SECURITY DEFINER/.test(m[3]),volatility:/IMMUTABLE/.test(m[3])?'i':/STABLE/.test(m[3])?'s':'v'})));
assert.ok(functions.length>=18);export const functionNames=functions.map(f=>f.name);
const baselineTables=['vendors','assets','employees','contracts','user_profiles','roles','role_permissions','notifications','vendor_candidates','vendor_followups','vendor_categories','vendor_specialties','vendor_contacts','vendor_candidate_specialties','vendor_activity_logs','vendor_status_history','vendor_locations','vendor_location_photos','auth.users','auth.identities'];
const baseline=baselineTables.map(t=>`SELECT ${quote(t)} name,count(*) n,md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text COLLATE "C")::text,'')) checksum FROM ${t.includes('.')?t:'public.'+t} x`).join(' UNION ALL ');
export const snapshotSql=`SELECT (${archiveSnapshot}) || jsonb_build_object(
 'functions',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',p.proname,'signature',p.oid::regprocedure::text,'source',replace(p.prosrc,chr(13),''),'definer',p.prosecdef,'volatility',p.provolatile::text,'config',p.proconfig,'owner',pg_get_userbyid(p.proowner),'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'acl',(SELECT jsonb_agg(a::text ORDER BY a::text COLLATE "C") FROM unnest(p.proacl) a)) ORDER BY p.oid::regprocedure::text),'[]') FROM pg_proc p WHERE p.pronamespace='public'::regnamespace),
 'baseline',(SELECT jsonb_object_agg(name,jsonb_build_object('count',n,'checksum',checksum)) FROM (${baseline}) b),
 'buckets',(SELECT coalesce(jsonb_agg(to_jsonb(b)||jsonb_build_object('objects',(SELECT count(*) FROM storage.objects WHERE bucket_id=b.id)) ORDER BY b.id),'[]') FROM storage.buckets b),
 'storage_objects_checksum',(SELECT md5(coalesce(jsonb_agg(to_jsonb(o) ORDER BY bucket_id,name)::text,'')) FROM storage.objects o),
 'storage_acl',(SELECT jsonb_build_object('owner',pg_get_userbyid(relowner),'acl',(SELECT jsonb_agg(a::text ORDER BY a::text COLLATE "C") FROM unnest(relacl) a)) FROM pg_class WHERE oid='storage.objects'::regclass),
 'new_objects',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',relname,'kind',relkind::text,'rls',relrowsecurity,'owner',pg_get_userbyid(relowner)) ORDER BY relname),'[]') FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN (${[...newTables,'vendor_sample_monitor','vendor_sample_code_seq','vendor_qc_code_seq','vendor_decision_code_seq','vendor_activation_master_code_seq'].map(quote).join(',')})))`;
export const privilegesSql=`SELECT jsonb_build_object('executor',current_user,'database',current_database(),
 'schema_create',has_schema_privilege(current_user,'public','CREATE'),
 'storage_policy_management',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user) OR pg_has_role(current_user,(SELECT relowner FROM pg_class WHERE oid='storage.objects'::regclass),'USAGE') OR coalesce((SELECT (setting::jsonb->current_user) ? 'storage.objects' FROM pg_settings WHERE name='supautils.policy_grants'),false),
 'bucket_insert',has_table_privilege(current_user,'storage.buckets','INSERT'),
 'references',(SELECT bool_and(has_table_privilege(current_user,t,'REFERENCES')) FROM unnest(ARRAY['public.vendor_candidates','public.user_profiles','public.employees','public.vendors']) t),
 'sha256',to_regprocedure('pg_catalog.sha256(bytea)') IS NOT NULL)`;
const publicFunctions=new Set(['vendor_sample_file_path','vendor_record_sample_qc','vendor_sampling_dashboard','vendor_sample_storage_access','vendor_approval_checklist','vendor_record_decision','activate_vendor_candidate','vendor_decision_file_access']);
const anonFunctions=new Set(['vendor_sample_storage_access','vendor_decision_file_access']);
export function stable(s){const v=structuredClone(s);for(const k of ['executor','database','ddl_permissions','new_objects'])delete v[k];v.functions=v.functions.filter(f=>!functionNames.includes(f.name));v.policies=v.policies.filter(p=>!newTables.includes(p.tablename)&&!/^Vendor (sample|decision) files /.test(p.policyname));v.triggers=v.triggers.filter(t=>!newTables.includes(t.table));v.rls=Object.fromEntries(Object.entries(v.rls).filter(([k])=>!newTables.includes(k.split('.')[1])));v.buckets=v.buckets.filter(b=>!newBuckets.includes(b.id));return v;}
export function validateBefore(s,p){
 assert.ok(['postgres','supabase_admin'].includes(p.executor));assert.ok(['postgres','phase45_restore'].includes(p.database));for(const[k,v]of Object.entries(p))if(!['executor','database'].includes(k))assert.equal(v,true,'Missing release privilege: '+k);
 assert.equal(Object.keys(s.baseline).length,20);assert.equal(s.asset_vendor_orphans,0);assert.equal(s.archive_columns.length,3);assert.equal(s.archive_triggers.length,6);assert.ok(s.archive_index&&s.archive_foreign_key);
 assert.equal(s.new_objects.length,0,'Phase 4/5 objects already exist; inspect outcome before any retry');assert.equal(s.functions.filter(f=>functionNames.includes(f.name)).length,0);assert.equal(s.buckets.filter(b=>newBuckets.includes(b.id)).length,0,'New bucket already exists; inspect before migration');
 for(const t of ['vendor_candidates','vendor_followups','vendor_locations','vendor_location_photos','user_profiles','roles','notifications'])assert.equal(s.rls['public.'+t],true,t+' RLS');
 for(const name of ['is_app_role','my_profile_id']){const f=s.functions.find(f=>f.name===name);assert.ok(f?.definer&&!f.anon_execute&&f.authenticated_execute);assert.ok(f.config?.includes('search_path=public, pg_temp'));}
 const exec=s.functions.find(f=>f.name==='exec_sql');assert.ok(!exec||(!exec.anon_execute&&!exec.authenticated_execute));assert.ok(s.map_view.options.includes('security_invoker=true'));assert.match(s.map_view.definition,/archived_at IS NULL/);
 for(const t of [...s.triggers,...s.archive_triggers])if(['vendor_candidates','user_profiles','vendor_followups'].includes(t.table))assert.equal(t.enabled,'O');
}
export function validateAfter(before,after){
 assert.ok(same(stable(before),stable(after)),'Existing data/security/buckets changed');
 for(const t of newTables){const obj=after.new_objects.find(x=>x.name===t);assert.ok(obj?.rls,t+' RLS');assert.ok(['postgres','supabase_admin'].includes(obj.owner));}
 const actual=after.functions.filter(f=>functionNames.includes(f.name));assert.equal(actual.length,functions.length);
 for(const expected of functions){const f=actual.find(x=>x.name===expected.name);assert.equal(f.source,expected.body,expected.name+' body');assert.equal(f.definer,expected.definer);assert.equal(f.volatility,expected.volatility);assert.ok(f.config?.includes('search_path=public, pg_temp'));assert.equal(f.authenticated_execute,publicFunctions.has(f.name));assert.equal(f.anon_execute,anonFunctions.has(f.name));assert.ok(['postgres','supabase_admin'].includes(f.owner));}
 assert.equal(after.policies.filter(p=>newTables.includes(p.tablename)||/^Vendor (sample|decision) files /.test(p.policyname)).length,22);
 for(const b of newBuckets){const x=after.buckets.find(x=>x.id===b);assert.ok(x&&!x.public);assert.equal(x.file_size_limit,5242880);assert.equal(x.objects,0);assert.deepEqual(x.allowed_mime_types,['application/pdf','image/jpeg','image/png','image/webp']);}
}
export const postChecksSql=`SELECT jsonb_build_object(
 'administrative_table_privileges_revoked',NOT EXISTS(SELECT FROM unnest(ARRAY[${newTables.map(t=>quote('public.'+t)).join(',')}]) t CROSS JOIN unnest(ARRAY['TRUNCATE','TRIGGER','REFERENCES','MAINTAIN']) p WHERE has_table_privilege('authenticated',t,p) OR has_table_privilege('anon',t,p)),
 'internal_sequence_privileges_revoked',NOT EXISTS(SELECT FROM unnest(ARRAY['public.vendor_qc_code_seq','public.vendor_qc_run_revisions_id_seq','public.vendor_sample_change_history_id_seq','public.vendor_decision_code_seq','public.vendor_activation_master_code_seq']) t WHERE has_sequence_privilege('authenticated',t,'USAGE') OR has_sequence_privilege('authenticated',t,'UPDATE') OR has_sequence_privilege('anon',t,'USAGE')) AND NOT has_sequence_privilege('authenticated','public.vendor_sample_code_seq','UPDATE') AND has_sequence_privilege('authenticated','public.vendor_sample_code_seq','USAGE'),
 'seed_parameters',(SELECT count(*)=6 FROM public.vendor_qc_parameters),
 'new_business_empty',(SELECT (SELECT count(*) FROM public.vendor_samples)+(SELECT count(*) FROM public.vendor_sample_qc_runs)+(SELECT count(*) FROM public.vendor_sample_change_history)+(SELECT count(*) FROM public.vendor_qc_run_revisions)+(SELECT count(*) FROM public.vendor_decisions)+(SELECT count(*) FROM public.vendor_activations)=0),
 'qc_decision_writes_revoked',(SELECT bool_and(NOT has_table_privilege('authenticated',t,'INSERT') AND NOT has_table_privilege('authenticated',t,'UPDATE') AND NOT has_table_privilege('authenticated',t,'DELETE') AND NOT has_table_privilege('anon',t,'SELECT')) FROM unnest(ARRAY['public.vendor_sample_qc_runs','public.vendor_qc_run_revisions','public.vendor_sample_change_history','public.vendor_decisions','public.vendor_activations']) t),
 'sample_deletes_revoked',NOT has_table_privilege('authenticated','public.vendor_samples','DELETE'),
 'view_invoker',(SELECT 'security_invoker=true'=ANY(reloptions) FROM pg_class WHERE oid='public.vendor_sample_monitor'::regclass),
 'triggers_enabled',(SELECT count(*)=9 AND bool_and(t.tgenabled='O') FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND c.relname IN (${newTables.map(quote).join(',')}) AND NOT t.tgisinternal))`;
export function validateChecks(checks){for(const[k,v]of Object.entries(checks))assert.equal(v,true,k);}
export const combinedSql=source.map(x=>x.sql.replace(/^BEGIN;\r?$/m,'').replace(/^NOTIFY pgrst,'reload schema';COMMIT;\r?$/m,'').replace(/^COMMIT;\r?$/m,'')).join('\n');
assert.ok(!/^BEGIN;|COMMIT;/m.test(combinedSql),'Only outer transaction may commit');
export function instrument(before,{database='postgres',executor=before.executor}={}){
 assert.ok(['postgres','phase45_restore'].includes(database));assert.ok(['postgres','supabase_admin'].includes(executor));
 const original=quote(JSON.stringify(before));
 return `BEGIN;SET LOCAL timezone='UTC';SET LOCAL search_path=public,pg_temp;SET LOCAL lock_timeout='10s';SET LOCAL statement_timeout='120s';
 DO $phase45_pre$ BEGIN IF current_database()<>${quote(database)} OR current_user<>${quote(executor)} THEN RAISE EXCEPTION 'Executor/database mismatch';END IF;IF (${snapshotSql}) IS DISTINCT FROM ${original}::jsonb THEN RAISE EXCEPTION 'Baseline changed before migration';END IF;END $phase45_pre$;
 ${combinedSql}
 DO $phase45_post$ DECLARE before_s jsonb:=${original}::jsonb;after_s jsonb;v jsonb;k text;BEGIN after_s:=(${snapshotSql});
 FOREACH k IN ARRAY ARRAY['baseline','monitoring','archive_functions','archive_columns','archive_triggers','archive_index','archive_foreign_key','asset_vendor_links','asset_vendor_orphans','storage_objects_checksum','storage_acl','columns','map_view'] LOOP IF after_s->k IS DISTINCT FROM before_s->k THEN RAISE EXCEPTION 'Existing % changed',k;END IF;END LOOP;
 SELECT coalesce(jsonb_agg(x ORDER BY x::text COLLATE "C"),'[]') INTO v FROM jsonb_array_elements(after_s->'functions') x WHERE NOT x->>'name'=ANY(ARRAY[${functionNames.map(quote).join(',')}]);IF v IS DISTINCT FROM (SELECT coalesce(jsonb_agg(x ORDER BY x::text COLLATE "C"),'[]') FROM jsonb_array_elements(before_s->'functions') x) THEN RAISE EXCEPTION 'Existing function/security changed';END IF;
 SELECT coalesce(jsonb_agg(x ORDER BY x::text COLLATE "C"),'[]') INTO v FROM jsonb_array_elements(after_s->'policies') x WHERE NOT x->>'tablename'=ANY(ARRAY[${newTables.map(quote).join(',')}]) AND x->>'policyname' !~ '^Vendor (sample|decision) files ';IF v IS DISTINCT FROM (SELECT coalesce(jsonb_agg(x ORDER BY x::text COLLATE "C"),'[]') FROM jsonb_array_elements(before_s->'policies') x) THEN RAISE EXCEPTION 'Existing policies changed';END IF;
 SELECT coalesce(jsonb_agg(x ORDER BY x::text COLLATE "C"),'[]') INTO v FROM jsonb_array_elements(after_s->'triggers') x WHERE NOT x->>'table'=ANY(ARRAY[${newTables.map(quote).join(',')}]);IF v IS DISTINCT FROM (SELECT coalesce(jsonb_agg(x ORDER BY x::text COLLATE "C"),'[]') FROM jsonb_array_elements(before_s->'triggers') x) THEN RAISE EXCEPTION 'Existing triggers changed';END IF;
 IF (after_s->'rls')-ARRAY[${newTables.map(t=>quote('public.'+t)).join(',')}] IS DISTINCT FROM before_s->'rls' THEN RAISE EXCEPTION 'Existing RLS changed';END IF;
 SELECT coalesce(jsonb_agg(x ORDER BY x::text COLLATE "C"),'[]') INTO v FROM jsonb_array_elements(after_s->'buckets') x WHERE NOT x->>'id'=ANY(ARRAY[${newBuckets.map(quote).join(',')}]);IF v IS DISTINCT FROM (SELECT coalesce(jsonb_agg(x ORDER BY x::text COLLATE "C"),'[]') FROM jsonb_array_elements(before_s->'buckets') x WHERE NOT x->>'id'=ANY(ARRAY[${newBuckets.map(quote).join(',')}])) THEN RAISE EXCEPTION 'Existing buckets changed';END IF;
 IF (SELECT count(*)<>${functions.length} OR NOT coalesce(bool_and(replace(p.prosrc,chr(13),'')=e.body AND p.prosecdef=e.definer AND p.provolatile::text=e.volatility AND 'search_path=public, pg_temp'=ANY(p.proconfig) AND has_function_privilege('authenticated',p.oid,'EXECUTE')=e.app AND has_function_privilege('anon',p.oid,'EXECUTE')=e.anon AND pg_get_userbyid(p.proowner) IN ('postgres','supabase_admin')),false) FROM (VALUES ${functions.map(f=>`(${quote(f.name)},${quote(f.body)},${f.definer},${quote(f.volatility)},${publicFunctions.has(f.name)},${anonFunctions.has(f.name)})`).join(',')}) e(name,body,definer,volatility,app,anon) JOIN pg_proc p ON p.pronamespace='public'::regnamespace AND p.proname=e.name) THEN RAISE EXCEPTION 'New function source/ACL invalid';END IF;
 IF EXISTS(SELECT FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN (${newTables.map(quote).join(',')}) AND NOT relrowsecurity) OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN (${newTables.map(quote).join(',')}) OR schemaname='storage' AND policyname ~ '^Vendor (sample|decision) files ')<>22 THEN RAISE EXCEPTION 'New RLS/policy structure invalid';END IF;
 IF (SELECT count(*)<>2 OR NOT bool_and(NOT public AND file_size_limit=5242880 AND allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png','image/webp']) FROM storage.buckets WHERE id IN (${newBuckets.map(quote).join(',')})) THEN RAISE EXCEPTION 'New bucket configuration invalid';END IF;
 IF EXISTS(SELECT FROM jsonb_each((${postChecksSql})) x WHERE x.value<>'true'::jsonb) THEN RAISE EXCEPTION 'New schema postchecks failed';END IF;END $phase45_post$;
 NOTIFY pgrst,'reload schema';COMMIT;`;
}
