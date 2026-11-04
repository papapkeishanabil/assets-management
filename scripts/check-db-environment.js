// Probe read-only environment DB untuk verifikasi backup (poin 5 review user).
// Hanya SELECT/information_schema via RAISE EXCEPTION — tidak mengubah apa pun.
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Butuh env: SUPABASE_URL dan SUPABASE_SERVICE_KEY');
  process.exit(1);
}

async function probe(label, inner) {
  const sql = `DO $$ DECLARE v TEXT; BEGIN ${inner} INTO v; RAISE EXCEPTION '${label}=%%', v; END $$;`.replace('%%', '%');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  const body = await res.text();
  try { console.log(JSON.parse(body).message || body); }
  catch { console.log(`${label}: [status ${res.status}] ${body.slice(0, 200)}`); }
}

// 1. Jenis instalasi & versi (hosted Supabase menandai versi mereka)
await probe('DB_VERSION', `SELECT version()`);
// 2. Region hosting dari konfigurasi project (jika tersedia)
await probe('HOST', `SELECT inet_server_addr()::text || ' / port ' || inet_server_port()::text`);
// 3. Ringkasan jumlah baris tabel kunci (untuk verifikasi backup sesudahnya)
await probe('ROWCOUNTS', `SELECT 'vendors=' || (SELECT count(*) FROM vendors) || ' assets=' || (SELECT count(*) FROM assets) || ' user_profiles=' || (SELECT count(*) FROM user_profiles) || ' employees=' || (SELECT count(*) FROM employees) || ' vendor_candidates=' || (SELECT count(*) FROM vendor_candidates)`);
