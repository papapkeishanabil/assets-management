// SQL validasi tanpa data fixture. Dipakai dalam transaksi migration dan sesudahnya.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

export const migrationPath='supabase/migrations/202611090001_vendor_management_phase3.sql';
export const migrationSha256='7f38d171690ceaf1afb2d0b8df4eb3462d48c41a49caf63bca7c2dd3bc945e2f';
export const snapshotSql=readFileSync('scripts/sql/vendor-phase3-preflight-readonly.sql','utf8').trim().replace(/;$/,'');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const migration=readFileSync(migrationPath,'utf8');
assert.equal(createHash('sha256').update(migration).digest('hex'),migrationSha256,'Isi migration berbeda dari persetujuan');
const functions=[...migration.replaceAll('\r','').matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(([\s\S]*?)\)\s*\nRETURNS ([\s\S]*?)AS \$\$([\s\S]*?)\$\$;/g)].map(m=>({name:m[1],header:m[3],body:m[4]}));
assert.equal(functions.length,11,'Definisi fungsi migration tidak lengkap');
const internal=new Set(['vendor_locations_guard','vendor_photos_guard','vendor_location_audit']);
const bounded=new Set(['vendor_photo_can_remove','vendor_photo_reader','vendor_photo_upload_allowed']);
const sources=functions.map(f=>`(${quote(f.name)},${quote(f.body)},${/SECURITY DEFINER/i.test(f.header)},${quote(/STABLE/i.test(f.header)?'s':'v')},${!internal.has(f.name)},${bounded.has(f.name)})`).join(',\n');

export const privilegeSql=`SELECT jsonb_build_object(
 'executor',current_user,'database',current_database(),
 'public_schema_create',has_schema_privilege(current_user,'public','CREATE'),
 'storage_policy_management',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user) OR pg_has_role(current_user,(SELECT relowner FROM pg_class WHERE oid='storage.objects'::regclass),'USAGE') OR coalesce((SELECT (setting::jsonb->current_user) ? 'storage.objects' FROM pg_settings WHERE name='supautils.policy_grants'),false),
 'storage_bucket_insert',has_table_privilege(current_user,'storage.buckets','INSERT'),
 'source_references',has_table_privilege(current_user,'public.vendor_candidates','REFERENCES') AND has_table_privilege(current_user,'public.user_profiles','REFERENCES')
)`;

export const phase3ChecksSql=`SELECT jsonb_build_object(
 'tables_rls',(SELECT count(*)=2 AND bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.vendor_locations'::regclass,'public.vendor_location_photos'::regclass)),
 'table_acl',(SELECT bool_and(has_table_privilege('authenticated',r,'SELECT') AND has_table_privilege('authenticated',r,'INSERT') AND has_table_privilege('authenticated',r,'UPDATE') AND NOT has_table_privilege('authenticated',r,'DELETE') AND NOT has_table_privilege('anon',r,'SELECT')) FROM unnest(ARRAY['public.vendor_locations','public.vendor_location_photos']) r),
 'views_invoker',(SELECT count(*)=2 AND bool_and('security_invoker=true'=ANY(reloptions)) FROM pg_class WHERE oid IN ('public.vendor_location_summary'::regclass,'public.vendor_map_points'::regclass)),
 'views_acl',has_table_privilege('authenticated','public.vendor_map_points','SELECT') AND has_table_privilege('authenticated','public.vendor_location_summary','SELECT') AND NOT has_table_privilege('anon','public.vendor_map_points','SELECT') AND NOT has_table_privilege('anon','public.vendor_location_summary','SELECT'),
 'indexes',(SELECT count(*)=7 FROM pg_indexes WHERE schemaname='public' AND indexname IN ('idx_vendor_locations_one_primary','idx_vendor_locations_candidate','idx_vendor_locations_city','idx_vendor_locations_verification','idx_vendor_location_photos_location','idx_vendor_location_photos_one_cover','vendor_location_photos_storage_path_key')),
 'triggers',(SELECT count(*)=4 AND bool_and(t.tgenabled='O') FROM pg_trigger t WHERE t.tgrelid IN ('public.vendor_locations'::regclass,'public.vendor_location_photos'::regclass) AND NOT t.tgisinternal AND t.tgname IN ('trg_vendor_locations_guard','trg_vendor_locations_audit','trg_vendor_photos_guard','trg_vendor_photos_audit')),
 'table_policies',(SELECT count(*)=6 FROM pg_policies WHERE schemaname='public' AND tablename IN ('vendor_locations','vendor_location_photos') AND policyname IN ('Vendor locations read','Vendor locations insert','Vendor locations update','Vendor photos read','Vendor photos insert','Vendor photos update') AND roles=ARRAY['authenticated']::name[]),
 'storage_gates',(SELECT count(*)=4 AND bool_and(permissive='RESTRICTIVE' AND roles=ARRAY['public']::name[]) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname IN ('Vendor storage read gate','Vendor storage insert gate','Vendor storage update gate','Vendor storage delete gate')),
 'storage_policies',(SELECT count(*)=3 AND bool_and(permissive='PERMISSIVE' AND roles=ARRAY['authenticated']::name[]) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname IN ('Vendor storage read','Vendor storage insert','Vendor storage delete orphan')),
 'private_bucket',EXISTS(SELECT FROM storage.buckets WHERE id='vendor-photos' AND NOT public AND file_size_limit=5242880 AND allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp']::text[]),
 'function_sources_acl',(SELECT count(*)=11 AND bool_and(replace(p.prosrc,chr(13),'')=e.body AND p.prosecdef=e.definer AND p.provolatile::text=e.volatility AND 'search_path=public, pg_temp'=ANY(p.proconfig) AND has_function_privilege('authenticated',p.oid,'EXECUTE')=e.auth_execute AND has_function_privilege('anon',p.oid,'EXECUTE')=e.anon_execute) FROM (VALUES ${sources}) e(name,body,definer,volatility,auth_execute,anon_execute) JOIN pg_proc p ON p.pronamespace='public'::regnamespace AND p.proname=e.name),
 'no_automatic_seed',NOT EXISTS(SELECT FROM public.vendor_locations) AND NOT EXISTS(SELECT FROM public.vendor_location_photos),
 'anonymous_reader_denied',NOT public.vendor_photo_reader()
)`;

