// ============================================================
// Validasi AMAN migration Fase 1 Modul Manajemen Vendor.
//
// Prinsip: JIAC exec_sql menjalankan satu panggilan = satu transaksi
// atomik, maka mengirim [migration + error di akhir] akan me-ROLLBACK
// seluruh batch → migration tervalidasi penuh TANPA tersimpan.
//
// Langkah:
//   1. Probe atomicity: buat schema throwaway lalu error disengaja.
//      - Cek apakah schema tersimpan (berarti TIDAK atomik → bersihkan,
//        laporkan, jangan lanjut validasi otomatis).
//   2. Jika atomik: kirim seluruh isi migration + RAISE di akhir.
//      Pesan 'PHASE1_VALIDATED_OK' = semua statement sukses lalu
//      di-rollback → tidak ada yang tersimpan.
//
// Kredensial dari env (SUPABASE_URL, SUPABASE_SERVICE_KEY) — tanpa hardcode.
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

async function execSql(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  return { status: res.status, body: await res.text() };
}

function extractMessage(body) {
  try { return JSON.parse(body).message || body; } catch { return body; }
}

// ---------- 1. Probe atomicity ----------
console.log('Langkah 1: probe atomicity exec_sql...');
const probe = await execSql(
  `CREATE SCHEMA IF NOT EXISTS vm_atomic_probe; DO $$ BEGIN RAISE EXCEPTION 'PROBE_BOOM'; END $$;`
);
console.log(`  hasil probe (harus error PROBE_BOOM): ${extractMessage(probe.body)}`);

const check = await execSql(
  `DO $$ DECLARE n INT; BEGIN
     SELECT count(*) INTO n FROM information_schema.schemata WHERE schema_name = 'vm_atomic_probe';
     RAISE EXCEPTION 'SCHEMA_PERSISTED=%', n;
   END $$;`
);
const persisted = extractMessage(check.body);
console.log(`  schema probe tersimpan? ${persisted}`);

// Bersihkan schema probe apa pun hasilnya (read-only bagi aplikasi).
await execSql(`DROP SCHEMA IF EXISTS vm_atomic_probe CASCADE;`);
console.log('  schema probe dibersihkan.');

if (!persisted.includes('SCHEMA_PERSISTED=0')) {
  console.error('!! exec_sql TIDAK atomik — validasi otomatis dibatalkan.');
  console.error('   Migration harus divalidasi manual di Supabase SQL Editor (copy-paste lalu ROLLBACK).');
  process.exit(2);
}
console.log('  exec_sql atomik → lanjut validasi rollback-otomatis.');

// ---------- 2. Validasi migration penuh (tanpa persist) ----------
console.log('Langkah 2: validasi migration Fase 1 (batch di-rollback otomatis)...');
const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '202611040001_vendor_management_phase1.sql');
const migration = readFileSync(migrationPath, 'utf8');

const result = await execSql(
  migration + `\nDO $$ BEGIN RAISE EXCEPTION 'PHASE1_VALIDATED_OK'; END $$;`
);
const msg = extractMessage(result.body);
console.log(`  hasil: ${msg}`);

if (msg.includes('PHASE1_VALIDATED_OK')) {
  console.log('SUKSES: seluruh migration valid (DDL, seed, trigger, policy) — tidak ada yang tersimpan.');
  process.exit(0);
} else {
  console.error('GAGAL: ada kesalahan SQL di migration — periksa pesan di atas. Tidak ada yang tersimpan.');
  process.exit(1);
}
