// Buat/hapus akun uji E2E sementara di PRODUKSI (via GoTrue admin API +
// service key). Akun: super_admin + ACTIVE — hanya untuk verifikasi
// operasional pasca-hardening; dihapus setelah selesai.
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY; create juga butuh HARMAS_E2E_PASSWORD. Arg: create | delete
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const mode = process.argv[2];
const EMAIL = 'e2e-temp@harmas-test.local';
const PASSWORD = process.env.HARMAS_E2E_PASSWORD;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Butuh env SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

if (mode === 'create') {
  if (!PASSWORD) {
    console.error('Butuh env HARMAS_E2E_PASSWORD untuk membuat akun uji');
    process.exit(1);
  }
  // 1) User auth
  const r1 = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  });
  const u = await r1.json();
  if (!r1.ok && !String(u.message || '').includes('already')) {
    console.error('GAGAL buat user:', r1.status, u.message);
    process.exit(1);
  }
  const uid = u.id;
  console.log('auth user:', uid || '(sudah ada)');
  if (!uid) process.exit(0);

  // 2) Profil super_admin + ACTIVE (via service key — jalur tepercaya)
  const { data: role } = await fetch(`${SUPABASE_URL}/rest/v1/roles?select=id&role_name=eq.super_admin`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  }).then((r) => r.json());
  const r2 = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      auth_user_id: uid,
      full_name: 'E2E Verifikasi Sementara',
      email: EMAIL,
      role_id: role[0].id,
      account_status: 'ACTIVE',
    }),
  });
  const p = await r2.json();
  console.log(r2.ok ? 'profil dibuat (super_admin ACTIVE)' : `profil: ${r2.status} ${JSON.stringify(p).slice(0, 120)}`);
  console.log('EMAIL=' + EMAIL);
} else if (mode === 'delete') {
  // cari uid
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(EMAIL)}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const d = await r.json();
  const uid = d.users?.[0]?.id;
  if (!uid) { console.log('user tidak ditemukan (sudah bersih)'); process.exit(0); }
  const rd = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  console.log(rd.ok ? 'user + profil terhapus (FK CASCADE)' : `hapus: ${rd.status}`);
} else {
  console.error('Arg: create|delete');
  process.exit(1);
}
