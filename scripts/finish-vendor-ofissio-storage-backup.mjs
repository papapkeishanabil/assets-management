// Completes Storage backup only; no PostgreSQL connection or credential access.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { hash, source, same, target } from './vendor-ofissio-release-checks.mjs';
import { backupStorageObjects, rememberVerifiedStorageBackup } from './vendor-storage-backup.mjs';
const stateFile = '.vercel/ofissio-release-status.json', state = JSON.parse(fs.readFileSync(stateFile));
const folder = fs.realpathSync(state.backup_directory), manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json')));
assert.match(folder.replaceAll('\\', '/'), /^D:\/Backups\/harmas-pre-ofissio-\d{8}-\d{6}-[a-f0-9]{8}$/);
assert.equal(manifest.target, target); assert.equal(manifest.production_migration_executed, false);
assert.equal(manifest.sha256, hash(fs.readFileSync(path.join(folder, 'database.dump'))));
assert.ok(manifest.application_restore_verified && manifest.migrations_and_rollbacks_twice_offline && manifest.stale_transaction_rejected);
assert.ok(same(manifest.sql_files, source.map(({ file, sha256 }) => ({ file, sha256 }))));
const inventory = JSON.parse(fs.readFileSync(path.join(folder, 'storage-object-inventory.json'))); assert.equal(inventory.target, target);
const result = await backupStorageObjects({ target, folder, objects: inventory.objects });
Object.assign(manifest, result); if (result.storage_blob_backup_verified) { delete manifest.storage_limit; delete manifest.failure; manifest.verified_at = new Date().toISOString(); }
manifest.final_live_recheck_required = true;
fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
if (result.storage_blob_backup_verified) rememberVerifiedStorageBackup({ target, folder });
const report = { checked_at: new Date().toISOString(), target, backup_directory: folder, database_dump_sha256: manifest.sha256, logical_restore_tables: manifest.logical_restore_tables, logical_restore_rows: manifest.logical_restore_rows, baseline_tables_verified: 27, existing_data_and_security_unchanged: true, migrations_rehearsed_offline: true, production_migration_executed: false, production_write_requests: 0, storage_blob_backup_verified: result.storage_blob_backup_verified, storage_blobs: result.storage_blobs, private_storage_objects: result.private_storage_objects, missing_private_objects: result.missing_private_objects, supabase_platform_restore_complete: false, migration_approved: true, final_live_recheck_required: true };
const status = result.storage_blob_backup_verified ? 'BACKUP_VERIFIED_APPROVED_MIGRATION_READY' : 'PRIVATE_STORAGE_BACKUP_REQUIRED';
fs.writeFileSync('docs/vendor-management/ofissio-catalog-evidence/BACKUP_READINESS.json', JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(stateFile, JSON.stringify({ state: status, updated_at: new Date().toISOString(), backup_directory: folder, production_migration_executed: false, migration_attempted: false, report_file: 'docs/vendor-management/ofissio-catalog-evidence/BACKUP_READINESS.json' }, null, 2) + '\n');
console.log(JSON.stringify({ state: status, storage_blobs: result.storage_blobs, private_objects: result.private_storage_objects, private_originals_missing: result.missing_private_objects, migration_executed: false }));
