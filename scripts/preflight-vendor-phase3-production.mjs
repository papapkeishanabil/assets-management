// Reviewer offline untuk snapshot PostgreSQL READ ONLY dari driver PowerShell.
// Tidak menghubungi jaringan, membaca kredensial atau memanggil exec_sql/RPC bisnis.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const api = 'https://uwlxkwyauxwewoexfgwi.supabase.co';
const fileIndex = process.argv.indexOf('--from-file');
assert.ok(fileIndex >= 0 && process.argv[fileIndex + 1], 'Gunakan --from-file hasil driver backup PostgreSQL dengan PGPASSWORD');
const input = JSON.parse(readFileSync(process.argv[fileIndex + 1], 'utf8'));
assert.equal(input.target, api, 'Target snapshot file tidak sesuai');
const outputIndex = process.argv.indexOf('--output-dir');
const checks = [], folder = outputIndex < 0 ? new URL('../docs/vendor-management/phase3-evidence/', import.meta.url)
  : pathToFileURL(resolve(process.argv[outputIndex + 1]) + '/');
mkdirSync(folder, { recursive: true });
const result = { checked_at: new Date().toISOString(), target: api,
  mode: 'Review file snapshot psql READ ONLY; no network in this process', source_checked_at: input.checked_at, checks };
const pass = (label) => { checks.push({ status: 'PASS', label }); console.log(`PASS | ${label}`); };
const names = ['is_app_role','my_profile_id','profiles_guard_admin_fields','vendor_guard_restricted_columns',
  'vendor_record_activity','vendor_record_status_change','exec_sql','vendor_followups_guard',
  'vendor_followups_audit','vendor_sourcing_dashboard','vendor_remind_overdue_followups'];

try {
  const age = Date.now() - Date.parse(input.checked_at);
  assert.ok(Number.isFinite(age) && age >= -300000 && age < 3600000, 'Snapshot perlu diperbarui (maksimal satu jam)');
  result.before = input.before;
  const s = result.before;
  assert.equal(Object.keys(s.baseline).length, 17, 'Baseline 17 tabel belum lengkap');
  assert.deepEqual(s.collisions, { relations: [], functions: [], storage_policies: [], bucket: 0 });
  pass('Belum ada tabel/view/fungsi/policy/bucket Fase 3 yang bertabrakan');
  const old = JSON.parse(readFileSync(new URL('../docs/vendor-management/production-verification-20261109/READONLY_RESULTS.json', import.meta.url), 'utf8')).before;
  assert.equal(s.functions.length, names.length);
  for (const name of names) {
    const current = s.functions.find((f) => f.name === name), previous = old.functions.find((f) => f.name === name);
    assert.ok(current && previous, `Fungsi ${name} tidak lengkap`);
    for (const field of ['definition','definer','config','anon_execute','authenticated_execute']) {
      assert.deepEqual(current[field], previous[field], `Drift ${name}.${field}`);
    }
  }
  pass('Sebelas definisi fungsi, SECURITY DEFINER/search_path dan ACL anon/authenticated identik dengan snapshot tervalidasi');
  const hardened = ['user_profiles','roles','notifications','vendor_followups'];
  assert.deepEqual(s.policies.filter((p) => p.schemaname === 'public' && hardened.includes(p.tablename)), old.policies);
  assert.ok(Object.values(s.rls).every(Boolean));
  assert.ok(s.triggers.every((t) => t.enabled === 'O'));
  pass('Policy hardening dan follow-up identik; RLS tabel relevan dan seluruh trigger terpilih aktif');
  const exec = s.functions.find((f) => f.name === 'exec_sql');
  assert.ok(!exec.anon_execute && !exec.authenticated_execute && exec.service_execute);
  for (const name of ['is_app_role','my_profile_id']) {
    const helper = s.functions.find((f) => f.name === name);
    assert.ok(helper.definer && helper.config.includes('search_path=public, pg_temp') && !helper.anon_execute && helper.authenticated_execute);
  }
  pass('exec_sql tetap service-only; helper anti-recursion tidak dibuka ke anon');
  const columns = (schema, table) => s.columns.filter((c) => c.schema === schema && c.table === table).map((c) => c.column);
  for (const col of ['id','vendor_name','is_active','contact_person','phone_number','whatsapp_number','email']) assert.ok(columns('public','vendors').includes(col), `Kolom K3 ${col} hilang`);
  for (const col of ['owner','owner_id','metadata','bucket_id','name']) assert.ok(columns('storage','objects').includes(col), `Storage objects.${col} hilang`);
  for (const col of ['id','name','public','file_size_limit','allowed_mime_types']) assert.ok(columns('storage','buckets').includes(col), `Storage buckets.${col} hilang`);
  pass('Kolom master K3 dan metadata Storage kompatibel dengan migration Fase 3');
  const gates = s.policies.filter((p) => p.schemaname === 'storage' && p.tablename === 'objects' && p.permissive === 'RESTRICTIVE');
  result.existing_restrictive_storage_policies = gates;
  assert.deepEqual(gates, [], 'Ada restrictive policy Storage existing: perlu review kombinasi sebelum rilis');
  assert.ok(Object.values(s.storage_service_acl).every(Boolean));
  pass('Storage belum memiliki restrictive gate yang berkonflik; service role memiliki ACL/bypass untuk backup dan lifecycle Storage');
  assert.ok(!s.roles.includes('qc'));
  for (const role of ['sourcing','direksi']) for (const module of ['vendor_management','vendor_map']) {
    assert.ok(s.permissions.some((p) => p.role === role && p.module === module && p.access), `${role} belum memiliki ${module}`);
  }
  pass('Sourcing dan Direksi memiliki module key vendor_map; tidak ada role QC');
  assert.equal(s.asset_vendor_orphans, 0);
  for (const name of ['vendors','assets']) assert.deepEqual(s.baseline[name], old.baseline[name], `Master ${name} berubah sejak snapshot penerimaan`);
  pass('Master vendor/aset sama dengan snapshot penerimaan; tidak ada relasi aset-vendor yatim');
  result.after = input.after;
  assert.deepEqual(result.after, result.before, 'Ada drift/aktivitas pengguna lain selama preflight; ulangi baseline sebelum rilis');
  pass('Metadata, Storage dan checksum 17 tabel identik sebelum/sesudah preflight');
  result.migration_sha256 = createHash('sha256').update(readFileSync(new URL('../supabase/migrations/202611090001_vendor_management_phase3.sql', import.meta.url))).digest('hex');
  result.production_migration_executed = false;
  result.readiness = 'PREFLIGHT_PASS; fresh verified backup and explicit migration approval still required';
  console.log(JSON.stringify({ baseline: Object.fromEntries(Object.entries(s.baseline).map(([k,v]) => [k,v.count])), storage_objects: s.buckets.reduce((n,b) => n+b.objects,0) }));
} catch (error) {
  // Jangan mencetak respons atau header kredensial; error pemeriksaan hanya ringkasan.
  checks.push({ status: 'FAIL', label: error.message });
  console.error(`FAIL | ${error.message}`); process.exitCode = 1;
} finally {
  writeFileSync(new URL('PRODUCTION_PREFLIGHT.json', folder), JSON.stringify(result, null, 2) + '\n');
}
