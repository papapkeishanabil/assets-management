// Verifikasi pasca-pemulihan 5 DROP POLICY (persetujuan darurat user).
// Hanya READ-ONLY + probe publik. Env: SUPABASE_URL, ANON_KEY.
const url = process.env.SUPABASE_URL;
const anon = process.env.ANON_KEY;
if (!url || !anon) { console.error('Butuh env SUPABASE_URL, ANON_KEY'); process.exit(1); }

const H = { apikey: anon, Authorization: 'Bearer ' + anon };

async function show(label, promise) {
  try {
    const r = await promise;
    const b = await r.text();
    console.log(label + ':', r.status, b.slice(0, 70));
  } catch (e) {
    console.log(label + ': ERROR', e.message);
  }
}

// V1+V8: user_profiles anon — harus 200 kosong (bukan 500 recursion)
await show('V1/V8 anon user_profiles', fetch(url + '/rest/v1/user_profiles?select=id&limit=1', { headers: H }));
// V6+V9a: notifications baca anon — kosong
await show('V6/V9a anon notifications', fetch(url + '/rest/v1/notifications?select=id&limit=1', { headers: H }));
// V9b: anon INSERT notifications — harus ditolak
await show('V9b anon INSERT notifications', fetch(url + '/rest/v1/notifications', {
  method: 'POST',
  headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000000', title: 'probe-ditolak' })
}));
// V10: anon roles — kosong
await show('V10 anon roles', fetch(url + '/rest/v1/roles?select=id&limit=1', { headers: H }));
// V2: endpoint login hidup (kredensial salah = 400, bukan 5xx)
await show('V2 endpoint login', fetch(url + '/auth/v1/token?grant_type=password', {
  method: 'POST',
  headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'probe-nonexistent@x.local', password: 'wrong' })
}));
// V12: situs produksi
await show('V12 situs produksi', fetch('https://harmas-asset-management.vercel.app/'));
// V-fungsi QR publik tetap hidup
await show('V-fungsi QR publik', fetch(url + '/rest/v1/rpc/get_public_asset_by_qr', {
  method: 'POST',
  headers: { ...H, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_token: '00000000-0000-0000-0000-000000000000' })
}));
