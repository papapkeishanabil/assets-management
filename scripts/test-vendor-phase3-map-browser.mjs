// Leaflet nyata; tile disimulasikan agar pengujian tidak membebani layanan publik OSM.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const origin='http://127.0.0.1:7014',results=[],errors=[],external=[],tiles=[];
const tile='<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e2e8f0"/><path d="M0 128H256M128 0V256" stroke="#cbd5e1"/><text x="12" y="24" fill="#64748b">TEST TILE</text></svg>';
const pass=label=>{results.push(`PASS | ${label}`);console.log(results.at(-1));};
let server,browser,tileMode='ok';
try {
  server=await createServer({envFile:false,define:{'import.meta.env.VITE_VENDOR_MAP_TILE_URL':'""','import.meta.env.VITE_VENDOR_MAP_TILE_CREDIT':'""'},plugins:[{name:'free-map-test',configureServer(vite){
    vite.middlewares.use('/__phase3_map_test',async(_req,res,next)=>{try{res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/__phase3_map_test','<!doctype html><div id="root"></div><script type="module" src="/scripts/fixtures/vendor-map-browser.jsx"></script>'));}catch(error){next(error);}});
  }}],server:{host:'127.0.0.1',port:7014,strictPort:true},clearScreen:false});await server.listen();
  const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_PACKAGE_PATH).href);browser=await chromium.launch({headless:true});const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(url.hostname==='127.0.0.1')return route.continue();
    if(url.hostname==='tile.openstreetmap.org'){tiles.push({path:url.pathname,query:url.search,referrer:req.headers().referer});return tileMode==='fail'?route.abort():route.fulfill({contentType:'image/svg+xml',body:tile,headers:{'Cache-Control':'public,max-age=604800'}});}
    external.push(url.hostname);return route.abort();});
  await page.goto(origin+'/__phase3_map_test');await page.waitForFunction(()=>document.querySelectorAll('.leaflet-marker-icon').length===2);
  assert.ok(await page.locator('.leaflet-tile-loaded').count()>0);assert.equal(await page.getByRole('link',{name:'OpenStreetMap contributors',exact:true}).count(),1);pass('Leaflet nyata menampilkan tile dan dua pin tanpa API key; atribusi terlihat');
  await page.getByTitle('Vendor B · Gudang',{exact:true}).click();assert.equal(await page.getByLabel('Pilihan vendor').textContent(),'b');pass('Klik pin memilih fasilitas yang tepat');
  await page.getByRole('button',{name:'Banyak titik',exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('.vendor-map-cluster')].reduce((sum,e)=>sum+Number(e.textContent),0)===1005);
  assert.ok(await page.locator('.leaflet-marker-icon').count()<100);pass('Seluruh 1005 fasilitas terwakili dalam cluster tanpa 1005 marker DOM');
  const zoomBefore=Math.max(...tiles.map(t=>Number(t.path.split('/')[1])));await page.locator('.vendor-map-cluster').first().click();await page.waitForFunction(()=>[...document.querySelectorAll('.leaflet-tile')].some(t=>Number(new URL(t.src).pathname.split('/')[1])>16));assert.ok(Math.max(...tiles.map(t=>Number(t.path.split('/')[1])))>zoomBefore);pass('Klik cluster memperbesar viewport');
  await page.getByRole('button',{name:'Titik berimpit',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.vendor-map-cluster')?.textContent==='2');
  for(let n=0;n<3;n++)await page.locator('.vendor-map-cluster').click();
  await page.getByRole('button',{name:'Vendor B · Gudang',exact:true}).click();assert.equal(await page.getByLabel('Pilihan vendor').textContent(),'b');pass('Fasilitas dengan GPS berimpit tetap dapat dipilih pada zoom maksimum');
  await page.getByRole('button',{name:'Edit titik',exact:true}).click();await page.getByRole('region',{name:'Pilih koordinat pada peta'}).waitFor();await page.getByTitle('Lokasi · Titik pilihan',{exact:true}).waitFor();
  const map=page.getByRole('region',{name:'Pilih koordinat pada peta'}),box=await map.boundingBox();const before=await page.getByLabel('Koordinat dipilih').textContent();
  await map.click({position:{x:box.width/2+70,y:box.height/2+45}});await page.waitForFunction(previous=>document.querySelector('output[aria-label="Koordinat dipilih"]').textContent!==previous,before);
  const clicked=JSON.parse(await page.getByLabel('Koordinat dipilih').textContent());assert.equal(clicked.coordinate_source,'PICK_ON_MAP');pass('Klik peta mengubah draf GPS dengan sumber PICK_ON_MAP');
  const marker=page.getByTitle('Lokasi · Titik pilihan',{exact:true}),markerBox=await marker.boundingBox();const old=await page.getByLabel('Koordinat dipilih').textContent();
  await page.mouse.move(markerBox.x+18,markerBox.y+18);await page.mouse.down();await page.mouse.move(markerBox.x+100,markerBox.y+40,{steps:10});await page.mouse.up();
  await page.waitForFunction(previous=>document.querySelector('output[aria-label="Koordinat dipilih"]').textContent!==previous,old);pass('Drag marker nyata mengubah koordinat draf');
  const route=await page.getByRole('link',{name:'Rute ke Lokasi',exact:true}).getAttribute('href'),picked=JSON.parse(await page.getByLabel('Koordinat dipilih').textContent()),url=new URL(route);
  assert.equal(url.searchParams.get('destination'),`${picked.latitude},${picked.longitude}`);assert.equal(url.searchParams.get('api'),'1');assert.ok(!url.searchParams.has('origin'));assert.ok(!url.searchParams.has('key'));pass('Tautan rute mengikuti titik terbaru; tanpa origin palsu atau API key');
  await page.getByRole('button',{name:'Titik tidak valid',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.leaflet-marker-icon').length===0);pass('GPS di luar rentang tidak membuat pin atau merusak peta');
  tileMode='fail';await page.reload();await page.getByRole('alert').filter({hasText:'Peta dasar tidak dapat dimuat'}).waitFor();assert.ok(await page.getByRole('link',{name:'Rute ke Lokasi',exact:true}).isVisible());
  tileMode='ok';await page.getByRole('button',{name:'Coba lagi',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.leaflet-tile-loaded').length>0);assert.equal(await page.getByRole('alert').count(),0);pass('Kegagalan tile memberi pesan/retry dan tidak menghilangkan rute');
  assert.ok(tiles.every(t=>t.query===''&&/^\/\d+\/\d+\/\d+\.png$/.test(t.path)&&t.referrer===origin+'/'));assert.deepEqual(external,[]);assert.deepEqual(errors,[]);pass('Permintaan tile hanya z/x/y dengan referrer origin; 0 Google SDK/geocoder/API produksi atau pageerror');
}catch(error){results.push(`FAIL | ${error.message} | pageerrors=${JSON.stringify(errors)}`);throw error;}
finally{await browser?.close();await server?.close();writeFileSync(new URL('../docs/vendor-management/phase3-evidence/FREE_MAP_BROWSER_RESULTS.txt',import.meta.url),results.join('\n')+'\n');}
