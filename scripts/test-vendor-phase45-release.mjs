// Release gates exercised only on the fixed synthetic Docker stack. No production credentials.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {snapshotSql,privilegesSql,validateBefore,validateAfter,validateChecks,postChecksSql,stable,instrument,same,source,newBuckets} from './vendor-phase45-release-checks.mjs';
const db='supabase_db_harmas-vendor-test';
const sql=q=>{const r=spawnSync('docker',['exec','-i',db,'psql','-X','-q','-A','-t','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:`SET timezone='UTC';SET search_path=public,pg_temp;${q}`,encoding:'utf8',maxBuffer:16e6});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const snapshot=()=>JSON.parse(sql(snapshotSql+';')),results=[];
const pass=check=>{results.push({check,pass:true});console.log('PASS | '+check);};
assert.equal(sql("SELECT to_regclass('public.vendor_samples') IS NULL AND to_regclass('public.vendor_decisions') IS NULL;"),'t');
const missing=['employees','contracts'].filter(t=>sql(`SELECT to_regclass('public.${t}') IS NULL;`)==='t');
let applied=false;
try{
 if(missing.includes('employees'))sql('CREATE TABLE public.employees(id uuid PRIMARY KEY,full_name text,is_active boolean DEFAULT true);GRANT SELECT ON public.employees TO authenticated,service_role;');
 if(missing.includes('contracts'))sql('CREATE TABLE public.contracts(id uuid PRIMARY KEY,vendor_id uuid REFERENCES public.vendors(id));');
 const before=snapshot(),privileges=JSON.parse(sql(privilegesSql+';'));validateBefore(before,privileges);pass('20-table preflight accepts hardened Phase 1–3 + archive baseline');
 for(const key of ['schema_create','storage_policy_management','bucket_insert','references','sha256']){assert.throws(()=>validateBefore(before,{...privileges,[key]:false}));}pass('Missing DDL/reference/Storage/SHA-256 privilege fails closed');
 const disabled=structuredClone(before);disabled.rls['public.user_profiles']=false;assert.throws(()=>validateBefore(disabled,privileges));pass('Disabled existing profile RLS rejected');
 const existing=structuredClone(before);existing.new_objects.push({name:'vendor_samples'});assert.throws(()=>validateBefore(existing,privileges));pass('Existing/partial Phase 4–5 installation rejected before write');
 const stale=structuredClone(before);stale.baseline.vendors.checksum='stale';assert.throws(()=>sql(instrument(stale)),/Baseline changed/);assert.ok(same(snapshot(),before));pass('Stale transaction snapshot rolls back before DDL');
 sql(instrument(before));applied=true;const after=snapshot();validateAfter(before,after);validateChecks(JSON.parse(sql(postChecksSql+';')));pass('Combined instrumented transaction installs Phase 4 then 5; old data/security intact');
 for(const{sql:q}of source)sql(q);validateAfter(before,snapshot());pass('Two migrations replay idempotently on local stack');
 const damaged=structuredClone(after);damaged.functions.find(f=>f.name==='activate_vendor_candidate').authenticated_execute=false;assert.throws(()=>validateAfter(before,damaged));pass('Altered activation ACL detected');
 const policy=structuredClone(after);policy.policies.find(p=>p.tablename==='user_profiles').qual='true';assert.throws(()=>validateAfter(before,policy));pass('Changed existing policy detected');
 const bucket=structuredClone(after);bucket.buckets.find(b=>b.id===newBuckets[0]).public=true;assert.throws(()=>validateAfter(before,bucket));pass('Public evidence bucket detected');
 const empty=structuredClone(after);empty.new_objects.find(o=>o.name==='vendor_decisions').rls=false;assert.throws(()=>validateAfter(before,empty));pass('New decision RLS disabled detected');
 sql(fs.readFileSync('supabase/rollbacks/202611110002_vendor_management_phase5_rollback.sql','utf8'));sql(fs.readFileSync('supabase/rollbacks/202611110002_vendor_management_phase5_rollback.sql','utf8'));
 sql(fs.readFileSync('supabase/rollbacks/202611110001_vendor_management_phase4_rollback.sql','utf8'));sql(fs.readFileSync('supabase/rollbacks/202611110001_vendor_management_phase4_rollback.sql','utf8'));applied=false;
 assert.ok(same(stable(snapshot()),stable(before)));assert.equal(snapshot().new_objects.length,0);pass('Both rollbacks twice preserve existing baseline; empty private buckets intentionally retained');
}finally{
 if(applied){sql(fs.readFileSync('supabase/rollbacks/202611110002_vendor_management_phase5_rollback.sql','utf8'));sql(fs.readFileSync('supabase/rollbacks/202611110001_vendor_management_phase4_rollback.sql','utf8'));}
 for(const t of missing)sql(`DROP TABLE public.${t};`);
 // Remove only these empty, locally created buckets through the local Storage API.
 const config=spawnSync('docker',['exec','supabase_kong_harmas-vendor-test','cat','/home/kong/kong.yml'],{encoding:'utf8'});assert.equal(config.status,0);
 const key=[...config.stdout.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)].map(m=>m[0]).find(k=>JSON.parse(Buffer.from(k.split('.')[1],'base64url')).role==='service_role');
 const{createClient}=await import('@supabase/supabase-js');const service=createClient('http://127.0.0.1:54321',key,{auth:{persistSession:false}});
 for(const bucket of newBuckets){const b=await service.storage.getBucket(bucket);if(!b.error){const r=await service.storage.deleteBucket(bucket);assert.ifError(r.error);}}
 fs.mkdirSync('docs/vendor-management/phase45-release-evidence',{recursive:true});fs.writeFileSync('docs/vendor-management/phase45-release-evidence/RELEASE_GATE_TESTS.json',JSON.stringify({checked_at:new Date().toISOString(),target:'Docker synthetic only',production_accessed:false,checks:results},null,2)+'\n');
}
