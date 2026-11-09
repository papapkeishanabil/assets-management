// Preview deployment yang disetujui; guard anonim saja, tanpa akun/data uji produksi.
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
process.loadEnvFile('.env.local');
const token = process.env.VERCEL_OIDC_TOKEN;
assert.ok(token, 'Token OIDC development resmi tidak tersedia');
const origin = 'https://harmas-asset-management-7qi0mttcc.vercel.app';
const headers = { 'x-vercel-trusted-oidc-idp-token': token };
const http = await fetch(origin, { headers, redirect:'manual', signal:AbortSignal.timeout(20000) });
assert.equal(http.status,200,'OIDC belum dapat mengakses preview');
const html = await http.text(), entry = html.match(/src="([^"\s]*\/assets\/[^"\s]+\.js)"/)?.[1];
assert.match(entry || '', /^\/assets\/[A-Za-z0-9_-]+\.js$/);
const remote = await fetch(new URL(entry,origin), { headers, redirect:'manual', signal:AbortSignal.timeout(20000) });
assert.equal(remote.status,200);
const body = Buffer.from(await remote.arrayBuffer()), local = readFileSync(`.vercel/output/static${entry}`);
const hash = (b) => createHash('sha256').update(b).digest('hex');
assert.equal(hash(body),hash(local),'Artifact yang tersaji berbeda dari build teruji');
const errors = [], writes = [], failedAssets = []; let browser;
try {
  const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_PACKAGE_PATH).href);
  browser = await chromium.launch({headless:true});
  const context = await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  await context.route('**/*',route => {
    const req = route.request(), url = new URL(req.url());
    if (!['GET','HEAD','OPTIONS'].includes(req.method())) { writes.push({method:req.method(),path:url.pathname}); return route.abort(); }
    const scopedHeaders = {...req.headers()}; delete scopedHeaders['x-vercel-trusted-oidc-idp-token'];
    if (url.origin === origin) return route.continue({headers:{...scopedHeaders,...headers}});
    if (['fonts.googleapis.com','fonts.gstatic.com','uwlxkwyauxwewoexfgwi.supabase.co'].includes(url.hostname)) return route.continue({headers:scopedHeaders});
    return route.abort();
  });
  const page = await context.newPage(); page.on('pageerror',e => errors.push(e.message));
  page.on('response',r => { if (r.status()>=400 && r.url().startsWith(`${origin}/assets/`)) failedAssets.push(r.status()); });
  for (const path of ['/vendor','/vendor/map','/vendor/database']) {
    await page.goto(origin+path); await page.waitForURL(/\/login/); await page.locator('input[type="password"]').waitFor();
  }
  await page.screenshot({path:'docs/vendor-management/phase3-evidence/preview-login.png',fullPage:true,animations:'disabled'});
  assert.deepEqual(errors,[]); assert.deepEqual(writes,[]); assert.deepEqual(failedAssets,[]);
  const production = JSON.parse(readFileSync('.vercel/phase3-preview-http-check.json','utf8'));
  const report = {checked_at:new Date().toISOString(),deployment_id:'dpl_AJYvZ3SSMcWaHQqpg73S3doKD2ru',url:origin,
    environment:'preview',state:'READY',commit:'d3beb8f5',artifact_entry:entry,artifact_sha256:hash(body),protected_http_status:200,
    anonymous_routes_redirect_to_login:3,pageerrors:errors,business_write_requests:writes,failed_assets:failedAssets,
    production_entry_unchanged:production.production_entry_unchanged,production_html_unchanged:production.production_html_unchanged,
    production_migration_executed:false,git_push_executed:false,authenticated_uat:'NOT RUN; no production test account created'};
  writeFileSync('docs/vendor-management/phase3-evidence/PREVIEW_DEPLOYMENT_CHECKS.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
} finally { await browser?.close(); }
