// Only the exact, separately approved Ofissio migration. Production business CRUD is never exercised here.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {target,source,hash,snapshotSql,privilegesSql,validateBefore,validateAfter,validateChecks,postChecksSql,instrument,same} from './vendor-ofissio-release-checks.mjs';
const approvalFile='.vercel/ofissio-migration-approval.json',statusFile='.vercel/ofissio-release-status.json';
const approval=JSON.parse(fs.readFileSync(approvalFile,'utf8'));assert.equal(approval.target,target);assert.equal(approval.explicit_user_approval,true);assert.equal(approval.consumed,false);assert.ok(approval.user_quote);
assert.ok(same(approval.sql_files,source.map(({file,sha256})=>({file,sha256}))));for(const[file,digest]of Object.entries(approval.release_source_sha256||{}))assert.equal(hash(fs.readFileSync(file)),digest,'Release driver changed: '+file);
assert.ok(process.env.PGPASSWORD,'Provide PGPASSWORD through the interactive terminal, never chat');
let folder='',attempted=false,committed=false;
const write=(file,v)=>fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n');
function status(state,extra={}){write(statusFile,{state,updated_at:new Date().toISOString(),backup_directory:folder,production_migration_executed:committed,migration_attempted:attempted,...extra});console.log(state);}
function run(args,input,timeout=180000){const r=spawnSync('docker',args,{input,env:process.env,encoding:'utf8',maxBuffer:128e6,timeout});if(r.status!==0){if(folder)fs.writeFileSync(path.join(folder,attempted?'private-migration-error.log':'private-final-preflight-error.log'),r.stderr||String(r.error));throw Error('PostgreSQL operation failed; inspect private backup log and status before any retry');}return r.stdout;}
function production(q,writeMode=false){const options=`-c default_transaction_read_only=${writeMode?'off':'on'} -c client_min_messages=warning -c statement_timeout=120000`;return run(['run','--rm','-i','--env','PGPASSWORD','--env','PGHOST=aws-0-ap-southeast-1.pooler.supabase.com','--env','PGPORT=6543','--env','PGUSER=postgres.uwlxkwyauxwewoexfgwi','--env','PGDATABASE=postgres','--env','PGSSLMODE=require','--env','PGCONNECT_TIMEOUT=20','--env','PGOPTIONS='+options,'postgres:17','psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],writeMode?q:`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;SET LOCAL timezone='UTC';SET LOCAL search_path=public,pg_temp;${q};ROLLBACK;`).trim();}
const collect=()=>JSON.parse(production(snapshotSql));
function backup(){const state=JSON.parse(fs.readFileSync(statusFile,'utf8'));folder=fs.realpathSync(state.backup_directory);assert.match(folder.replaceAll('\\','/'),/^D:\/Backups\/harmas-pre-ofissio-\d{8}-\d{6}-[a-f0-9]{8}$/);const m=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));assert.equal(m.target,target);assert.equal(m.sha256,hash(fs.readFileSync(path.join(folder,'database.dump'))));assert.ok(m.application_restore_verified&&m.migrations_and_rollbacks_twice_offline&&m.stale_transaction_rejected,'Restore/rehearsal backup belum terverifikasi');assert.ok(m.storage_blob_backup_verified,'Backup Storage belum lengkap; lengkapi file privat melalui Dashboard, lalu verifikasi ulang sebelum migration');assert.ok(same(m.sql_files,approval.sql_files));return m;}
try{
 let manifest=backup();status('APPROVED_FINAL_READONLY_PREFLIGHT');let fresh=collect(),privileges=JSON.parse(production(privilegesSql));validateBefore(fresh,privileges);
 const age=Date.now()-Date.parse(manifest.started_at);
 if(age<0||age>=3600000||!same(fresh,manifest.post_dump_baseline)){
  // Refresh under the same password session; still strictly READ ONLY against production.
  const refreshed=spawnSync(process.execPath,['scripts/backup-vendor-ofissio-release.mjs'],{env:process.env,stdio:'inherit',timeout:1200000});assert.equal(refreshed.status,0,'Backup refresh failed; no migration attempted');manifest=backup();fresh=collect();privileges=JSON.parse(production(privilegesSql));validateBefore(fresh,privileges);
 }
 assert.ok(same(fresh,manifest.post_dump_baseline),'Live baseline differs from verified backup');assert.ok(Date.now()-Date.parse(manifest.started_at)<3600000,'Verified backup too old');
 const blobManifest=JSON.parse(fs.readFileSync(path.join(folder,'storage-backup-manifest.json'),'utf8'));for(const f of blobManifest.objects){assert.match(f.file,/^[a-f0-9]{64}\.blob$/);assert.equal(hash(fs.readFileSync(path.join(folder,'storage-blobs',f.file))),f.sha256,'Backup blob changed');}
 const sql=instrument(fresh);fs.writeFileSync(path.join(folder,'approved-ofissio-migration.sql'),sql);
 approval.consumed=true;approval.attempted_at=new Date().toISOString();approval.backup_directory=folder;write(approvalFile,approval);attempted=true;status('APPROVED_OFISSIO_MIGRATION_EXECUTION_STARTED');
 const output=production(sql+"\nSELECT 'OFISSIO_COMMIT_CONFIRMED';",true);assert.ok(output.split(/\r?\n/).includes('OFISSIO_COMMIT_CONFIRMED'),'Commit marker missing; inspect before retry');committed=true;status('MIGRATION_COMMITTED_VERIFYING');
 const after=collect();validateAfter(fresh,after);const checks=JSON.parse(production(postChecksSql));validateChecks(checks);
 write(path.join(folder,'production-after-ofissio.json'),after);manifest.production_migration_executed=true;manifest.production_commit_confirmed=true;manifest.production_verified_at=new Date().toISOString();write(path.join(folder,'manifest.json'),manifest);
 const report={checked_at:manifest.production_verified_at,target,sql_files:approval.sql_files,backup_directory:folder,database_dump_sha256:manifest.sha256,logical_restore_tables:manifest.logical_restore_tables,logical_restore_rows:manifest.logical_restore_rows,storage_blob_backup_verified:true,storage_blobs:manifest.storage_blobs,baseline_tables_verified:27,existing_data_security_and_policies_unchanged:true,production_migration_executed:true,production_commit_confirmed:true,post_checks:checks,business_fixture_created:false,accounts_created:false,git_push:false,frontend_promoted:false};
 write('docs/vendor-management/ofissio-catalog-evidence/PRODUCTION_MIGRATION_CHECKS.json',report);status('MIGRATION_COMMITTED_VERIFIED',{report_file:'docs/vendor-management/ofissio-catalog-evidence/PRODUCTION_MIGRATION_CHECKS.json'});
}catch(error){status(committed?'MIGRATION_COMMITTED_REVIEW_REQUIRED':attempted?'MIGRATION_OUTCOME_REVIEW_REQUIRED':'FINAL_PREFLIGHT_FAILED_NO_PRODUCTION_WRITE',{message:error.message});process.exitCode=1;}
