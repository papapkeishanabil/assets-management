// Real RLS/API reads against Docker synthetic data only. Business writes from browser are blocked.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const api = 'http://127.0.0.1:54321', origin = 'http://127.0.0.1:7018', db = 'supabase_db_harmas-vendor-test';
assert.ok(process.env.HARMAS_LOCAL_TEST_PASSWORD);
const docker = (args, input) => { const r = spawnSync('docker', args, { input, encoding: 'utf8', maxBuffer: 8e6 }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
const sql = (input) => docker(['exec', '-i', db, 'psql', '-X', '-q', '-A', '-t', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], input);
const key = docker(['exec', 'supabase_kong_harmas-vendor-test', 'cat', '/home/kong/kong.yml']).match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0]; assert.ok(key);
const tables = ['vendors', 'assets', 'user_profiles', 'roles', 'role_permissions', 'notifications', 'vendor_candidates', 'vendor_locations', 'vendor_location_photos', 'vendor_followups', 'vendor_status_history', 'vendor_activity_logs'];
const snapshot = () => sql(`SELECT jsonb_object_agg(name,hash) FROM (${tables.map((t) => `SELECT '${t}' name,md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) hash FROM public.${t} x`).join(' UNION ALL ')}) q;`);
const before = snapshot(), results = [], pageErrors = [], writes = [], external = [];
const ids = Array.from({ length: 4 }, () => randomUUID()), profiles = Array.from({ length: 4 }, () => randomUUID()), locs = Array.from({ length: 3 }, () => randomUUID());
const asset = randomUUID(), code = randomUUID().slice(0, 8), pid = sql("SELECT id FROM public.user_profiles WHERE email='superadmin.test@harmas.local';");
assert.match(pid, /^[a-f0-9-]{36}$/);
const pass = (check) => { results.push({ check, pass: true }); console.log(`PASS | ${check}`); };
const dir = process.env.HARMAS_VENDOR_EVIDENCE_DIR || 'docs/vendor-management/dashboard-evidence'; mkdirSync(dir, { recursive: true });
let server, browser, lastPage;
try {
  sql(`BEGIN;
    INSERT INTO public.vendors(id,vendor_code,vendor_name,vendor_type,city,is_active) VALUES
      ('${ids[0]}','DB-${code}-A','[DASH] Banyak Fasilitas','MAKLUN_JAHIT','Bandung',true),
      ('${ids[1]}','DB-${code}-B','[DASH] Belum Ada Profil','MAKLUN_JAHIT','Cimahi',true),
      ('${ids[2]}','DB-${code}-C','[DASH] Lokasi Kosong','SUPPLIER_UMUM','Bandung',true),
      ('${ids[3]}','DB-${code}-D','[DASH] Tidak Aktif','SUPPLIER_UMUM','Bandung',false);
    INSERT INTO public.vendor_candidates(id,business_name,vendor_id,internal_pic_id,category_id) VALUES
      ('${profiles[0]}','[DASH] Profil A','${ids[0]}','${pid}',(SELECT id FROM vendor_categories LIMIT 1)),
      ('${profiles[1]}','[DASH] Profil C','${ids[2]}','${pid}',(SELECT id FROM vendor_categories LIMIT 1)),
      ('${profiles[2]}','[DASH] Profil D','${ids[3]}','${pid}',(SELECT id FROM vendor_categories LIMIT 1)),
      ('${profiles[3]}','[DASH] Calon Murni',null,'${pid}',(SELECT id FROM vendor_categories LIMIT 1));
    INSERT INTO public.vendor_locations(id,candidate_id,location_name,location_type,address_line,city,province,latitude,longitude,coordinate_source,created_by) VALUES
      ('${locs[0]}','${profiles[0]}','Utama','WORKSHOP_JAHIT','Jalan Uji','Bandung','Jawa Barat',0,0,'MANUAL','${pid}'),
      ('${locs[1]}','${profiles[0]}','Gudang','GUDANG','Jalan Uji 2','Bandung','Jawa Barat',-6.9,107.6,'MANUAL','${pid}'),
      ('${locs[2]}','${profiles[2]}','Nonaktif','KANTOR','Jalan Nonaktif','Bandung','Jawa Barat',-6.8,107.5,'MANUAL','${pid}');
    INSERT INTO public.assets(id,asset_code,asset_name,vendor_id) VALUES ('${asset}','DB-${code}','[DASH] Aset Uji','${ids[0]}');
    COMMIT;`);
  const expected = Number(sql('SELECT count(*) FROM public.vendors WHERE is_active;'));
  const expectedCandidates = Number(sql('SELECT count(*) FROM public.vendor_candidates WHERE vendor_id IS NULL;'));
  const expectedAssets = Number(sql('SELECT count(*) FROM public.assets a JOIN public.vendors v ON v.id=a.vendor_id WHERE v.is_active;'));
  const { createServer } = await import('vite');
  server = await createServer({ envFile: false, define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(api), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(key) }, server: { host: '127.0.0.1', port: 7018, strictPort: true }, clearScreen: false }); await server.listen();
  const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_PACKAGE_PATH).href); browser = await chromium.launch({ headless: true });
  async function user(email, deny = [], fail = '') {
    const r = await fetch(`${api}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: process.env.HARMAS_LOCAL_TEST_PASSWORD }) }); assert.equal(r.status, 200);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), requests = [];
    await ctx.addInitScript((auth) => localStorage.setItem('sb-127-auth-token', JSON.stringify(auth)), await r.json());
    await ctx.route('**/*', (route) => {
      const req = route.request(), url = new URL(req.url());
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { external.push(url.hostname); return route.abort(); }
      if (url.pathname.startsWith('/rest/v1/')) requests.push(url.pathname);
      if (url.pathname.endsWith('/rpc/vendor_remind_overdue_followups')) return route.fulfill({ status: 200, contentType: 'application/json', body: '0' });
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method()) && !['/rest/v1/rpc/vendor_sourcing_dashboard', '/rest/v1/rpc/vendor_location_monitoring'].includes(url.pathname)) { writes.push(url.pathname); return route.abort(); }
      if (fail && url.pathname === `/rest/v1/${fail}`) return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: '42501', message: 'Simulated permission error' }) });
      return route.continue();
    });
    if (deny.length) await ctx.route('**/rest/v1/role_permissions*', async (route) => { const r = await route.fetch(); const data = await r.json(); await route.fulfill({ response: r, json: data.map((p) => deny.includes(p.module_key) ? { ...p, can_access: false } : p) }); });
    const page = await ctx.newPage(); lastPage = page; page.on('pageerror', (e) => pageErrors.push(e.message));
    return { ctx, page, requests };
  }
  const admin = await user('superadmin.test@harmas.local'), page = admin.page;
  const metric = (label) => page.getByRole('article', { name: label, exact: true }).locator('p').first();
  await page.goto(`${origin}/vendor`); await page.getByRole('article', { name: 'Vendor aktif', exact: true }).waitFor();
  assert.equal(await metric('Vendor aktif').innerText(), String(expected));
  assert.equal(await page.getByRole('tab', { name: 'Ringkasan operasional' }).getAttribute('aria-selected'), 'true');
  pass('Default dashboard shows real active-master total including masters without linked profiles');
  assert.equal(await metric('Sudah dipetakan').innerText(), '1');
  await page.getByText('2 titik', { exact: true }).waitFor();
  assert.equal(await metric('Lokasi belum lengkap').innerText(), String(expected));
  pass('Two GPS facilities count as one active vendor; inactive mapped vendor excluded; null profile incomplete');
  assert.equal(await metric('Aset di vendor aktif').innerText(), String(expectedAssets));
  assert.equal(await page.getByRole('article', { name: 'Calon vendor', exact: true }).locator('p').last().innerText(), String(expectedCandidates));
  pass('Asset count uses vendor relation; candidate count excludes active-master linked profiles');
  const attention = page.getByRole('region', { name: 'Vendor aktif yang perlu perhatian', exact: true });
  if (await attention.getByRole('button', { name: 'Lihat semua', exact: true }).count()) await attention.getByRole('button', { name: 'Lihat semua', exact: true }).click();
  const unlinked = attention.getByRole('row').filter({ hasText: '[DASH] Belum Ada Profil' }); await unlinked.getByRole('link', { name: /Isi melalui Vendor Aktif/ }).waitFor();
  const linked = attention.getByRole('row').filter({ hasText: '[DASH] Banyak Fasilitas' }); assert.equal(await linked.getByRole('link', { name: /Periksa lokasi/ }).getAttribute('href'), `/vendor/database/${profiles[0]}?tab=location`);
  pass('Attention list routes linked locations correctly and offers master action for unlinked active vendor');
  if (await attention.getByRole('button', { name: 'Tampilkan lebih sedikit', exact: true }).count()) await attention.getByRole('button', { name: 'Tampilkan lebih sedikit', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${dir}/dashboard-desktop.png`, fullPage: true, animations: 'disabled' });
  await page.getByRole('tab', { name: 'Sourcing', exact: true }).click(); await page.getByRole('heading', { name: 'Produktivitas PIC Sourcing', exact: true }).waitFor();
  await page.getByLabel('PIC kandidat').selectOption(pid); await page.getByRole('heading', { name: 'Produktivitas PIC Sourcing', exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Ringkasan operasional', exact: true }).click(); assert.equal(await metric('Vendor aktif').innerText(), String(expected));
  pass('Sourcing detail and filters remain available without changing global operational totals');
  await page.getByRole('tab', { name: 'Ringkasan operasional' }).focus(); await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('tab', { name: 'Sourcing', exact: true }).getAttribute('aria-selected'), 'true');
  await page.keyboard.press('Home'); assert.equal(await page.getByRole('tab', { name: 'Ringkasan operasional' }).getAttribute('aria-selected'), 'true');
  pass('Dashboard tabs support arrow keys, Home and a single active keyboard tab stop');
  await page.setViewportSize({ width: 390, height: 844 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `${dir}/dashboard-mobile.png`, animations: 'disabled' });
  await page.getByRole('article', { name: 'Aset di vendor aktif', exact: true }).scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const assetCard = page.getByRole('article', { name: 'Aset di vendor aktif', exact: true });
  await assetCard.screenshot({ path: `${dir}/mobile-asset-card.png`, animations: 'disabled' });
  await page.screenshot({ path: `${dir}/dashboard-mobile-lower-cards.png`, animations: 'disabled' });
  await page.evaluate(() => window.scrollTo(0, 0));
  pass('Mobile 390px has no page overflow; table scroll stays within card');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light')); await page.setViewportSize({ width: 1440, height: 1000 });
  for (const article of await page.getByRole('region', { name: 'Ringkasan sourcing dan follow-up' }).getByRole('article').all()) assert.ok(await article.isVisible());
  await page.screenshot({ path: `${dir}/dashboard-light.png`, animations: 'disabled' });
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(8, 10, 15)');
  await page.setViewportSize({ width: 1919, height: 1062 });
  await page.screenshot({ path: `${dir}/dashboard-reference-size.png`, animations: 'disabled' });
  await page.getByRole('article', { name: 'Vendor aktif', exact: true }).locator('..').screenshot({ path: `${dir}/vendor-cards-light.png`, animations: 'disabled' });
  await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
  await page.getByRole('article', { name: 'Vendor aktif', exact: true }).locator('..').screenshot({ path: `${dir}/vendor-cards-dark.png`, animations: 'disabled' });
  pass('Light theme uses existing application tokens'); await admin.ctx.close();
  for (const email of ['sourcing.test@harmas.local', 'direksi.test@harmas.local']) {
    const u = await user(email); await u.page.goto(`${origin}/vendor`); await u.page.getByRole('article', { name: 'Vendor aktif', exact: true }).waitFor();
    assert.equal(await u.page.getByRole('main').getByRole('link', { name: 'Vendor Aktif', exact: true }).count(), 0);
    assert.equal(await u.page.getByRole('article', { name: 'Vendor aktif', exact: true }).locator('p').first().innerText(), String(expected));
    await u.page.goto(`${origin}/vendors`); await u.page.waitForURL(`${origin}/dashboard`); await u.ctx.close();
  }
  pass('Sourcing and Direksi can read operational summary without gaining master edit access');
  const restricted = await user('hrd.test@harmas.local', ['vendor_map', 'assets']); await restricted.page.goto(`${origin}/vendor`);
  await restricted.page.getByRole('article', { name: 'Vendor aktif', exact: true }).waitFor();
  assert.equal(await restricted.page.getByRole('article', { name: 'Sudah dipetakan', exact: true }).locator('p').first().innerText(), '—');
  assert.equal(await restricted.page.getByRole('article', { name: 'Aset di vendor aktif', exact: true }).locator('p').first().innerText(), '—');
  assert.ok(!restricted.requests.some((p) => p === '/rest/v1/vendor_map_points' || p === '/rest/v1/assets')); await restricted.ctx.close();
  pass('Missing module permissions hide location/asset numbers and prevent their data requests');
  const failed = await user('superadmin.test@harmas.local', [], 'vendor_map_points'); await failed.page.goto(`${origin}/vendor`);
  await failed.page.getByText(/Data lokasi gagal dimuat/).waitFor(); assert.equal(await failed.page.getByRole('article', { name: 'Vendor aktif', exact: true }).locator('p').first().innerText(), String(expected));
  assert.equal(await failed.page.getByRole('article', { name: 'Sudah dipetakan', exact: true }).locator('p').first().innerText(), '—'); await failed.ctx.close();
  pass('Map query error preserves master totals and shows unavailable GPS rather than false zero');
  const denied = await user('hrd.test@harmas.local', ['vendor_management']); await denied.page.goto(`${origin}/vendor`); await denied.page.waitForURL(`${origin}/dashboard`);
  assert.ok(!denied.requests.includes('/rest/v1/vendor_map_points')); await denied.ctx.close();
  pass('Dashboard module guard still rejects HRD without vendor_management');
  if (process.env.HARMAS_CAPTURE_CARD_REFERENCE === '1') {
    // Render the unchanged main-dashboard card source from the user's screenshot.
    // Reference only: isolated synthetic API fixtures, no production data or writes.
    const ref = await user('superadmin.test@harmas.local');
    await ref.page.setViewportSize({ width: 1919, height: 1062 });
    await ref.page.addInitScript(() => { localStorage.setItem('harmas-theme', 'light'); sessionStorage.setItem('dashboard_popup_dismissed', '1'); });
    await ref.page.route('**/rest/v1/*', (route) => {
      const req = route.request(), url = new URL(req.url()), table = url.pathname.split('/').at(-1);
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method())) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      if (!['assets', 'contracts', 'maintenance_schedules', 'asset_categories'].includes(table)) return route.continue();
      const count = table === 'assets' ? (url.searchParams.has('is_active') ? 52 : 55) : table === 'contracts' ? (url.searchParams.has('end_date') ? 0 : url.searchParams.has('contract_status') ? 23 : 28) : table === 'maintenance_schedules' && url.searchParams.get('next_maintenance_date')?.startsWith('lt.') ? 4 : 0;
      return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'content-range': `*/${count}`, 'access-control-allow-origin': origin, 'access-control-expose-headers': 'content-range' }, body: req.method() === 'HEAD' ? '' : '[]' });
    });
    await ref.page.goto(`${origin}/dashboard`);
    await ref.page.getByText('55', { exact: true }).first().waitFor();
    await ref.page.screenshot({ path: `${dir}/main-dashboard-reference.png`, animations: 'disabled' });
    await ref.page.getByText('Total Aset', { exact: true }).locator('..').locator('..').locator('..').screenshot({ path: `${dir}/source-cards-light.png`, animations: 'disabled' });
    await ref.ctx.close();
    pass('Reference card source captured at user screenshot viewport using synthetic API fixtures');
  }
  assert.deepEqual(pageErrors, []); assert.deepEqual(writes, []); assert.ok(!external.some((h) => h.endsWith('supabase.co')));
  pass('No browser exceptions, business writes or requests to production Supabase');
} catch (error) {
  results.push({ check: error.message, pass: false });
  if (lastPage && !lastPage.isClosed()) await lastPage.screenshot({ path: `${dir}/failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser?.close(); await server?.close();
  sql(`BEGIN; SET LOCAL session_replication_role=replica;
    DELETE FROM public.vendor_activity_logs WHERE candidate_id IN (${profiles.map((p) => `'${p}'`).join(',')});
    DELETE FROM public.vendor_status_history WHERE candidate_id IN (${profiles.map((p) => `'${p}'`).join(',')});
    DELETE FROM public.vendor_locations WHERE id IN (${locs.map((p) => `'${p}'`).join(',')});
    DELETE FROM public.vendor_candidates WHERE id IN (${profiles.map((p) => `'${p}'`).join(',')});
    DELETE FROM public.assets WHERE id='${asset}'; DELETE FROM public.vendors WHERE id IN (${ids.map((p) => `'${p}'`).join(',')}); COMMIT;`);
  const unchanged = snapshot() === before;
  results.push({ check: 'Fixture cleanup restores all 12 table checksums', pass: unchanged });
  writeFileSync(`${dir}/BROWSER_RESULTS.json`, JSON.stringify({ checked_at: new Date().toISOString(), target: 'Supabase Docker synthetic + loopback', production_connected: false, reminder_mocked: true, writes, pageErrors, results }, null, 2) + '\n');
  assert.ok(unchanged, 'Cleanup checksum mismatch');
}
