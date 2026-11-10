// Navigasi terpadu, hanya Docker sintetis/loopback. Tidak membuat fixture bisnis.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const api='http://127.0.0.1:54321',origin='http://127.0.0.1:7017';
assert.ok(process.env.HARMAS_LOCAL_TEST_PASSWORD);
const docker=(args,input)=>{const r=spawnSync('docker',args,{input,encoding:'utf8',maxBuffer:8e6});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const sql=q=>docker(['exec','-i','supabase_db_harmas-vendor-test','psql','-X','-q','-A','-t','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],q);
const key=docker(['exec','supabase_kong_harmas-vendor-test','cat','/home/kong/kong.yml']).match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];assert.ok(key);
const snapshot=()=>sql(`SELECT jsonb_object_agg(name,hash) FROM (${['vendors','assets','user_profiles','roles','role_permissions','notifications'].map(t=>`SELECT '${t}' name,md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) hash FROM public.${t} x`).join(' UNION ALL ')}) q;`);
const before=snapshot(),results=[],errors=[],writes=[],external=[];let server,browser,lastPage;
const dir='docs/vendor-management/phase3-evidence';
const pass=check=>{results.push({check,pass:true});console.log(`PASS | ${check}`);};
try {
 const {createServer}=await import('vite');server=await createServer({envFile:false,define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(api),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify(key),'import.meta.env.VITE_VENDOR_MAP_TILE_URL':'""','import.meta.env.VITE_VENDOR_MAP_TILE_CREDIT':'""'},server:{host:'127.0.0.1',port:7017,strictPort:true},clearScreen:false});await server.listen();
 const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_PACKAGE_PATH).href);browser=await chromium.launch({headless:true});
 async function contextFor(email,masterOnly=false){
  const login=await fetch(`${api}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email,password:process.env.HARMAS_LOCAL_TEST_PASSWORD})});assert.equal(login.status,200);
  const auth=await login.json(),ctx=await browser.newContext({viewport:{width:1440,height:1000}});await ctx.addInitScript(a=>localStorage.setItem('sb-127-auth-token',JSON.stringify(a)),auth);
  await ctx.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.hostname==='tile.openstreetmap.org')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e2e8f0"/><text x="10" y="20">TEST TILE</text></svg>'});
   if(!['127.0.0.1','localhost'].includes(url.hostname)){external.push(url.hostname);return route.abort();}
   if(url.pathname.endsWith('/rpc/vendor_remind_overdue_followups'))return route.fulfill({status:200,contentType:'application/json',body:'0'});
   if(!['GET','HEAD','OPTIONS'].includes(req.method())&&!['/rest/v1/rpc/vendor_sourcing_dashboard','/rest/v1/rpc/vendor_location_monitoring'].includes(url.pathname)){writes.push(url.pathname);return route.abort();}
   return route.continue();
  });
  if(masterOnly)await ctx.route('**/rest/v1/role_permissions*',async route=>{const response=await route.fetch();const data=await response.json();const permissions=data.filter(p=>p.module_key!=='vendors').map(p=>p.module_key.startsWith('vendor_')?{...p,can_access:false}:p);permissions.push({module_key:'vendors',can_access:true});await route.fulfill({response,json:permissions});});
  const page=await ctx.newPage();lastPage=page;page.on('pageerror',e=>errors.push(e.message));return {ctx,page};
 }
 const admin=await contextFor('superadmin.test@harmas.local'),page=admin.page,sidebar=page.locator('#main-sidebar'),main=page.getByRole('main');
 await page.goto(`${origin}/vendors`);await main.getByRole('heading',{name:'Master Vendor',exact:true}).waitFor();await sidebar.getByRole('link',{name:'Vendor Aktif',exact:true}).waitFor();
 const items=await sidebar.getByRole('link').evaluateAll(nodes=>nodes.filter(n=>['/vendor','/vendors','/vendor/database','/vendor/followups','/vendor/map'].includes(n.getAttribute('href'))).map(n=>({href:n.getAttribute('href'),label:n.textContent.trim()})));
 assert.deepEqual(items,[{href:'/vendor',label:'Dashboard Vendor'},{href:'/vendors',label:'Vendor Aktif'},{href:'/vendor/database',label:'Calon Vendor'},{href:'/vendor/followups',label:'Follow-Up Vendor'},{href:'/vendor/map',label:'Peta Vendor'}]);assert.equal(await sidebar.getByRole('link',{name:'Vendor',exact:true}).count(),0);
 pass('Lima menu berada dalam urutan Manajemen Vendor; tautan Master Data lama tidak duplikat');
 await main.getByRole('link',{name:'Dashboard Vendor',exact:true}).click();await main.getByRole('heading',{name:'Dashboard Vendor',exact:true}).waitFor();await main.getByRole('link',{name:'Vendor Aktif',exact:true}).click();await main.getByRole('heading',{name:'Master Vendor',exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/vendors');
 await main.getByRole('button',{name:/Lokasi & Koordinat/}).first().click();await page.getByRole('tab',{name:'Lokasi & Koordinat',exact:true}).waitFor();await page.getByRole('button',{name:'Tutup vendor',exact:true}).click();
 pass('Dashboard ↔ Vendor Aktif memakai /vendors existing dan input koordinat tetap dapat dibuka');
 for(const [label,heading] of [['Calon Vendor','Database Calon Vendor'],['Follow-Up Vendor','Follow-Up Vendor'],['Peta Vendor','Peta Lokasi Vendor']]){await sidebar.getByRole('link',{name:label,exact:true}).click();await main.getByRole('heading',{name:heading,exact:true}).waitFor();}
 pass('Calon Vendor, Follow-Up dan Peta tetap menuju halaman yang benar');
 await sidebar.getByRole('link',{name:'Vendor Aktif',exact:true}).click();await main.getByRole('heading',{name:'Master Vendor',exact:true}).waitFor();await page.screenshot({path:`${dir}/vendor-navigation-desktop.png`,fullPage:true,animations:'disabled'});
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.getElementById('main-sidebar').getBoundingClientRect().right<=1);await page.getByRole('button',{name:'Buka menu',exact:true}).click();await sidebar.getByRole('link',{name:'Vendor Aktif',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/vendor-navigation-mobile.png`,fullPage:true,animations:'disabled'});await sidebar.getByRole('link',{name:'Vendor Aktif',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Buka menu',exact:true}).getAttribute('aria-expanded'),'false');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 pass('Menu terpadu mobile bekerja, drawer menutup setelah dipilih dan halaman tanpa overflow');await admin.ctx.close();
 const hrd=await contextFor('hrd.test@harmas.local',true);await hrd.page.goto(`${origin}/vendors`);await hrd.page.getByRole('heading',{name:'Master Vendor',exact:true}).waitFor();const hs=hrd.page.locator('#main-sidebar');await hs.getByRole('link',{name:'Vendor Aktif',exact:true}).waitFor();assert.equal(await hs.getByRole('link',{name:'Dashboard Vendor',exact:true}).count(),0);assert.equal(await hs.getByRole('link',{name:'Peta Vendor',exact:true}).count(),0);
 pass('HRD dengan hanya izin master tetap melihat Vendor Aktif meskipun modul sourcing disembunyikan');await hrd.ctx.close();
 for(const email of ['sourcing.test@harmas.local','direksi.test@harmas.local']){const user=await contextFor(email);await user.page.goto(`${origin}/vendor`);await user.page.getByRole('heading',{name:'Dashboard Vendor',exact:true}).waitFor();assert.equal(await user.page.locator('#main-sidebar').getByRole('link',{name:'Vendor Aktif',exact:true}).count(),0);assert.equal(await user.page.getByRole('main').getByRole('link',{name:'Vendor Aktif',exact:true}).count(),0);await user.page.goto(`${origin}/vendors`);await user.page.waitForURL(`${origin}/dashboard`);await user.ctx.close();}
 pass('Sourcing/Direksi tidak mendapat akses master baru dari menu atau tautan Dashboard');
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.ok(!external.some(h=>h.endsWith('supabase.co')||h==='maps.googleapis.com'));assert.equal(snapshot(),before);
 pass('Tidak ada pageerror, write bisnis, request produksi atau perubahan enam checksum baseline Docker');
}catch(error){results.push({check:error.message,pass:false});if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:`${dir}/vendor-navigation-failure.png`,fullPage:true}).catch(()=>{});throw error;}
finally{await browser?.close();await server?.close();writeFileSync(`${dir}/VENDOR_NAVIGATION_BROWSER_RESULTS.json`,JSON.stringify({checked_at:new Date().toISOString(),target:'Docker synthetic + loopback',production_writes:false,permission_reduction_fixture_mocked:true,results},null,2)+'\n');}
