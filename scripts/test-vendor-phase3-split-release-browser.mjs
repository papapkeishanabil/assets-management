// Docker sintetis saja. Simulasi backend Fase 3 belum terpasang dan RLS ditolak.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const api = 'http://127.0.0.1:54321', origin = 'http://127.0.0.1:7015';
const password = process.env.HARMAS_LOCAL_TEST_PASSWORD;
assert.ok(password, 'Password fixture Docker harus tersedia melalui env sesi');
function docker(args, input) {
  const r = spawnSync('docker', args, { input, encoding: 'utf8', maxBuffer: 8e6 });
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
}
const sql = (q) => docker(['exec','-i','supabase_db_harmas-vendor-test','psql','-X','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'], q);
const anon = docker(['exec','supabase_kong_harmas-vendor-test','cat','/home/kong/kong.yml']).match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
assert.ok(anon);
const candidate = sql('SELECT id FROM public.vendor_candidates ORDER BY created_at LIMIT 1;'); assert.ok(candidate);
const baseline = () => sql(`SELECT jsonb_build_object('vendors',(SELECT md5(jsonb_agg(to_jsonb(x) ORDER BY id)::text) FROM public.vendors x),'assets',(SELECT md5(jsonb_agg(to_jsonb(x) ORDER BY id)::text) FROM public.assets x),'notifications',(SELECT md5(jsonb_agg(to_jsonb(x) ORDER BY id)::text) FROM public.notifications x),'candidates',(SELECT md5(jsonb_agg(to_jsonb(x) ORDER BY id)::text) FROM public.vendor_candidates x));`);
const before = baseline(), results = [], errors = [], blocked = [];
const pass = (label) => { results.push(`PASS | ${label}`); console.log(results.at(-1)); };
let server, browser, mode = 'missing';
try {
  const login = await fetch(`${api}/auth/v1/token?grant_type=password`, { method:'POST', headers:{apikey:anon,'Content-Type':'application/json'}, body:JSON.stringify({email:'sourcing.test@harmas.local',password}) });
  assert.equal(login.status,200); const auth = await login.json();
  const { createServer } = await import('vite');
  server = await createServer({ envFile:false, define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(api),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify(anon),'import.meta.env.VITE_VENDOR_MAP_TILE_URL':'""','import.meta.env.VITE_VENDOR_MAP_TILE_CREDIT':'""'}, server:{host:'127.0.0.1',port:7015,strictPort:true}, clearScreen:false }); await server.listen();
  const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_PACKAGE_PATH).href);
  browser = await chromium.launch({headless:true}); const context = await browser.newContext();
  await context.addInitScript(a => localStorage.setItem('sb-127-auth-token',JSON.stringify(a)),auth);
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if(url.hostname==='tile.openstreetmap.org') return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e2e8f0"/></svg>'});
    if (!['127.0.0.1','localhost'].includes(url.hostname)) return route.abort();
    if (/\/rest\/v1\/(?:vendor_map_points|vendor_locations|rpc\/vendor_location_monitoring)$/.test(url.pathname)) {
      const code = mode === 'denied' ? '42501' : url.pathname.includes('/rpc/') ? 'PGRST202' : 'PGRST205';
      return route.fulfill({status:mode === 'denied'?403:404,contentType:'application/json',body:JSON.stringify({code,message:mode === 'denied'?'permission denied':'Backend location not found',details:null,hint:null})});
    }
    if (url.pathname.endsWith('/rpc/vendor_remind_overdue_followups')) return route.fulfill({status:200,contentType:'application/json',body:'0'});
    if (!['GET','HEAD','OPTIONS'].includes(request.method()) && !url.pathname.endsWith('/rpc/vendor_sourcing_dashboard')) { blocked.push(url.pathname); return route.abort(); }
    return route.continue();
  });
  const page = await context.newPage(); page.on('pageerror',e => errors.push(e.message));
  const pending = 'Lokasi dan foto vendor belum aktif. Data sourcing dan follow-up tetap dapat digunakan.';
  await page.goto(`${origin}/vendor`); await page.getByRole('heading',{name:'Produktivitas PIC Sourcing',exact:true}).waitFor(); await page.getByText(pending,{exact:true}).waitFor();
  assert.equal(await page.getByText(/Gagal memuat dashboard/).count(),0); pass('Dashboard Fase 2 tetap tampil ketika RPC lokasi Fase 3 belum tersedia');
  await page.goto(`${origin}/vendor/map`); await page.getByText(pending,{exact:true}).waitFor();
  assert.ok(await page.getByRole('button',{name:'Semua lokasi (—)',exact:true}).isDisabled());
  assert.equal(await page.getByRole('button',{name:'Lokasikan Vendor Aktif',exact:true}).count(),0);
  await page.locator('summary').click(); assert.equal(await page.getByLabel('Kategori').count(),1);
  pass('Peta/filter tetap tampil; jumlah tidak dipalsukan nol dan retrofit tidak dapat dijalankan');
  await page.goto(`${origin}/vendor/database/${candidate}?tab=location`); await page.getByText(pending,{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Tambah Lokasi',exact:true}).count(),0); pass('Tab lokasi menjelaskan fitur belum aktif tanpa tombol simpan yang gagal');
  mode = 'denied'; await page.goto(`${origin}/vendor/map`); await page.getByRole('alert').filter({hasText:'permission denied'}).waitFor();
  assert.equal(await page.getByText(pending,{exact:true}).count(),0); pass('Error RLS 42501 tetap dilaporkan, tidak disamarkan sebagai backend belum aktif');
  assert.deepEqual(errors,[]); assert.deepEqual(blocked,[]); assert.equal(baseline(),before);
  pass('Tidak ada pageerror atau write bisnis; checksum empat tabel Docker tetap identik');
} catch (error) { results.push(`FAIL | ${error.message}`); throw error; }
finally {
  await browser?.close(); await server?.close();
  writeFileSync(new URL('../docs/vendor-management/phase3-evidence/SPLIT_RELEASE_BROWSER_RESULTS.txt',import.meta.url),results.join('\n')+'\n');
}
