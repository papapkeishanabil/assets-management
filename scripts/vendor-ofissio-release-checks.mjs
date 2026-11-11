// Pure validation/SQL builders; imports do not connect to any database.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { snapshotSql as phase45Snapshot, privilegesSql, functions as phase45Functions, newTables as phase45Tables, quote, target } from './vendor-phase45-release-checks.mjs';
export { privilegesSql, quote, target };
export const same = isDeepStrictEqual;
export const hash = value => createHash('sha256').update(value).digest('hex');
export const migrations = ['supabase/migrations/202611110003_vendor_sample_ofissio_references.sql'];
const review = JSON.parse(fs.readFileSync('docs/vendor-management/ofissio-catalog-evidence/BUILD_AND_REVIEW.json', 'utf8'));
export const source = migrations.map(file => { const sql = fs.readFileSync(file, 'utf8'), sha256 = hash(sql); assert.equal(sha256, review.source_sha256[file]); return { file, sql, sha256 }; });
export const newTables = ['vendor_sample_product_references'];
export const newBuckets = ['vendor-product-references'];
export const functionNames = ['vendor_product_reference_immutable', 'vendor_sample_reference_code_guard', 'vendor_create_ofissio_sample', 'vendor_product_reference_storage_read'];
export const triggerNames = ['trg_vendor_product_reference_immutable', 'trg_vendor_sample_reference_code_guard'];
export const functions = source.flatMap(({ sql }) => [...sql.replaceAll('\r', '').matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(([\s\S]*?)\)\s*\nRETURNS ([\s\S]*?)AS \$\$([\s\S]*?)\$\$;/g)].map(m => ({ name: m[1], body: m[4], definer: /SECURITY DEFINER/.test(m[3]), volatility: /IMMUTABLE/.test(m[3]) ? 'i' : /STABLE/.test(m[3]) ? 's' : 'v' })));
assert.equal(functions.length, 4);
const tables = ['vendors', 'assets', 'employees', 'contracts', 'user_profiles', 'roles', 'role_permissions', 'notifications', 'vendor_candidates', 'vendor_followups', 'vendor_categories', 'vendor_specialties', 'vendor_contacts', 'vendor_candidate_specialties', 'vendor_activity_logs', 'vendor_status_history', 'vendor_locations', 'vendor_location_photos', 'auth.users', 'auth.identities', ...phase45Tables];
const baseline = tables.map(t => `SELECT ${quote(t)} name,count(*) n,md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text COLLATE "C")::text,'')) checksum FROM ${t.includes('.') ? t : 'public.' + t} x`).join(' UNION ALL ');
export const snapshotSql = `SELECT (${phase45Snapshot}) || jsonb_build_object(
 'baseline',(SELECT jsonb_object_agg(name,jsonb_build_object('count',n,'checksum',checksum)) FROM (${baseline}) b),
 'sample_view',(SELECT jsonb_build_object('definition',pg_get_viewdef(c.oid,true),'options',c.reloptions,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl) FROM pg_class c WHERE c.oid='public.vendor_sample_monitor'::regclass),
 'relations',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind::text,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',(SELECT jsonb_agg(a::text ORDER BY a::text COLLATE "C") FROM unnest(c.relacl) a)) ORDER BY n.nspname,c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','S') AND c.relname<>'vendor_sample_product_references'),
 'catalog_objects',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',relname,'rls',relrowsecurity,'owner',pg_get_userbyid(relowner)) ORDER BY relname),'[]') FROM pg_class WHERE relnamespace='public'::regnamespace AND relname='vendor_sample_product_references'),
 'catalog_columns',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',column_name,'type',data_type,'nullable',is_nullable) ORDER BY ordinal_position),'[]') FROM information_schema.columns WHERE table_schema='public' AND table_name='vendor_sample_product_references'))`;

