// Hanya loopback dan fixture Docker sintetis. Tidak membaca .env produksi.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const api='http://127.0.0.1:54321',origin='http://127.0.0.1:7016',db='supabase_db_harmas-vendor-test';
assert.ok(process.env.HARMAS_LOCAL_TEST_PASSWORD);
const docker=(args,input)=>{const r=spawnSync('docker',args,{input,encoding:'utf8',maxBuffer:8e6});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const sql=input=>docker(['exec','-i',db,'psql','-X','-q','-A','-t','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],input);
const kong=docker(['exec','supabase_kong_harmas-vendor-test','cat','/home/kong/kong.yml']);
const key=kong.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];assert.ok(key);
const stamp=randomUUID().slice(0,8),codes=['A','B','C','D'].map(s=>`MLOC-${stamp}-${s}`),ids=[randomUUID(),randomUUID()];
const name='[MASTER-MAP] Vendor Aktif';
const countCandidate=id=>Number(sql(`SELECT count(*) FROM public.vendor_candidates WHERE vendor_id='${id}';`));
const masterHash=()=>sql("SELECT md5(jsonb_agg(to_jsonb(v) ORDER BY id)::text) FROM public.vendors v;");
const snapshot=()=>sql(`SELECT jsonb_object_agg(name,hash) FROM (${['vendors','assets','user_profiles','roles','role_permissions','notifications'].map(t=>`SELECT '${t}' name,md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) hash FROM public.${t} x`).join(' UNION ALL ')}) q;`);
const before=snapshot(),results=[],errors=[],external=[];let server,browser,page;
const dir='docs/vendor-management/phase3-evidence';mkdirSync(dir,{recursive:true});
const pass=check=>{results.push({check,pass:true});console.log(`PASS | ${check}`);};
sql(`INSERT INTO public.vendors(id,vendor_code,vendor_name,address,city,is_active) VALUES('${ids[0]}','${codes[0]}','${name}','Jalan Master Uji 1','Bandung',true),('${ids[1]}','${codes[1]}','[MASTER-MAP] Nonaktif','Jalan Master Uji 2','Bandung',false);`);
const tile='<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e2e8f0"/><text x="12" y="24" fill="#64748b">TEST TILE</text></svg>';
try {
 const {createServer}=await import('vite');
 server=await createServer({envFile:false,define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(api),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify(key),'import.meta.env.VITE_VENDOR_MAP_TILE_URL':'""','import.meta.env.VITE_VENDOR_MAP_TILE_CREDIT':'""'},server:{host:'127.0.0.1',port:7016,strictPort:true},clearScreen:false});await server.listen();
 const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_PACKAGE_PATH).href);browser=await chromium.launch({headless:true});
 async function contextFor(email) {
  const r=await fetch(`${api}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email,password:process.env.HARMAS_LOCAL_TEST_PASSWORD})});assert.equal(r.status,200);
  const auth=await r.json(),ctx=await browser.newContext({viewport:{width:1440,height:1000}}),requests=[];
  await ctx.addInitScript(value=>localStorage.setItem('sb-127-auth-token',JSON.stringify(value)),auth);
  await ctx.route('**/*',route=>{const host=new URL(route.request().url()).hostname;if(['127.0.0.1','localhost'].includes(host))return route.continue();if(host==='tile.openstreetmap.org')return route.fulfill({contentType:'image/svg+xml',body:tile});external.push(host);return route.abort();});
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.url().startsWith(api))requests.push({path:new URL(r.url()).pathname,method:r.method()});});return {ctx,page:p,requests};
 }
 const admin=await contextFor('superadmin.test@harmas.local');page=admin.page;
 const dialog=()=>page.getByRole('dialog',{name:'Edit Vendor',exact:true});
 const locationForm=()=>page.getByRole('dialog',{name:'Tambah Lokasi',exact:true});
 const candidate=()=>sql(`SELECT id FROM public.vendor_candidates WHERE vendor_id='${ids[0]}';`);
 async function openMaster(vendorName=name){await page.goto(`${origin}/vendors`);await page.getByRole('button',{name:`Lokasi & Koordinat ${vendorName}`,exact:true}).click();await dialog().getByRole('tab',{name:'Lokasi & Koordinat',exact:true}).waitFor();}
 async function addCoordinates(lat,lng,locationName='Lokasi Utama') {await dialog().getByRole('button',{name:'Tambah Lokasi',exact:true}).click();const d=locationForm();await d.getByLabel('Nama lokasi *',{exact:true}).fill(locationName);await d.getByLabel('Latitude',{exact:true}).fill(lat);await d.getByLabel('Longitude',{exact:true}).fill(lng);return d;}
 async function save(d,locationName='Lokasi Utama'){await d.getByRole('button',{name:'Simpan Lokasi',exact:true}).click();await d.waitFor({state:'detached'});await dialog().getByRole('heading',{name:locationName,exact:true}).waitFor();}
 const unchanged=masterHash();
 await openMaster();await dialog().getByText('Belum ada lokasi vendor.',{exact:false}).waitFor();assert.equal(countCandidate(ids[0]),0);await dialog().getByRole('button',{name:'Tutup vendor',exact:true}).click();assert.equal(countCandidate(ids[0]),0);assert.equal(masterHash(),unchanged);
 pass('Membuka/menutup koordinat Master Vendor tidak menulis profil terhubung atau master');
 await openMaster();let d=await addCoordinates('-6.92','');assert.equal(await d.getByLabel('Alamat jalan / nomor',{exact:true}).inputValue(),'Jalan Master Uji 1');assert.equal(await d.getByLabel('Kota / kabupaten',{exact:true}).inputValue(),'Bandung');
 await d.getByRole('button',{name:'Simpan Lokasi',exact:true}).click();await page.getByText(/Latitude dan longitude harus diisi berpasangan/).waitFor();assert.equal(countCandidate(ids[0]),0);await d.getByRole('button',{name:'Batal',exact:true}).click();assert.equal(countCandidate(ids[0]),0);
 pass('Alamat master menjadi draf; koordinat parsial dan pembatalan tidak membuat data');
 d=await addCoordinates('-6.92','107.62');await save(d);
 assert.equal(countCandidate(ids[0]),1);assert.equal(sql(`SELECT count(*) FROM public.vendor_locations WHERE candidate_id='${candidate()}';`),'1');assert.equal(masterHash(),unchanged);
 assert.equal(await page.evaluate(()=>document.querySelectorAll('form form').length),0);
 pass('Simpan koordinat langsung di Master Vendor membuat satu link/lokasi/audit tanpa menulis master atau nested form');
 await page.reload();await page.getByRole('button',{name:`Lokasi & Koordinat ${name}`,exact:true}).click();await dialog().getByRole('heading',{name:'Lokasi Utama',exact:true}).waitFor();assert.equal(countCandidate(ids[0]),1);
 await dialog().getByRole('button',{name:'Edit lokasi',exact:true}).click();d=page.getByRole('dialog',{name:'Edit Lokasi',exact:true});assert.equal(await d.getByLabel('Latitude',{exact:true}).inputValue(),'-6.92');await d.getByLabel('Latitude',{exact:true}).fill('-6.921');await save(d);
 let route=new URL(await dialog().getByRole('link',{name:'Rute ke Lokasi',exact:true}).getAttribute('href'));assert.equal(route.searchParams.get('destination'),'-6.921,107.62');assert.equal(masterHash(),unchanged);
 pass('Buka ulang memakai link yang sama; edit koordinat memperbarui tujuan rute dan master tetap identik');
 d=await addCoordinates('-6.93','107.63','Gudang Master');await d.getByLabel('Jenis fasilitas *').selectOption('GUDANG');await save(d,'Gudang Master');assert.equal(sql(`SELECT count(*),count(*) FILTER(WHERE is_primary) FROM public.vendor_locations WHERE candidate_id='${candidate()}';`),'2|1');
 pass('Beberapa fasilitas pada Master Vendor memakai kandidat yang sama dan hanya satu primary');
 await dialog().getByRole('tab',{name:'Profil Vendor',exact:true}).click();await dialog().getByLabel('Alamat',{exact:true}).fill('Draf belum disimpan');await dialog().getByRole('tab',{name:'Profil Vendor',exact:true}).press('ArrowRight');assert.equal(await dialog().getByRole('tab',{name:'Lokasi & Koordinat',exact:true}).getAttribute('aria-selected'),'true');await dialog().getByRole('tab',{name:'Lokasi & Koordinat',exact:true}).press('ArrowLeft');assert.equal(await dialog().getByLabel('Alamat',{exact:true}).inputValue(),'Draf belum disimpan');await dialog().getByRole('button',{name:'Batal',exact:true}).click();assert.equal(masterHash(),unchanged);
 pass('Tab keyboard bekerja dan draf profil tidak tersimpan saat mengelola lokasi');
 await page.goto(`${origin}/vendor/map`);await page.getByLabel('Cari nama vendor / fasilitas',{exact:true}).fill(name);await page.getByText('2 titik berkoordinat',{exact:true}).waitFor();assert.equal(await page.locator('tbody tr').count(),2);assert.equal(await page.locator('tbody').getByRole('link',{name:'Rute ke Lokasi',exact:true}).count(),2);
 pass('Lokasi yang diisi dari Master Vendor langsung tersedia pada Peta Vendor dan rute per fasilitas');
 await openMaster('[MASTER-MAP] Nonaktif');await dialog().getByText(/Vendor nonaktif belum dapat/).waitFor();assert.equal(await dialog().getByRole('button',{name:'Tambah Lokasi',exact:true}).count(),0);assert.equal(countCandidate(ids[1]),0);await dialog().getByRole('button',{name:'Tutup vendor',exact:true}).click();
 pass('Master nonaktif yang belum terhubung tidak bisa melewati guard retrofit');
 const hrd=await contextFor('hrd.test@harmas.local');await hrd.page.goto(`${origin}/vendors`);await hrd.page.getByRole('heading',{name:'Master Vendor',exact:true}).waitFor();await hrd.page.getByRole('button',{name:'Tambah Vendor',exact:true}).waitFor();assert.equal(await hrd.page.getByRole('button',{name:/Lokasi & Koordinat/}).count(),0);assert.ok(!hrd.requests.some(r=>/vendor_locations|vendor_candidates/.test(r.path)));await hrd.ctx.close();
 pass('HRD tanpa vendor_map tetap memakai Master Vendor tanpa kontrol atau request lokasi');
 for(const email of ['sourcing.test@harmas.local','direksi.test@harmas.local']){const restricted=await contextFor(email);await restricted.page.goto(`${origin}/vendors`);await restricted.page.waitForURL(`${origin}/dashboard`);await restricted.ctx.close();}
 pass('Guard halaman Master Vendor untuk Sourcing/Direksi tetap berlaku');
 await page.getByRole('button',{name:'Tambah Vendor',exact:true}).click();let profile=page.getByRole('dialog',{name:'Tambah Vendor',exact:true});await profile.getByLabel('Kode Vendor *',{exact:true}).fill(codes[2]);await profile.getByLabel('Nama Vendor *',{exact:true}).fill('[MASTER-MAP] Baru');await profile.getByLabel('Alamat',{exact:true}).fill('Jalan Baru');await profile.getByLabel('Kota',{exact:true}).fill('Bandung');await profile.getByRole('button',{name:'Simpan dan Isi Koordinat',exact:true}).click();await dialog().getByText(/Belum ada lokasi vendor/).waitFor();
 const newId=sql(`SELECT id FROM public.vendors WHERE vendor_code='${codes[2]}';`);assert.equal(countCandidate(newId),0);d=await addCoordinates('-6.94','107.64');await save(d);assert.equal(countCandidate(newId),1);await dialog().getByRole('button',{name:'Tutup vendor',exact:true}).click();
 pass('Vendor baru: Simpan dan Isi Koordinat menyimpan profil lalu melanjutkan lokasi di Master Vendor');
 await page.getByRole('button',{name:'Tambah Vendor',exact:true}).click();profile=page.getByRole('dialog',{name:'Tambah Vendor',exact:true});await profile.getByLabel('Kode Vendor *',{exact:true}).fill(codes[3]);await profile.getByLabel('Nama Vendor *',{exact:true}).fill('[MASTER-MAP] Simpan Biasa');await profile.getByLabel('Nama Vendor *',{exact:true}).press('Enter');await profile.waitFor({state:'detached'});const ordinaryId=sql(`SELECT id FROM public.vendors WHERE vendor_code='${codes[3]}';`);assert.ok(ordinaryId);assert.equal(countCandidate(ordinaryId),0);
 pass('Enter/Simpan biasa tetap menyimpan profil tanpa otomatis membuat link atau lokasi');
 await openMaster('[MASTER-MAP] Simpan Biasa');d=await addCoordinates('-6.95','107.65');
 const rpcPattern='**/rest/v1/rpc/vendor_link_existing_active';await page.route(rpcPattern,r=>r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({code:'XX000',message:'Uji RPC gagal lokal'})}));await d.getByRole('button',{name:'Simpan Lokasi',exact:true}).click();await page.getByText(/Uji RPC gagal lokal/).waitFor();assert.equal(countCandidate(ordinaryId),0);await page.unroute(rpcPattern);
 const postPattern='**/rest/v1/vendor_locations*';await page.route(postPattern,r=>r.request().method()==='POST'?r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({code:'XX000',message:'Uji lokasi gagal lokal'})}):r.continue());await d.getByRole('button',{name:'Simpan Lokasi',exact:true}).click();await page.getByText(/Uji lokasi gagal lokal/).waitFor();assert.equal(countCandidate(ordinaryId),1);const rpcCount=admin.requests.filter(r=>r.path.endsWith('vendor_link_existing_active')).length;await page.unroute(postPattern);await save(d);assert.equal(countCandidate(ordinaryId),1);assert.equal(admin.requests.filter(r=>r.path.endsWith('vendor_link_existing_active')).length,rpcCount);
 pass('RPC/insert gagal ditampilkan; retry memakai link yang sudah berhasil tanpa duplikasi');
 await dialog().getByRole('button',{name:'Tutup vendor',exact:true}).click();await openMaster();await dialog().getByRole('heading',{name:'Lokasi Utama',exact:true}).waitFor();await page.screenshot({path:`${dir}/master-vendor-coordinates-desktop.png`,fullPage:true,animations:'disabled'});
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.setAttribute('data-theme','light'));await page.waitForFunction(()=>document.getElementById('main-sidebar').getBoundingClientRect().right<=1);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await dialog().evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.screenshot({path:`${dir}/master-vendor-coordinates-mobile.png`,fullPage:true,animations:'disabled'});
 pass('Modal Master Vendor dengan lokasi/foto responsif pada mobile light 390px');
 assert.equal(errors.length,0,JSON.stringify(errors));assert.ok(!external.some(h=>h.endsWith('supabase.co')||h==='maps.googleapis.com'));
 pass('Tidak ada pageerror atau request ke Supabase/Google Maps produksi; tile OSM dimock');
} catch(error){results.push({check:error.message,pass:false});if(page&&!page.isClosed())await page.screenshot({path:`${dir}/master-vendor-coordinates-failure.png`,fullPage:true}).catch(()=>{});throw error;}
finally {
 await browser?.close();await server?.close();
 const owned=sql(`SELECT id FROM public.vendors WHERE vendor_code IN (${codes.map(c=>`'${c}'`).join(',')});`).split('\n').filter(Boolean);
 if(owned.length){const list=owned.map(id=>`'${id}'`).join(',');sql(`BEGIN;ALTER TABLE public.vendor_locations DISABLE TRIGGER trg_vendor_locations_guard;DELETE FROM public.vendor_locations WHERE candidate_id IN(SELECT id FROM public.vendor_candidates WHERE vendor_id IN(${list}));ALTER TABLE public.vendor_locations ENABLE TRIGGER trg_vendor_locations_guard;DELETE FROM public.vendor_candidates WHERE vendor_id IN(${list});DELETE FROM public.vendors WHERE id IN(${list});COMMIT;`);}
 assert.equal(snapshot(),before,'Cleanup harus mempertahankan data existing Docker');pass('Cleanup fixture Docker selesai; master/aset/profil/role/permission/notifikasi existing identik');
 writeFileSync(`${dir}/MASTER_VENDOR_LOCATION_BROWSER_RESULTS.json`,JSON.stringify({checked_at:new Date().toISOString(),target:'Docker synthetic + loopback only',production_database_writes:false,results},null,2)+'\n');
}
