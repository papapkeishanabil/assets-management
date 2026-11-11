// Backup blob bytes only. Public HTTP GET or user-downloaded private originals; no credentials/API writes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const digest = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
const etag = value => String(value || '').replace(/^W\//, '').replaceAll('"', '').toLowerCase();
const inside = (root, file) => { const relative = path.relative(root, file); return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative); };
const fingerprint = object => digest(JSON.stringify([object.id, object.bucket, object.name, Number(object.metadata?.size), object.metadata?.mimetype || '', etag(object.metadata?.eTag || object.metadata?.etag)]));

export async function backupStorageObjects({ target, folder, objects, cacheFile = '.vercel/ofissio-private-blob-cache.json', backupRoot = 'D:/Backups', fetchImpl = fetch }) {
 assert.match(target, /^https:\/\/[a-z0-9-]+\.supabase\.co$/);
 const root = fs.realpathSync(backupRoot), destination = fs.realpathSync(folder);
 assert.ok(inside(root, destination), 'Backup directory escapes approved backup root');
 const blobDir = path.join(destination, 'storage-blobs'), imports = path.join(destination, 'private-import');
 fs.mkdirSync(blobDir, { recursive: true }); assert.ok(inside(destination, fs.realpathSync(blobDir)));
 const candidates = fs.existsSync(imports) ? (() => {
  assert.ok(inside(destination, fs.realpathSync(imports)), 'Private import directory escapes backup');
  return fs.readdirSync(imports, { withFileTypes: true }).filter(e => e.isFile() && /\.(webp|png|jpe?g|pdf)$/i.test(e.name)).map(e => path.join(imports, e.name));
 })() : [];
 assert.ok(candidates.length <= 50, 'Too many files in private import directory');
 let cached = [];
 if (fs.existsSync(cacheFile)) {
  const pointer = JSON.parse(fs.readFileSync(cacheFile)); assert.equal(pointer.target, target);
  const source = fs.realpathSync(pointer.backup_directory); assert.ok(inside(root, source), 'Private cache escapes approved backup root');
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'))); assert.equal(manifest.target, target); assert.equal(manifest.storage_blob_backup_verified, true);
  const inventory = JSON.parse(fs.readFileSync(path.join(source, 'storage-backup-manifest.json'))); assert.equal(inventory.target, target); assert.equal(inventory.complete, true);
  cached = inventory.objects.filter(o => o.private).map(o => ({ ...o, directory: source }));
 }
 const records = [], missing = []; let cursor = 0;
 function validateBody(object, body) {
  assert.equal(body.length, Number(object.metadata.size), 'Storage file size mismatch');
  const expected = etag(object.metadata.eTag || object.metadata.etag);
  if (/^[a-f0-9]{32}$/.test(expected)) assert.equal(digest(body, 'md5'), expected, 'Storage original checksum mismatch');
  else if (!object.public) throw Error('Private original requires an authenticated checksum; metadata ETag is not a single-object MD5');
  return digest(body);
 }
 async function worker() {
  while (cursor < objects.length) {
   const object = objects[cursor++]; assert.equal(typeof object.public, 'boolean');
   assert.match(object.bucket, /^[a-zA-Z0-9_-]+$/); assert.ok(object.name && !object.name.includes('\\') && object.name.split('/').every(p => p && p !== '.' && p !== '..'));
   const size = Number(object.metadata?.size); assert.ok(Number.isSafeInteger(size) && size >= 0 && size < 50e6);
   const file = digest(object.bucket + '\0' + object.name) + '.blob', output = path.join(blobDir, file);
   let body, method;
   if (object.public) {
    const url = target + '/storage/v1/object/public/' + [object.bucket, ...object.name.split('/')].map(encodeURIComponent).join('/');
    const response = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(30000) }); assert.equal(response.status, 200, 'Public Storage download failed');
    const chunks = []; let bytes = 0;
    for await (const part of response.body) { bytes += part.length; assert.ok(bytes <= size, 'Storage exceeds expected size'); chunks.push(part); }
    body = Buffer.concat(chunks); method = 'public_get';
    const expected = etag(object.metadata.eTag || object.metadata.etag);
    if (expected && !/^[a-f0-9]{32}$/.test(expected)) assert.equal(etag(response.headers.get('etag')), expected);
   } else {
    if (fs.existsSync(output)) { body = fs.readFileSync(output); method = 'verified_destination'; }
    if (!body) {
     const saved = cached.find(o => o.id === object.id && o.bucket === object.bucket && o.name === object.name && o.metadata_fingerprint === fingerprint(object));
     if (saved) { assert.match(saved.file, /^[a-f0-9]{64}\.blob$/); const full = path.join(saved.directory, 'storage-blobs', saved.file); assert.ok(inside(saved.directory, fs.realpathSync(full))); body = fs.readFileSync(full); assert.equal(digest(body), saved.sha256, 'Cached private backup corrupted'); method = 'verified_previous_backup'; }
    }
    if (!body) {
     const expected = etag(object.metadata.eTag || object.metadata.etag);
     if (!/^[a-f0-9]{32}$/.test(expected)) throw Error('Private original checksum unavailable; authenticated download verification required');
     for (const candidate of candidates) {
      if (fs.statSync(candidate).size !== size) continue;
      const bytes = fs.readFileSync(candidate);
      if (digest(bytes, 'md5') === expected) { body = bytes; method = 'dashboard_original_import'; break; }
     }
    }
    if (!body) { missing.push({ id: object.id, bucket: object.bucket, name: object.name, bytes: size, mime: object.metadata.mimetype, import_directory: imports }); continue; }
   }
   const sha256 = validateBody(object, body);
   if (fs.existsSync(output)) assert.equal(digest(fs.readFileSync(output)), sha256, 'Existing backup blob differs'); else fs.writeFileSync(output, body);
   assert.equal(digest(fs.readFileSync(output)), sha256);
   records.push({ id: object.id, bucket: object.bucket, name: object.name, private: !object.public, bytes: body.length, sha256, file, metadata_fingerprint: fingerprint(object), source_etag: etag(object.metadata.eTag || object.metadata.etag), verification_method: method });
  }
 }
 // Finish every worker before reporting an error or allowing the clone to stop.
 const workers = await Promise.allSettled([worker(), worker(), worker(), worker()]);
 for (const result of workers) if (result.status === 'rejected') throw result.reason;
 records.sort((a, b) => (a.bucket + '/' + a.name).localeCompare(b.bucket + '/' + b.name));
 const complete = missing.length === 0 && records.length === objects.length;
 fs.writeFileSync(path.join(destination, 'storage-backup-manifest.json'), JSON.stringify({ target, complete, expected_objects: objects.length, objects: records, missing_private_objects: missing }, null, 2) + '\n');
 return { storage_blob_backup_verified: complete, storage_blobs: records.length, storage_bytes: records.reduce((n, o) => n + o.bytes, 0), private_storage_objects: objects.filter(o => !o.public).length, missing_private_objects: missing.length, storage_limit: complete ? undefined : 'Download missing private originals through Dashboard into private-import; no production migration attempted.' };
}
// Call only AFTER the caller persists a verified complete manifest.json.
export function rememberVerifiedStorageBackup({ target, folder, cacheFile = '.vercel/ofissio-private-blob-cache.json' }) {
 const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'))), inventory = JSON.parse(fs.readFileSync(path.join(folder, 'storage-backup-manifest.json')));
 assert.equal(manifest.target, target); assert.equal(manifest.storage_blob_backup_verified, true); assert.equal(inventory.complete, true);
 fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
 fs.writeFileSync(cacheFile, JSON.stringify({ target, backup_directory: fs.realpathSync(folder) }, null, 2) + '\n');
}
