import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';

// In-memory API contract test: no environment files or network/database access.
const server = await createServer({ envFile: false, server: { middlewareMode: true }, clearScreen: false });
const results = [];
try {
  const { fetchVendorOverview } = await server.ssrLoadModule('/src/lib/vendor-dashboard-helpers.js');
  function client({ mapError, masterError, assetError, candidateError } = {}) {
    const calls = [], vendors = Array.from({ length: 1001 }, (_, n) => ({ id: `v${n}`, vendor_name: `Vendor ${n}`, is_active: true }));
    const points = vendors.map((v, n) => ({ vendor_id: v.id, candidate_id: `c${n}`, location_id: `l${n}`, latitude: 0, longitude: 0 }));
    return { calls, from(table) {
      const query = { table, start: 0, end: 999, ids: [] }; calls.push(query);
      const builder = {
        select(_columns, options) { query.head = options?.head; return builder; },
        eq(_key, value) { assert.equal(value, true); return builder; },
        is(key, value) { assert.equal(key, 'vendor_id'); assert.equal(value, null); return builder; },
        order() { return builder; }, range(start, end) { query.start = start; query.end = end; return builder; },
        in(_key, ids) { query.ids = ids; return builder; },
        then(resolve, reject) {
          const error = table === 'vendors' ? masterError : table === 'vendor_map_points' ? mapError : table === 'assets' ? assetError : candidateError;
          const rows = table === 'vendors' ? vendors : table === 'vendor_map_points' ? points : [];
          return Promise.resolve({ error, data: rows.slice(query.start, query.end + 1), count: table === 'assets' ? query.ids.length * 2 : 7 }).then(resolve, reject);
        }
      }; return builder;
    } };
  }
  async function test(check, run) { await run(); results.push({ check, pass: true }); console.log(`PASS | ${check}`); }
  await test('Pagination loads 1001 masters and 1001 facilities beyond API default cap', async () => {
    const c = client(), s = await fetchVendorOverview({ canMap: true, canAssets: true }, c);
    assert.equal(s.summary.active, 1001); assert.equal(s.summary.mapped, 1001); assert.equal(s.summary.facilities, 1001);
    assert.equal(s.assetCount, 2002); assert.equal(s.candidates, 7);
    assert.equal(c.calls.filter((q) => q.table === 'vendors').length, 3);
    const assetQueries = c.calls.filter((q) => q.table === 'assets'); assert.equal(assetQueries.length, 6); assert.ok(assetQueries.every((q) => q.head && q.ids.length <= 200));
  });
  await test('No map or assets permission means no corresponding API requests', async () => {
    const c = client(), s = await fetchVendorOverview({ canMap: false, canAssets: false }, c);
    assert.equal(s.summary.mapped, null); assert.equal(s.mapStatus, 'restricted'); assert.equal(s.assetCount, null);
    assert.ok(!c.calls.some((q) => ['assets', 'vendor_map_points'].includes(q.table)));
  });
  await test('Missing map backend is pending; active master totals survive', async () => {
    const s = await fetchVendorOverview({ canMap: true, canAssets: false }, client({ mapError: { code: '42P01', message: 'missing view' } }));
    assert.equal(s.mapStatus, 'pending'); assert.equal(s.summary.active, 1001); assert.equal(s.summary.mapped, null);
  });
  await test('Denied map query is an error, never a pending backend or zero GPS', async () => {
    const s = await fetchVendorOverview({ canMap: true, canAssets: false }, client({ mapError: { code: '42501', message: 'denied' } }));
    assert.equal(s.mapStatus, 'error'); assert.equal(s.mapError, 'denied'); assert.equal(s.summary.mapped, null);
  });
  await test('Master failure does not trigger asset queries or fabricate zero master count', async () => {
    const c = client({ masterError: { message: 'master unavailable' } }), s = await fetchVendorOverview({ canMap: true, canAssets: true }, c);
    assert.equal(s.summary, null); assert.equal(s.masterError, 'master unavailable'); assert.equal(s.candidates, 7); assert.ok(!c.calls.some((q) => q.table === 'assets'));
  });
  await test('Asset and candidate count errors remain independent of operational metrics', async () => {
    const s = await fetchVendorOverview({ canMap: true, canAssets: true }, client({ assetError: { message: 'asset denied' }, candidateError: { message: 'candidate denied' } }));
    assert.equal(s.summary.active, 1001); assert.equal(s.assetCount, null); assert.equal(s.candidates, null); assert.equal(s.assetError, 'asset denied'); assert.equal(s.candidateError, 'candidate denied');
  });
} finally {
  await server.close();
  const dir = 'docs/vendor-management/dashboard-evidence'; mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/QUERIES_RESULTS.json`, JSON.stringify({ checked_at: new Date().toISOString(), network: false, results }, null, 2) + '\n');
}
