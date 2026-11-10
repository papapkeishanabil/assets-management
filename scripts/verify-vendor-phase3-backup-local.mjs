// Verifikasi restore lokal saja. Tidak mempunyai koneksi produksi atau kredensialnya.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const info = JSON.parse(readFileSync('.vercel/phase3-restore-container.json','utf8'));
assert.match(info.name,/^harmas-vendor-restore-phase3-\d{8}-[a-f0-9]{8}$/);
const backup = realpathSync(info.backup).replaceAll('\\','/');
assert.match(backup,/^D:\/Backups\/harmas-pre-phase3-\d{8}-\d{6}-[a-f0-9]{8}$/);
assert.equal(info.name.split('-').at(-2),backup.split('-').at(-3),'Tanggal clone/backup berbeda');
function docker(args,input) {
  const r = spawnSync('docker',args,{input,encoding:'utf8',maxBuffer:32e6});
  assert.equal(r.status,0,`Docker restore command gagal: ${r.stderr?.slice(0,1200)}`); return r.stdout;
}
const config = JSON.parse(docker(['inspect',info.name]))[0];
assert.equal(config.HostConfig.NetworkMode,'none');
assert.equal(config.Config.Labels['harmas.task'],'vendor-phase3-backup-restore');
assert.ok(!config.HostConfig.PortBindings || Object.keys(config.HostConfig.PortBindings).length===0);
assert.ok(config.Mounts.some(m=>m.Destination==='/backup'&&!m.RW&&m.Source.replaceAll('\\','/')===backup),'Mount backup harus read-only dan sesuai target');
function sql(input,user='supabase_admin') {
  return docker(['exec','-i',info.name,'psql','-X','-q','-A','-t','-U',user,'-d','phase3_restore','-v','ON_ERROR_STOP=1'],`SET search_path=public,pg_temp;\n${input}`);
}
const hash = (v) => createHash('sha256').update(v).digest('hex');
const manifest = JSON.parse(readFileSync(`${backup}/manifest.json`,'utf8'));
assert.equal(manifest.target,'https://uwlxkwyauxwewoexfgwi.supabase.co');
const source = JSON.parse(readFileSync(`${backup}/production-preflight.json`,'utf8'));
assert.equal(hash(readFileSync(`${backup}/database.dump`)),manifest.sha256);
const same=(a,b,label)=>assert.ok(isDeepStrictEqual(a,b),label);
same(source.before,source.after,'Snapshot preflight tidak stabil');
same(source.after,manifest.post_dump_baseline,'Produksi berubah saat backup; baseline restore perlu ditinjau');
const query = readFileSync('scripts/sql/vendor-phase3-preflight-readonly.sql','utf8');
const restored = JSON.parse(sql(`BEGIN READ ONLY; ${query}; ROLLBACK;`));
same(restored.baseline,source.before.baseline,'Checksum 17 tabel hasil restore berbeda');
same(restored.functions,source.before.functions,'Helper/guard/ACL hasil restore berbeda');
// PG 17.6 dan 17.11 dapat mendeparse cast ARRAY secara berbeda. Reparse
// ekspresi sumber di engine restore yang sama, lalu bandingkan hasil kanonik.
// Policy sementara hanya di clone lokal dan selalu ROLLBACK.
const identifier=(v)=>'"'+v.replaceAll('"','""')+'"';
const literal=(v)=>"'"+v.replaceAll("'","''")+"'";
let canonicalizedPolicies=0;
const expectedPolicies=source.before.policies.map((p,index)=>{
  const actual=restored.policies[index];assert.ok(actual,'Policy restore hilang');
  same({...actual,qual:null,with_check:null},{...p,qual:null,with_check:null},'Identitas/role policy berubah');
  if(p.qual===actual.qual&&p.with_check===actual.with_check)return p;
  const name='__phase3_backup_expected';
  const command=`CREATE POLICY ${identifier(name)} ON ${identifier(p.schemaname)}.${identifier(p.tablename)} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.map(identifier).join(',')}${p.qual?' USING ('+p.qual+')':''}${p.with_check?' WITH CHECK ('+p.with_check+')':''};`;
  const normalized=JSON.parse(sql(`BEGIN; ${command} SELECT jsonb_build_object('qual',qual,'with_check',with_check) FROM pg_policies WHERE schemaname=${literal(p.schemaname)} AND tablename=${literal(p.tablename)} AND policyname=${literal(name)}; ROLLBACK;`));
  canonicalizedPolicies++;return {...p,...normalized};
});
same(restored.policies,expectedPolicies,'RLS/policy hasil restore berbeda sesudah canonical parse');
same(restored.triggers,source.before.triggers,'Trigger hasil restore berbeda');
assert.equal(restored.asset_vendor_orphans,0);
console.log('PASS | Hash dump, 17 baseline, 11 fungsi/ACL, policy dan trigger restore cocok');

