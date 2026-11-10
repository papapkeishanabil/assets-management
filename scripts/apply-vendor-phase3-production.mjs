// Eksekusi tunggal yang telah disetujui user; target produksi tetap, tanpa service key.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {instrumentMigration,snapshotSql,privilegeSql,phase3ChecksSql,migrationSha256} from './vendor-phase3-release-checks.mjs';
const target='https://uwlxkwyauxwewoexfgwi.supabase.co';
const approvalFile='.vercel/phase3-migration-approval.json';
const approval=JSON.parse(fs.readFileSync(approvalFile,'utf8'));
assert.equal(approval.target,target);assert.equal(approval.migration_sha256,migrationSha256);
assert.equal(approval.explicit_user_approval,true);assert.equal(approval.consumed,false,'Izin eksekusi ini sudah dipakai; periksa hasil sebelum mencoba ulang');
assert.ok(process.env.PGPASSWORD,'PGPASSWORD harus diisi melalui terminal interaktif');
const folder=fs.mkdtempSync('.vercel/phase3-release-');
const statusFile='.vercel/phase3-activation-status.json';
let attempted=false,committed=false;
function status(state,extra={}) {fs.writeFileSync(statusFile,JSON.stringify({state,updated_at:new Date().toISOString(),release_directory:folder,migration_attempted:attempted,production_migration_executed:committed,...extra},null,2)+'\n');}
function psql(sql,write=false) {
 const options=write?'-c default_transaction_read_only=off -c client_min_messages=warning -c lock_timeout=10000 -c statement_timeout=120000':'-c default_transaction_read_only=on -c client_min_messages=warning -c statement_timeout=120000';
 const args=['run','--rm','-i','--env','PGPASSWORD','--env','PGHOST=aws-0-ap-southeast-1.pooler.supabase.com','--env','PGPORT=6543','--env','PGUSER=postgres.uwlxkwyauxwewoexfgwi','--env','PGDATABASE=postgres','--env','PGSSLMODE=require','--env','PGCONNECT_TIMEOUT=20','--env',`PGOPTIONS=${options}`,'postgres:17','psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1'];
 const input=write?sql:`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n${sql};\nROLLBACK;`;
 const run=spawnSync('docker',args,{input,encoding:'utf8',maxBuffer:16e6,timeout:180000});
 fs.writeFileSync(`${folder}/${write?'migration':'readonly'}-stderr.log`,run.stderr||'');
 assert.equal(run.status,0,`Koneksi ${write?'migration':'read-only'} gagal; periksa log privat. Jangan mengulang write otomatis.`);
 return run.stdout.trim();
}
function local(script,args) {
 const run=spawnSync(process.execPath,[script,...args],{encoding:'utf8',maxBuffer:4e6});
 if(run.status!==0){fs.writeFileSync(`${folder}/review-error.log`,`${run.stdout}\n${run.stderr}`);throw new Error('Validasi lokal belum lulus; lihat log privat.');}
 console.log(run.stdout.trim());
}
try {
 status('MIGRATION_APPROVED_PREFLIGHT_RUNNING');
 const before=JSON.parse(psql(snapshotSql));
 const after=JSON.parse(psql(snapshotSql));
 const privileges=JSON.parse(psql(privilegeSql));
 const input={target,checked_at:new Date().toISOString(),backup_directory:'D:/Backups/harmas-pre-phase3-20261110-090939-f4bf7fbd',before,after,privileges};
 const beforeFile=`${folder}/before.json`,preparedFile=`${folder}/approved-migration.sql`;
 fs.writeFileSync(beforeFile,JSON.stringify(input,null,2));
 local('scripts/preflight-vendor-phase3-production.mjs',['--from-file',beforeFile,'--output-dir',folder]);
 local('scripts/prepare-vendor-phase3-release.mjs',['prepare',beforeFile,preparedFile]);
 const sql=instrumentMigration(before);
 assert.equal(fs.readFileSync(preparedFile,'utf8'),sql);
 // Simpan konsumsi izin SEBELUM write; kegagalan koneksi memerlukan inspeksi,
 // tidak boleh menebak bahwa COMMIT pasti belum terjadi lalu mengulang otomatis.
 approval.consumed=true;approval.attempted_at=new Date().toISOString();
 fs.writeFileSync(approvalFile,JSON.stringify(approval,null,2)+'\n');attempted=true;
 status('MIGRATION_EXECUTION_STARTED');
 const output=psql(sql+"\nSELECT 'PHASE3_COMMIT_CONFIRMED';",true);
 assert.ok(output.split(/\r?\n/).includes('PHASE3_COMMIT_CONFIRMED'),'Marker COMMIT belum terkonfirmasi');
 committed=true;status('MIGRATION_COMMITTED_VERIFYING');
 const observed=JSON.parse(psql(`SELECT jsonb_build_object('snapshot',(${snapshotSql}),'phase3_checks',(${phase3ChecksSql}))`));
 const verifyFile=`${folder}/after.json`,reportFile='docs/vendor-management/phase3-evidence/PHASE3_PRODUCTION_ACTIVATION_CHECKS.json';
 fs.writeFileSync(verifyFile,JSON.stringify({...input,after:observed.snapshot,phase3_checks:observed.phase3_checks},null,2));
 local('scripts/prepare-vendor-phase3-release.mjs',['verify',verifyFile,reportFile]);
 status('MIGRATION_COMMITTED_VERIFIED',{report_file:reportFile,migration_sha256:migrationSha256});
 console.log('PASS | Migration Fase 3 COMMIT terkonfirmasi; verifikasi pasca-commit lulus.');
} catch(error) {
 status(committed?'MIGRATION_COMMITTED_VERIFICATION_REVIEW_REQUIRED':attempted?'MIGRATION_OUTCOME_REVIEW_REQUIRED':'PREFLIGHT_FAILED_NO_MIGRATION',{message:error.message});
 console.error(error.message);process.exitCode=1;
}
