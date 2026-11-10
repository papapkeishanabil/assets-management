// Explicitly approved archive migration only. Credential comes from interactive PGPASSWORD.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {target,migrationSha256,migration,rollback,snapshotSql,validateBefore,validateAfter,stableSnapshot,instrumentMigration,same} from './vendor-candidate-archive-release-checks.mjs';
const approvalPath='.vercel/candidate-archive-migration-approval.json',statusPath='.vercel/candidate-archive-activation-status.json';
const approval=JSON.parse(fs.readFileSync(approvalPath,'utf8'));
assert.equal(approval.target,target);assert.equal(approval.migration_sha256,migrationSha256);assert.equal(approval.explicit_user_approval,true);assert.equal(approval.consumed,false);
for(const [file,expectedHash] of Object.entries(approval.release_source_sha256||{}))assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),expectedHash,'Release helper changed: '+file);
assert.ok(process.env.PGPASSWORD,'Masukkan password melalui terminal, bukan chat');
const stamp=new Date().toISOString().replaceAll(/[-:]/g,'').replace('T','-').slice(0,15),suffix=randomUUID().slice(0,8);
const folder=path.resolve(`D:/Backups/harmas-pre-candidate-archive-${stamp}-${suffix}`);
assert.match(folder.replaceAll('\\','/'),/^D:\/Backups\/harmas-pre-candidate-archive-\d{8}-\d{6}-[a-f0-9]{8}$/);
fs.mkdirSync(folder,{recursive:true});
let clone='',attempted=false,committed=false,logCounter=0;
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const hash=v=>createHash('sha256').update(v).digest('hex');
function status(state,extra={}){write(statusPath,{state,updated_at:new Date().toISOString(),backup_directory:folder,migration_attempted:attempted,production_migration_executed:committed,...extra});console.log(state);}
function run(args,input,{env=process.env,timeout=180000}={}){
 const r=spawnSync('docker',args,{input,env,encoding:'utf8',maxBuffer:128e6,timeout});
 if(r.status!==0){fs.writeFileSync(path.join(folder,`private-error-${++logCounter}.log`),r.stderr||String(r.error||'Docker failed'));throw Error('Operasi Docker/PostgreSQL gagal; lihat log privat di direktori backup.');}
 return r.stdout;
}
const connection=writeMode=>['--env','PGPASSWORD','--env','PGHOST=aws-0-ap-southeast-1.pooler.supabase.com','--env','PGPORT=6543','--env','PGUSER=postgres.uwlxkwyauxwewoexfgwi','--env','PGDATABASE=postgres','--env','PGSSLMODE=require','--env','PGCONNECT_TIMEOUT=20','--env',`PGOPTIONS=-c default_transaction_read_only=${writeMode?'off':'on'} -c client_min_messages=warning -c statement_timeout=120000`];
function production(q,writeMode=false){return run(['run','--rm','-i',...connection(writeMode),'postgres:17','psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],writeMode?q:`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL timezone='UTC'; SET LOCAL search_path=public,pg_temp; ${q}; ROLLBACK;`).trim();}
const collect=()=>JSON.parse(production(snapshotSql));
function local(q,database='archive_restore'){return run(['exec','-i',clone,'psql','-X','-q','-A','-t','-U','supabase_admin','-d',database,'-v','ON_ERROR_STOP=1'],`SET timezone='UTC'; SET search_path=public,pg_temp;\n${q}`).trim();}
const identifier=v=>'"'+v.replaceAll('"','""')+'"';
const literal=v=>"'"+v.replaceAll("'","''")+"'";
const manifest={target,started_at:new Date().toISOString(),migration_sha256:migrationSha256,production_migration_executed:false,application_restore_verified:false,supabase_platform_restore_complete:false,storage_blob_backup_created:false};
try {
 status('READONLY_PREFLIGHT_RUNNING');
 const before=collect(),second=collect();assert.ok(same(before,second),'Snapshot produksi berubah saat preflight; hentikan dan periksa.');validateBefore(before);
 write(path.join(folder,'production-preflight.json'),{target,checked_at:new Date().toISOString(),before,after:second});
 manifest.preflight_pass=true;status('BACKUP_RUNNING');
 const mount=`type=bind,source=${folder},target=/backup`;
 run(['run','--rm',...connection(false),'--mount',mount,'postgres:17','pg_dump','--format=custom','--lock-wait-timeout=10000','--file=/backup/database.dump'],undefined,{timeout:600000});
 const toc=run(['run','--rm','--network','none','--mount',mount+',readonly','postgres:17','pg_restore','--list','/backup/database.dump']);
 fs.writeFileSync(path.join(folder,'database.toc.txt'),toc);
 manifest.sha256=hash(fs.readFileSync(path.join(folder,'database.dump')));manifest.bytes=fs.statSync(path.join(folder,'database.dump')).size;manifest.database_backup_created=true;manifest.archive_list_verified=true;
 const afterDump=collect();assert.ok(same(before,afterDump),'Produksi berubah selama backup; jangan migration sebelum backup baru diverifikasi.');
 write(path.join(folder,'manifest.json'),manifest);status('RESTORE_VERIFICATION_RUNNING');
 clone=`harmas-candidate-archive-restore-${stamp.slice(0,8)}-${suffix}`;
 run(['run','-d','--name',clone,'--network','none','--label','harmas.task=candidate-archive-restore','--mount',mount+',readonly','--env','POSTGRES_PASSWORD','public.ecr.aws/supabase/postgres:17.11.0.011','postgres','-D','/etc/postgresql','-c','shared_preload_libraries=pg_stat_statements,pg_net,pg_cron','-c','cron.database_name=archive_restore','-c','cron.launch_active_jobs=off'],undefined,{env:{...process.env,POSTGRES_PASSWORD:randomUUID()}});
 write(path.join(folder,'restore-container.json'),{name:clone,network:'none',published_ports:[],backup:folder});
 let ready=false;for(let i=0;i<60;i++){const r=spawnSync('docker',['exec',clone,'pg_isready','-h','127.0.0.1','-U','postgres','-d','postgres'],{encoding:'utf8',timeout:5000});if(r.status===0){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,1000));}assert.ok(ready,'Clone TCP server belum siap');
 const config=JSON.parse(run(['inspect',clone]))[0];assert.equal(config.HostConfig.NetworkMode,'none');assert.equal(config.Config.Labels['harmas.task'],'candidate-archive-restore');assert.equal(Object.keys(config.HostConfig.PortBindings||{}).length,0);
 const schema=run(['exec',clone,'pg_restore','--schema-only','--file=-','/backup/database.dump']);
 const roles=[...new Set([...schema.matchAll(/^(?:GRANT[^\r\n]+ TO|REVOKE[^\r\n]+ FROM|ALTER[^\r\n]+ OWNER TO) ([a-z_][a-z_0-9]*);/gm)].map(m=>m[1]))].filter(r=>r!=='PUBLIC');
 for(const r of roles)assert.match(r,/^(?:supabase_[a-z_]+|postgres|pgbouncer|anon|authenticated|authenticator|service_role|dashboard_user|pg_database_owner|pgsodium_[a-z_]+)$/);
 local(roles.map(r=>`DO $bootstrap$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname=${literal(r)}) THEN CREATE ROLE ${identifier(r)} NOLOGIN; END IF; END $bootstrap$;`).join('\n'),'postgres');
 local('CREATE DATABASE archive_restore OWNER supabase_admin TEMPLATE template0;','postgres');
 run(['exec',clone,'pg_restore','--exit-on-error','-U','supabase_admin','-d','archive_restore','/backup/database.dump'],undefined,{timeout:600000});
 const restored=JSON.parse(local(`BEGIN READ ONLY; ${snapshotSql}; ROLLBACK;`));validateBefore(restored);
 const canonicalPolicies=before.policies.map((p,i)=>{const actual=restored.policies[i];assert.ok(same({...p,qual:null,with_check:null},{...actual,qual:null,with_check:null}),'Identitas policy restore berubah');if(p.qual===actual.qual&&p.with_check===actual.with_check)return p;
 const sql=`CREATE POLICY __archive_backup_expected ON ${identifier(p.schemaname)}.${identifier(p.tablename)} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.map(identifier).join(',')}${p.qual?' USING ('+p.qual+')':''}${p.with_check?' WITH CHECK ('+p.with_check+')':''};`;
 const normalized=JSON.parse(local(`BEGIN;${sql} SELECT jsonb_build_object('qual',qual,'with_check',with_check) FROM pg_policies WHERE schemaname=${literal(p.schemaname)} AND tablename=${literal(p.tablename)} AND policyname='__archive_backup_expected';ROLLBACK;`));return {...p,...normalized};});
 const canonicalBefore={...before,policies:canonicalPolicies};assert.ok(same(stableSnapshot(restored),stableSnapshot(canonicalBefore)),'Baseline data/helper/guard/RLS restore berbeda');
 // Canonicalize the approved pre-archive view on the same clone engine; rollback always.
 const start=rollback.indexOf('CREATE OR REPLACE VIEW public.vendor_map_points '),oldView=rollback.slice(start,rollback.indexOf(';',start)+1);
 const expectedView=JSON.parse(local(`BEGIN;${oldView} SELECT to_jsonb(pg_get_viewdef('public.vendor_map_points'::regclass,true));ROLLBACK;`));assert.equal(restored.map_view.definition,expectedView,'View produksi berbeda dari baseline yang direview');
 const data=run(['exec',clone,'pg_restore','--data-only','--file=-','/backup/database.dump']),lines=data.split(/\r?\n/),copies=[];
 for(let i=0;i<lines.length;i++){const match=lines[i].match(/^COPY ([a-z_][a-z_0-9]*\.[a-z_][a-z_0-9]*) \(([A-Za-z_0-9", ]+)\) FROM stdin;$/);if(!match)continue;const rows=[];while(++i<lines.length&&lines[i]!=='\\.')rows.push(lines[i]);assert.equal(lines[i],'\\.');copies.push({table:match[1],columns:match[2],rows});}
 assert.ok(copies.length>=90,'Archive COPY tidak lengkap');let verifiedRows=0;
 for(const c of copies){const output=run(['exec','-i',clone,'psql','-X','-q','-A','-t','-U','supabase_admin','-d','archive_restore','-v','ON_ERROR_STOP=1'],`BEGIN READ ONLY;SET LOCAL timezone='UTC';SET LOCAL extra_float_digits=3;COPY (SELECT ${c.columns} FROM ${c.table}) TO STDOUT;ROLLBACK;`);const actual=output.split(/\r?\n/);if(actual.at(-1)==='')actual.pop();assert.equal(actual.length,c.rows.length,`COPY row count ${c.table}`);assert.equal(hash(JSON.stringify(actual.sort())),hash(JSON.stringify(c.rows.sort())),`COPY hash ${c.table}`);verifiedRows+=actual.length;}
 // Rehearse the instrumented transaction, idempotent migration and separate rollback on the fresh restore.
 const cloneBefore=JSON.parse(local(`BEGIN READ ONLY;${snapshotSql};ROLLBACK;`));
 const stale=structuredClone(cloneBefore);stale.baseline.vendors.checksum='stale-local-test-only';
 const denied=spawnSync('docker',['exec','-i',clone,'psql','-X','-q','-A','-t','-U','supabase_admin','-d','archive_restore','-v','ON_ERROR_STOP=1'],{input:instrumentMigration(stale,{database:'archive_restore'}),encoding:'utf8'});assert.notEqual(denied.status,0);assert.match(denied.stderr,/Baseline changed/);
 local(instrumentMigration(cloneBefore,{database:'archive_restore'}));local(migration);
 validateAfter(cloneBefore,JSON.parse(local(`BEGIN READ ONLY;${snapshotSql};ROLLBACK;`)));
 local(rollback);local(rollback);const cloneRollback=JSON.parse(local(`BEGIN READ ONLY;${snapshotSql};ROLLBACK;`));assert.ok(same(cloneRollback,cloneBefore),'Rollback clone tidak identik');
 manifest.application_restore_verified=true;manifest.logical_restore_tables=copies.length;manifest.logical_restore_rows=verifiedRows;manifest.archive_clone_migration_twice=true;manifest.archive_clone_rollback_twice=true;manifest.clone_stale_transaction_rejected=true;manifest.backup_verified_at=new Date().toISOString();
 write(path.join(folder,'manifest.json'),manifest);status('BACKUP_RESTORE_VERIFIED');
 // The backup must still represent the live database immediately before the one authorized write.
 const fresh=collect();assert.ok(same(fresh,before),'Produksi berubah sesudah backup. Hentikan sebelum migration; perlu backup baru.');validateBefore(fresh);
 const approvedSql=instrumentMigration(fresh);fs.writeFileSync(path.join(folder,'approved-migration.sql'),approvedSql);
 assert.equal(approval.consumed,false);approval.consumed=true;approval.attempted_at=new Date().toISOString();approval.backup_directory=folder;write(approvalPath,approval);attempted=true;status('APPROVED_MIGRATION_EXECUTION_STARTED');
 const output=production(approvedSql+"\nSELECT 'CANDIDATE_ARCHIVE_COMMIT_CONFIRMED';",true);assert.ok(output.split(/\r?\n/).includes('CANDIDATE_ARCHIVE_COMMIT_CONFIRMED'),'Commit marker absent; inspect outcome before retry');committed=true;
 status('MIGRATION_COMMITTED_VERIFYING');const after=collect();validateAfter(fresh,after);
 write(path.join(folder,'production-after.json'),after);manifest.production_migration_executed=true;manifest.verified_at=new Date().toISOString();
 const report={checked_at:manifest.verified_at,target,migration_sha256:migrationSha256,backup_directory:folder,database_dump_sha256:manifest.sha256,database_dump_bytes:manifest.bytes,logical_restore_tables:copies.length,logical_restore_rows:verifiedRows,baseline_tables_verified:18,security_helpers_guards_policies_unchanged:true,archive_clone_migration_twice:true,archive_clone_rollback_twice:true,clone_stale_transaction_rejected:true,production_migration_executed:true,production_commit_confirmed:true,application_restore_verified:true,supabase_platform_restore_complete:false,storage_blob_backup_created:false,existing_business_rows_changed:false,accounts_created:false,git_push:false};
 write('docs/vendor-management/candidate-archive-evidence/PRODUCTION_ACTIVATION_CHECKS.json',report);status('MIGRATION_COMMITTED_VERIFIED',{report_file:'docs/vendor-management/candidate-archive-evidence/PRODUCTION_ACTIVATION_CHECKS.json'});
}catch(error){manifest.failure=error.message;status(committed?'MIGRATION_COMMITTED_REVIEW_REQUIRED':attempted?'MIGRATION_OUTCOME_REVIEW_REQUIRED':'PREFLIGHT_OR_BACKUP_FAILED_NO_PRODUCTION_WRITE',{message:error.message});process.exitCode=1;}
finally {
 if(clone){try{run(['stop',clone],undefined,{timeout:30000});manifest.restore_container=clone;manifest.restore_container_stopped=true;}catch{manifest.restore_container_stopped=false;}}
 manifest.finished_at=new Date().toISOString();manifest.production_migration_executed=committed;write(path.join(folder,'manifest.json'),manifest);
}
