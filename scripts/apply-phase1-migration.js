// ============================================================
// EKSEKUSI MIGRATION FASE 1 — MODUL MANAJEMEN VENDOR
// DISETUJUI EKSPLISIT USER 5 Nov 2026 (setelah: pengujian lokal
// penuh, backup #2 terverifikasi, konfirmasi operasional SA).
// File: supabase/migrations/202611040001_vendor_management_phase1.sql
// (additive + idempotent; rollback tersedia di supabase/rollbacks/).
// Satu panggilan exec_sql = satu transaksi atomik.
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY.
// ============================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Butuh env: SUPABASE_URL dan SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, '..', 'supabase', 'migrations', '202611040001_vendor_management_phase1.sql'), 'utf8');

console.log('Target :', SUPABASE_URL, '(produksi HARMAS)');
console.log('Panjang SQL:', sql.length, 'karakter');

const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ sql }),
});
const body = await res.text();
console.log('Eksekusi → HTTP', res.status, body ? body.slice(0, 300) : '(void sukses — atomik)');
process.exit(res.status === 200 || res.status === 204 ? 0 : 1);
