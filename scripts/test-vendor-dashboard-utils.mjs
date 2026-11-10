import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { summarizeActiveVendors } from '../src/lib/vendor-dashboard-utils.js';

const results = [];
function test(check, run) { run(); results.push({ check, pass: true }); console.log(`PASS | ${check}`); }
const vendors = [
  { id: 'a', vendor_name: 'A', vendor_type: 'MAKLUN_JAHIT', is_active: true },
  { id: 'b', vendor_name: 'B', vendor_type: 'MAKLUN_JAHIT', is_active: true },
  { id: 'c', vendor_name: 'C', is_active: true },
  { id: 'd', vendor_name: 'D', is_active: false }
];
const point = { vendor_id: 'a', candidate_id: 'ca', location_id: 'la', latitude: 0, longitude: 0, is_complete: true, is_verified: true };
test('All active masters counted, including masters without profiles; inactive excluded', () => assert.equal(summarizeActiveVendors(vendors, []).active, 3));
test('Zero coordinates are valid; missing profiles counted as unmapped and incomplete', () => {
  const s = summarizeActiveVendors(vendors, [point]);
  assert.deepEqual([s.mapped, s.unmapped, s.incomplete, s.verified, s.coverage], [1, 2, 2, 1, 33]);
});
test('Multiple facilities and linked profiles do not multiply vendor totals', () => {
  const s = summarizeActiveVendors(vendors, [point, { ...point, location_id: 'lb' }, { ...point, candidate_id: 'duplicate-profile' }, { ...point, vendor_id: 'd', location_id: 'inactive-facility' }]);
  assert.deepEqual([s.active, s.mapped, s.facilities, s.verified], [3, 1, 2, 1]);
});
test('Facility GPS does not make an incomplete primary location complete', () => {
  const s = summarizeActiveVendors(vendors, [{ ...point, is_complete: false, is_verified: false }]);
  assert.equal(s.incomplete, 3); assert.equal(s.attention.find((v) => v.id === 'a').reason, 'Lokasi belum lengkap');
});
test('Verification and completeness must belong to the same profile', () => {
  const s = summarizeActiveVendors(vendors, [{ ...point, is_verified: false }, { ...point, candidate_id: 'other', location_id: 'other', is_complete: false }]);
  assert.equal(s.verified, 0); assert.equal(s.attention.find((v) => v.id === 'a').reason, 'Perlu verifikasi');
});
test('Permission denial or unavailable locations produce null, not misleading zero', () => {
  const s = summarizeActiveVendors(vendors, null);
  assert.deepEqual([s.active, s.mapped, s.unmapped, s.verified, s.coverage], [3, null, null, null, null]); assert.deepEqual(s.attention, []);
});
test('Type distribution counts vendors once and includes missing types', () => {
  const s = summarizeActiveVendors([...vendors, vendors[0]], []);
  assert.equal(s.distribution.reduce((n, v) => n + v.count, 0), 3);
  assert.deepEqual(s.distribution, [{ type: 'MAKLUN_JAHIT', count: 2 }, { type: 'BELUM_DIISI', count: 1 }]);
});
test('Empty database has zero counts, finite percentage, and no attention rows', () => {
  const s = summarizeActiveVendors([], []); assert.equal(s.coverage, 0); assert.equal(s.active, 0); assert.deepEqual(s.attention, []);
});
test('Legacy type labels and enum keys share a single distribution category', () => {
  const s = summarizeActiveVendors([...vendors, { id: 'legacy', vendor_name: 'Legacy', vendor_type: ' Maklun Jahit ', is_active: true }], [], { MAKLUN_JAHIT: 'Maklun Jahit' });
  assert.equal(s.distribution.find((d) => d.type === 'MAKLUN_JAHIT').count, 3);
  assert.equal(s.distribution.length, 2);
});
const dir = 'docs/vendor-management/dashboard-evidence'; mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/UTILS_RESULTS.json`, JSON.stringify({ checked_at: new Date().toISOString(), results }, null, 2) + '\n');
