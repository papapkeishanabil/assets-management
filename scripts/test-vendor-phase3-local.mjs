// Fixed Docker target only; tidak membaca .env atau menghubungi produksi.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db='supabase_db_harmas-vendor-test', localApi='http://127.0.0.1:54321';
const migration=readFileSync(new URL('../supabase/migrations/202611090001_vendor_management_phase3.sql',import.meta.url),'utf8');
const rollback=readFileSync(new URL('../supabase/rollbacks/202611090001_vendor_management_phase3_rollback.sql',import.meta.url),'utf8');
const stripped=(s)=>s.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
const results=[];
function sql(input){const r=spawnSync('docker',['exec','-i',db,'psql','-X','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{input,encoding:'utf8',maxBuffer:8e6});return{ok:r.status===0,out:r.stdout?.trim()||'',error:r.stderr?.trim()||r.error?.message||''};}
function must(input){const r=sql(input);assert.ok(r.ok,r.error);return r.out;}
function pass(label,detail='PASS'){results.push(`PASS | ${label} | ${detail}`);console.log(results.at(-1));}
const tables=['vendors','assets','roles','user_profiles','role_permissions','vendor_categories','vendor_specialties','vendor_candidates','vendor_contacts','vendor_candidate_specialties','vendor_followups','vendor_status_history','vendor_activity_logs','notifications'];
const snapshot=()=>must(`SELECT jsonb_build_object('data',(SELECT jsonb_object_agg(name,checksum) FROM (${tables.map(t=>`SELECT '${t}' name,md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'')) checksum FROM public.${t} x`).join(' UNION ALL ')}) q),
 'policies',(SELECT md5(jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname)::text) FROM pg_policies p WHERE NOT(schemaname='public' AND tablename IN ('vendor_locations','vendor_location_photos')) AND NOT(schemaname='storage' AND policyname LIKE 'Vendor storage %')),
 'buckets',(SELECT md5(coalesce(jsonb_agg(to_jsonb(b) ORDER BY id)::text,'')) FROM storage.buckets b WHERE id<>'vendor-photos'),
 'guards',(SELECT md5(string_agg(pg_get_functiondef(oid),'' ORDER BY proname)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('is_app_role','my_profile_id','vendor_guard_restricted_columns','profiles_guard_admin_fields','vendor_sourcing_dashboard','vendor_remind_overdue_followups')));`);
const before=snapshot();must(migration);must(migration);assert.equal(snapshot(),before);pass('Migration 2x: data/policy/bucket/guard existing identik');
assert.equal(must("SELECT relrowsecurity FROM pg_class WHERE oid='public.vendor_locations'::regclass; SELECT relrowsecurity FROM pg_class WHERE oid='public.vendor_location_photos'::regclass; SELECT public,file_size_limit FROM storage.buckets WHERE id='vendor-photos';"),'t\nt\nf|5242880');pass('Struktur RLS, bucket PRIVATE dan batas 5 MB');
const uid=n=>`00000000-0000-4000-a000-${String(n).padStart(12,'0')}`,pid=n=>`11111111-0000-4000-a000-${String(n).padStart(12,'0')}`;
const cid=n=>`55555555-0000-4000-a000-${String(n).padStart(12,'0')}`,lid=n=>`66666666-0000-4000-a000-${String(n).padStart(12,'0')}`,photo=n=>`77777777-0000-4000-a000-${String(n).padStart(12,'0')}`;
const path=n=>`${cid(1)}/${lid(1)}/${photo(n)}.png`;
const role=(n,sqlRole='authenticated')=>`SET LOCAL ROLE ${sqlRole}; SELECT set_config('request.jwt.claims','${JSON.stringify({role:sqlRole,...(n?{sub:uid(n)}:{})})}',true);`;
const fixture=`INSERT INTO public.vendor_candidates(id,business_name,created_by) VALUES('${cid(1)}','Fase3 Jahit','${pid(4)}'),('${cid(2)}','Fase3 Belum Dipetakan','${pid(4)}');
 INSERT INTO public.vendor_locations(id,candidate_id,location_name,location_type,address_line,city,province,latitude,longitude,coordinate_source,created_by)
 VALUES('${lid(1)}','${cid(1)}','Workshop Utama','WORKSHOP_JAHIT','Jalan Uji 1','Bandung','Jawa Barat',-6.9,107.6,'MANUAL','${pid(4)}'),
 ('${lid(2)}','${cid(1)}','Gudang','GUDANG','Jalan Uji 2','Bandung','Jawa Barat',-6.8,107.5,'MANUAL','${pid(4)}');
 INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES('vendor-photos','${path(1)}','${uid(4)}','{"size":42,"mimetype":"image/png"}'),('vendor-photos','${path(2)}','${uid(4)}','{"size":42,"mimetype":"image/png"}');
 INSERT INTO public.vendor_location_photos(id,location_id,storage_path,photo_type,file_mime,file_size,uploaded_by)
 VALUES('${photo(1)}','${lid(1)}','${path(1)}','EXTERIOR','image/png',42,'${pid(4)}'),('${photo(2)}','${lid(1)}','${path(2)}','MACHINES','image/png',42,'${pid(4)}');`;
const assertSql=condition=>`DO $$ BEGIN IF NOT (${condition}) THEN RAISE EXCEPTION 'ASSERT gagal'; END IF; END $$; SELECT 'PASS'`;
function check(label,who,operation,expected='PASS',setup=''){
 const r=sql(`BEGIN; ${fixture} ${setup} ${who} ${operation}; ROLLBACK;`);
 if(expected instanceof RegExp){assert.ok(!r.ok&&expected.test(r.error),`${label}\n${r.out}\n${r.error}`);pass(label,r.error.split('\n')[0]);}
 else{assert.ok(r.ok&&r.out.includes(expected),`${label}\n${r.out}\n${r.error}`);pass(label);}
}
const insertLocation=`INSERT INTO public.vendor_locations(candidate_id,location_name,location_type) VALUES('${cid(2)}','Cabang Baru','GUDANG')`;
for(const [name,n] of [['sourcing',4],['hrd',3],['super_admin',1]]){
 check(`INSERT lokasi ${name}`,role(n),`${insertLocation}; ${assertSql(`EXISTS(SELECT 1 FROM public.vendor_locations WHERE candidate_id='${cid(2)}' AND created_by='${pid(n)}' AND is_primary)`)}`);
 check(`UPDATE lokasi ${name}`,role(n),`UPDATE public.vendor_locations SET city='Cimahi' WHERE id='${lid(2)}'; ${assertSql(`EXISTS(SELECT 1 FROM public.vendor_locations WHERE id='${lid(2)}' AND updated_by='${pid(n)}')`)}`);
 check(`DELETE lokasi ${name} ditolak`,role(n),`DELETE FROM public.vendor_locations WHERE id='${lid(1)}'`,/permission denied|hapus tidak diizinkan/);
 check(`Guard approval ${name} tidak berubah`,role(n),`UPDATE public.vendor_candidates SET qualification_status='APPROVED' WHERE id='${cid(1)}'`,/DITOLAK: keputusan kelayakan/);
}
check('Direksi READ lokasi/foto',role(2),assertSql(`(SELECT count(*) FROM public.vendor_location_photos WHERE location_id='${lid(1)}')=2`));
check('Direksi INSERT ditolak',role(2),insertLocation,/row-level security/);
check('Direksi primary RPC ditolak',role(2),`SELECT public.vendor_set_primary_location('${lid(2)}')`,/Akses lokasi utama/);
for(const [name,n,setup] of [['pelaksana',5,''],['finance',5,`UPDATE public.user_profiles SET role_id=(SELECT id FROM public.roles WHERE role_name='finance') WHERE id='${pid(5)}';`]]){
 check(`${name} tidak melihat lokasi/foto/view`,role(n),assertSql(`(SELECT count(*) FROM public.vendor_locations)=0 AND (SELECT count(*) FROM public.vendor_location_photos)=0 AND (SELECT count(*) FROM public.vendor_map_points)=0`),'PASS',setup);
 check(`${name} INSERT ditolak`,role(n),insertLocation,/row-level security/,setup);
}
check('Anon SELECT ditolak',role(null,'anon'),'SELECT * FROM public.vendor_locations',/permission denied/);
check('Anon view ditolak',role(null,'anon'),'SELECT * FROM public.vendor_map_points',/permission denied/);
check('Akun disabled ditolak',role(4),insertLocation,/row-level security/,`UPDATE public.user_profiles SET account_status='DISABLED' WHERE id='${pid(4)}';`);
check('JWT tanpa sub ditolak',role(null),insertLocation,/row-level security|not-null/);
check('Pasangan koordinat wajib',role(4),`UPDATE public.vendor_locations SET longitude=NULL WHERE id='${lid(1)}'`,/check constraint/);
check('Rentang latitude',role(4),`UPDATE public.vendor_locations SET latitude=91 WHERE id='${lid(1)}'`,/check constraint/);
check('Rentang longitude',role(4),`UPDATE public.vendor_locations SET longitude=-181 WHERE id='${lid(1)}'`,/check constraint/);
check('Lokasi tanpa GPS boleh',role(4),`${insertLocation}; ${assertSql(`EXISTS(SELECT 1 FROM public.vendor_locations WHERE candidate_id='${cid(2)}' AND latitude IS NULL AND longitude IS NULL)`)}`);
check('Lokasi utama hanya satu',role(4),`UPDATE public.vendor_locations SET is_primary=true WHERE id='${lid(2)}'`,/duplicate key/);
check('Unmark primary langsung ditolak',role(4),`UPDATE public.vendor_locations SET is_primary=false WHERE id='${lid(1)}'`,/Ganti lokasi utama/);
check('Primary switch atomik',role(4),`SELECT public.vendor_set_primary_location('${lid(2)}'); ${assertSql(`(SELECT count(*) FROM public.vendor_locations WHERE candidate_id='${cid(1)}' AND is_primary)=1 AND EXISTS(SELECT 1 FROM public.vendor_locations WHERE id='${lid(2)}' AND is_primary)`)}`);
check('Sourcing tidak memverifikasi',role(4),`UPDATE public.vendor_locations SET verification_status='VERIFIED' WHERE id='${lid(1)}'`,/Verifikasi lokasi hanya/);
check('HRD verifikasi tanpa exterior ditolak',role(3),`UPDATE public.vendor_locations SET verification_status='VERIFIED' WHERE id='${lid(2)}'`,/Verifikasi perlu/);
for(const [name,n] of [['hrd',3],['super_admin',1]]) check(`${name} verifikasi lengkap`,role(n),`UPDATE public.vendor_locations SET verification_status='VERIFIED',verification_notes='Survei fisik' WHERE id='${lid(1)}'; ${assertSql(`EXISTS(SELECT 1 FROM public.vendor_locations WHERE id='${lid(1)}' AND verified_by='${pid(n)}' AND verified_at=now())`)}`);
check('Edit koordinat membatalkan verifikasi',role(4),`UPDATE public.vendor_locations SET latitude=-6.95 WHERE id='${lid(1)}'; ${assertSql(`EXISTS(SELECT 1 FROM public.vendor_locations WHERE id='${lid(1)}' AND verification_status='UNVERIFIED' AND verified_by IS NULL)`)}`,'PASS',`${role(3)} UPDATE public.vendor_locations SET verification_status='VERIFIED' WHERE id='${lid(1)}'; RESET ROLE;`);
check('Identitas lokasi immutable',role(4),`UPDATE public.vendor_locations SET candidate_id='${cid(2)}' WHERE id='${lid(1)}'`,/Identitas dan pembuat/);
check('File/pengunggah immutable',role(4),`UPDATE public.vendor_location_photos SET storage_path='ganti.png' WHERE id='${photo(1)}'`,/Identitas\/file/);
check('Sourcing tidak mengarsipkan',role(4),`UPDATE public.vendor_location_photos SET is_archived=true WHERE id='${photo(1)}'`,/Arsip foto hanya/);
check('Arsip exterior terakhir membatalkan verifikasi',role(1),`UPDATE public.vendor_location_photos SET is_archived=true WHERE id='${photo(1)}'; ${assertSql(`EXISTS(SELECT 1 FROM public.vendor_locations WHERE id='${lid(1)}' AND verification_status='UNVERIFIED') AND EXISTS(SELECT 1 FROM public.vendor_location_photos WHERE id='${photo(1)}' AND archived_by='${pid(1)}')`)}`,'PASS',`${role(3)} UPDATE public.vendor_locations SET verification_status='VERIFIED' WHERE id='${lid(1)}'; RESET ROLE;`);
check('Ubah jenis exterior membatalkan verifikasi',role(4),`UPDATE public.vendor_location_photos SET photo_type='OTHER' WHERE id='${photo(1)}'; ${assertSql(`EXISTS(SELECT 1 FROM public.vendor_locations WHERE id='${lid(1)}' AND verification_status='UNVERIFIED')`)}`,'PASS',`${role(3)} UPDATE public.vendor_locations SET verification_status='VERIFIED' WHERE id='${lid(1)}'; RESET ROLE;`);
check('Cover switch atomik',role(4),`SELECT public.vendor_set_cover_photo('${photo(2)}'); ${assertSql(`(SELECT count(*) FROM public.vendor_location_photos WHERE location_id='${lid(1)}' AND is_cover)=1 AND EXISTS(SELECT 1 FROM public.vendor_location_photos WHERE id='${photo(2)}' AND is_cover)`)}`);
check('Audit lokasi aktor JWT',role(4),`UPDATE public.vendor_locations SET city='Cimahi' WHERE id='${lid(2)}'; ${assertSql(`EXISTS(SELECT 1 FROM public.vendor_activity_logs WHERE entity_id='${lid(2)}' AND action='location_update' AND actor_id='${pid(4)}' AND old_values->>'city'='Bandung' AND new_values->>'city'='Cimahi')`)}`);
check('Audit foto old/new',role(3),`UPDATE public.vendor_location_photos SET caption='Mesin baru' WHERE id='${photo(2)}'; ${assertSql(`EXISTS(SELECT 1 FROM public.vendor_activity_logs WHERE entity_id='${photo(2)}' AND actor_id='${pid(3)}' AND action='location_photo_update' AND new_values->>'caption'='Mesin baru')`)}`);
check('Multi fasilitas dan belum dipetakan di view',role(4),assertSql(`(SELECT count(*) FROM public.vendor_map_points WHERE candidate_id='${cid(1)}' AND latitude IS NOT NULL)=2 AND EXISTS(SELECT 1 FROM public.vendor_map_points WHERE candidate_id='${cid(2)}' AND location_id IS NULL AND mapped_count=0)`));
check('Kelengkapan tidak otomatis verified',role(4),assertSql(`EXISTS(SELECT 1 FROM public.vendor_location_summary WHERE candidate_id='${cid(1)}' AND is_complete AND NOT is_verified)`));
check('Retrofit master aktif idempotent dan teraudit',role(4),`DO $$ DECLARE v uuid; a uuid; b uuid; BEGIN SELECT id INTO v FROM public.vendors WHERE vendor_code='TST-SEW1'; a:=public.vendor_link_existing_active(v); b:=public.vendor_link_existing_active(v); IF a<>b OR NOT EXISTS(SELECT 1 FROM public.vendor_candidates WHERE id=a AND vendor_id=v AND qualification_status='APPROVED' AND operational_status='ACTIVE') OR NOT EXISTS(SELECT 1 FROM public.vendor_activity_logs WHERE candidate_id=a AND action='legacy_vendor_linked') THEN RAISE EXCEPTION 'Retrofit gagal'; END IF; END $$; SELECT 'PASS'`);
check('Retrofit master nonaktif ditolak',role(4),`SELECT public.vendor_link_existing_active((SELECT id FROM public.vendors WHERE vendor_code='TST-SEW1'))`,/Master vendor aktif tidak ditemukan/,"UPDATE public.vendors SET is_active=false WHERE vendor_code='TST-SEW1';");
check('Direksi retrofit ditolak',role(2),`SELECT public.vendor_link_existing_active((SELECT id FROM public.vendors WHERE vendor_code='TST-SEW1'))`,/Akses retrofit/);
check('Reapply saat tabel berisi data','',`${stripped(migration)}; ${assertSql(`(SELECT count(*) FROM public.vendor_locations WHERE candidate_id='${cid(1)}')=2`)}`);
check('Policy dorman ditolak','',`CREATE POLICY "unknown policy" ON public.vendor_locations FOR SELECT TO anon USING(true); ${stripped(migration)}`,/Policy lokasi\/foto tidak dikenal/);
check('Rollback menolak bucket berisi berkas','',stripped(rollback),/Bucket berisi file/);
const broad=`CREATE POLICY "test broad legacy" ON storage.objects FOR ALL TO PUBLIC USING(true) WITH CHECK(true); INSERT INTO storage.buckets(id,name,public) VALUES('phase3-other-test','phase3-other-test',true); INSERT INTO storage.objects(bucket_id,name) VALUES('phase3-other-test','readable.txt');`;
check('Policy storage lama tidak membocorkan bucket baru ke anon',role(null,'anon'),assertSql(`(SELECT count(*) FROM storage.objects WHERE bucket_id='vendor-photos')=0 AND (SELECT count(*) FROM storage.objects WHERE bucket_id='phase3-other-test')=1`),'PASS',broad);
check('Policy storage lama tidak membocorkan ke pelaksana',role(5),assertSql(`(SELECT count(*) FROM storage.objects WHERE bucket_id='vendor-photos')=0 AND (SELECT count(*) FROM storage.objects WHERE bucket_id='phase3-other-test')=1`),'PASS',broad);
check('Overwrite/move blob ditolak meski policy legacy luas',role(4),`UPDATE storage.objects SET name='overwrite.png' WHERE bucket_id='vendor-photos'; ${assertSql(`EXISTS(SELECT 1 FROM storage.objects WHERE name='${path(1)}')`)}`,'PASS',broad);
check('Path upload lintas kandidat ditolak',role(4),`INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('vendor-photos','${cid(2)}/${lid(1)}/${photo(8)}.png','{}')`,/row-level security/);
check('Blob terkait foto tidak dapat dihapus',role(4),assertSql(`NOT public.vendor_photo_can_remove('${path(1)}','${uid(4)}')`));
check('Orphan milik sendiri dapat dibersihkan',role(4),assertSql(`public.vendor_photo_can_remove('${cid(1)}/${lid(1)}/${photo(8)}.png','${uid(4)}')`));
check('Orphan orang lain tidak dapat dibersihkan sourcing',role(4),assertSql(`NOT public.vendor_photo_can_remove('${cid(1)}/${lid(1)}/${photo(8)}.png','${uid(3)}')`));
assert.equal(snapshot(),before);pass('Semua fixture rollback; data/policy existing tetap identik');
assert.equal(must('SELECT count(*) FROM public.vendor_locations; SELECT count(*) FROM storage.objects WHERE bucket_id=\'vendor-photos\';'),'0\n0','Rollback hanya pada stack lokal kosong');
const kong=spawnSync('docker',['exec','supabase_kong_harmas-vendor-test','cat','/home/kong/kong.yml'],{encoding:'utf8'});assert.equal(kong.status,0);
const localService=kong.stdout.match(/sb_secret_[A-Za-z0-9_-]+/)?.[0];assert.ok(localService);
const deleted=await fetch(`${localApi}/storage/v1/bucket/vendor-photos`,{method:'DELETE',headers:{apikey:localService,Authorization:`Bearer ${localService}`}});assert.ok(deleted.ok,`Hapus bucket lokal via Storage API: ${deleted.status}`);
must(rollback);must(rollback);assert.equal(snapshot(),before);must(migration);pass('Rollback 2x + reapply; bucket dihapus lewat Storage API, existing utuh');
writeFileSync(new URL('../docs/vendor-management/PHASE3_LOCAL_TEST_RESULTS.txt',import.meta.url),results.join('\n')+`\nTOTAL: ${results.length} PASS; 0 FAIL\nBASELINE: ${before}\n`);
console.log(`TOTAL: ${results.length} PASS; 0 FAIL`);