// Baca COPY archive hanya di memori; jangan mencetak data Auth/pribadi.
const dataSql = docker(['exec',info.name,'pg_restore','--data-only','--file=-','/backup/database.dump']);
const lines = dataSql.split(/\r?\n/), copies = [];
for (let n=0;n<lines.length;n++) {
  const match = lines[n].match(/^COPY ([a-z_][a-z_0-9]*\.[a-z_][a-z_0-9]*) \(([A-Za-z_0-9", ]+)\) FROM stdin;$/);
  if (!match) continue;
  const rows=[]; while (++n<lines.length && lines[n]!=='\\.') rows.push(lines[n]);
  assert.equal(lines[n],'\\.','COPY archive tidak lengkap');
  copies.push({table:match[1],columns:match[2],rows});
}
assert.ok(copies.length>=90,'COPY archive tidak lengkap');
const dataChecks=[];
for (const copy of copies) {
  const out = sql(`BEGIN READ ONLY; SET LOCAL timezone='UTC'; SET LOCAL extra_float_digits=3; COPY (SELECT ${copy.columns} FROM ${copy.table}) TO STDOUT; ROLLBACK;`);
  const actual = out.split(/\r?\n/); if(actual.at(-1)==='')actual.pop();
  const sourceHash=hash(JSON.stringify(copy.rows.sort())),actualHash=hash(JSON.stringify(actual.sort()));
  assert.equal(actual.length,copy.rows.length,`Jumlah COPY berbeda: ${copy.table}`);
  assert.equal(actualHash,sourceHash,`Isi COPY berbeda: ${copy.table}`);
  dataChecks.push({table:copy.table,rows:actual.length,sha256:actualHash});
  if(dataChecks.length%25===0) console.log(`PASS | Isi COPY ${dataChecks.length}/${copies.length} tabel cocok`);
}
const toc = readFileSync(`${backup}/database.toc.txt`,'utf8');
const counts = JSON.parse(sql(`SELECT jsonb_build_object(
 'public_tables',(SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p')),
 'public_foreign_keys',(SELECT count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='f'),
 'public_policies',(SELECT count(*) FROM pg_policies WHERE schemaname='public'),
 'public_triggers',(SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal),
 'cron_launch_active_jobs',current_setting('cron.launch_active_jobs'));`));
for(const [key,pattern] of [['public_tables',/\d+; \d+ \d+ TABLE public /g],['public_foreign_keys',/\d+; \d+ \d+ FK CONSTRAINT public /g],['public_policies',/\d+; \d+ \d+ POLICY public /g],['public_triggers',/\d+; \d+ \d+ TRIGGER public /g]]) {
  assert.equal(counts[key],[...toc.matchAll(pattern)].length,`Jumlah objek restore berbeda: ${key}`);
}
assert.equal(counts.cron_launch_active_jobs,'off');
console.log(`PASS | Seluruh ${copies.length} COPY tabel dan jumlah objek aplikasi cocok dengan archive`);

const migration=readFileSync('supabase/migrations/202611090001_vendor_management_phase3.sql','utf8');
// Image bootstrap tidak memulihkan membership role global produksi. Gunakan
// administrator clone yang tersedia, tanpa menaikkan privilege role postgres.
sql(migration); sql(migration);
const after=JSON.parse(sql(`BEGIN READ ONLY; ${query}; ROLLBACK;`));
same(after.baseline,restored.baseline,'Migration lokal mengubah 17 tabel existing');
same(after.functions,restored.functions,'Migration lokal mengubah helper existing');
const oldPolicies=after.policies.filter(p=>!['vendor_locations','vendor_location_photos'].includes(p.tablename)&&!(p.schemaname==='storage'&&p.policyname.startsWith('Vendor storage ')));
same(oldPolicies,restored.policies,'Migration lokal mengubah policy existing');
same(after.buckets.filter(b=>b.id!=='vendor-photos'),restored.buckets,'Bucket existing berubah');
console.log('PASS | Migration Fase 3 dua kali pada hasil restore; data/helper/policy existing utuh');
const report={checked_at:new Date().toISOString(),container:info.name,network:'none',published_ports:[],backup_sha256:manifest.sha256,
 pg_restore_exit:0,logical_database_restore_verified:true,copy_tables_verified:copies.length,total_rows_verified:dataChecks.reduce((n,t)=>n+t.rows,0),counts,
 baseline_tables_verified:17,existing_functions_and_acl_verified:11,policies_canonicalized_for_minor_pg_version:canonicalizedPolicies,migration_phase3_local_applied_twice:true,local_migration_executor:'supabase_admin',existing_data_and_security_unchanged:true,
 supabase_platform_restore_complete:false,platform_limit:'Role bootstrap tersedia lokal; layanan Auth/Storage/Gateway, konfigurasi eksternal dan kunci platform tidak dipulihkan sebagai stack penuh.',
 storage_blob_backup_verified:false,production_migration_executed:false,data_checks:dataChecks};
writeFileSync(`${backup}/restore-verification.json`,JSON.stringify(report,null,2)+'\n');
writeFileSync('docs/vendor-management/phase3-evidence/BACKUP_RESTORE_VERIFICATION.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({logical_restore_verified:true,tables:copies.length,rows:report.total_rows_verified,counts,production_migration_executed:false}));
