// GET saja, publishable key frontend; tidak login/membuat akun atau fixture produksi.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
const env=parseEnv(fs.readFileSync('.env','utf8'));
const origin='https://uwlxkwyauxwewoexfgwi.supabase.co';
assert.equal(env.VITE_SUPABASE_URL,origin);
const key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.ok(key?.startsWith('sb_publishable_')||JSON.parse(Buffer.from(key?.split('.')[1]||'','base64url')).role==='anon','Hanya key publik frontend');
const headers={apikey:key};
const checks=[];
for(const table of ['vendor_locations','vendor_location_photos','vendor_map_points']) {
 const response=await fetch(`${origin}/rest/v1/${table}?select=*&limit=1`,{headers,redirect:'manual'});
 assert.ok([401,403].includes(response.status),`Akses anon harus ditolak: ${table}`);
 checks.push({check:`anonymous_${table}_denied`,http_status:response.status,pass:true});
}
const reader=await fetch(`${origin}/rest/v1/rpc/vendor_photo_reader`,{headers,redirect:'manual'});
assert.equal(reader.status,200);assert.equal(await reader.json(),false);
checks.push({check:'anonymous_photo_reader_false',http_status:200,pass:true});
const auth=await fetch(`${origin}/auth/v1/settings`,{headers,redirect:'manual'});assert.equal(auth.status,200);
checks.push({check:'public_auth_configuration',http_status:200,pass:true});
const summary=JSON.parse(fs.readFileSync('docs/vendor-management/phase3-evidence/ACTIVATION_BACKUP_SUMMARY.json','utf8'));
const backup=fs.realpathSync(summary.backup_directory).replaceAll('\\','/');
assert.match(backup,/^D:\/Backups\/harmas-pre-phase3-\d{8}-\d{6}-[a-f0-9]{8}$/);
const blobs=JSON.parse(fs.readFileSync(`${backup}/storage-backup-manifest.json`,'utf8')).objects;
for(const bucket of ['assets','employee-photos','maintenance-photos','ppm-documents']) {
 const sample=blobs.find(b=>b.bucket===bucket);assert.ok(sample);
 assert.ok(sample.name.split('/').every(p=>p!=='.'&&p!=='..'));
 const url=`${origin}/storage/v1/object/public/${[sample.bucket,...sample.name.split('/')].map(encodeURIComponent).join('/')}`;
 const response=await fetch(url,{redirect:'manual'});assert.equal(response.status,200);
 const digest=createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
 assert.equal(digest,sample.sha256,'Isi file existing berubah');
 checks.push({check:'existing_public_storage_sample',bucket,http_status:200,backup_hash_matches:true,pass:true});
}
const frontend='https://harmas-asset-management.vercel.app';
const page=await fetch(`${frontend}/vendor/map`);assert.equal(page.status,200);
const html=await page.text(),entry=html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
assert.equal(entry,'/assets/index-Bv4kaRUk.js');checks.push({check:'frontend_map_route',http_status:200,pass:true});
const bundle=await fetch(frontend+entry);assert.equal(bundle.status,200);
assert.equal(createHash('sha256').update(Buffer.from(await bundle.arrayBuffer())).digest('hex'),'c8e8d766625be31675c730f4c39e8cf4bfce0ee20284be8613ae77556419a790');
checks.push({check:'frontend_release_unchanged',http_status:200,pass:true});
const report={checked_at:new Date().toISOString(),mode:'Anonymous read-only HTTP GET',checks,write_requests:0,new_accounts:0,authenticated_production_business_uat:false,real_osm_tiles_tested:false,status:'PASS'};
fs.writeFileSync('docs/vendor-management/phase3-evidence/PRODUCTION_HTTP_POST_ACTIVATION.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
