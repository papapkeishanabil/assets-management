import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const origin = 'http://127.0.0.1:7014', results = [], failures = [], external = [];
let server, browser;
const pass = (text) => { results.push(`PASS | ${text}`); console.log(results.at(-1)); };
try {
  server = await createServer({ envFile: false, define: {
    'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify('LOCAL_MOCK_ONLY'),
    'import.meta.env.VITE_GOOGLE_MAPS_MAP_ID': JSON.stringify('LOCAL_MAP_ID')
  }, plugins: [{ name: 'phase3-local-harness', configureServer(vite) {
    vite.middlewares.use('/__phase3_map_test', async (_req, res, next) => {
      try {
        res.setHeader('Content-Type', 'text/html');
        res.end(await vite.transformIndexHtml('/__phase3_map_test', '<!doctype html><div id="root"></div><script type="module" src="/scripts/fixtures/vendor-map-browser.jsx"></script>'));
      } catch (error) { next(error); }
    });
  } }], server: { host: '127.0.0.1', port: 7014, strictPort: true }, clearScreen: false });
  await server.listen();
  const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_PACKAGE_PATH).href);
  browser = await chromium.launch({ headless: true });
  let requests = 0;
  const page = await browser.newPage(); page.on('pageerror', (e) => failures.push(e.message));
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.hostname === 'maps.googleapis.com') {
      requests++; return route.fulfill({ contentType: 'text/javascript', body: readFileSync(new URL('fixtures/google-maps-mock.js', import.meta.url), 'utf8') });
    }
    external.push(url.hostname); return route.abort();
  });
  await page.goto(`${origin}/__phase3_map_test`);
  await page.waitForFunction(() => document.querySelectorAll('.test-marker').length === 2);
  assert.equal(requests, 1);
  assert.deepEqual(await page.evaluate(() => [...new Set(window.__mapsTest.imports)].sort()), ['maps', 'marker']);
  assert.equal(await page.evaluate(() => window.__mapsTest.maps[0].options.mapId), 'LOCAL_MAP_ID');
  pass('SDK double dimuat lazy sekali dengan libraries maps/marker dan Map ID');
  await page.getByTitle('Vendor B · Gudang', { exact: true }).click();
  assert.equal(await page.getByLabel('Pilihan vendor').textContent(), 'b');
  pass('AdvancedMarker titik tunggal membuka vendor/fasilitas yang benar');
  await page.getByRole('button', { name: 'Banyak titik', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.test-marker').length === 1);
  assert.equal(await page.locator('.test-marker').textContent(), '1005');
  const zoom = await page.evaluate(() => window.__mapsTest.maps.at(-1).getZoom());
  await page.locator('.test-marker').click();
  assert.equal(await page.evaluate(() => window.__mapsTest.maps.at(-1).getZoom()), zoom + 2);
  pass('1005 lokasi dikelompokkan; klik cluster memperbesar tanpa kehilangan titik');
  await page.getByRole('button', { name: 'Edit titik', exact: true }).click();
  await page.waitForFunction(() => window.__mapsTest.maps.at(-1).listeners.click?.size === 1);
  await page.evaluate(() => window.__emitMapEvent(window.__mapsTest.maps.at(-1), 'click', { latLng: { lat: () => -6.95, lng: () => 107.65 } }));
  await page.waitForFunction(() => document.querySelector('output[aria-label="Koordinat dipilih"]').textContent.includes('-6.95'));
  await page.evaluate(() => { const marker = window.__mapsTest.markers.findLast((m) => m.map && m.options.gmpDraggable); marker.position = { lat: -6.96, lng: 107.66 }; window.__emitMapEvent(marker, 'dragend'); });
  await page.waitForFunction(() => document.querySelector('output[aria-label="Koordinat dipilih"]').textContent.includes('-6.96'));
  assert.equal(requests, 1);
  pass('Klik peta dan drag AdvancedMarker mengubah draf koordinat tanpa memuat SDK berulang');
  await page.evaluate(() => window.gm_authFailure());
  await page.getByRole('alert').filter({ hasText: 'Akses Google Maps ditolak' }).waitFor();
  pass('Kegagalan autentikasi Maps menampilkan pesan konfigurasi dan tombol coba lagi');
  await page.close();

  const retry = await browser.newPage(); let attempts = 0;
  retry.on('pageerror', (e) => failures.push(e.message));
  await retry.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.hostname === 'maps.googleapis.com') {
      attempts++;
      return attempts === 1 ? route.abort() : route.fulfill({ contentType: 'text/javascript', body: readFileSync(new URL('fixtures/google-maps-mock.js', import.meta.url), 'utf8') });
    }
    external.push(url.hostname); return route.abort();
  });
  await retry.goto(`${origin}/__phase3_map_test`);
  await retry.getByRole('alert').filter({ hasText: 'Google Maps gagal dimuat' }).waitFor();
  await retry.getByRole('button', { name: 'Coba lagi', exact: true }).click();
  await retry.waitForFunction(() => document.querySelectorAll('.test-marker').length === 2);
  assert.equal(attempts, 2); pass('Kegagalan jaringan dapat dicoba ulang sampai pin muncul');
  assert.deepEqual(failures, []); assert.deepEqual(external, []);
  pass('Tidak ada pageerror, database atau jaringan eksternal nyata; Google SDK hanya double');
} catch (error) { results.push(`FAIL | ${error.message} | pageerrors=${JSON.stringify(failures)}`); throw error; }
finally {
  await browser?.close(); await server?.close();
  writeFileSync(new URL('../docs/vendor-management/phase3-evidence/MAP_SDK_DOUBLE_RESULTS.txt', import.meta.url), results.join('\n') + '\n');
}