export function instrumentMigration(expected,{executor='postgres',database='postgres'}={}) {
 assert.ok(['postgres','supabase_admin'].includes(executor));
 assert.ok(['postgres','phase3_restore'].includes(database));
 const value=quote(JSON.stringify(expected));
 const pre=`DO $phase3_pre$ DECLARE observed jsonb; privilege jsonb; BEGIN
 observed:=(${snapshotSql});
 IF observed IS DISTINCT FROM ${value}::jsonb THEN RAISE EXCEPTION 'Baseline berubah sebelum migration; transaksi dibatalkan'; END IF;
 privilege:=(${privilegeSql});
 IF privilege->>'executor'<>${quote(executor)} OR privilege->>'database'<>${quote(database)} OR EXISTS(SELECT FROM jsonb_each(privilege-'executor'-'database') x WHERE x.value IS DISTINCT FROM 'true'::jsonb) THEN RAISE EXCEPTION 'Hak executor migration belum sesuai'; END IF;
 END $phase3_pre$;`;
 const post=`DO $phase3_post$ DECLARE observed jsonb; expected jsonb:=${value}::jsonb; checks jsonb; policies jsonb; expected_policies jsonb; buckets jsonb; item text; invalid text; BEGIN
 observed:=(${snapshotSql});
 FOREACH item IN ARRAY ARRAY['baseline','functions','rls','triggers','columns','roles','permissions','storage_service_acl','asset_vendor_links','asset_vendor_orphans'] LOOP
 IF observed->item IS DISTINCT FROM expected->item THEN RAISE EXCEPTION 'Validasi pasca-migration gagal pada %; transaksi dibatalkan',item; END IF;
 END LOOP;
 SELECT jsonb_agg(p ORDER BY p::text) INTO policies FROM jsonb_array_elements(observed->'policies') p
 WHERE NOT (p->>'schemaname'='public' AND p->>'tablename' IN ('vendor_locations','vendor_location_photos')) AND NOT(p->>'schemaname'='storage' AND p->>'policyname' LIKE 'Vendor storage %');
 SELECT jsonb_agg(p ORDER BY p::text) INTO expected_policies FROM jsonb_array_elements(expected->'policies') p;
 IF policies IS DISTINCT FROM expected_policies THEN RAISE EXCEPTION 'Policy existing berubah; transaksi dibatalkan'; END IF;
 SELECT jsonb_agg(b ORDER BY b->>'id') INTO buckets FROM jsonb_array_elements(observed->'buckets') b WHERE b->>'id'<>'vendor-photos';
 IF buckets IS DISTINCT FROM expected->'buckets' THEN RAISE EXCEPTION 'Bucket existing berubah; transaksi dibatalkan'; END IF;
 checks:=(${phase3ChecksSql});
 SELECT string_agg(c.key,', ') INTO invalid FROM jsonb_each(checks) c WHERE c.value IS DISTINCT FROM 'true'::jsonb;
 IF invalid IS NOT NULL THEN RAISE EXCEPTION 'Struktur/RLS Fase 3 tidak sesuai (%); transaksi dibatalkan',invalid; END IF;
 END $phase3_post$;`;
 assert.equal((migration.match(/^BEGIN;\r?$/gm)||[]).length,1);
 assert.equal((migration.match(/^COMMIT;\r?$/gm)||[]).length,1);
 return migration.replace(/^BEGIN;\r?$/m,()=>`BEGIN;\nSET LOCAL lock_timeout='10s';\nSET LOCAL statement_timeout='120s';\n${pre}`)
  .replace(/^COMMIT;\r?$/m,()=>`${post}\nCOMMIT;`);
}
