// Offline: fixture metadata sintetis. Tidak menulis hasil preflight produksi palsu.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const directory = mkdtempSync(join(tmpdir(), 'harmas-p3-reviewer-'));
const old = JSON.parse(readFileSync(new URL('../docs/vendor-management/production-verification-20261109/READONLY_RESULTS.json', import.meta.url))).before;
const historical = JSON.parse(readFileSync(new URL('../docs/vendor-management/PHASE2_PRODUCTION_READONLY.json', import.meta.url))).data;
const functions = old.functions.map((f) => ({ ...f, service_execute: historical.functions.find((p) => p.signature === `${f.name}(text)`)?.service_execute ?? false }));
const columns = [
  ['public','vendors',['id','vendor_name','is_active','contact_person','phone_number','whatsapp_number','email']],
  ['storage','objects',['owner','owner_id','metadata','bucket_id','name']],
  ['storage','buckets',['id','name','public','file_size_limit','allowed_mime_types']]
].flatMap(([schema,table,cols]) => cols.map((column) => ({ schema,table,column })));
const base = { functions, policies: old.policies, rls: old.rls, triggers: old.triggers, columns,
  collisions: { relations: [], functions: [], storage_policies: [], bucket: 0 },
  storage_service_acl: { select: true, insert: true, delete: true, bypass_rls: true },
  roles: ['super_admin','sourcing','direksi'], permissions: ['sourcing','direksi'].flatMap((role) => ['vendor_management','vendor_map'].map((module) => ({ role,module,access:true }))),
  buckets: [], asset_vendor_orphans: 0, baseline: { ...old.baseline,
    ...Object.fromEntries(['vendor_categories','vendor_specialties','vendor_contacts','vendor_candidate_specialties','vendor_activity_logs','vendor_status_history','auth.users'].map((name) => [name,{count:0,checksum:'synthetic-test-only'}])) } };
const results = [];
function check(label, edit, expectedExit) {
  const input = { target: 'https://uwlxkwyauxwewoexfgwi.supabase.co', checked_at: new Date().toISOString(), before: structuredClone(base), after: structuredClone(base) };
  edit(input);
  const source = join(directory, 'synthetic-input.json'); writeFileSync(source, JSON.stringify(input));
  const run = spawnSync(process.execPath, ['scripts/preflight-vendor-phase3-production.mjs', '--from-file', source, '--output-dir', directory], { encoding: 'utf8' });
  assert.equal(run.status, expectedExit, `${label}: ${run.stdout}\n${run.stderr}`);
  const report = JSON.parse(readFileSync(join(directory, 'PRODUCTION_PREFLIGHT.json')));
  assert.equal(report.checks.some((c) => c.status === 'FAIL'), expectedExit !== 0);
  results.push(`PASS | ${label}`); console.log(results.at(-1));
}
try {
  check('Reviewer menerima snapshot kompatibel sintetis; hasil hanya di TEMP', () => {}, 0);
  check('Reviewer menolak benturan tabel Fase 3', (r) => { r.before.collisions.relations.push('vendor_locations'); }, 1);
  check('Reviewer menolak ACL helper yang terbuka ke anon', (r) => { r.before.functions.find((f) => f.name === 'is_app_role').anon_execute = true; }, 1);
  check('Reviewer menolak perubahan checksum selama pemeriksaan', (r) => { r.after.baseline.vendors.checksum = 'changed'; }, 1);
  check('Reviewer menolak snapshot kedaluwarsa', (r) => { r.checked_at = '2000-01-01T00:00:00Z'; }, 1);
  writeFileSync(new URL('../docs/vendor-management/phase3-evidence/PREFLIGHT_REVIEWER_TEST_RESULTS.txt', import.meta.url), results.join('\n') + '\nTOTAL: 5 PASS; offline synthetic only\n');
} finally {
  // Path dari mkdtempSync, bukan hasil input atau path repo/produksi.
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
  assert.ok(basename(directory).startsWith('harmas-p3-reviewer-'));
  rmSync(directory, { recursive: true, force: true });
}