// Canonical whole-row C ordering avoids name/text collation differences in catalog JSON.
export function stableSql(expression) {
 return `SELECT (s-'catalog_objects'-'catalog_columns'-'executor'-'database'-'ddl_permissions') || jsonb_build_object(
 'functions',(SELECT coalesce(jsonb_agg(x ORDER BY x::text COLLATE "C"),'[]') FROM jsonb_array_elements(s->'functions') x WHERE NOT x->>'name'=ANY(ARRAY[${functionNames.map(quote).join(',')}])),
 'policies',(SELECT coalesce(jsonb_agg(x ORDER BY x::text COLLATE "C"),'[]') FROM jsonb_array_elements(s->'policies') x WHERE x->>'tablename'<>'vendor_sample_product_references' AND x->>'policyname' NOT LIKE 'Vendor product reference files %'),
 'triggers',(SELECT coalesce(jsonb_agg(x ORDER BY x::text COLLATE "C"),'[]') FROM jsonb_array_elements(s->'triggers') x WHERE NOT x->>'name'=ANY(ARRAY[${triggerNames.map(quote).join(',')}])),
 'buckets',(SELECT coalesce(jsonb_agg(x ORDER BY x::text COLLATE "C"),'[]') FROM jsonb_array_elements(s->'buckets') x WHERE x->>'id'<>'vendor-product-references'),
 'rls',(s->'rls')-'public.vendor_sample_product_references') FROM (SELECT (${expression}) s) input`;
}
export function stable(s) {
 const value = structuredClone(s); for (const key of ['catalog_objects', 'catalog_columns', 'executor', 'database', 'ddl_permissions']) delete value[key];
 value.functions = value.functions.filter(f => !functionNames.includes(f.name));
 value.policies = value.policies.filter(p => p.tablename !== newTables[0] && !p.policyname.startsWith('Vendor product reference files '));
 value.triggers = value.triggers.filter(t => !triggerNames.includes(t.name));
 value.buckets = value.buckets.filter(b => !newBuckets.includes(b.id)); delete value.rls['public.vendor_sample_product_references'];
 for (const key of ['functions', 'policies', 'triggers', 'buckets']) value[key].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
 return value;
}
export function validateBefore(s, privileges) {
 assert.equal(Object.keys(s.baseline).length, 27); assert.equal(s.asset_vendor_orphans, 0);
 for (const key of ['schema_create', 'storage_policy_management', 'bucket_insert', 'references', 'sha256']) assert.equal(privileges[key], true, key);
 assert.ok(['postgres', 'supabase_admin'].includes(s.executor));
 assert.equal(s.catalog_objects.length, 0, 'Catalog object already exists; inspect before retry');
 assert.equal(s.functions.filter(f => functionNames.includes(f.name)).length, 0);
 assert.equal(s.buckets.filter(b => newBuckets.includes(b.id)).length, 0, 'New bucket already exists; inspect first');
 for (const t of ['user_profiles', 'roles', 'notifications', 'vendor_candidates', 'vendor_followups', 'vendor_locations', 'vendor_location_photos', ...phase45Tables]) assert.equal(s.rls['public.' + t], true, t);
 const appFunctions = new Set(['vendor_sample_file_path','vendor_record_sample_qc','vendor_sampling_dashboard','vendor_sample_storage_access','vendor_approval_checklist','vendor_record_decision','activate_vendor_candidate','vendor_decision_file_access']);
 const anonFunctions = new Set(['vendor_sample_storage_access','vendor_decision_file_access']);
 for (const expected of phase45Functions) { const f = s.functions.find(f => f.name === expected.name); assert.ok(f, expected.name); assert.equal(f.source, expected.body); assert.equal(f.definer, expected.definer); assert.equal(f.volatility, expected.volatility); assert.ok(['postgres', 'supabase_admin'].includes(f.owner)); assert.ok(f.config?.includes('search_path=public, pg_temp')); assert.equal(f.authenticated_execute, appFunctions.has(f.name), expected.name+' authenticated ACL'); assert.equal(f.anon_execute, anonFunctions.has(f.name), expected.name+' anon ACL'); }
 for (const name of ['is_app_role', 'my_profile_id']) { const f = s.functions.find(f => f.name === name); assert.ok(f?.definer && !f.anon_execute && f.authenticated_execute); assert.ok(f.config?.includes('search_path=public, pg_temp')); }
 const exec = s.functions.find(f => f.name === 'exec_sql'); assert.ok(!exec || (!exec.anon_execute && !exec.authenticated_execute));
 assert.ok(s.sample_view?.options?.includes('security_invoker=true')); assert.ok(s.map_view?.options?.includes('security_invoker=true'));
 for (const t of [...s.triggers, ...s.archive_triggers]) if (['vendor_candidates', 'user_profiles', 'vendor_samples', 'vendor_sample_qc_runs', 'vendor_decisions', 'vendor_activations'].includes(t.table)) assert.equal(t.enabled, 'O');
}
export function validateAfter(before, after) {
 assert.ok(same(stable(before), stable(after)), 'Existing 27-table baseline/functions/policies/ACL/schema changed');
 assert.equal(after.catalog_objects.length, 1); assert.equal(after.catalog_objects[0].rls, true); assert.ok(['postgres', 'supabase_admin'].includes(after.catalog_objects[0].owner));
 assert.equal(after.catalog_columns.length, 15);
 for (const expected of functions) { const f = after.functions.find(f => f.name === expected.name); assert.ok(f, expected.name); assert.equal(f.source, expected.body); assert.equal(f.definer, expected.definer); assert.equal(f.volatility, expected.volatility); assert.ok(f.config?.includes('search_path=public, pg_temp')); assert.equal(f.anon_execute, f.name === 'vendor_product_reference_storage_read'); assert.equal(f.authenticated_execute, f.name === 'vendor_product_reference_storage_read'); }
 const b = after.buckets.find(b => b.id === newBuckets[0]); assert.ok(b && !b.public); assert.equal(b.file_size_limit, 5242880); assert.equal(b.objects, 0); assert.deepEqual(b.allowed_mime_types, ['image/jpeg', 'image/png', 'image/webp']);
 assert.equal(after.policies.filter(p => p.tablename === newTables[0] || p.policyname.startsWith('Vendor product reference files ')).length, 6);
}
export const postChecksSql = `SELECT jsonb_build_object(
 'reference_empty',(SELECT count(*)=0 FROM public.vendor_sample_product_references),
 'reference_select_only',has_table_privilege('authenticated','public.vendor_sample_product_references','SELECT') AND NOT has_table_privilege('anon','public.vendor_sample_product_references','SELECT') AND NOT EXISTS(SELECT FROM unnest(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES','MAINTAIN']) p WHERE has_table_privilege('authenticated','public.vendor_sample_product_references',p) OR has_table_privilege('anon','public.vendor_sample_product_references',p)),
 'rpc_service_only',has_function_privilege('service_role','public.vendor_create_ofissio_sample(uuid,jsonb,jsonb,uuid)','EXECUTE') AND NOT has_function_privilege('authenticated','public.vendor_create_ofissio_sample(uuid,jsonb,jsonb,uuid)','EXECUTE') AND NOT has_function_privilege('anon','public.vendor_create_ofissio_sample(uuid,jsonb,jsonb,uuid)','EXECUTE'),
 'triggers_enabled',(SELECT count(*)=2 AND bool_and(tgenabled='O') FROM pg_trigger WHERE tgname IN ('trg_vendor_product_reference_immutable','trg_vendor_sample_reference_code_guard')),
 'bucket_private',(SELECT count(*)=1 AND bool_and(NOT public AND file_size_limit=5242880 AND allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp']) FROM storage.buckets WHERE id='vendor-product-references'),
 'policies_complete',(SELECT count(*)=6 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_sample_product_references' OR schemaname='storage' AND policyname LIKE 'Vendor product reference files %'))`;
