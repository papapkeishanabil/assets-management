import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';

export const target='https://uwlxkwyauxwewoexfgwi.supabase.co';
export const migrationPath='supabase/migrations/202611100001_vendor_candidate_archive.sql';
export const migrationSha256='f2ed4b42d2fb77ab8c9e986ff5fd6bead177d28b72d562bb2671ab8d06aeb1c5';
export const migration=fs.readFileSync(migrationPath,'utf8');
assert.equal(createHash('sha256').update(migration).digest('hex'),migrationSha256);
export const rollback=fs.readFileSync('supabase/rollbacks/202611100001_vendor_candidate_archive_rollback.sql','utf8');
export const quote=v=>"'"+v.replaceAll("'","''")+"'";
const parseFunctions=sql=>[...sql.replaceAll('\r','').matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(([\s\S]*?)\)\s*\nRETURNS ([\s\S]*?)AS \$\$([\s\S]*?)\$\$;/g)].map(m=>({name:m[1],body:m[4],definer:/SECURITY DEFINER/i.test(m[3]),volatility:/STABLE/i.test(m[3])?'s':'v'}));
const expected=parseFunctions(migration),oldFunctions=parseFunctions(rollback);
assert.equal(expected.length,6);assert.equal(oldFunctions.length,3);
const newFunctions=['vendor_candidate_archive_guard','vendor_archived_child_guard','vendor_set_candidate_archive'];
const changedFunctions=['vendor_sourcing_dashboard','vendor_remind_overdue_followups','vendor_location_monitoring'];
const tables=['vendors','assets','user_profiles','roles','role_permissions','notifications','vendor_candidates','vendor_followups','vendor_categories','vendor_specialties','vendor_contacts','vendor_candidate_specialties','vendor_activity_logs','vendor_status_history','vendor_locations','vendor_location_photos','auth.users','auth.identities'];
const rows=t=>`SELECT ${quote(t)} name,count(*) n,md5(coalesce(jsonb_agg(${t==='vendor_candidates'?"to_jsonb(x)-ARRAY['archived_at','archived_by','archive_reason']":"to_jsonb(x)"} ORDER BY ${t==='vendor_candidate_specialties'?'candidate_id,specialty_id':'id'})::text,'')) checksum FROM ${t.includes('.')?t:'public.'+t} x`;
const functionSelect=`SELECT jsonb_build_object('name',p.proname,'signature',p.oid::regprocedure::text,'source',replace(p.prosrc,chr(13),''),'definer',p.prosecdef,'volatility',p.provolatile::text,'config',p.proconfig,'owner',pg_get_userbyid(p.proowner),'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'acl',p.proacl) value FROM pg_proc p WHERE p.pronamespace='public'::regnamespace`;
export const snapshotSql=`SELECT jsonb_build_object(
 'executor',current_user,'database',current_database(),
 'ddl_permissions',jsonb_build_object('schema_create',has_schema_privilege(current_user,'public','CREATE'),'table_ownership',(SELECT bool_and(pg_has_role(current_user,c.relowner,'USAGE')) FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname IN ('vendor_candidates','vendor_contacts','vendor_candidate_specialties','vendor_followups','vendor_locations','vendor_location_photos')),'function_ownership',(SELECT bool_and(pg_has_role(current_user,p.proowner,'USAGE')) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN (${changedFunctions.map(quote).join(',')})),'view_ownership',(SELECT pg_has_role(current_user,c.relowner,'USAGE') FROM pg_class c WHERE c.oid='public.vendor_map_points'::regclass)),
 'baseline',(SELECT jsonb_object_agg(name,jsonb_build_object('count',n,'checksum',checksum)) FROM (${tables.map(rows).join(' UNION ALL ')}) b),
 'functions',(SELECT coalesce(jsonb_agg(value ORDER BY value->>'signature'),'[]'::jsonb) FROM (${functionSelect} AND (p.proname LIKE 'vendor_%' OR p.proname IN ('is_app_role','my_profile_id','profiles_guard_admin_fields','exec_sql')) AND p.proname NOT IN (${[...newFunctions,...changedFunctions].map(quote).join(',')})) f),
 'monitoring',(SELECT jsonb_agg(value ORDER BY value->>'name') FROM (${functionSelect} AND p.proname IN (${changedFunctions.map(quote).join(',')})) f),
 'archive_functions',(SELECT coalesce(jsonb_agg(value ORDER BY value->>'name'),'[]'::jsonb) FROM (${functionSelect} AND p.proname IN (${newFunctions.map(quote).join(',')})) f),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname) FROM pg_policies p WHERE schemaname IN ('public','storage')),
 'rls',(SELECT jsonb_object_agg(n.nspname||'.'||c.relname,c.relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE (n.nspname='public' AND (c.relname LIKE 'vendor_%' OR c.relname IN ('vendors','assets','user_profiles','roles','notifications'))) AND c.relkind IN ('r','p')),
 'columns',(SELECT jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',data_type,'nullable',is_nullable,'default',column_default) ORDER BY table_name,ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('vendor_candidates','vendor_contacts','vendor_candidate_specialties','vendor_followups','vendor_locations','vendor_location_photos') AND column_name NOT IN ('archived_at','archived_by','archive_reason')),
 'archive_columns',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',column_name,'type',data_type,'nullable',is_nullable) ORDER BY column_name),'[]'::jsonb) FROM information_schema.columns WHERE table_schema='public' AND table_name='vendor_candidates' AND column_name IN ('archived_at','archived_by','archive_reason')),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) ORDER BY n.nspname,c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname IN ('public','storage') AND t.tgname NOT IN ('trg_vendor_candidate_archive_guard','trg_vendor_archived_child_guard')),
 'archive_triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'enabled',t.tgenabled) ORDER BY c.relname,t.tgname),'[]'::jsonb) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE t.tgname IN ('trg_vendor_candidate_archive_guard','trg_vendor_archived_child_guard') AND c.relnamespace='public'::regnamespace),
 'map_view',(SELECT jsonb_build_object('definition',pg_get_viewdef(c.oid,true),'options',c.reloptions,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl) FROM pg_class c WHERE c.oid='public.vendor_map_points'::regclass),
 'archive_index',to_regclass('public.idx_vendor_candidates_unarchived') IS NOT NULL,
 'archive_foreign_key',EXISTS(SELECT FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey) WHERE c.conrelid='public.vendor_candidates'::regclass AND c.confrelid='public.user_profiles'::regclass AND a.attname='archived_by' AND c.contype='f'),
 'asset_vendor_links',(SELECT count(*) FROM public.assets WHERE vendor_id IS NOT NULL),
 'asset_vendor_orphans',(SELECT count(*) FROM public.assets a LEFT JOIN public.vendors v ON v.id=a.vendor_id WHERE a.vendor_id IS NOT NULL AND v.id IS NULL)
)`;
export const stableFields=['baseline','functions','policies','rls','columns','triggers','asset_vendor_links','asset_vendor_orphans'];
export function stableSnapshot(snapshot){return Object.fromEntries(stableFields.map(k=>[k,snapshot[k]]));}
function matchingFunctions(actual,reference){
 assert.equal(actual.length,reference.length);
 for(const e of reference){const f=actual.find(f=>f.name===e.name);assert.ok(f,e.name);assert.equal(f.source,e.body,e.name+' source');assert.equal(f.definer,e.definer,e.name+' security');assert.equal(f.volatility,e.volatility,e.name+' volatility');assert.ok(f.config?.includes('search_path=public, pg_temp'),e.name+' search_path');assert.equal(f.anon_execute,false,e.name+' anon ACL');assert.equal(f.authenticated_execute,!['vendor_candidate_archive_guard','vendor_archived_child_guard'].includes(e.name),e.name+' authenticated ACL');}
}
export function validateBefore(s){
 assert.equal(Object.keys(s.baseline).length,18);assert.equal(s.asset_vendor_orphans,0);
 assert.ok(['postgres','supabase_admin'].includes(s.executor));assert.ok(['postgres','archive_restore'].includes(s.database));
 assert.ok(Object.values(s.ddl_permissions).every(v=>v===true),'Executor lacks archive DDL permissions');
 assert.equal(s.archive_columns.length,0,'Archive columns already exist: inspect before retrying');assert.equal(s.archive_functions.length,0);assert.equal(s.archive_triggers.length,0);assert.equal(s.archive_index,false);
 matchingFunctions(s.monitoring,oldFunctions);
 assert.ok(s.map_view.options?.includes('security_invoker=true'));
 assert.ok(!s.map_view.definition.includes('archived_at'));
 for(const t of ['vendor_candidates','vendor_followups','vendor_locations','vendor_location_photos','user_profiles','roles','notifications'])assert.equal(s.rls['public.'+t],true,t+' RLS');
 assert.ok(s.triggers.filter(t=>['vendor_candidates','vendor_followups','user_profiles'].includes(t.table)).every(t=>t.enabled==='O'));
 const exec=s.functions.find(f=>f.name==='exec_sql');assert.ok(!exec||(!exec.anon_execute&&!exec.authenticated_execute),'exec_sql must be absent or inaccessible to anon/authenticated');
 for(const name of ['is_app_role','my_profile_id']){const f=s.functions.find(f=>f.name===name);assert.ok(f?.definer&&!f.anon_execute&&f.authenticated_execute);assert.ok(f.config.includes('search_path=public, pg_temp'));}
}
export function validateAfter(before,after){
 assert.deepEqual(stableSnapshot(after),stableSnapshot(before),'Existing data/security changed');
 matchingFunctions([...after.archive_functions,...after.monitoring],expected);
 assert.deepEqual(after.archive_columns,[{name:'archive_reason',type:'text',nullable:'YES'},{name:'archived_at',type:'timestamp with time zone',nullable:'YES'},{name:'archived_by',type:'uuid',nullable:'YES'}]);
 assert.equal(after.archive_triggers.length,6);assert.ok(after.archive_triggers.every(t=>t.enabled==='O'));
 assert.ok(after.archive_index&&after.archive_foreign_key);
 assert.ok(after.map_view.options.includes('security_invoker=true'));assert.match(after.map_view.definition,/c\.archived_at IS NULL/);
 for(const key of ['owner','acl','options'])assert.deepEqual(after.map_view[key],before.map_view[key]);
}
export function same(a,b){return isDeepStrictEqual(a,b);}

