// Release transaction rehearsal on the isolated synthetic Docker stack; no production credential.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {snapshotSql,validateBefore,validateAfter,instrumentMigration,migration,rollback,same} from './vendor-candidate-archive-release-checks.mjs';
const db='supabase_db_harmas-vendor-test',checks=[];
const sql=q=>spawnSync('docker',['exec','-i',db,'psql','-X','-q','-A','-t','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:`SET timezone='UTC';SET search_path=public,pg_temp;\n${q}`,encoding:'utf8',maxBuffer:16e6});
const collect=()=>{const r=sql(`BEGIN READ ONLY;${snapshotSql};ROLLBACK;`);assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
const before=collect();validateBefore(before);
const pass=check=>{checks.push({check,pass:true});console.log('PASS | '+check);};
function denied(name,command,pattern){const r=sql(command);assert.notEqual(r.status,0,name);assert.match(r.stderr,pattern);assert.ok(same(collect(),before),'Failed transaction must restore all snapshot metadata and checksums');pass(name);}
try {
 pass('Read-only snapshot covers 18 tables, DDL permissions, baseline function bodies and active security guards');
 const stale=structuredClone(before);stale.baseline.vendors.checksum='stale-local-test-only';denied('Stale baseline aborts before DDL',instrumentMigration(stale),/Baseline changed/);
 denied('Wrong database aborts before DDL',instrumentMigration(before,{database:'archive_restore'}),/Executor\/database mismatch/);
 denied('Wrong executor aborts before DDL',instrumentMigration(before,{executor:'supabase_admin'}),/Executor\/database mismatch/);
 const guarded=instrumentMigration(before);
 denied('Deliberate RLS weakening inside migration rolls back the entire transaction',guarded.replace('DO $archive_post$', 'ALTER TABLE public.vendor_candidates DISABLE ROW LEVEL SECURITY;\nDO $archive_post$'),/Existing data\/security changed/);
 const valid=sql(guarded+"\nSELECT 'LOCAL_ARCHIVE_COMMIT_CONFIRMED';");assert.equal(valid.status,0,valid.stderr);assert.match(valid.stdout,/LOCAL_ARCHIVE_COMMIT_CONFIRMED/);validateAfter(before,collect());pass('Guarded migration commits only with preserved data/security and valid archive ACL/objects');
 const twice=sql(migration);assert.equal(twice.status,0,twice.stderr);validateAfter(before,collect());pass('Second idempotent migration preserves baseline and validated archive state');
} catch(error){checks.push({check:error.message,pass:false});throw error;}
finally {
 const r=sql(rollback);assert.equal(r.status,0,r.stderr);const again=sql(rollback);assert.equal(again.status,0,again.stderr);
 const unchanged=same(collect(),before);checks.push({check:'Rollback twice restores the exact snapshot of 18 tables, functions, views, triggers and RLS',pass:unchanged});
 fs.writeFileSync('docs/vendor-management/candidate-archive-evidence/RELEASE_TRANSACTION_TEST_RESULTS.json',JSON.stringify({checked_at:new Date().toISOString(),target:'Synthetic Docker only',production_accessed:false,checks},null,2)+'\n');assert.ok(unchanged);
}