export function validateChecks(checks) { for (const [key, value] of Object.entries(checks)) assert.equal(value, true, key); }
const combinedSql = source[0].sql.replace(/^BEGIN;\r?$/m, '').replace(/^COMMIT;\r?$/m, '');
assert.ok(!/^BEGIN;|^COMMIT;/m.test(combinedSql));
export function instrument(before, { database = 'postgres', executor = before.executor } = {}) {
 assert.ok(['postgres', 'ofissio_restore'].includes(database)); assert.ok(['postgres', 'supabase_admin'].includes(executor));
 const original = `${quote(JSON.stringify(before))}::jsonb`;
 return `BEGIN;SET LOCAL timezone='UTC';SET LOCAL search_path=public,pg_temp;SET LOCAL lock_timeout='10s';SET LOCAL statement_timeout='120s';
 DO $ofissio_pre$ BEGIN IF current_database()<>${quote(database)} OR current_user<>${quote(executor)} THEN RAISE EXCEPTION 'Executor/database mismatch';END IF;IF (${snapshotSql}) IS DISTINCT FROM ${original} THEN RAISE EXCEPTION 'Baseline changed before migration';END IF;END $ofissio_pre$;
 ${combinedSql}
 DO $ofissio_post$ BEGIN IF (${stableSql(snapshotSql)}) IS DISTINCT FROM (${stableSql(`SELECT ${original}`)}) THEN RAISE EXCEPTION 'Existing baseline/security/schema changed';END IF;
 IF EXISTS(SELECT FROM jsonb_each((${postChecksSql})) x WHERE x.value<>'true'::jsonb) THEN RAISE EXCEPTION 'Catalog schema postchecks failed';END IF;
 IF (SELECT count(*)<>4 OR NOT bool_and(replace(p.prosrc,chr(13),'')=e.body AND p.prosecdef=e.definer AND p.provolatile::text=e.volatility AND 'search_path=public, pg_temp'=ANY(p.proconfig) AND pg_get_userbyid(p.proowner) IN ('postgres','supabase_admin') AND has_function_privilege('authenticated',p.oid,'EXECUTE')=e.app AND has_function_privilege('anon',p.oid,'EXECUTE')=e.app) FROM (VALUES ${functions.map(f => `(${quote(f.name)},${quote(f.body)},${f.definer},${quote(f.volatility)},${f.name === 'vendor_product_reference_storage_read'})`).join(',')}) e(name,body,definer,volatility,app) JOIN pg_proc p ON p.pronamespace='public'::regnamespace AND p.proname=e.name) THEN RAISE EXCEPTION 'New function source/ACL mismatch';END IF;
 END $ofissio_post$;NOTIFY pgrst,'reload schema';COMMIT;`;
}
