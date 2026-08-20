// ============================================================
// _ppm-env.js — Shared environment loader for LOCAL Node tooling ONLY.
//
// DEV-STD-01 rules:
//   - Reads .env.local (gitignored) then .env (gitignored).
//   - Never overrides a real process.env value (explicit env wins).
//   - NEVER imported by client/frontend code (no VITE_ exposure).
//   - Never prints the service key.
//   - Zero external dependencies.
//
// Used by: test-ppm-*.js, run-ppm-*-migration.js, run-migration.js,
//          cleanup-ppm-m1-test.js, apply-m1.1.js, fix-*.js, verify-*.js
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return; }
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnvFile(path.join(__dirname, '..', '.env.local'));
loadEnvFile(path.join(__dirname, '..', '.env'));

export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uwlxkwyauxwewoexfgwi.supabase.co';
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
export const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || SUPABASE_PUBLISHABLE_KEY;

export function assertServiceKey() {
  if (!SUPABASE_SERVICE_KEY) {
    console.error('ERROR: SUPABASE_SERVICE_KEY is not set.');
    console.error('Local test/migration tooling requires a Supabase service_role key.');
    console.error('Create a gitignored .env.local containing:');
    console.error('  SUPABASE_SERVICE_KEY=<service_role_jwt>');
    process.exit(1);
  }
}
