// Final step after the fresh backup has been restored and rehearsed offline.
// Never creates a test account or archives a business candidate.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {target,migrationSha256,snapshotSql,validateBefore,validateAfter,instrumentMigration,same} from './vendor-candidate-archive-release-checks.mjs';
const approvalPath='.vercel/candidate-archive-migration-approval.json',statusPath='.vercel/candidate-archive-activation-status.json';
const approval=JSON.parse(fs.readFileSync(approvalPath,'utf8'));
assert.equal(approval.target,target);assert.equal(approval.migration_sha256,migrationSha256);assert.equal(approval.explicit_user_approval,true);assert.equal(approval.consumed,false);
const hash=data=>createHash('sha256').update(data).digest('hex');
for(const [f,h] of Object.entries(approval.release_source_sha256))assert.equal(hash(fs.readFileSync(f)),h,'Release helper changed: '+f);
assert.ok(process.env.PGPASSWORD,'Isi password di terminal tersembunyi');
const verified=JSON.parse(fs.readFileSync('docs/vendor-management/candidate-archive-evidence/BACKUP_OFFLINE_VERIFICATION.json'));
const folder=fs.realpathSync(verified.backup_directory);assert.match(folder.replaceAll('\\','/'),/^D:\/Backups\/harmas-pre-candidate-archive-\d{8}-\d{6}-[a-f0-9]{8}$/);
assert.ok(verified.cold_restore_verified&&verified.archive_migration_applied_twice&&verified.archive_rollback_applied_twice&&verified.stale_guard_rejected&&verified.functions_acl_set_equal&&verified.policies_canonically_equal);
const backup=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'))),source=JSON.parse(fs.readFileSync(path.join(folder,'production-preflight.json')));
assert.equal(backup.target,target);assert.equal(backup.migration_sha256,migrationSha256);assert.equal(backup.sha256,verified.backup_sha256);assert.equal(hash(fs.readFileSync(path.join(folder,'database.dump'))),verified.backup_sha256);
assert.ok(Date.now()-Date.parse(source.checked_at)<3600000,'Backup snapshot older than one hour; create a fresh verified backup');assert.ok(same(source.before,source.after));
const expected=structuredClone(source.before);
for(const key of ['functions','monitoring','archive_functions'])for(const f of expected[key])if(f.acl)f.acl.sort((a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b)));
let attempted=false,committed=false;
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
function status(state,extra={}){write(statusPath,{state,updated_at:new Date().toISOString(),backup_directory:folder,migration_attempted:attempted,production_migration_executed:committed,...extra});console.log(state);}
function psql(q,writeMode=false){
 const args=['run','--rm','-i','--env','PGPASSWORD','--env','PGHOST=aws-0-ap-southeast-1.pooler.supabase.com','--env','PGPORT=6543','--env','PGUSER=postgres.uwlxkwyauxwewoexfgwi','--env','PGDATABASE=postgres','--env','PGSSLMODE=require','--env','PGCONNECT_TIMEOUT=20','--env',`PGOPTIONS=-c default_transaction_read_only=${writeMode?'off':'on'} -c client_min_messages=warning -c statement_timeout=120000`,'postgres:17','psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1'];
 const input=writeMode?q:`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;SET LOCAL timezone='UTC';SET LOCAL search_path=public,pg_temp;${q};ROLLBACK;`;
 const r=spawnSync('docker',args,{input,encoding:'utf8',maxBuffer:16e6,timeout:180000});
 if(r.status!==0){fs.writeFileSync(path.join(folder,writeMode?'final-migration-error.log':'final-readonly-error.log'),r.stderr||String(r.error));throw Error('Koneksi/SQL gagal; lihat log privat dan periksa status sebelum mencoba ulang');}
 return r.stdout.trim();
}
try {
 status('VERIFIED_BACKUP_FINAL_READONLY_CHECK');
 const before=JSON.parse(psql(snapshotSql)),second=JSON.parse(psql(snapshotSql));validateBefore(before);assert.ok(same(before,second),'Baseline berubah saat final preflight');assert.ok(same(before,expected),'Produksi berbeda dari backup terverifikasi; jangan migration, perlu backup baru');
 const sql=instrumentMigration(before);fs.writeFileSync(path.join(folder,'approved-migration.sql'),sql);
 approval.consumed=true;approval.attempted_at=new Date().toISOString();approval.backup_directory=folder;write(approvalPath,approval);attempted=true;status('APPROVED_MIGRATION_EXECUTION_STARTED');
 const output=psql(sql+"\nSELECT 'CANDIDATE_ARCHIVE_COMMIT_CONFIRMED';",true);assert.ok(output.split(/\r?\n/).includes('CANDIDATE_ARCHIVE_COMMIT_CONFIRMED'),'COMMIT marker absent; inspect outcome before retry');committed=true;status('MIGRATION_COMMITTED_VERIFYING');
 const after=JSON.parse(psql(snapshotSql));validateAfter(before,after);write(path.join(folder,'production-after.json'),after);
 Object.assign(backup,{application_restore_verified:true,logical_restore_tables:verified.copy_tables_verified,logical_restore_rows:verified.total_rows_verified,archive_clone_migration_twice:true,archive_clone_rollback_twice:true,production_migration_executed:true,verified_at:new Date().toISOString(),supabase_platform_restore_complete:false,storage_blob_backup_created:false});write(path.join(folder,'manifest.json'),backup);
 const report={checked_at:backup.verified_at,target,migration_sha256:migrationSha256,backup_directory:folder,database_dump_sha256:backup.sha256,database_dump_bytes:backup.bytes,logical_restore_tables:verified.copy_tables_verified,logical_restore_rows:verified.total_rows_verified,baseline_tables_verified:18,security_helpers_guards_policies_unchanged:true,archive_clone_migration_twice:true,archive_clone_rollback_twice:true,clone_stale_transaction_rejected:true,production_migration_executed:true,production_commit_confirmed:true,application_restore_verified:true,supabase_platform_restore_complete:false,storage_blob_backup_created:false,existing_business_rows_changed:false,accounts_created:false,git_push:false};
 write('docs/vendor-management/candidate-archive-evidence/PRODUCTION_ACTIVATION_CHECKS.json',report);status('MIGRATION_COMMITTED_VERIFIED',{report_file:'docs/vendor-management/candidate-archive-evidence/PRODUCTION_ACTIVATION_CHECKS.json'});
}catch(error){status(committed?'MIGRATION_COMMITTED_REVIEW_REQUIRED':attempted?'MIGRATION_OUTCOME_REVIEW_REQUIRED':'FINAL_PREFLIGHT_FAILED_NO_PRODUCTION_WRITE',{message:error.message});process.exitCode=1;}
