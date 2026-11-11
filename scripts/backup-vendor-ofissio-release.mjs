import {backupStorageObjects,rememberVerifiedStorageBackup} from './vendor-storage-backup.mjs';
// READ-ONLY production preflight/backup. Applies migrations ONLY to an isolated offline restore.
// No production write path or production approval consumption exists in this driver. Rehearses only 202611110003 on already installed Phase 4/5.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {target,source,newBuckets,hash,snapshotSql,privilegesSql,validateBefore,validateAfter,validateChecks,postChecksSql,stable,instrument,same} from './vendor-ofissio-release-checks.mjs';
assert.ok(process.env.PGPASSWORD,'Provide PGPASSWORD in the interactive terminal, never chat');
const stamp=new Date().toISOString().replaceAll(/[-:]/g,'').replace('T','-').slice(0,15),suffix=randomUUID().slice(0,8);
const folder=path.resolve(`D:/Backups/harmas-pre-ofissio-${stamp}-${suffix}`);
assert.match(folder.replaceAll('\\','/'),/^D:\/Backups\/harmas-pre-ofissio-\d{8}-\d{6}-[a-f0-9]{8}$/);fs.mkdirSync(folder,{recursive:true});
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
let clone='',logCounter=0;
const manifest={target,started_at:new Date().toISOString(),sql_files:source.map(({file,sha256})=>({file,sha256})),production_migration_executed:false,production_write_requests:0,application_restore_verified:false,storage_blob_backup_verified:false,supabase_platform_restore_complete:false};
function status(state,extra={}){write('.vercel/ofissio-release-status.json',{state,updated_at:new Date().toISOString(),backup_directory:folder,production_migration_executed:false,production_write_requests:0,...extra});console.log(state);}
function run(args,input,{env=process.env,timeout=180000}={}){const r=spawnSync('docker',args,{input,env,encoding:'utf8',maxBuffer:128e6,timeout});if(r.status!==0){fs.writeFileSync(path.join(folder,`private-error-${++logCounter}.log`),r.stderr||String(r.error||'Docker failed'));throw Error('Docker/PostgreSQL operation failed; inspect private backup log. No production write was attempted.');}return r.stdout;}
const connection=['--env','PGPASSWORD','--env','PGHOST=aws-0-ap-southeast-1.pooler.supabase.com','--env','PGPORT=6543','--env','PGUSER=postgres.uwlxkwyauxwewoexfgwi','--env','PGDATABASE=postgres','--env','PGSSLMODE=require','--env','PGCONNECT_TIMEOUT=20','--env','PGOPTIONS=-c default_transaction_read_only=on -c client_min_messages=warning -c statement_timeout=120000'];
function production(q){return run(['run','--rm','-i',...connection,'postgres:17','psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;SET LOCAL timezone='UTC';SET LOCAL search_path=public,pg_temp;${q};ROLLBACK;`).trim();}
const collect=()=>JSON.parse(production(snapshotSql));
function local(q,database='ofissio_restore'){assert.match(clone,/^harmas-ofissio-restore-\d{8}-[a-f0-9]{8}$/);return run(['exec','-i',clone,'psql','-X','-q','-A','-t','-U','supabase_admin','-d',database,'-v','ON_ERROR_STOP=1'],`SET timezone='UTC';SET search_path=public,pg_temp;${q}`).trim();}
const identifier=v=>'"'+v.replaceAll('"','""')+'"',literal=v=>"'"+v.replaceAll("'","''")+"'";
try{
 status('READONLY_PREFLIGHT_RUNNING');const before=collect(),second=collect(),privileges=JSON.parse(production(privilegesSql));assert.ok(same(before,second),'Live baseline changed during preflight');validateBefore(before,privileges);
 write(path.join(folder,'production-preflight.json'),{target,before,after:second,privileges});manifest.preflight_pass=true;status('READONLY_BACKUP_RUNNING');
 const mount=`type=bind,source=${folder},target=/backup`;
 run(['run','--rm',...connection,'--mount',mount,'postgres:17','pg_dump','--format=custom','--lock-wait-timeout=10000','--file=/backup/database.dump'],undefined,{timeout:600000});
 const toc=run(['run','--rm','--network','none','--mount',mount+',readonly','postgres:17','pg_restore','--list','/backup/database.dump']);fs.writeFileSync(path.join(folder,'database.toc.txt'),toc);
 manifest.database_backup_created=true;manifest.sha256=hash(fs.readFileSync(path.join(folder,'database.dump')));manifest.bytes=fs.statSync(path.join(folder,'database.dump')).size;
 const afterDump=collect();assert.ok(same(before,afterDump),'Live database changed during backup; new verified backup required');manifest.post_dump_baseline=afterDump;write(path.join(folder,'manifest.json'),manifest);status('OFFLINE_RESTORE_VERIFICATION_RUNNING');
 clone=`harmas-ofissio-restore-${stamp.slice(0,8)}-${suffix}`;
 run(['run','-d','--name',clone,'--network','none','--label','harmas.task=ofissio-backup-restore','--mount',mount+',readonly','--env','POSTGRES_PASSWORD','public.ecr.aws/supabase/postgres:17.11.0.011','postgres','-D','/etc/postgresql','-c','shared_preload_libraries=pg_stat_statements,pg_net,pg_cron','-c','cron.database_name=ofissio_restore','-c','cron.launch_active_jobs=off'],undefined,{env:{...process.env,POSTGRES_PASSWORD:randomUUID()}});
 write(path.join(folder,'restore-container.json'),{name:clone,network:'none',published_ports:[],backup:folder});
 let ready=false;for(let i=0;i<60;i++){const r=spawnSync('docker',['exec',clone,'pg_isready','-h','127.0.0.1','-U','postgres','-d','postgres'],{encoding:'utf8',timeout:5000});if(r.status===0){ready=true;break;}await new Promise(r=>setTimeout(r,1000));}assert.ok(ready,'Offline clone server not ready');
 const config=JSON.parse(run(['inspect',clone]))[0];assert.equal(config.HostConfig.NetworkMode,'none');assert.equal(config.Config.Labels['harmas.task'],'ofissio-backup-restore');assert.equal(Object.keys(config.HostConfig.PortBindings||{}).length,0);
 const schema=run(['exec',clone,'pg_restore','--schema-only','--file=-','/backup/database.dump']);
 const roles=[...new Set([...schema.matchAll(/^(?:GRANT[^\r\n]+ TO|REVOKE[^\r\n]+ FROM|ALTER[^\r\n]+ OWNER TO) ([a-z_][a-z_0-9]*);/gm)].map(m=>m[1]))].filter(r=>r!=='PUBLIC');
 for(const r of roles)assert.match(r,/^(?:supabase_[a-z_]+|postgres|pgbouncer|anon|authenticated|authenticator|service_role|dashboard_user|pg_database_owner|pgsodium_[a-z_]+)$/);
 local(roles.map(r=>`DO $b$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname=${literal(r)}) THEN CREATE ROLE ${identifier(r)} NOLOGIN;END IF;END $b$;`).join('\n'),'postgres');
 local('CREATE DATABASE ofissio_restore OWNER supabase_admin TEMPLATE template0;','postgres');
 run(['exec',clone,'pg_restore','--exit-on-error','-U','supabase_admin','-d','ofissio_restore','/backup/database.dump'],undefined,{timeout:600000});
 const restored=JSON.parse(local(`BEGIN READ ONLY;${snapshotSql};ROLLBACK;`));validateBefore(restored,JSON.parse(local(privilegesSql)));
 const canonicalPolicies=before.policies.map((p,i)=>{const a=restored.policies[i];assert.ok(same({...p,qual:null,with_check:null},{...a,qual:null,with_check:null}),'Restore policy identity/ACL changed');if(p.qual===a.qual&&p.with_check===a.with_check)return p;
  const normalized=JSON.parse(local(`BEGIN;CREATE POLICY __ofissio_expected ON ${identifier(p.schemaname)}.${identifier(p.tablename)} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.map(identifier).join(',')}${p.qual?' USING ('+p.qual+')':''}${p.with_check?' WITH CHECK ('+p.with_check+')':''};SELECT jsonb_build_object('qual',qual,'with_check',with_check) FROM pg_policies WHERE schemaname=${literal(p.schemaname)} AND tablename=${literal(p.tablename)} AND policyname='__ofissio_expected';ROLLBACK;`));return{...p,...normalized};});
 const expectedRestore={...before,policies:canonicalPolicies};
 // Canonical view deparse on this engine; no live SQL is executed.
 if(!same(restored.map_view,expectedRestore.map_view)){
  const archive=fs.readFileSync('supabase/migrations/202611100001_vendor_candidate_archive.sql','utf8'),start=archive.indexOf('CREATE OR REPLACE VIEW public.vendor_map_points ');assert.ok(start>=0);
  const sql=archive.slice(start,archive.indexOf(';',start)+1),normalized=JSON.parse(local(`BEGIN;${sql} SELECT to_jsonb(pg_get_viewdef('public.vendor_map_points'::regclass,true));ROLLBACK;`));assert.equal(restored.map_view.definition,normalized);expectedRestore.map_view={...expectedRestore.map_view,definition:normalized};
 }
 assert.ok(same(stable(restored),stable(expectedRestore)),'Restored data/functions/ACL/RLS differ from live backup baseline');
 const data=run(['exec',clone,'pg_restore','--data-only','--file=-','/backup/database.dump']),lines=data.split(/\r?\n/);let tables=0,rows=0;
 for(let i=0;i<lines.length;i++){const m=lines[i].match(/^COPY ([a-z_][a-z_0-9]*\.[a-z_][a-z_0-9]*) \(([A-Za-z_0-9", ]+)\) FROM stdin;$/);if(!m)continue;const expected=[];while(++i<lines.length&&lines[i]!=='\\.')expected.push(lines[i]);assert.equal(lines[i],'\\.');
  const out=run(['exec','-i',clone,'psql','-X','-q','-A','-t','-U','supabase_admin','-d','ofissio_restore','-v','ON_ERROR_STOP=1'],`BEGIN READ ONLY;SET LOCAL timezone='UTC';SET LOCAL extra_float_digits=3;COPY (SELECT ${m[2]} FROM ${m[1]}) TO STDOUT;ROLLBACK;`),actual=out.split(/\r?\n/);if(actual.at(-1)==='')actual.pop();assert.equal(actual.length,expected.length,m[1]+' row count');assert.equal(hash(JSON.stringify(actual.sort())),hash(JSON.stringify(expected.sort())),m[1]+' COPY checksum');tables++;rows+=actual.length;
 }
 assert.ok(tables>=90);manifest.application_restore_verified=true;manifest.logical_restore_tables=tables;manifest.logical_restore_rows=rows;
 const cloneBefore=JSON.parse(local(`BEGIN READ ONLY;${snapshotSql};ROLLBACK;`)),stale=structuredClone(cloneBefore);stale.baseline.vendors.checksum='stale-test-only';
 const blocked=spawnSync('docker',['exec','-i',clone,'psql','-X','-q','-A','-t','-U','supabase_admin','-d','ofissio_restore','-v','ON_ERROR_STOP=1'],{input:instrument(stale,{database:'ofissio_restore'}),encoding:'utf8'});assert.notEqual(blocked.status,0);assert.match(blocked.stderr,/Baseline changed/);
 local(instrument(cloneBefore,{database:'ofissio_restore'}));const afterClone=JSON.parse(local(`BEGIN READ ONLY;${snapshotSql};ROLLBACK;`));validateAfter(cloneBefore,afterClone);validateChecks(JSON.parse(local(postChecksSql)));
 // Idempotency replay is offline only; production never receives this SQL from this driver.
 for(const {sql}of source)local(sql);validateAfter(cloneBefore,JSON.parse(local(`BEGIN READ ONLY;${snapshotSql};ROLLBACK;`)));
 local(fs.readFileSync('supabase/rollbacks/202611110003_vendor_sample_ofissio_references_rollback.sql','utf8'));local(fs.readFileSync('supabase/rollbacks/202611110003_vendor_sample_ofissio_references_rollback.sql','utf8'));
 const rollbackState=JSON.parse(local(`BEGIN READ ONLY;${snapshotSql};ROLLBACK;`));assert.ok(same(stable(rollbackState),stable(cloneBefore)),'Clone rollback changed existing baseline');assert.equal(rollbackState.catalog_objects.length,0);manifest.migrations_and_rollbacks_twice_offline=true;manifest.stale_transaction_rejected=true;manifest.rollback_retains_empty_private_buckets=true;
 status('STORAGE_BACKUP_RUNNING');const objects=JSON.parse(local("SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'bucket',o.bucket_id,'name',o.name,'metadata',o.metadata,'public',b.public) ORDER BY o.bucket_id,o.name),'[]') FROM storage.objects o JOIN storage.buckets b ON b.id=o.bucket_id;"));
 const privateObjects=objects.filter(o=>!o.public);
 write(path.join(folder,'storage-object-inventory.json'),{target,objects});
 const storage=await backupStorageObjects({target,folder,objects});Object.assign(manifest,storage);if(storage.storage_blob_backup_verified)delete manifest.storage_limit;
 const fresh=collect();assert.ok(same(before,fresh),'Live database changed during verification; refresh backup before migration');
 manifest.verified_at=new Date().toISOString();write(path.join(folder,'manifest.json'),manifest);if(manifest.storage_blob_backup_verified)rememberVerifiedStorageBackup({target,folder});
 const summary={checked_at:manifest.verified_at,target,backup_directory:folder,database_dump_sha256:manifest.sha256,logical_restore_tables:tables,logical_restore_rows:rows,baseline_tables_verified:27,existing_data_and_security_unchanged:true,migrations_rehearsed_offline:true,production_migration_executed:false,production_write_requests:0,storage_blob_backup_verified:manifest.storage_blob_backup_verified,private_storage_objects:privateObjects.length,supabase_platform_restore_complete:false,migration_approved:fs.existsSync('.vercel/ofissio-migration-approval.json')&&JSON.parse(fs.readFileSync('.vercel/ofissio-migration-approval.json')).explicit_user_approval===true};
 fs.mkdirSync('docs/vendor-management/ofissio-catalog-evidence',{recursive:true});write('docs/vendor-management/ofissio-catalog-evidence/BACKUP_READINESS.json',summary);
 status(!manifest.storage_blob_backup_verified?'PRIVATE_STORAGE_BACKUP_REQUIRED':'BACKUP_VERIFIED_WAITING_FOR_EXPLICIT_MIGRATION_APPROVAL',{report_file:'docs/vendor-management/ofissio-catalog-evidence/BACKUP_READINESS.json'});
}catch(error){manifest.failure=error.message;status('PREPARATION_STOPPED_NO_PRODUCTION_WRITE',{message:error.message});process.exitCode=1;}
finally{if(clone){try{run(['stop',clone],undefined,{timeout:30000});manifest.restore_container=clone;manifest.restore_container_stopped=true;}catch{manifest.restore_container_stopped=false;}}manifest.finished_at=new Date().toISOString();write(path.join(folder,'manifest.json'),manifest);}
