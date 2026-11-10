// Auth/profile mutations are limited to new disposable accounts on Docker loopback.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { createAdminUserHandler } from '../supabase/functions/admin-update-user/handler.js';

const nativeDeno = process.env.HARMAS_DENO_BINARY;
const api = 'http://127.0.0.1:54321', origin = 'http://127.0.0.1:7020', backend = nativeDeno ? 'http://127.0.0.1:8000' : 'http://127.0.0.1:7021';
const db = 'supabase_db_harmas-vendor-test';
assert.equal(new URL(api).hostname, '127.0.0.1');
const anon = process.env.HARMAS_LOCAL_ANON_KEY, secret = process.env.HARMAS_LOCAL_SERVICE_KEY;
assert.ok(anon && secret && process.env.PLAYWRIGHT_PACKAGE_PATH, 'Local test environment required');
const docker = (args, input) => { const r = spawnSync('docker', args, { input, encoding: 'utf8', maxBuffer: 8e6 }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
const sql = (q) => docker(['exec', '-i', db, 'psql', '-X', '-q', '-A', '-t', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], q);
const tables = ['vendors', 'assets', 'user_profiles', 'roles', 'role_permissions', 'notifications', 'vendor_candidates', 'vendor_locations', 'vendor_location_photos', 'vendor_followups', 'vendor_status_history', 'vendor_activity_logs', 'auth.users', 'auth.identities'];
const snapshot = () => sql(`SELECT jsonb_object_agg(name,hash) FROM (${tables.map((t) => `SELECT '${t}' name,md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) hash FROM ${t.includes('.') ? t : `public.${t}`} x`).join(' UNION ALL ')}) q;`);
const before = snapshot(), created = [], logs = [], checks = [], browserErrors = [], blocked = [], writes = [];
const dir = 'docs/user-management/evidence'; mkdirSync(dir, { recursive: true });
const run = randomUUID().slice(0, 8), password = `Test-${randomUUID()}!9`, newPassword = `New-${randomUUID()}!8`;
const client = createClient(api, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const env = (name) => ({ SUPABASE_URL: api, SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: secret })[name];
const handler = createAdminUserHandler({ createClient, env, log: (record) => logs.push(record) });
const pass = (check) => { checks.push({ check, pass: true }); console.log(`PASS | ${check}`); };
const schema = JSON.parse(sql(`SELECT jsonb_build_object('departments',to_regclass('public.departments') IS NOT NULL,'subs',to_regclass('public.sub_departments') IS NOT NULL,'dept_id',EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='department_id'),'sub_id',EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='sub_department_id'));`));
const dept = randomUUID(), dept2 = randomUUID(), sub = randomUUID();
let server, http, browser, page, deno;
let nativeOutput = '';
const sessions = {};
async function account(label, role, status = 'ACTIVE') {
  const email = `admin-edit-${run}-${label}@harmas.local`;
  const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `[ADM-${run}] ${label}` } });
  assert.ifError(error); created.push(data.user.id);
  const { data: r, error: roleError } = await client.from('roles').select('id').eq('role_name', role).single(); assert.ifError(roleError);
  const { data: profile, error: profileError } = await client.from('user_profiles').insert({ auth_user_id: data.user.id, full_name: `[ADM-${run}] ${label}`, email, role_id: r.id, account_status: status, phone: '', department: '', position: '' }).select('*').single(); assert.ifError(profileError);
  const auth = createClient(api, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await auth.auth.signInWithPassword({ email, password }); assert.ifError(login.error);
  return { ...profile, session: login.data.session };
}
async function call(token, body, custom = handler) {
  const r = await custom(new Request(`${backend}/admin-update-user`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }));
  return { status: r.status, body: await r.json() };
}
async function current(id) { const { data, error } = await client.from('user_profiles').select('*').eq('id', id).single(); assert.ifError(error); return data; }
async function login(email, pw) { return createClient(api, anon, { auth: { persistSession: false, autoRefreshToken: false } }).auth.signInWithPassword({ email, password: pw }); }
const fields = (p, overrides = {}) => ({ full_name: p.full_name, email: p.email, phone: p.phone || '', department: p.department || '', department_id: p.department_id || '', sub_department_id: p.sub_department_id || '', position: p.position || '', ...overrides });
try {
  // Faithful minimal organization schema, only where absent in the synthetic stack.
  sql(`CREATE TABLE IF NOT EXISTS public.departments(id uuid PRIMARY KEY,department_name text,department_code text,is_active boolean DEFAULT true);
    CREATE TABLE IF NOT EXISTS public.sub_departments(id uuid PRIMARY KEY,department_id uuid REFERENCES public.departments(id),sub_department_name text,sub_department_code text,is_active boolean DEFAULT true);
    ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id),ADD COLUMN IF NOT EXISTS sub_department_id uuid REFERENCES public.sub_departments(id);
    GRANT SELECT ON public.departments,public.sub_departments TO authenticated,service_role;
    INSERT INTO public.departments(id,department_name,department_code) VALUES ('${dept}','[ADM] Resources','ADM-${run}-1'),('${dept2}','[ADM] Produksi','ADM-${run}-2');
    INSERT INTO public.sub_departments(id,department_id,sub_department_name,sub_department_code) VALUES ('${sub}','${dept}','[ADM] Sourcing','ADM-${run}-S'); NOTIFY pgrst,'reload schema';`);
  // Wait for PostgREST's schema-cache reload, never fall back to a production URL.
  for (let i = 0; i < 30; i++) { const r = await client.from('user_profiles').select('department_id').limit(0); if (!r.error) break; await new Promise((resolve) => setTimeout(resolve, 100)); if (i === 29) throw r.error; }
  sessions.admin = await account('admin', 'super_admin'); sessions.target = await account('target', 'sourcing'); sessions.other = await account('other', 'pelaksana');
  for (const role of ['hrd', 'direksi', 'sourcing', 'pelaksana', 'finance']) sessions[role] = await account(role, role);
  sessions.inactive = await account('inactive', 'super_admin', 'PENDING');
  const token = sessions.admin.session.access_token, target = sessions.target;
  const reset = { action: 'reset_password', profile_id: target.id, password: newPassword };
  assert.equal((await call('', reset)).status, 401); assert.equal((await call('not-a-valid-token', reset)).status, 401);
  pass('Missing/forged identity rejected by Auth before any mutation');
  for (const role of ['hrd', 'direksi', 'sourcing', 'pelaksana', 'finance', 'inactive']) assert.equal((await call(sessions[role].session.access_token, reset)).status, 403, role);
  pass('HRD, Direksi, Sourcing, Pelaksana, Finance and inactive Super Admin denied');
  const demoted = await client.from('user_profiles').update({ account_status: 'ACTIVE', role_id: sessions.other.role_id }).eq('id', sessions.inactive.id); assert.ifError(demoted.error);
  assert.equal((await call(sessions.inactive.session.access_token, reset)).status, 403);
  pass('Live database role checked even when the same session previously belonged to Super Admin');
  assert.equal((await call(token, { ...reset, role: 'super_admin' })).status, 400);
  assert.equal((await call(token, { ...reset, auth_user_id: sessions.other.auth_user_id })).status, 400);
  assert.equal((await call(token, { ...reset, profile_id: randomUUID() })).status, 404);
  pass('Unknown fields, caller-supplied Auth ID and missing target rejected');
  assert.equal((await call(token, { ...reset, password: 'short' })).status, 400);
  assert.equal((await call(token, { ...reset, password: '        ' })).status, 400);
  pass('Short or whitespace-only password rejected without changing credentials');
  const original = await current(target.id);
  const p = fields(original, { full_name: `[ADM-${run}] Edited`, phone: '081234560001', department_id: dept, sub_department_id: sub, position: 'Staf Resources' });
  const profileRequest = { action: 'update_profile', profile_id: target.id, expected_updated_at: original.updated_at, profile: p };
  assert.equal((await call(token, { ...profileRequest, profile: { ...p, role_id: sessions.admin.role_id } })).status, 400);
  assert.equal((await call(token, { ...profileRequest, profile: { ...p, department_id: dept2 } })).status, 400);
  pass('Identity allowlist and department/subdepartment relationship enforced server-side');
  const saved = await call(token, profileRequest); assert.equal(saved.status, 200, saved.body.error);
  let updated = await current(target.id);
  assert.equal(updated.full_name, p.full_name); assert.equal(updated.department, '[ADM] Resources'); assert.equal(updated.position, p.position);
  for (const key of ['role_id', 'account_status', 'auth_user_id', 'approved_by', 'approved_at']) assert.equal(updated[key], original[key], key);
  pass('Super Admin updates identity and organization; role/status/approval/Auth link unchanged');
  assert.equal((await call(token, profileRequest)).status, 409);
  pass('Stale edit rejected with optimistic concurrency check');
  const changedEmail = `admin-edited-${run}@harmas.local`;
  const emailEdit = await call(token, { ...profileRequest, expected_updated_at: updated.updated_at, profile: fields(updated, { email: changedEmail }) }); assert.equal(emailEdit.status, 200, emailEdit.body.error);
  assert.equal((await current(target.id)).email, changedEmail); assert.ok((await login(changedEmail, password)).data.user); assert.ok((await login(original.email, password)).error);
  pass('Edited email synchronized with Auth; new address logs in and old address fails');
  updated = await current(target.id);
  assert.equal((await call(token, { ...profileRequest, expected_updated_at: updated.updated_at, profile: fields(updated, { email: sessions.other.email }) })).status, 400);
  assert.equal((await current(target.id)).email, changedEmail);
  pass('Duplicate login email rejected without changing public profile');
  const failingClient = (...args) => {
    const c = createClient(...args), from = c.from.bind(c);
    c.from = (table) => { const q = from(table); if (table === 'user_profiles') q.update = () => {
      const f = { eq: () => f, is: () => f, select: () => f, maybeSingle: async () => ({ data: null, error: { code: 'TEST_SAVE_FAILED' } }) }; return f;
    }; return q; }; return c;
  };
  const rollback = createAdminUserHandler({ createClient: failingClient, env, log: (record) => logs.push(record) });
  const rejectedEmail = `admin-rollback-${run}@harmas.local`;
  const failed = await call(token, { ...profileRequest, expected_updated_at: updated.updated_at, profile: fields(updated, { email: rejectedEmail }) }, rollback);
  assert.equal(failed.status, 409); assert.notEqual(failed.body.needs_review, true);
  assert.equal((await current(target.id)).email, changedEmail); assert.ok((await login(changedEmail, password)).data.user); assert.ok((await login(rejectedEmail, password)).error);
  pass('Injected public-profile write failure compensates real Auth email mutation');
  const originalAuth = (await client.auth.admin.getUserById(target.auth_user_id)).data.user;
  const concurrentClient = (...args) => {
    const c = createClient(...args), from = c.from.bind(c);
    c.from = (table) => { const q = from(table); if (table === 'user_profiles') q.update = () => {
      const f = { eq: () => f, is: () => f, select: () => f, maybeSingle: async () => {
        const { error } = await c.auth.admin.updateUserById(target.auth_user_id, { user_metadata: { full_name: 'Concurrent update' } }); assert.ifError(error);
        return { data: null, error: { code: 'TEST_CONCURRENT_FAILURE' } };
      } }; return f;
    }; return q; }; return c;
  };
  const concurrent = await call(token, { ...profileRequest, expected_updated_at: updated.updated_at, profile: fields(updated, { email: rejectedEmail }) }, createAdminUserHandler({ createClient: concurrentClient, env, log: (record) => logs.push(record) }));
  assert.equal(concurrent.status, 409); assert.equal(concurrent.body.needs_review, true);
  assert.equal((await client.auth.admin.getUserById(target.auth_user_id)).data.user.user_metadata.full_name, 'Concurrent update');
  const restore = await client.auth.admin.updateUserById(target.auth_user_id, { email: changedEmail, email_confirm: true, user_metadata: originalAuth.user_metadata }); assert.ifError(restore.error);
  pass('Concurrent Auth change is preserved; partial synchronization returns explicit review error');
  const concurrentProfileClient = (...args) => {
    const c = createClient(...args), from = c.from.bind(c);
    c.from = (table) => { const q = from(table); if (table === 'user_profiles') q.update = () => {
      const f = { eq: () => f, is: () => f, select: () => f, maybeSingle: async () => {
        const { error } = await client.from('user_profiles').update({ full_name: `[ADM-${run}] Concurrent profile`, updated_at: new Date().toISOString() }).eq('id', target.id); assert.ifError(error);
        return { data: null, error: { code: 'TEST_CONCURRENT_PROFILE' } };
      } }; return f;
    }; return q; }; return c;
  };
  const profileConflict = await call(token, { ...profileRequest, expected_updated_at: updated.updated_at, profile: fields(updated, { email: rejectedEmail }) }, createAdminUserHandler({ createClient: concurrentProfileClient, env, log: (record) => logs.push(record) }));
  assert.equal(profileConflict.status, 409); assert.equal(profileConflict.body.needs_review, true);
  assert.equal((await current(target.id)).full_name, `[ADM-${run}] Concurrent profile`);
  assert.equal((await client.auth.admin.getUserById(target.auth_user_id)).data.user.email, rejectedEmail);
  const restoreProfile = await client.from('user_profiles').update({ full_name: updated.full_name, updated_at: new Date().toISOString() }).eq('id', target.id); assert.ifError(restoreProfile.error);
  const restoreAuth = await client.auth.admin.updateUserById(target.auth_user_id, { email: changedEmail, email_confirm: true, user_metadata: originalAuth.user_metadata }); assert.ifError(restoreAuth.error);
  updated = await current(target.id);
  pass('Concurrent public-profile edit prevents unsafe restoration of an older Auth identity');
  const beforeReset = await current(target.id);
  assert.equal((await call(token, reset)).status, 200);
  assert.ok((await login(changedEmail, password)).error); assert.ok((await login(changedEmail, newPassword)).data.user);
  assert.deepEqual(await current(target.id), beforeReset);
  assert.ok((await login(sessions.other.email, password)).data.user);
  pass('Admin password reset changes only target Auth credentials; profile and other user unchanged');

  if (nativeDeno) {
    deno = spawn(nativeDeno, ['run', '--no-config', '--no-lock', '--allow-env=SUPABASE_URL,SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY', '--allow-net=0.0.0.0:8000,127.0.0.1:54321', 'supabase/functions/admin-update-user/index.ts'], {
      env: { ...process.env, SUPABASE_URL: api, SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: secret }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
    });
    deno.stdout.on('data', (chunk) => { nativeOutput += chunk.toString(); }); deno.stderr.on('data', (chunk) => { nativeOutput += chunk.toString(); });
    let ready = false;
    for (let i = 0; i < 300; i++) { if (deno.exitCode !== null) throw new Error('Native Deno entrypoint exited before startup'); try { const r = await fetch(backend, { signal: AbortSignal.timeout(500) }); if (r.status === 405) { ready = true; break; } } catch { /* Still downloading pinned runtime imports/startup. */ } await new Promise((resolve) => setTimeout(resolve, 100)); }
    assert.ok(ready, 'Native Deno entrypoint did not start');
  } else {
  http = createHttpServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const r = await handler(new Request(`${backend}${req.url}`, { method: req.method, headers: req.headers, ...(req.method === 'POST' ? { body: Buffer.concat(chunks) } : {}) }));
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
  }); await new Promise((resolve) => http.listen(7021, '127.0.0.1', resolve));
  }
  const { createServer } = await import('vite'); server = await createServer({ envFile: false, define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(api), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(anon) }, server: { host: '127.0.0.1', port: 7020, strictPort: true }, clearScreen: false }); await server.listen();
  const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_PACKAGE_PATH).href); browser = await chromium.launch({ headless: true });
  async function contextFor(session) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript((s) => localStorage.setItem('sb-127-auth-token', JSON.stringify(s)), session);
    await ctx.route('**/*', async (route) => {
      const req = route.request(), url = new URL(req.url());
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { blocked.push(url.hostname); return route.abort(); }
      if (url.pathname === '/functions/v1/smooth-task') {
        writes.push({ path: url.pathname, keys: Object.keys(req.postDataJSON()) });
        const response = await route.fetch({ url: `${backend}/admin-update-user` }); return route.fulfill({ response });
      }
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method())) return route.fulfill({ status: 200, contentType: 'application/json', body: '0' });
      return route.continue();
    });
    const p = await ctx.newPage(); p.on('pageerror', (e) => browserErrors.push(e.message)); return { ctx, page: p };
  }
  const adminBrowser = await contextFor(sessions.admin.session); page = adminBrowser.page;
  await page.goto(`${origin}/users`); await page.getByRole('heading', { name: 'Manajemen Pengguna', exact: true }).waitFor();
  await page.getByRole('button', { name: `Edit identitas ${p.full_name}`, exact: true }).click();
  let modal = page.getByRole('dialog', { name: 'Edit Identitas Pengguna', exact: true });
  assert.equal(await modal.getByLabel('Email login', { exact: true }).inputValue(), changedEmail);
  await modal.getByLabel('Nama lengkap', { exact: true }).fill(`[ADM-${run}] UI Edited`);
  await modal.getByLabel('Nomor WhatsApp / telepon', { exact: true }).fill('081234560099');
  await modal.getByRole('button', { name: 'Simpan Identitas', exact: true }).click(); await modal.waitFor({ state: 'detached' });
  updated = await current(target.id); assert.equal(updated.phone, '081234560099'); assert.equal(updated.full_name, `[ADM-${run}] UI Edited`);
  pass('Browser → function handler → real Auth/PostgREST → refreshed user row succeeds');
  await page.getByRole('button', { name: `Edit identitas ${updated.full_name}`, exact: true }).click(); modal = page.getByRole('dialog');
  await modal.getByLabel('Nomor WhatsApp / telepon', { exact: true }).fill('081234560088');
  await page.route('**/functions/v1/smooth-task', (route) => route.fulfill({ status: 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ code: 'NOT_FOUND' }) }));
  await modal.getByRole('button', { name: 'Simpan Identitas', exact: true }).click(); await modal.getByText(/Layanan perubahan pengguna belum aktif/).waitFor();
  assert.equal(await modal.getByLabel('Nomor WhatsApp / telepon', { exact: true }).inputValue(), '081234560088'); assert.equal((await current(target.id)).phone, '081234560099');
  await page.unroute('**/functions/v1/smooth-task');
  await modal.getByRole('button', { name: 'Simpan Identitas', exact: true }).click(); await modal.waitFor({ state: 'detached' }); updated = await current(target.id); assert.equal(updated.phone, '081234560088');
  pass('Missing backend gives clear error, preserves edits, and retry succeeds when available');
  await page.getByRole('button', { name: `Edit identitas ${updated.full_name}`, exact: true }).click(); modal = page.getByRole('dialog');
  await modal.getByLabel('Nama lengkap', { exact: true }).fill('Unsaved'); await page.keyboard.press('Escape'); await modal.waitFor({ state: 'detached' });
  assert.equal((await current(target.id)).full_name, updated.full_name);
  pass('Cancel/Escape discards identity changes');
  await page.getByRole('button', { name: `Ubah password ${updated.full_name}`, exact: true }).click(); modal = page.getByRole('dialog', { name: 'Ubah Password Pengguna', exact: true });
  await modal.getByLabel('Password baru', { exact: true }).fill(password); await modal.getByLabel('Konfirmasi password baru', { exact: true }).fill(newPassword);
  const beforeMismatch = writes.length; await modal.getByRole('button', { name: 'Simpan Password Baru', exact: true }).click(); await modal.getByRole('alert').waitFor(); assert.equal(writes.length, beforeMismatch);
  pass('Password confirmation mismatch never sends an update request');
  await modal.getByLabel('Konfirmasi password baru', { exact: true }).fill(password);
  await modal.getByRole('button', { name: 'Tampilkan password baru', exact: true }).click(); assert.equal(await modal.getByLabel('Password baru', { exact: true }).getAttribute('type'), 'text');
  await modal.getByRole('button', { name: 'Sembunyikan password baru', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: `${dir}/admin-password-mobile.png`, animations: 'disabled' });
  await modal.getByRole('button', { name: 'Simpan Password Baru', exact: true }).click(); await modal.waitFor({ state: 'detached' });
  assert.ok((await login(changedEmail, password)).data.user); assert.ok((await login(changedEmail, newPassword)).error);
  pass('Browser password reset works on mobile; new login verified and former password rejected');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: `Edit identitas ${updated.full_name}`, exact: true }).click(); await page.screenshot({ path: `${dir}/admin-identity-desktop.png`, animations: 'disabled' }); await page.keyboard.press('Escape');
  await adminBrowser.ctx.close();
  const nonAdmin = await contextFor(sessions.hrd.session); await nonAdmin.page.goto(`${origin}/users`); await nonAdmin.page.waitForURL(`${origin}/dashboard`); await nonAdmin.ctx.close();
  pass('Existing /users route guard still rejects HRD');
  const logText = JSON.stringify(logs);
  assert.ok(!logText.includes(password) && !logText.includes(newPassword)); assert.ok(!logText.includes(secret));
  assert.ok(!nativeOutput.includes(password) && !nativeOutput.includes(newPassword) && !nativeOutput.includes(secret));
  assert.ok(logs.some((r) => r.action === 'reset_password' && r.outcome === 'success' && r.actor_profile_id === sessions.admin.id && r.target_profile_id === target.id));
  assert.deepEqual(browserErrors, []); assert.ok(!blocked.some((h) => h.endsWith('supabase.co')));
  pass('Audit identifies actor/action/target without passwords; no browser exceptions or production requests');
} catch (error) {
  checks.push({ check: error.message, pass: false });
  if (page && !page.isClosed()) await page.screenshot({ path: `${dir}/failure.png`, animations: 'disabled' }).catch(() => {});
  throw error;
} finally {
  await browser?.close(); await server?.close(); await new Promise((resolve) => http ? http.close(resolve) : resolve());
  if (deno && deno.exitCode === null) { deno.kill(); await new Promise((resolve) => deno.once('exit', resolve)); }
  for (const id of created) { const r = await client.from('user_profiles').delete().eq('auth_user_id', id); assert.ifError(r.error); const a = await client.auth.admin.deleteUser(id); assert.ifError(a.error); }
  sql(`BEGIN; ${!schema.sub_id ? 'ALTER TABLE public.user_profiles DROP COLUMN sub_department_id;' : ''} ${!schema.dept_id ? 'ALTER TABLE public.user_profiles DROP COLUMN department_id;' : ''}
    DELETE FROM public.sub_departments WHERE id='${sub}'; DELETE FROM public.departments WHERE id IN ('${dept}','${dept2}');
    ${!schema.subs ? 'DROP TABLE public.sub_departments;' : ''} ${!schema.departments ? 'DROP TABLE public.departments;' : ''} NOTIFY pgrst,'reload schema'; COMMIT;`);
  const unchanged = snapshot() === before; checks.push({ check: 'Cleanup restores 14 table checksums including original Auth users/identities', pass: unchanged });
  writeFileSync(`${dir}/RESULTS.json`, JSON.stringify({ checked_at: new Date().toISOString(), target: nativeDeno ? 'Docker synthetic + browser through native Deno Edge entrypoint' : 'Docker synthetic + loopback Node HTTP adapter of shared Edge handler', deno_runtime_executed: Boolean(nativeDeno), production_accessed: false, new_accounts_cleaned: created.length, browser_errors: browserErrors, checks, audit_events: logs.length }, null, 2) + '\n');
  assert.ok(unchanged, 'Baseline checksum mismatch');
}
