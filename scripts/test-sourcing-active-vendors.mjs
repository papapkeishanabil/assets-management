// Isolated Supabase Docker only. Never reads .env or connects to a production host.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const api = 'http://127.0.0.1:54321', origin = 'http://127.0.0.1:7022';
const db = 'supabase_db_harmas-vendor-test';
const docker = (args, input) => {
  const r = spawnSync('docker', args, { input, encoding: 'utf8', maxBuffer: 8e6 });
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
};
const sql = (q) => docker(['exec', '-i', db, 'psql', '-X', '-q', '-A', '-t', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], q);
const kong = docker(['exec', 'supabase_kong_harmas-vendor-test', 'cat', '/home/kong/kong.yml']);
const anon = kong.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
const secret = [...kong.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)]
  .map((m) => m[0]).find((key) => JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role === 'service_role');
assert.ok(anon && secret && process.env.PLAYWRIGHT_PACKAGE_PATH);
const service = createClient(api, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const tables = ['vendors', 'assets', 'user_profiles', 'roles', 'role_permissions', 'notifications', 'vendor_candidates', 'vendor_locations', 'vendor_location_photos', 'vendor_followups', 'vendor_status_history', 'vendor_activity_logs', 'auth.users', 'auth.identities'];
const snapshot = () => sql(`SELECT jsonb_object_agg(name,hash) FROM (${tables.map((t) => `SELECT '${t}' name,md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) hash FROM ${t.includes('.') ? t : `public.${t}`} x`).join(' UNION ALL ')}) q;`);
const policySnapshot = () => sql("SELECT jsonb_build_object('rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.vendors'::regclass),'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM pg_policies p WHERE schemaname='public' AND tablename='vendors'));");
const before = snapshot(), policiesBefore = policySnapshot();
const masterHash = () => sql("SELECT md5(coalesce(jsonb_agg(to_jsonb(v) ORDER BY id)::text,'')) FROM public.vendors v;");
const checks = [], errors = [], external = [], blockedWrites = [], sourceMasterWrites = [], accounts = [], sessions = {};
const dir = 'docs/vendor-management/sourcing-active-vendors-evidence'; mkdirSync(dir, { recursive: true });
const run = randomUUID().slice(0, 8), password = `Local-${randomUUID()}!9`;
const vendorId = randomUUID(), code = `SRC-${run}`, name = `[SOURCING-${run}] Vendor Aktif`;
let browser, server, page;
const pass = (check) => { checks.push({ check, pass: true }); console.log(`PASS | ${check}`); };
async function account(role, status = 'ACTIVE') {
  const email = `vendor-access-${run}-${role}-${status}@harmas.local`;
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true }); assert.ifError(created.error);
  accounts.push(created.data.user.id);
  const r = await service.from('roles').select('id').eq('role_name', role).single(); assert.ifError(r.error);
  const p = await service.from('user_profiles').insert({ auth_user_id: created.data.user.id, full_name: `[SRC-${run}] ${role}`, email, role_id: r.data.id, account_status: status }).select('id').single(); assert.ifError(p.error);
  const client = createClient(api, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await client.auth.signInWithPassword({ email, password }); assert.ifError(login.error);
  return { session: login.data.session, authId: created.data.user.id, profileId: p.data.id };
}
async function contextFor(role, { vendors = true, map = true, management = true, inactive = false } = {}) {
  const auth = sessions[inactive ? 'inactive' : role];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  await ctx.addInitScript((s) => localStorage.setItem('sb-127-auth-token', JSON.stringify(s)), auth.session);
  const requests = [];
  await ctx.route('**/*', (route) => {
    const req = route.request(), url = new URL(req.url());
    if (url.hostname === 'tile.openstreetmap.org') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e2e8f0"/></svg>' });
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { external.push(url.hostname); return route.abort(); }
    if (url.origin === api) requests.push({ path: url.pathname, method: req.method() });
    if (url.pathname === '/rest/v1/role_permissions') return route.fulfill({ json: [
      { module_key: 'vendors', can_access: vendors }, { module_key: 'vendor_map', can_access: map },
      { module_key: 'vendor_management', can_access: management }, { module_key: 'vendor_followups', can_access: management }
    ] });
    if (url.pathname === '/rest/v1/rpc/vendor_remind_overdue_followups') return route.fulfill({ json: 0 });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method()) && url.origin === api) {
      if (role === 'sourcing' && url.pathname === '/rest/v1/vendors') { sourceMasterWrites.push(req.method()); return route.abort(); }
      const allowed = ['/rest/v1/rpc/vendor_sourcing_dashboard', '/rest/v1/rpc/vendor_location_monitoring', '/rest/v1/rpc/vendor_link_existing_active', '/rest/v1/vendor_locations'];
      if (role !== 'super_admin' && role !== 'hrd' && !allowed.includes(url.pathname)) { blockedWrites.push(url.pathname); return route.abort(); }
    }
    return route.continue();
  });
  const p = await ctx.newPage(); page = p; p.on('pageerror', (e) => errors.push(e.message));
  return { ctx, page: p, requests };
}
try {
  for (const role of ['super_admin', 'hrd', 'sourcing', 'direksi', 'finance', 'pelaksana']) sessions[role] = await account(role);
  sessions.inactive = await account('sourcing', 'PENDING');
  sql(`INSERT INTO public.vendors(id,vendor_code,vendor_name,address,city,is_active) VALUES ('${vendorId}','${code}','${name}','Jalan Uji Lokal','Bandung',true);`);
  const masterBefore = masterHash();
  // The old synthetic vendors fixture has RLS disabled and lacks the writer policy.
  // Reproduce the production role rule in ROLLED-BACK transactions only. No shared policy changes persist.
  for (const role of ['sourcing', 'hrd', 'super_admin']) {
    const authId = sessions[role].authId;
    const begin = `BEGIN; ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Sourcing access test writer" ON public.vendors FOR ALL TO authenticated
        USING(public.is_app_role(ARRAY['super_admin','hrd']));
      SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims='{"sub":"${authId}","role":"authenticated"}';`;
    const update = sql(`${begin} WITH changed AS (UPDATE public.vendors SET city='Uji RLS' WHERE id='${vendorId}' RETURNING id) SELECT count(*) FROM changed; ROLLBACK;`);
    const del = sql(`${begin} WITH changed AS (DELETE FROM public.vendors WHERE id='${vendorId}' RETURNING id) SELECT count(*) FROM changed; ROLLBACK;`);
    assert.equal(update, role === 'sourcing' ? '0' : '1'); assert.equal(del, role === 'sourcing' ? '0' : '1');
    sql(`${begin} DO $$ BEGIN ${role === 'sourcing' ? 'BEGIN' : ''}
      INSERT INTO public.vendors(vendor_code,vendor_name,is_active) VALUES ('RLS-${run}','RLS fixture',true);
      ${role === 'sourcing' ? "RAISE EXCEPTION 'INSERT unexpectedly allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;" : ''}
      END $$; ROLLBACK;`);
    pass(`Local RLS transaction: ${role} ${role === 'sourcing' ? 'cannot INSERT/UPDATE/DELETE' : 'retains INSERT/UPDATE/DELETE'} master vendors`);
  }
  assert.equal(masterHash(), masterBefore); assert.equal(policySnapshot(), policiesBefore);
  pass('Temporary RLS test transactions restore policies and master data exactly');

  const { createServer } = await import('vite');
  server = await createServer({ envFile: false, define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(api), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(anon) }, server: { host: '127.0.0.1', port: 7022, strictPort: true }, clearScreen: false }); await server.listen();
  const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_PACKAGE_PATH).href); browser = await chromium.launch({ headless: true });
  const source = await contextFor('sourcing'); page = source.page;
  await page.goto(`${origin}/vendor`); await page.getByRole('heading', { name: 'Dashboard Vendor', exact: true }).waitFor();
  await page.getByRole('main').getByRole('link', { name: 'Vendor Aktif', exact: true }).click();
  await page.getByRole('heading', { name: 'Master Vendor', exact: true }).waitFor();
  await page.locator('#main-sidebar').getByRole('link', { name: 'Vendor Aktif', exact: true }).waitFor();
  pass('Sourcing with vendors permission sees sidebar and Dashboard link and opens Vendor Aktif');
  await page.reload(); await page.getByRole('button', { name: `Lihat profil ${name}`, exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Tambah Vendor', exact: true }).count(), 0);
  assert.equal(await page.locator('button[title="Edit"],button[title="Hapus"]').count(), 0);
  await page.getByPlaceholder('Cari kode atau nama vendor...').fill(code); await page.locator('tbody tr').filter({ hasText: name }).waitFor();
  assert.equal(await page.locator('tbody tr').count(), 1);
  pass('Sourcing direct URL/reload and search work; master add/edit/delete actions absent');
  await page.getByRole('button', { name: `Lihat profil ${name}`, exact: true }).click();
  let detail = page.getByRole('dialog', { name: 'Detail Vendor', exact: true }); await detail.waitFor();
  assert.equal(await detail.locator('fieldset :is(input,select,textarea):enabled').count(), 0);
  assert.equal(await detail.getByRole('button', { name: 'Simpan', exact: true }).count(), 0);
  await detail.locator('form').evaluate((form) => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  assert.deepEqual(sourceMasterWrites, []); assert.equal(masterHash(), masterBefore);
  pass('Sourcing profile fields disabled and forced form submission sends no master write');
  await detail.getByRole('tab', { name: 'Lokasi & Koordinat', exact: true }).click();
  await detail.getByRole('button', { name: 'Tambah Lokasi', exact: true }).click();
  let form = page.getByRole('dialog', { name: 'Tambah Lokasi', exact: true });
  await form.getByRole('button', { name: 'Batal', exact: true }).click();
  assert.equal(sql(`SELECT count(*) FROM public.vendor_candidates WHERE vendor_id='${vendorId}';`), '0');
  pass('Opening/cancelling Sourcing location form does not create a linked candidate');
  await detail.getByRole('button', { name: 'Tambah Lokasi', exact: true }).click();
  form = page.getByRole('dialog', { name: 'Tambah Lokasi', exact: true });
  await form.getByLabel('Nama lokasi *', { exact: true }).fill('Workshop Sourcing');
  await form.getByLabel('Latitude', { exact: true }).fill('-6.921'); await form.getByLabel('Longitude', { exact: true }).fill('107.621');
  await form.getByRole('button', { name: 'Simpan Lokasi', exact: true }).click(); await form.waitFor({ state: 'detached' });
  await detail.getByRole('heading', { name: 'Workshop Sourcing', exact: true }).waitFor(); assert.equal(masterHash(), masterBefore);
  assert.equal(sql(`SELECT count(*) FROM public.vendor_locations l JOIN public.vendor_candidates c ON c.id=l.candidate_id WHERE c.vendor_id='${vendorId}';`), '1');
  pass('Sourcing with vendor_map saves real Docker coordinates through existing RPC without changing master');
  await detail.getByRole('button', { name: 'Edit lokasi', exact: true }).click();
  form = page.getByRole('dialog', { name: 'Edit Lokasi', exact: true });
  assert.equal(await form.getByLabel('Status verifikasi', { exact: true }).count(), 0);
  await form.getByLabel('Latitude', { exact: true }).fill('-6.922'); await form.getByRole('button', { name: 'Simpan Lokasi', exact: true }).click(); await form.waitFor({ state: 'detached' });
  await detail.getByText('Koordinat: -6.922, 107.621', { exact: true }).waitFor();
  pass('Sourcing can update coordinates but location verification control remains restricted');
  await detail.getByRole('tab', { name: 'Profil Vendor', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await page.waitForFunction(() => document.getElementById('main-sidebar').getBoundingClientRect().right <= 1);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.ok(await detail.evaluate((e) => e.scrollWidth <= e.clientWidth + 1));
  await page.screenshot({ path: `${dir}/sourcing-profile-mobile.png`, fullPage: true, animations: 'disabled' });
  await detail.getByRole('button', { name: 'Tutup', exact: true }).click();
  await page.getByRole('button', { name: 'Buka menu', exact: true }).click(); await page.locator('#main-sidebar').getByRole('link', { name: 'Vendor Aktif', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${dir}/sourcing-menu-mobile.png`, fullPage: true, animations: 'disabled' });
  pass('Sourcing mobile menu and read-only profile remain usable without overflow'); await source.ctx.close();

  const noMap = await contextFor('sourcing', { map: false, management: false });
  await noMap.page.goto(`${origin}/vendors`); await noMap.page.getByRole('heading', { name: 'Master Vendor', exact: true }).waitFor();
  assert.equal(await noMap.page.getByRole('button', { name: /Lokasi & Koordinat/ }).count(), 0);
  assert.equal(await noMap.page.getByRole('link', { name: 'Peta Vendor', exact: true }).count(), 0);
  await noMap.page.getByRole('button', { name: `Lihat profil ${name}`, exact: true }).click();
  assert.equal(await noMap.page.getByRole('tab', { name: 'Lokasi & Koordinat', exact: true }).count(), 0);
  assert.ok(!noMap.requests.some((r) => /vendor_locations|vendor_candidates/.test(r.path)));
  pass('vendors permission works independently; vendor_map OFF hides location controls and avoids location queries'); await noMap.ctx.close();

  for (const role of ['sourcing', 'hrd']) {
    const denied = await contextFor(role, { vendors: false }); await denied.page.goto(`${origin}/vendor`);
    await denied.page.getByRole('heading', { name: 'Dashboard Vendor', exact: true }).waitFor();
    assert.equal(await denied.page.getByRole('link', { name: 'Vendor Aktif', exact: true }).count(), 0);
    await denied.page.goto(`${origin}/vendors`); await denied.page.waitForURL(`${origin}/dashboard`);
    pass(`${role} vendors OFF hides links and denies direct URL`); await denied.ctx.close();
  }
  for (const role of ['direksi', 'finance', 'pelaksana']) {
    const denied = await contextFor(role); await denied.page.goto(`${origin}/vendors`); await denied.page.waitForURL(`${origin}/dashboard`);
    assert.equal(await denied.page.locator('#main-sidebar').getByRole('link', { name: 'Vendor Aktif', exact: true }).count(), 0);
    pass(`${role} remains denied even with vendors module enabled`); await denied.ctx.close();
  }
  const inactive = await contextFor('sourcing', { inactive: true }); await inactive.page.goto(`${origin}/vendors`);
  await inactive.page.getByRole('heading', { name: 'Akun Belum Aktif', exact: true }).waitFor();
  pass('Inactive Sourcing remains blocked before vendor data access'); await inactive.ctx.close();

  for (const role of ['super_admin', 'hrd']) {
    const admin = await contextFor(role, { vendors: role !== 'super_admin', map: false }); const p = admin.page;
    await p.goto(`${origin}/vendors`); await p.getByRole('button', { name: 'Tambah Vendor', exact: true }).click();
    const create = p.getByRole('dialog', { name: 'Tambah Vendor', exact: true }), c = `CRUD-${run}-${role === 'hrd' ? 'H' : 'S'}`, n = `[${run}] ${role}`;
    await create.getByLabel('Kode Vendor *', { exact: true }).fill(c); await create.getByLabel('Nama Vendor *', { exact: true }).fill(n);
    await create.getByRole('button', { name: 'Simpan', exact: true }).click(); await create.waitFor({ state: 'detached' });
    let row = p.locator('tbody tr').filter({ hasText: c }); await row.getByRole('button', { name: 'Edit', exact: true }).click();
    const edit = p.getByRole('dialog', { name: 'Edit Vendor', exact: true }); await edit.getByLabel('Kota', { exact: true }).fill('Bandung CRUD');
    await edit.getByRole('button', { name: 'Simpan', exact: true }).click(); await edit.waitFor({ state: 'detached' });
    assert.equal(sql(`SELECT city FROM public.vendors WHERE vendor_code='${c}';`), 'Bandung CRUD');
    p.once('dialog', (d) => d.accept()); await row.getByRole('button', { name: 'Hapus', exact: true }).click(); await row.waitFor({ state: 'detached' });
    assert.equal(masterHash(), masterBefore);
    pass(`${role} retains actual browser CRUD${role === 'super_admin' ? ' and Super Admin module bypass' : ''}`); await admin.ctx.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(sourceMasterWrites, []); assert.deepEqual(blockedWrites, []);
  assert.ok(!external.some((host) => host.endsWith('supabase.co')));
  pass('No page errors, Sourcing master writes, unexpected writes or production requests');
} catch (error) {
  checks.push({ check: error.message, pass: false });
  if (page && !page.isClosed()) await page.screenshot({ path: `${dir}/failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser?.close(); await server?.close();
  sql(`BEGIN; ALTER TABLE public.vendor_locations DISABLE TRIGGER trg_vendor_locations_guard;
    DELETE FROM public.vendor_locations WHERE candidate_id IN(SELECT id FROM public.vendor_candidates WHERE vendor_id='${vendorId}');
    ALTER TABLE public.vendor_locations ENABLE TRIGGER trg_vendor_locations_guard;
    DELETE FROM public.vendor_candidates WHERE vendor_id='${vendorId}';
    DELETE FROM public.vendors WHERE id='${vendorId}' OR vendor_code IN ('CRUD-${run}-S','CRUD-${run}-H'); COMMIT;`);
  for (const id of accounts) { const p = await service.from('user_profiles').delete().eq('auth_user_id', id); assert.ifError(p.error); const a = await service.auth.admin.deleteUser(id); assert.ifError(a.error); }
  const unchanged = before === snapshot(), policiesUnchanged = policiesBefore === policySnapshot();
  checks.push({ check: 'Cleanup restores 14 table checksums including Auth users/identities and exact vendor RLS metadata', pass: unchanged && policiesUnchanged });
  writeFileSync(`${dir}/RESULTS.json`, JSON.stringify({ checked_at: new Date().toISOString(), target: 'Docker synthetic + loopback browser', production_accessed: false, permission_switches_mocked_in_browser: true, rls_policy_fixture: 'Temporary transaction-scoped writer policy; original fixture RLS/policies restored by ROLLBACK', accounts_cleaned: accounts.length, browser_errors: errors, sourcing_master_write_requests: sourceMasterWrites, checks }, null, 2) + '\n');
  assert.ok(unchanged && policiesUnchanged, 'Cleanup checksum or policy mismatch');
}
