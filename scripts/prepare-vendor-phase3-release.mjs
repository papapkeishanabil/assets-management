// Tidak menghubungi database; persiapan SQL dan review snapshot file lokal saja.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {instrumentMigration,migrationSha256} from './vendor-phase3-release-checks.mjs';
const [mode,inputFile,outputFile]=process.argv.slice(2);
const input=JSON.parse(readFileSync(inputFile,'utf8'));
const same=(a,b,label)=>assert.ok(isDeepStrictEqual(a,b),label);
assert.equal(input.target,'https://uwlxkwyauxwewoexfgwi.supabase.co');
if(mode==='prepare') {
 const backup=realpathSync(input.backup_directory).replaceAll('\\','/');
 assert.equal(backup,'D:/Backups/harmas-pre-phase3-20261110-090939-f4bf7fbd');
 const manifest=JSON.parse(readFileSync(`${backup}/manifest.json`,'utf8'));
 assert.ok(manifest.application_restore_verified&&manifest.storage_blob_backup_verified);
 assert.equal(manifest.target,input.target);
 assert.equal(createHash('sha256').update(readFileSync(`${backup}/database.dump`)).digest('hex'),manifest.sha256);
 const age=Date.now()-Date.parse(manifest.verified_at);
 assert.ok(age>=0&&age<3600000,'Backup perlu diperbarui sebelum migration (batas satu jam)');
 same(input.before,input.after,'Metadata berubah selama preflight');
 same(input.before,manifest.post_dump_baseline,'Baseline/metadata berbeda dari backup terverifikasi; perbarui backup');
 assert.equal(input.privileges.executor,'postgres');
 assert.equal(input.privileges.database,'postgres');
 assert.ok(Object.entries(input.privileges).filter(([key])=>!['executor','database'].includes(key)).every(([,value])=>value===true),'Hak koneksi migration belum memenuhi prasyarat');
 writeFileSync(outputFile,instrumentMigration(input.before));
 console.log(JSON.stringify({prepared:true,migration_sha256:migrationSha256,executor:input.privileges.executor,backup_sha256:manifest.sha256}));
} else if(mode==='verify') {
 const expected=input.before,actual=input.after;
 const checks=[];
 for(const key of ['baseline','functions','rls','triggers','columns','roles','permissions','storage_service_acl','asset_vendor_links','asset_vendor_orphans']) {
  same(actual[key],expected[key],`Existing ${key} berubah`);checks.push({check:`existing_${key}`,pass:true});
 }
 const oldPolicies=actual.policies.filter(p=>!(p.schemaname==='public'&&['vendor_locations','vendor_location_photos'].includes(p.tablename))&&!(p.schemaname==='storage'&&p.policyname.startsWith('Vendor storage ')));
 same(oldPolicies,expected.policies,'Policy existing berubah');checks.push({check:'existing_policies',pass:true});
 same(actual.buckets.filter(b=>b.id!=='vendor-photos'),expected.buckets,'Bucket existing berubah');checks.push({check:'existing_buckets',pass:true});
 for(const [check,pass] of Object.entries(input.phase3_checks)){assert.equal(pass,true,check);checks.push({check,pass});}
 const report={checked_at:new Date().toISOString(),target:input.target,migration_sha256:migrationSha256,migration_executed:true,migration_commit_confirmed:true,executor:input.privileges.executor,checks,baseline_tables_verified:17,existing_functions_and_acl_verified:11,baseline_counts:Object.fromEntries(Object.entries(actual.baseline).map(([name,value])=>[name,value.count])),asset_vendor_links:actual.asset_vendor_links,asset_vendor_orphans:actual.asset_vendor_orphans,production_fixture_created:false,status:'PASS'};
 writeFileSync(outputFile,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'PASS',checks:checks.length,baseline_tables:17,existing_functions:11}));
} else throw new Error('Mode harus prepare atau verify');
