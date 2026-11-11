// Only the fixed loopback Docker stack. Public Ofissio HTTP responses are injected fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { createOfissioCatalogHandler, normalizeOfissioProduct } from '../supabase/functions/vendor-ofissio-catalog/handler.js';
const api = 'http://127.0.0.1:54321', origin = 'http://127.0.0.1:7028', db = 'supabase_db_harmas-vendor-test';
const sql = query => { const r = spawnSync('docker', ['exec', '-i', db, 'psql', '-X', '-q', '-A', '-t', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: query, encoding: 'utf8', maxBuffer: 16e6 }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
const kong = spawnSync('docker', ['exec', 'supabase_kong_harmas-vendor-test', 'cat', '/home/kong/kong.yml'], { encoding: 'utf8' }); assert.equal(kong.status, 0);
const anon = kong.stdout.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
const secret = [...kong.stdout.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)].map(m => m[0]).find(k => JSON.parse(Buffer.from(k.split('.')[1], 'base64url')).role === 'service_role');
assert.ok(anon && secret); assert.equal(new URL(api).hostname, '127.0.0.1');
const client = key => createClient(api, key, { auth: { persistSession: false, autoRefreshToken: false } }), service = client(secret);
const ok = r => { assert.ifError(r.error); return r.data; }, denied = r => assert.ok(r.error || (Array.isArray(r.data) && !r.data.length));
const tables = ['vendors', 'assets', 'user_profiles', 'roles', 'role_permissions', 'notifications', 'vendor_candidates', 'vendor_categories', 'vendor_specialties', 'vendor_contacts', 'vendor_locations', 'vendor_location_photos', 'vendor_followups', 'vendor_status_history', 'vendor_activity_logs', 'auth.users', 'auth.identities'];
const snapshot = () => sql(`SELECT jsonb_object_agg(name,hash) FROM (${tables.map(t => `SELECT '${t}' name,md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'')) hash FROM ${t.includes('.') ? t : `public.${t}`} x`).join(' UNION ALL ')}) q;`);
const security = () => sql(`SELECT jsonb_build_object('policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname) FROM pg_policies p WHERE schemaname IN ('public','storage') AND tablename<>'vendor_sample_product_references' AND policyname NOT LIKE 'Vendor product reference %'),'functions',(SELECT jsonb_agg(jsonb_build_object('name',oid::regprocedure::text,'definition',pg_get_functiondef(oid),'acl',proacl) ORDER BY oid::regprocedure::text) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f' AND proname NOT IN ('vendor_product_reference_immutable','vendor_sample_reference_code_guard','vendor_create_ofissio_sample','vendor_product_reference_storage_read')));`);
assert.equal(sql("SELECT to_regclass('public.vendor_samples') IS NULL AND to_regclass('public.vendor_decisions') IS NULL AND to_regclass('public.vendor_sample_product_references') IS NULL;"), 't', 'Refuse a pre-existing test installation');
const before = snapshot(), securityBefore = security(), hasEmployees = sql("SELECT to_regclass('public.employees') IS NOT NULL;") === 't';
const names = ['202611110001_vendor_management_phase4', '202611110002_vendor_management_phase5', '202611110003_vendor_sample_ofissio_references'];
const migration = name => fs.readFileSync(`supabase/migrations/${name}.sql`, 'utf8');
const rollback = name => fs.readFileSync(`supabase/rollbacks/${name}_rollback.sql`, 'utf8');
const dir = 'docs/vendor-management/ofissio-catalog-evidence'; fs.mkdirSync(dir, { recursive: true });
const results = [], accounts = [], sessions = {}, candidates = [randomUUID(), randomUUID(), randomUUID()], permissionsAdded = [];
const run = randomUUID().slice(0, 8), password = `Local-${randomUUID()}!9`, bucket = 'vendor-product-references';
const bucketBefore = {};
for (const b of ['vendor-sample-files', 'vendor-decision-files', bucket]) bucketBefore[b] = (await service.storage.getBucket(b)).data;
const pass = (check, kind = 'database/API') => { results.push({ check, kind, pass: true }); console.log(`PASS | ${kind} | ${check}`); };
let phase4 = false, phase5 = false, installed = false, server, browser, currentPage;
let mode = 'normal', upstreamCalls = 0, forceRpcFailure = false;
const errors = [], outside = [], logs = [];
const checkpoint = state => { fs.mkdirSync('.vercel', { recursive: true }); fs.writeFileSync('.vercel/ofissio-test-state.json', JSON.stringify({ state, run, candidates, accounts, permissions_added: permissionsAdded, baseline: before, security_baseline: securityBefore, employees_existed: hasEmployees, bucket_existed: Object.fromEntries(Object.entries(bucketBefore).map(([name, value]) => [name, Boolean(value)])) })); };
const photo = fs.readFileSync('test-fixtures/vendor-ofissio/ks-003.webp');
const product = { id: 'wc-462', sku: 'KS-003', slug: 'kemeja-safety-ks-003', name: 'Kemeja Safety KS-003', material: 'American Drill', mainImage: 'https://woo.ofissio.com/wp-content/uploads/2026/09/ks-003.webp' };
const fixtureFetch = async url => {
  upstreamCalls++;
  if (url.startsWith('https://ofissio.com/api/catalog/search?q=')) {
    if (mode === 'offline') throw Error('Offline fixture');
    if (mode === 'bad-json') return new Response('<html>error</html>');
    if (mode === 'rate-limit') return new Response('', { status: 429 });
    const q = new URL(url).searchParams.get('q');
    return Response.json({ ok: true, result: { resultCount: q === 'nothing' ? 0 : 1, products: q === 'nothing' || mode === 'missing' ? [] : [{ ...product, ...(mode === 'changed' ? { name: 'Katalog baru', material: 'Bahan baru' } : {}) }] } });
  }
  assert.equal(url, product.mainImage, 'Only the allowlisted public fixture image may be requested');
  if (mode === 'photo-redirect') throw Error('Redirect refused');
  if (mode === 'photo-html') return new Response('<html>not a photo</html>', { headers: { 'Content-Type': 'image/webp' } });
  if (mode === 'photo-large') return new Response(new Uint8Array(5242881), { headers: { 'Content-Type': 'image/png' } });
  if (mode === 'photo-mime') return new Response(photo, { headers: { 'Content-Type': 'image/png' } });
  return new Response(photo, { headers: { 'Content-Type': 'image/webp' } });
};
const env = key => ({ SUPABASE_URL: api, SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: secret })[key];
const create = (...args) => {
  const c = createClient(...args);
  if (forceRpcFailure && args[1] === secret) {
    const original = c.rpc.bind(c), after = forceRpcFailure === 'after';
    c.rpc = async (...params) => { if (after) ok(await original(...params)); return { error: { message: 'Simulated lost network response' } }; };
  }
  return c;
};
const handler = () => createOfissioCatalogHandler({ createClient: create, env, fetchImpl: fixtureFetch, log: v => logs.push(v) });
let handle = handler();
async function call(payload, role = 'sourcing', custom = {}) {
  const response = await handle(new Request(api + '/functions/v1/vendor-ofissio-catalog', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(sessions[role] ? { Authorization: `Bearer ${sessions[role].session.access_token}` } : {}), ...custom }, body: JSON.stringify(payload) }));
  return { status: response.status, data: await response.json() };
}
const sampleInput = (candidate = candidates[0]) => ({ candidate_id: candidate, sample_type: 'JAHIT_PRODUK', brief: 'Kemeja safety acuan KS-003, ukuran M, warna sesuai brief', material_source: 'HARMAS', quantity: 1, unit: 'pcs', cost: null, internal_pic_id: null, assigned_at: null, target_date: null, received_at: null, notes: null, revision_note: null, related_sample_id: null });
const request = (id = randomUUID(), candidate = candidates[0]) => ({ action: 'create_sample', request_id: id, product_id: product.id, sku: product.sku, sample: sampleInput(candidate) });
const get = async (table, id) => ok(await service.from(table).select('*').eq(table === 'vendor_sample_product_references' ? 'sample_id' : 'id', id).single());
async function account(role, status = 'ACTIVE') {
  const email = `ofissio-${run}-${role}-${status}@harmas.local`, user = ok(await service.auth.admin.createUser({ email, password, email_confirm: true })).user; accounts.push(user.id); checkpoint('fixture_accounts');
  const r = ok(await service.from('roles').select('id').eq('role_name', role).single());
  const profile = ok(await service.from('user_profiles').insert({ auth_user_id: user.id, email, full_name: `[OFISSIO] ${role}`, role_id: r.id, account_status: status }).select('id').single());
  const c = client(anon), login = ok(await c.auth.signInWithPassword({ email, password }));
  return { client: c, session: login.session, profileId: profile.id, roleId: r.id, authId: user.id };
}
try {
  checkpoint('started');
  if (!hasEmployees) sql('CREATE TABLE public.employees(id uuid PRIMARY KEY,full_name text,is_active boolean DEFAULT true);GRANT SELECT ON public.employees TO authenticated,service_role;');
  sql(migration(names[0])); phase4 = true; sql(migration(names[1])); phase5 = true;
  const phase45Security = security(), phase45Before = snapshot();
  sql(migration(names[2])); installed = true; sql(migration(names[2]));
  assert.equal(snapshot(), phase45Before); assert.equal(security(), phase45Security);
  pass('Migration twice preserves 17 baseline data checksums and every existing Phase 1–5 function/ACL/policy');
  assert.equal(sql("SELECT relrowsecurity FROM pg_class WHERE oid='public.vendor_sample_product_references'::regclass;"), 't');
  for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES', 'MAINTAIN']) assert.equal(sql(`SELECT has_table_privilege('authenticated','public.vendor_sample_product_references','${privilege}');`), 'f');
  pass('New reference table has RLS, SELECT only; administrative privileges outside RLS revoked');
  sql("CREATE POLICY unexpected_reference_policy ON public.vendor_sample_product_references FOR SELECT USING(true);"); assert.throws(() => sql(migration(names[2])), /Policy referensi produk tidak dikenal/); sql('DROP POLICY unexpected_reference_policy ON public.vendor_sample_product_references;');
  pass('Unknown policy aborts migration replay instead of silently activating it');
  sql("NOTIFY pgrst, 'reload schema';");
  for (let i = 0; i < 30; i++) { if (!(await service.from('vendor_sample_product_references').select('sample_id').limit(0)).error) break; await new Promise(r => setTimeout(r, 200)); }
  for (const role of ['sourcing', 'hrd', 'super_admin', 'direksi', 'finance', 'pelaksana']) sessions[role] = await account(role);
  sessions.inactive = await account('sourcing', 'PENDING');
  const hrdPermission = await service.from('role_permissions').select('id').eq('role_id', sessions.hrd.roleId).eq('module_key', 'vendor_samples').maybeSingle();
  if (!ok(hrdPermission)) permissionsAdded.push(ok(await service.from('role_permissions').insert({ role_id: sessions.hrd.roleId, module_key: 'vendor_samples', can_access: true }).select('id').single()).id);
  const category = ok(await service.from('vendor_categories').select('id').limit(1))[0].id;
  for (const [i, id] of candidates.entries()) ok(await sessions.sourcing.client.from('vendor_candidates').insert({ id, business_name: `[OFISSIO ${run}] ${i}`, category_id: category, internal_pic_id: sessions.sourcing.profileId }));
  assert.equal((await call({ action: 'search', query: 'KS-003' }, 'anonymous')).status, 401);
  assert.equal((await call({ action: 'search', query: 'KS-003' }, 'anonymous', { Authorization: 'Bearer invalid' })).status, 401);
  for (const role of ['finance', 'pelaksana', 'inactive']) assert.equal((await call({ action: 'search', query: 'KS-003' }, role)).status, 403);
  assert.equal(upstreamCalls, 0); pass('Anonymous, forged token, inactive, Finance/Pelaksana rejected before upstream access');
  ok(await service.from('role_permissions').update({ can_access: false }).eq('role_id', sessions.sourcing.roleId).eq('module_key', 'vendor_samples'));
  assert.equal((await call({ action: 'search', query: 'KS-003' })).status, 403); assert.equal((await call(request())).status, 403);
  ok(await service.from('role_permissions').update({ can_access: true }).eq('role_id', sessions.sourcing.roleId).eq('module_key', 'vendor_samples'));
  pass('Backend independently enforces module permission for search and creation');
  for (const role of ['sourcing', 'hrd', 'super_admin', 'direksi']) { const r = await call({ action: 'search', query: 'KS-003' }, role); assert.equal(r.status, 200); assert.equal(r.data.products[0].sku, 'KS-003'); }
  assert.equal((await call({ action: 'search', query: 'nothing' })).data.products.length, 0);
  assert.equal((await call(request(), 'direksi')).status, 403); pass('Authorized four-role search; empty results; Direksi cannot create samples');
  for (const raw of [{ ...product, id: 'mock-462' }, { ...product, mainImage: 'https://evil.invalid/x.png' }, { ...product, mainImage: 'http://127.0.0.1/x.png' }, { ...product, mainImage: 'https://woo.ofissio.com/wp-content/uploads/a.svg' }, { ...product, mainImage: product.mainImage + '?token=x' }]) assert.equal(normalizeOfissioProduct(raw), null);
  pass('Reject demo products, SSRF hosts, HTTP, SVG and credential/query-bearing image URLs');
  for (const [current, status] of [['offline', 502], ['bad-json', 502], ['rate-limit', 429]]) { mode = current; assert.equal((await call({ action: 'search', query: 'KS-003' })).status, status); }
  mode = 'normal'; pass('Catalog outage, malformed JSON and upstream throttling return safe errors');
  const savedRequest = request(), saved = await call(savedRequest); assert.equal(saved.status, 200, JSON.stringify(saved));
  const sid = saved.data.sample.id, reference = await get('vendor_sample_product_references', sid);
  assert.equal(reference.product_name, product.name); assert.equal(reference.captured_by, sessions.sourcing.profileId); assert.equal(saved.data.sample.created_by, sessions.sourcing.profileId); assert.equal(saved.data.sample.status, 'BRIEF_DIBUAT');
  assert.equal(reference.image_sha256, createHash('sha256').update(photo).digest('hex'));
  const bytes = Buffer.from(await ok(await service.storage.from(bucket).download(reference.image_path)).arrayBuffer()); assert.deepEqual(bytes, photo);
  pass('Real Auth → handler → Storage → atomic RPC creates sample with verified image hash and authoritative Sourcing actor');
  const countBeforeRetry = upstreamCalls; mode = 'offline'; const retried = await call(savedRequest); assert.equal(retried.status, 200); assert.equal(retried.data.reused, true); assert.equal(retried.data.sample.id, sid); assert.equal(upstreamCalls, countBeforeRetry);
  assert.equal((await call({ ...savedRequest, sample: { ...savedRequest.sample, quantity: 9 } })).status, 409);
  assert.equal((await call(savedRequest, 'super_admin')).status, 409); mode = 'normal';
  pass('Retry after saved result reuses original snapshot even offline; changed payload/actor cannot reuse request ID');
  const simultaneous = request(); handle = handler(); const concurrent = await Promise.all([call(simultaneous), call(simultaneous)]); assert.ok(concurrent.every(r => r.status === 200), JSON.stringify(concurrent));
  assert.equal(sql(`SELECT count(*) FROM public.vendor_samples WHERE id='${simultaneous.request_id}';`), '1'); assert.equal(sql(`SELECT count(*) FROM public.vendor_sample_product_references WHERE sample_id='${simultaneous.request_id}';`), '1');
  pass('Concurrent same-request creation produces one sample, one snapshot and one immutable image');
  for (const role of ['hrd', 'super_admin']) { handle = handler(); assert.equal((await call(request(), role)).status, 200); } pass('HRD with module permission and Super Admin can create authenticated catalog samples');
  handle = handler();
  for (const role of ['sourcing', 'hrd', 'super_admin', 'direksi', 'finance', 'pelaksana']) {
    denied(await sessions[role].client.rpc('vendor_create_ofissio_sample', { p_actor_auth_id: sessions[role].authId, p_sample: sampleInput(), p_reference: {}, p_request_id: randomUUID() }));
    denied(await sessions[role].client.from('vendor_sample_product_references').update({ product_name: 'FAKE' }).eq('sample_id', sid).select());
    denied(await sessions[role].client.from('vendor_sample_product_references').delete().eq('sample_id', sid).select());
  }
  denied(await sessions.sourcing.client.from('vendor_sample_product_references').insert(reference));
  assert.equal((await get('vendor_sample_product_references', sid)).product_name, product.name); pass('Even app Super Admin cannot call service-only RPC or insert/edit/delete catalog snapshots directly');
  for (const role of ['sourcing', 'hrd', 'super_admin', 'direksi']) assert.equal(ok(await sessions[role].client.from('vendor_sample_product_references').select('sample_id').eq('sample_id', sid)).length, 1);
  for (const role of ['finance', 'pelaksana', 'inactive']) assert.equal(ok(await sessions[role].client.from('vendor_sample_product_references').select('sample_id')).length, 0);
  denied(await client(anon).from('vendor_sample_product_references').select('sample_id')); pass('Snapshot RLS permits only active vendor roles, including read-only Direksi');
  for (const role of ['sourcing', 'hrd', 'super_admin']) denied(await sessions[role].client.from('vendor_samples').update({ product_code: 'FAKE-CODE' }).eq('id', sid).select());
  ok(await sessions.sourcing.client.from('vendor_samples').update({ brief: 'Spesifikasi dapat diperjelas sebelum QC; acuan tidak berubah' }).eq('id', sid));
  const manual = ok(await sessions.sourcing.client.from('vendor_samples').insert({ candidate_id: candidates[0], sample_type: 'JAHIT_PRODUK', brief: 'Produk custom Harmas tetap manual', material_source: 'HARMAS', quantity: 1, unit: 'pcs', product_code: 'CUSTOM' }).select('id').single());
  ok(await sessions.sourcing.client.from('vendor_samples').update({ product_code: 'CUSTOM-REVISED' }).eq('id', manual.id));
  pass('Catalog SKU locked before QC; manual samples retain existing editing behavior and original guards');
  mode = 'changed'; assert.equal((await call({ action: 'search', query: 'KS-003' })).data.products[0].name, 'Katalog baru'); assert.equal((await get('vendor_sample_product_references', sid)).product_name, product.name); assert.equal((await get('vendor_sample_product_references', sid)).material, product.material); mode = 'normal';
  const audit = ok(await service.from('vendor_activity_logs').select('*').eq('entity_table', 'vendor_sample_product_references').eq('entity_id', sid)); assert.equal(audit.length, 1); assert.equal(audit[0].actor_id, sessions.sourcing.profileId); assert.equal(audit[0].new_values.image_sha256, reference.image_sha256);
  assert.equal('image_path' in audit[0].new_values, false); assert.equal('request_payload' in audit[0].new_values, false);
  pass('Catalog changes cannot mutate saved name/material/photo; creation audit records actor/hash/time');
  const b = ok(await service.storage.getBucket(bucket)); assert.equal(b.public, false);
  for (const role of ['sourcing', 'hrd', 'super_admin', 'direksi']) { const signed = ok(await sessions[role].client.storage.from(bucket).createSignedUrl(reference.image_path, 60)); assert.equal((await fetch(signed.signedUrl)).status, 200); }
  for (const role of ['finance', 'pelaksana', 'inactive']) assert.ok((await sessions[role].client.storage.from(bucket).createSignedUrl(reference.image_path, 60)).error);
  assert.ok((await client(anon).storage.from(bucket).createSignedUrl(reference.image_path, 60)).error); assert.notEqual((await fetch(`${api}/storage/v1/object/public/${bucket}/${reference.image_path}`)).status, 200);
  pass('Private photo signed URLs work for vendor roles; anonymous/public URL and unrelated roles denied');
  for (const role of ['sourcing', 'super_admin']) {
    assert.ok((await sessions[role].client.storage.from(bucket).upload(`${candidates[0]}/${sid}/fake.webp`, photo, { contentType: 'image/webp' })).error);
    assert.ok((await sessions[role].client.storage.from(bucket).update(reference.image_path, photo, { contentType: 'image/webp' })).error);
    denied(await sessions[role].client.storage.from(bucket).remove([reference.image_path]));
  }
  assert.deepEqual(Buffer.from(await ok(await service.storage.from(bucket).download(reference.image_path)).arrayBuffer()), photo); pass('Authenticated clients cannot upload, replace or delete immutable reference photos');
  for (const [current, status] of [['missing', 409], ['photo-redirect', 502], ['photo-html', 502], ['photo-mime', 502], ['photo-large', 413]]) {
    handle = handler(); mode = current; const r = request(); const response = await call(r); assert.equal(response.status, status, current + JSON.stringify(response)); assert.equal(sql(`SELECT count(*) FROM public.vendor_samples WHERE id='${r.request_id}';`), '0');
  }
  mode = 'normal'; pass('Removed product, redirected/invalid/oversized photo fail before sample creation');
  const rpcFailure = request(); forceRpcFailure = true; assert.equal((await call(rpcFailure)).status, 503); forceRpcFailure = false;
  assert.equal(sql(`SELECT count(*) FROM public.vendor_samples WHERE id='${rpcFailure.request_id}';`), '0'); handle = handler(); assert.equal((await call(rpcFailure)).status, 200);
  pass('RPC failure keeps safe staged image; retry validates existing bytes and creates one sample');
  const lostResponse = request(); forceRpcFailure = 'after'; handle = handler(); assert.equal((await call(lostResponse)).status, 503); forceRpcFailure = false; handle = handler(); const afterLoss = await call(lostResponse); assert.equal(afterLoss.status, 200); assert.equal(afterLoss.data.reused, true);
  assert.equal(sql(`SELECT count(*) FROM public.vendor_samples WHERE id='${lostResponse.request_id}';`), '1'); pass('COMMIT followed by lost HTTP response is recovered idempotently without deleting saved photo');
  const badPic = request(); badPic.sample.internal_pic_id = randomUUID(); assert.equal((await call(badPic)).status, 400); assert.equal(sql(`SELECT count(*) FROM public.vendor_samples WHERE id='${badPic.request_id}';`), '0'); assert.equal(sql(`SELECT count(*) FROM public.vendor_sample_product_references WHERE sample_id='${badPic.request_id}';`), '0'); pass('Real sample guard failure rolls back sample and snapshot together');
  const orphan = ok(await service.storage.from(bucket).list(`${candidates[0]}/${badPic.request_id}`)); assert.equal(orphan.length, 1); assert.ok((await sessions.sourcing.client.storage.from(bucket).createSignedUrl(`${candidates[0]}/${badPic.request_id}/${orphan[0].name}`, 60)).error); pass('Staged file from failed transaction remains unreadable without a saved reference');
  for (const bad of [{ ...request(), sample: { ...sampleInput(), created_by: sessions.super_admin.profileId } }, { ...request(), p_actor_auth_id: sessions.super_admin.authId }, { ...request(), sample: { ...sampleInput(), quantity: -1 } }, { ...request(), image_url: 'http://127.0.0.1/' }]) assert.equal((await call(bad)).status, 400);
  for (const changes of [{ quantity: true }, { target_date: '2026-99-99' }, { target_date: '2026-02-31' }]) assert.equal((await call({ ...request(), sample: { ...sampleInput(), ...changes } })).status, 400);
  pass('Client cannot inject actor, arbitrary fetch URL, unknown sample fields or invalid quantities');
  ok(await sessions.super_admin.client.rpc('vendor_set_candidate_archive', { p_candidate_id: candidates[1], p_archive: true, p_reason: 'Arsip fixture katalog lokal', p_expected_updated_at: (await get('vendor_candidates', candidates[1])).updated_at }));
  assert.equal((await call(request(randomUUID(), candidates[1]))).status, 403); pass('Archived candidate rejected before file upload/sample creation');
  handle = handler(); for (let i = 0; i < 30; i++) assert.equal((await call({ action: 'search', query: 'KS-003' })).status, 200);
  assert.equal((await call({ action: 'search', query: 'KS-003' })).status, 429); handle = handler(); pass('Per-user request throttling bounds repeated catalog requests');
  const assigned = new Date(Date.now() - 3600000).toISOString(), target = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  for (const values of [{ status: 'DITUGASKAN', assigned_at: assigned, target_date: target, internal_pic_id: sessions.sourcing.profileId }, { status: 'DIKERJAKAN' }, { status: 'SAMPEL_DITERIMA', received_at: new Date().toISOString() }, { status: 'SEDANG_QC' }]) ok(await sessions.sourcing.client.from('vendor_samples').update(values).eq('id', sid));
  const parameters = ok(await sessions.sourcing.client.from('vendor_qc_parameters').select('id').eq('is_active', true));
  ok(await sessions.sourcing.client.rpc('vendor_record_sample_qc', { p_sample_id: sid, p_payload: { inspector_name: 'Pemeriksa fixture tanpa akun', inspected_at: new Date().toISOString(), parameter_scores: Object.fromEntries(parameters.map(p => [p.id, 5])), pass_mark: 4, decision: 'LULUS', photos: [] }, p_qc_id: null, p_expected_updated_at: null }));
  assert.equal((await get('vendor_samples', sid)).status, 'SELESAI'); assert.equal((await get('vendor_candidates', candidates[0])).operational_status, 'NOT_ACTIVE');
  assert.deepEqual(await get('vendor_sample_product_references', sid), reference); pass('Referenced sample completes real QC without changing frozen reference or activating candidate');
  const basis = ok(await sessions.direksi.client.rpc('vendor_approval_checklist', { p_candidate_id: candidates[0] })).basis_token;
  denied(await service.from('vendor_sample_product_references').update({ material: 'Tampered after QC' }).eq('sample_id', sid));
  denied(await sessions.sourcing.client.from('vendor_samples').update({ brief: 'Tampered after QC' }).eq('id', sid));
  assert.equal(ok(await sessions.direksi.client.rpc('vendor_approval_checklist', { p_candidate_id: candidates[0] })).basis_token, basis); pass('QC/approval basis stays stable when attempted snapshot/brief manipulation is rejected');
  assert.throws(() => sql(rollback(names[2])), /Acuan sampel sudah berisi/); pass('Rollback refuses to discard saved sample references');
  if (process.env.PLAYWRIGHT_PACKAGE_PATH) {
    const { createServer } = await import('vite');
    server = await createServer({ envFile: false, define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(api), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(anon) }, server: { host: '127.0.0.1', port: 7028, strictPort: true }, clearScreen: false }); await server.listen();
    const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_PACKAGE_PATH).href); browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, serviceWorkers: 'block' });
    await context.addInitScript(session => localStorage.setItem('sb-127-auth-token', JSON.stringify(session)), sessions.sourcing.session);
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin === 'https://woo.ofissio.com') return route.fulfill({ body: photo, contentType: 'image/webp' });
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ body: '', contentType: 'text/css' });
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { outside.push(url.hostname); return route.abort(); }
      if (url.pathname === '/functions/v1/vendor-ofissio-catalog') {
        const response = await handle(new Request(req.url(), { method: req.method(), headers: req.headers(), body: req.postData() }));
        return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
      }
      if (url.pathname === '/rest/v1/rpc/vendor_remind_overdue_followups') return route.fulfill({ json: 0 });
      return route.continue();
    });
    currentPage = await context.newPage(); currentPage.on('pageerror', error => errors.push(error.message));
    await currentPage.goto(origin + '/vendor/samples'); await currentPage.getByRole('button', { name: 'Tambah Sampel', exact: true }).click();
    let dialog = currentPage.getByRole('dialog', { name: 'Tambah Sampel', exact: true });
    await dialog.getByLabel('Vendor *', { exact: true }).selectOption(candidates[2]); await dialog.getByLabel('Sumber produk acuan', { exact: true }).selectOption('OFISSIO');
    await dialog.getByLabel('Cari produk', { exact: true }).fill('KS-003'); mode = 'offline'; await dialog.getByRole('button', { name: 'Cari', exact: true }).click(); await dialog.getByText('Katalog Ofissio belum dapat dihubungi. Coba lagi.', { exact: true }).waitFor();
    assert.equal(sql(`SELECT count(*) FROM public.vendor_samples WHERE candidate_id='${candidates[2]}';`), '0'); pass('Catalog error is visible in browser and does not create a sample', 'browser');
    mode = 'normal'; await dialog.getByRole('button', { name: 'Cari', exact: true }).click(); await dialog.getByRole('button', { name: 'Pilih Kemeja Safety KS-003', exact: true }).click();
    assert.equal(await dialog.getByLabel('Kode produk', { exact: true }).inputValue(), 'KS-003'); assert.equal(await dialog.getByLabel('Kode produk', { exact: true }).isDisabled(), true);
    await dialog.getByRole('img', { name: product.name }).first().waitFor(); pass('Product card/photo selection fills and locks SKU', 'browser');
    await dialog.getByLabel('Brief / spesifikasi *', { exact: true }).fill('KS-003 ukuran M warna kuning navy, periksa jahitan dan ukuran');
    await dialog.evaluate(d => { d.scrollTop = 0; }); await dialog.screenshot({ path: dir + '/picker-desktop.png' });
    forceRpcFailure = true; await dialog.getByRole('button', { name: 'Simpan Sampel', exact: true }).click(); await dialog.getByRole('alert').filter({ hasText: 'belum dapat dipastikan' }).waitFor();
    assert.equal(await dialog.getByLabel('Kode produk', { exact: true }).inputValue(), 'KS-003'); forceRpcFailure = false; handle = handler();
    await dialog.getByRole('button', { name: 'Simpan Sampel', exact: true }).click(); await dialog.waitFor({ state: 'detached' });
    const browserSample = ok(await service.from('vendor_samples').select('id,sample_code').eq('candidate_id', candidates[2]).single());
    pass('Browser retries failed save with same request ID and persists through real local RPC/Storage', 'browser');
    await currentPage.getByRole('button', { name: `Detail sampel ${browserSample.sample_code}`, exact: true }).click();
    dialog = currentPage.getByRole('dialog', { name: 'Detail Sampel', exact: true });
    await dialog.getByRole('img', { name: 'Acuan Kemeja Safety KS-003', exact: true }).waitFor();
    assert.equal(await dialog.getByRole('img', { name: 'Acuan Kemeja Safety KS-003', exact: true }).evaluate(img => img.complete && img.naturalWidth > 0), true);
    pass('Saved private snapshot renders on sample detail using a real signed Storage URL', 'browser');
    await dialog.getByRole('button', { name: 'Edit Sampel', exact: true }).click(); let edit = currentPage.getByRole('dialog', { name: 'Edit Sampel', exact: true }); assert.equal(await edit.getByLabel('Kode produk', { exact: true }).isDisabled(), true); assert.equal(await edit.getByLabel('Sumber produk acuan', { exact: true }).count(), 0); await edit.getByRole('button', { name: 'Batal', exact: true }).click(); pass('Edit retains original snapshot and disallows changing source/SKU', 'browser');
    await currentPage.setViewportSize({ width: 390, height: 844 }); await currentPage.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
    await currentPage.waitForFunction(() => getComputedStyle(document.querySelector('[aria-label="Produk acuan tersimpan"] h3')).color === 'rgb(15, 23, 42)');
    fs.writeFileSync(dir + '/LIGHT_STYLES.json', JSON.stringify(await dialog.evaluate(d => ({ theme: document.documentElement.dataset.theme, dialog_color: getComputedStyle(d).color, reference_heading_color: getComputedStyle(d.querySelector('[aria-label="Produk acuan tersimpan"] h3')).color, viewport_fits: d.scrollWidth <= d.clientWidth + 1 })), null, 2) + '\n');
    await dialog.screenshot({ path: dir + '/reference-mobile.png' }); assert.ok(await dialog.evaluate(d => d.scrollWidth <= d.clientWidth + 1)); pass('Mobile detail fits viewport with original product photo/reference', 'browser');
    const past = new Date(Date.now() - 3600000).toISOString(), future = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    for (const values of [{ status: 'DITUGASKAN', assigned_at: past, target_date: future, internal_pic_id: sessions.sourcing.profileId }, { status: 'DIKERJAKAN' }, { status: 'SAMPEL_DITERIMA', received_at: new Date().toISOString() }, { status: 'SEDANG_QC' }]) ok(await sessions.sourcing.client.from('vendor_samples').update(values).eq('id', browserSample.id));
    await dialog.getByRole('button', { name: 'Tutup sampel', exact: true }).click(); await currentPage.getByRole('button', { name: 'Refresh sampel', exact: true }).click(); await currentPage.getByRole('button', { name: `Detail sampel ${browserSample.sample_code}`, exact: true }).click(); dialog = currentPage.getByRole('dialog', { name: 'Detail Sampel', exact: true });
    await dialog.getByRole('button', { name: 'Catat Hasil QC', exact: true }).click(); const qc = currentPage.getByRole('dialog', { name: 'Catat Hasil QC', exact: true }); await qc.getByRole('img', { name: 'Acuan Kemeja Safety KS-003', exact: true }).waitFor(); pass('QC entry includes the saved reference photo alongside inspection fields', 'browser');
    await qc.getByRole('button', { name: 'Batal', exact: true }).click(); await dialog.getByRole('button', { name: 'Tutup sampel', exact: true }).click();
    await currentPage.getByRole('button', { name: 'Tambah Sampel', exact: true }).click(); dialog = currentPage.getByRole('dialog', { name: 'Tambah Sampel', exact: true }); await dialog.getByLabel('Vendor *', { exact: true }).selectOption(candidates[2]); await dialog.getByLabel('Kode produk', { exact: true }).fill('HARMAS-CUSTOM'); await dialog.getByLabel('Brief / spesifikasi *', { exact: true }).fill('Pesanan khusus klien Harmas tetap manual'); await dialog.getByRole('button', { name: 'Simpan Sampel', exact: true }).click(); await dialog.waitFor({ state: 'detached' }); pass('Manual Harmas sample creation remains available in same form', 'browser');
    assert.deepEqual(errors, []); assert.deepEqual(outside, []); pass('No browser runtime errors or unexpected external/production requests', 'browser');
    await context.close();
  }
  assert.equal(security(), phase45Security); pass('All original Phase 1–5 functions, policies and approval/activation guards remain byte-identical');
} catch (error) {
  results.push({ kind: 'failure', check: error.message, pass: false });
  if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: dir + '/failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  checkpoint('cleanup_started');
  await browser?.close(); await server?.close();
  forceRpcFailure = false; mode = 'normal';
  // Own test candidate prefixes only; remove file content through Storage API, never SQL metadata.
  if (installed) {
    for (const candidate of candidates) {
      const prefixes = ok(await service.storage.from(bucket).list(candidate));
      for (const entry of prefixes) {
        const prefix = `${candidate}/${entry.name}`, files = ok(await service.storage.from(bucket).list(prefix));
        if (files.length) ok(await service.storage.from(bucket).remove(files.map(file => `${prefix}/${file.name}`)));
      }
    }
    assert.equal(sql(`SELECT count(*) FROM public.vendor_sample_product_references r JOIN public.vendor_samples s ON s.id=r.sample_id WHERE s.candidate_id NOT IN (${candidates.map(id => `'${id}'`).join(',')});`), '0');
    // TRUNCATE is only used by this fixed local postgres fixture owner, after checking all rows are ours.
    sql('TRUNCATE public.vendor_sample_product_references;'); sql(rollback(names[2])); sql(rollback(names[2]));
  }
  if (phase5) { sql(rollback(names[1])); sql(rollback(names[1])); }
  if (phase4) { sql(rollback(names[0])); sql(rollback(names[0])); }
  for (const id of candidates) sql(`DELETE FROM public.vendor_activity_logs WHERE candidate_id='${id}';DELETE FROM public.vendor_status_history WHERE candidate_id='${id}';DELETE FROM public.vendor_candidates WHERE id='${id}';`);
  for (const id of permissionsAdded) ok(await service.from('role_permissions').delete().eq('id', id));
  checkpoint('cleanup_accounts');
  if (sessions.sourcing) ok(await service.from('role_permissions').update({ can_access: true }).eq('role_id', sessions.sourcing.roleId).eq('module_key', 'vendor_samples'));
  for (const id of accounts) { ok(await service.from('user_profiles').delete().eq('auth_user_id', id)); ok(await service.auth.admin.deleteUser(id)); }
  if (!hasEmployees) sql('DROP TABLE public.employees;');
  for (const b of Object.keys(bucketBefore)) if (!bucketBefore[b] && !(await service.storage.getBucket(b)).error) ok(await service.storage.deleteBucket(b));
  const restored = snapshot() === before && security() === securityBefore;
  checkpoint(restored ? 'cleanup_verified' : 'cleanup_baseline_mismatch');
  results.push({ kind: 'database/API', check: 'Rollback twice, own fixture/account/file cleanup restore all baseline checksums/security', pass: restored });
  fs.writeFileSync(dir + '/RESULTS.json', JSON.stringify({ checked_at: new Date().toISOString(), target: 'fixed Docker Supabase + loopback browser', production_accessed: false, ofissio_upstream: 'injected catalog/image fixtures only', permissions_mocked: false, results, browser_errors: errors, unexpected_external_hosts: outside, accounts_cleaned: accounts.length, cleanup_restored_baseline: restored }, null, 2) + '\n');
  assert.ok(restored, 'Baseline restoration failed'); console.log(`RESULT | ${results.filter(r => r.pass).length}/${results.length}`);
}