export function instrumentMigration(before,{database='postgres',executor=before.executor}={}){
 assert.ok(['postgres','archive_restore'].includes(database));assert.ok(['postgres','supabase_admin'].includes(executor));
 const expectedSnapshot=quote(JSON.stringify(before)),baseline=quote(JSON.stringify(stableSnapshot(before)));
 const bodies=expected.map(e=>`(${quote(e.name)},${quote(e.body)},${e.definer},${quote(e.volatility)},${!['vendor_candidate_archive_guard','vendor_archived_child_guard'].includes(e.name)})`).join(',');
 const pre=`DO $archive_pre$ DECLARE observed jsonb; BEGIN
 IF current_database()<>${quote(database)} OR current_user<>${quote(executor)} THEN RAISE EXCEPTION 'Executor/database mismatch'; END IF;
 observed:=(${snapshotSql});IF observed IS DISTINCT FROM ${expectedSnapshot}::jsonb THEN RAISE EXCEPTION 'Baseline changed before migration'; END IF;
 END $archive_pre$;`;
 const post=`DO $archive_post$ DECLARE observed jsonb; stable jsonb; k text; body_ok boolean; BEGIN
 observed:=(${snapshotSql});stable:='{}'::jsonb;
 FOREACH k IN ARRAY ARRAY[${stableFields.map(quote).join(',')}] LOOP stable:=stable||jsonb_build_object(k,observed->k); END LOOP;
 IF stable IS DISTINCT FROM ${baseline}::jsonb THEN RAISE EXCEPTION 'Existing data/security changed; rollback required'; END IF;
 SELECT count(*)=6 AND bool_and(replace(p.prosrc,chr(13),'')=e.body AND p.prosecdef=e.definer AND p.provolatile::text=e.volatility AND 'search_path=public, pg_temp'=ANY(p.proconfig) AND NOT has_function_privilege('anon',p.oid,'EXECUTE') AND has_function_privilege('authenticated',p.oid,'EXECUTE')=e.auth_execute) INTO body_ok
 FROM (VALUES ${bodies}) e(name,body,definer,volatility,auth_execute) JOIN pg_proc p ON p.pronamespace='public'::regnamespace AND p.proname=e.name;
 IF body_ok IS DISTINCT FROM true OR jsonb_array_length(observed->'archive_columns')<>3 OR jsonb_array_length(observed->'archive_triggers')<>6 OR observed->>'archive_index'<>'true' OR observed->>'archive_foreign_key'<>'true' THEN RAISE EXCEPTION 'Archive structure/functions/ACL invalid'; END IF;
 IF EXISTS(SELECT FROM jsonb_array_elements(observed->'archive_triggers') t WHERE t->>'enabled'<>'O') OR (observed->'map_view'->>'definition') NOT LIKE '%c.archived_at IS NULL%' THEN RAISE EXCEPTION 'Archive triggers/view invalid'; END IF;
 END $archive_post$;`;
 assert.equal((migration.match(/^BEGIN;\r?$/gm)||[]).length,1);assert.equal((migration.match(/^COMMIT;\r?$/gm)||[]).length,1);
 return migration.replace(/^BEGIN;\r?$/m,()=>`BEGIN;\nSET LOCAL timezone='UTC';\nSET LOCAL search_path=public,pg_temp;\nSET LOCAL lock_timeout='10s';\nSET LOCAL statement_timeout='120s';\n${pre}`).replace(/^COMMIT;\r?$/m,()=>`${post}\nCOMMIT;`);
}
