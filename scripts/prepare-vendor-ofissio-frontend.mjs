// Export ONLY tested committed runtime files. No worktree changes, deploy, push or database write.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const repo = process.cwd(), project = 'prj_2MBxDEiNjz80jfB2L0dQ55hUbG0P', team = 'team_gulGpJeEXpB77MplKv8w4Ilo';
const target = 'https://uwlxkwyauxwewoexfgwi.supabase.co', git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
const commit = git(['rev-parse', 'b0e376a6^{commit}']);
execFileSync('git', ['merge-base', '--is-ancestor', 'e1285125', commit]);
const normalize = (file, bytes) => /\.(jsx?|tsx?|css|html|json|svg|txt|xml|webmanifest)$/.test(file) ? bytes.toString('utf8').replaceAll('\r\n', '\n') : bytes;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const linked = JSON.parse(fs.readFileSync('.vercel/project.json')); assert.equal(linked.projectId, project); assert.equal(linked.orgId, team);
const tested = JSON.parse(fs.readFileSync('docs/vendor-management/ofissio-catalog-evidence/BUILD_AND_REVIEW.json'));
for (const [file, expected] of Object.entries(tested.source_sha256)) assert.equal(sha(execFileSync('git', ['show', `${commit}:${file}`])), expected, 'Committed feature differs from tested source: ' + file);
const folder = path.resolve(os.tmpdir(), 'harmas-ofissio-release-' + commit.slice(0, 12));
assert.ok(folder.startsWith(path.resolve(os.tmpdir()) + path.sep));
assert.ok(!fs.existsSync(folder), 'Isolated build already exists; inspect before retry');
fs.mkdirSync(folder);
const paths = ['src', 'api', 'public', 'index.html', 'package.json', 'package-lock.json', 'vite.config.js', 'tailwind.config.js', 'postcss.config.js', 'vercel.json'];
const files = git(['ls-tree', '-r', '--name-only', commit, '--', ...paths]).split('\n'), sourceHashes = {}, excluded = [];
for (const file of files) {
 assert.ok(!file.split('/').includes('..')); const body = execFileSync('git', ['show', `${commit}:${file}`]);
 const destination = path.join(folder, file); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, body);
 sourceHashes[file] = sha(normalize(file, body));
 if (sha(normalize(file, fs.readFileSync(path.join(repo, file)))) !== sourceHashes[file]) excluded.push(file);
}
fs.symlinkSync(path.join(repo, 'node_modules'), path.join(folder, 'node_modules'), 'junction');
const cache = fs.readFileSync('.vercel/.env.production.local', 'utf8');
const value = key => { const m = cache.match(new RegExp('^' + key + '=(.*)$', 'm')); assert.ok(m); return m[1].trim().replace(/^(['"])(.*)\1$/, '$2'); };
const url = value('VITE_SUPABASE_URL'), key = value('VITE_SUPABASE_PUBLISHABLE_KEY'); assert.equal(url, target); assert.ok(key.length > 20 && !/your_|placeholder/i.test(key));
if (key.startsWith('eyJ')) { const claim = JSON.parse(Buffer.from(key.split('.')[1], 'base64url')); assert.equal(claim.role, 'anon'); assert.equal(claim.ref, 'uwlxkwyauxwewoexfgwi'); } else assert.ok(key.startsWith('sb_publishable_'));
const settings = await fetch(target + '/auth/v1/settings', { headers: { apikey: key }, signal: AbortSignal.timeout(20000) }); assert.equal(settings.status, 200); await settings.arrayBuffer();
fs.mkdirSync(path.join(folder, '.vercel')); fs.writeFileSync(path.join(folder, '.vercel/project.json'), JSON.stringify(linked));
// Copy only these two PUBLIC build variables; no OIDC or other cached environment values.
fs.writeFileSync(path.join(folder, '.vercel/.env.production.local'), `VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_PUBLISHABLE_KEY=${key}\n`);
const built = spawnSync('cmd.exe', ['/d', '/s', '/c', 'vercel.cmd build --prod'], { cwd: folder, encoding: 'utf8', maxBuffer: 12e6, env: { ...process.env, VERCEL_NO_UPDATE_NOTIFIER: '1' } });
fs.writeFileSync('.vercel/ofissio-build.log', (built.stdout || '') + '\n' + (built.stderr || '')); assert.equal(built.status, 0, 'Inspect private build log; keep isolated folder for review');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const output = path.join(folder, '.vercel/output'), artifact = walk(output);
for (const file of artifact) {
 const text = fs.readFileSync(file).toString('utf8'); assert.ok(!/sb_secret_[A-Za-z0-9_-]+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|postgres(?:ql)?:\/\/[^\s:]+:[^\s@]+@/.test(text), 'Private artifact: ' + file);
 for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) { try { const p = JSON.parse(Buffer.from(m[0].split('.')[1], 'base64url')); assert.ok(p.role !== 'service_role' && !p.iss?.includes('vercel.com')); } catch (error) { if (error.code === 'ERR_ASSERTION') throw error; } }
 assert.ok(!/(?:^|[\\/])\.env|\.(?:dump|sql|pem)$/.test(file));
}
const js = artifact.filter(f => f.endsWith('.js')).map(f => fs.readFileSync(f, 'utf8')).join('\n');
const checks = { public_config_valid: true, ofissio_catalog: js.includes('vendor-ofissio-catalog'), ofissio_reference: js.includes('vendor_sample_product_references'), samples: js.includes('vendor_record_sample_qc'), decisions: js.includes('vendor_record_decision'), activation: js.includes('activate_vendor_candidate'), free_maps: js.includes('tile.openstreetmap.org'), no_private_artifacts: true }; assert.ok(Object.values(checks).every(Boolean));
const staticRoot = path.join(output, 'static'), assets = artifact.filter(f => f.startsWith(staticRoot + path.sep)).map(f => ({ path: '/' + path.relative(staticRoot, f).replaceAll('\\', '/'), sha256: sha(fs.readFileSync(f)) }));
const html = fs.readFileSync(path.join(staticRoot, 'index.html'), 'utf8'), entry = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1], css = html.match(/href="(\/assets\/index-[^"]+\.css)"/)?.[1]; assert.ok(entry && css);
const selected = ['/index.html', entry, css, '/sw.js', ...assets.filter(a => /^\/assets\/(?:VendorSamplesPage-|VendorApprovalsPage-|VendorDecisionPanel-|VendorSamplesPanel-|vendor-sampling-|MasterVendorLocationsPanel-|VendorSourcingPanel-|VendorMapPage-|leaflet-src-|leaflet-.*\.css)/.test(a.path)).map(a => a.path)];
const report = { checked_at: new Date().toISOString(), commit, project_id: project, team_id: team, build_directory: folder, checks, scanned_files: artifact.length, entry, assets, selected, source_sha256: sourceHashes, excluded_worktree_files: excluded, cloud_environment_changed: false, production_database_write: false, git_push: false, deployed: false };
fs.writeFileSync('.vercel/ofissio-artifact.json', JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync('docs/vendor-management/ofissio-catalog-evidence/FRONTEND_PREFLIGHT.json', JSON.stringify({ ...report, assets: undefined, source_sha256: undefined }, null, 2) + '\n');
console.log(JSON.stringify({ prepared: true, commit, build_directory: folder, checks, selected_assets: selected.length, excluded_worktree_files: excluded, deployed: false }));
