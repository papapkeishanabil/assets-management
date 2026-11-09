// Backup blob existing yang PUBLIC. Inventaris dari restore lokal, bukan query produksi.
// Tidak memakai service key, tidak mengunggah/mengubah/menghapus file remote.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const info=JSON.parse(readFileSync('.vercel/phase3-restore-container.json','utf8'));
assert.match(info.name,/^harmas-vendor-restore-phase3-20261109-[a-f0-9]{8}$/);
const root=info.backup.replaceAll('\\','/');
assert.equal(root,'D:/Backups/harmas-pre-phase3-20261109-162946-b0c15d41');
const inspect=spawnSync('docker',['inspect',info.name],{encoding:'utf8'});assert.equal(inspect.status,0);
assert.equal(JSON.parse(inspect.stdout)[0].HostConfig.NetworkMode,'none');
const query=`SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'bucket',o.bucket_id,'name',o.name,'metadata',o.metadata,'public',b.public) ORDER BY o.bucket_id,o.name),'[]'::jsonb) FROM storage.objects o JOIN storage.buckets b ON b.id=o.bucket_id;`;
const result=spawnSync('docker',['exec','-i',info.name,'psql','-X','-q','-A','-t','-U','supabase_admin','-d','phase3_restore','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',maxBuffer:8e6});assert.equal(result.status,0);
const objects=JSON.parse(result.stdout);
assert.equal(objects.length,95,'Inventaris backup berubah');
assert.ok(objects.every(o=>o.public),'Ada file private: perlukan jalur backup berotorisasi terpisah');
const folder=`${root}/storage-blobs`;assert.ok(!existsSync(folder),'Direktori blob sudah ada; jangan menimpa backup sebelumnya');mkdirSync(folder);
const sha=v=>createHash('sha256').update(v).digest('hex');
const cleanEtag=v=>typeof v==='string'?v.replace(/^W\//,'').replaceAll('"','').toLowerCase():null;
const records=[];let cursor=0;
async function worker() {
  while(cursor<objects.length) {
    const object=objects[cursor++];
    assert.ok(object.name.split('/').every(p=>p!=='.'&&p!=='..'),'Path Storage tidak aman');
    const expected=Number(object.metadata?.size);assert.ok(Number.isSafeInteger(expected)&&expected>=0&&expected<50e6);
    const encoded=[object.bucket,...object.name.split('/')].map(encodeURIComponent).join('/');
    const url=`https://uwlxkwyauxwewoexfgwi.supabase.co/storage/v1/object/public/${encoded}`;
    const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(30000)});
    assert.equal(response.status,200,`Download gagal pada objek ${object.id}`);
    const chunks=[];let bytes=0;
    for await(const chunk of response.body){bytes+=chunk.length;assert.ok(bytes<=expected,`Ukuran versi file berubah: ${object.id}`);chunks.push(chunk);}
    assert.equal(bytes,expected,`Ukuran file tidak cocok: ${object.id}`);
    const body=Buffer.concat(chunks),expectedEtag=cleanEtag(object.metadata?.eTag||object.metadata?.etag),httpEtag=cleanEtag(response.headers.get('etag'));
    if(expectedEtag) {
      if(/^[a-f0-9]{32}$/.test(expectedEtag))assert.equal(createHash('md5').update(body).digest('hex'),expectedEtag,`Isi versi objek berubah: ${object.id}`);
      else assert.equal(httpEtag,expectedEtag,`ETag objek tidak cocok: ${object.id}`);
    }
    const file=sha(`${object.bucket}\0${object.name}`)+'.blob',digest=sha(body);
    writeFileSync(`${folder}/${file}`,body);assert.equal(sha(readFileSync(`${folder}/${file}`)),digest);
    records.push({id:object.id,bucket:object.bucket,name:object.name,bytes,sha256:digest,file,source_etag:expectedEtag,etag_verified:Boolean(expectedEtag)});
    if(records.length%20===0)console.log(`PASS | Blob ${records.length}/${objects.length} tersalin dan hash disk cocok`);
  }
}
await Promise.all([worker(),worker(),worker(),worker()]);
records.sort((a,b)=>a.file.localeCompare(b.file));
const privateManifest={checked_at:new Date().toISOString(),source:'public Storage downloads; metadata from verified local restore',objects:records};
const manifestText=JSON.stringify(privateManifest,null,2)+'\n';writeFileSync(`${root}/storage-backup-manifest.json`,manifestText);
const byBucket={};for(const r of records){byBucket[r.bucket]??={objects:0,bytes:0};byBucket[r.bucket].objects++;byBucket[r.bucket].bytes+=r.bytes;}
const summary={checked_at:privateManifest.checked_at,objects_verified:records.length,bytes_verified:records.reduce((n,r)=>n+r.bytes,0),etag_verified_objects:records.filter(r=>r.etag_verified).length,
 buckets:byBucket,private_file_objects:0,all_local_hashes_rechecked:true,inventory_manifest_sha256:sha(manifestText),storage_blob_backup_verified:true,
 restore_into_storage_service_verified:false,production_write_requests:0,production_migration_executed:false};
writeFileSync(`${root}/storage-backup-verification.json`,JSON.stringify(summary,null,2)+'\n');
writeFileSync('docs/vendor-management/phase3-evidence/STORAGE_BACKUP_VERIFICATION.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
