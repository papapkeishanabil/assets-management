// Public GET only. No .env, credentials, database, Ofissio writes or production fixtures.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { normalizeOfissioProduct } from '../supabase/functions/vendor-ofissio-catalog/handler.js';
const endpoint = 'https://ofissio.com/api/catalog/search?q=KS-003';
const response = await fetch(endpoint, { redirect: 'error', signal: AbortSignal.timeout(20000) });
assert.equal(response.status, 200);
const data = await response.json(); assert.equal(data.ok, true);
const product = normalizeOfissioProduct(data.result.products.find(p => p.sku === 'KS-003'));
assert.ok(product); assert.ok(product.image_url.endsWith('.webp'));
const image = await fetch(product.image_url, { redirect: 'error', signal: AbortSignal.timeout(20000) });
assert.equal(image.status, 200); assert.equal(image.headers.get('content-type')?.split(';')[0], 'image/webp');
const bytes = Buffer.from(await image.arrayBuffer()); assert.ok(bytes.length > 12 && bytes.length < 5242880);
assert.equal(bytes.toString('ascii', 0, 4), 'RIFF'); assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
fs.mkdirSync('test-fixtures/vendor-ofissio', { recursive: true });
fs.writeFileSync('test-fixtures/vendor-ofissio/ks-003.webp', bytes);
const snResponse = await fetch('https://ofissio.com/api/catalog/search?q=SN', { redirect: 'error', signal: AbortSignal.timeout(20000) });
assert.equal(snResponse.status, 200);
const snData = await snResponse.json(); assert.equal(snData.ok, true);
const snProducts = snData.result.products.map(normalizeOfissioProduct).filter(Boolean);
assert.ok(snProducts.some(p => p.sku === 'SN' || p.sku === 'SN-Green'));
fs.mkdirSync('docs/vendor-management/ofissio-catalog-evidence', { recursive: true });
const report = { checked_at: new Date().toISOString(), endpoint, catalog_status: response.status, product, image_status: image.status,
  image_bytes: bytes.length, image_sha256: createHash('sha256').update(bytes).digest('hex'), image_fixture: 'test-fixtures/vendor-ofissio/ks-003.webp',
  variants_in_search: ['variants', 'variations', 'available_colors', 'available_sizes'].filter(key => key in data.result.products[0]),
  cors_allow_origin: response.headers.get('access-control-allow-origin'), credentials_used: false, database_accessed: false, external_writes: false };
report.sasienala_via_ofissio = { endpoint: 'https://ofissio.com/api/catalog/search?q=SN', status: snResponse.status, total: snData.result.resultCount, compatible_results: snProducts.length, products: snProducts.map(p => ({ id: p.id, sku: p.sku, name: p.name, image_origin: new URL(p.image_url).origin })) };
fs.writeFileSync('docs/vendor-management/ofissio-catalog-evidence/PUBLIC_READONLY_PROBE.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ catalog: response.status, photo: image.status, sku: product.sku, bytes: bytes.length, database_accessed: false, external_writes: false }));
