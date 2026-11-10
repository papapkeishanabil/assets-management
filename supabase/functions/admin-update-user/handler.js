const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store'
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const only = (object, keys) => object && typeof object === 'object' && !Array.isArray(object) && Object.keys(object).every((key) => keys.includes(key));
const text = (value, max) => typeof value === 'string' && value.length <= max ? value.trim() : null;
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const authError = (error) => ['email_exists', 'email_address_not_authorized', 'email_address_invalid'].includes(error?.code)
  ? 'Email tidak valid atau sudah digunakan akun lain.' : error?.code === 'weak_password'
    ? 'Password belum memenuhi kebijakan keamanan. Gunakan password yang lebih kuat.' : 'Perubahan akun belum dapat disimpan.';

// Dependencies are supplied by the small Edge adapter; the same handler is exercised
// against real local Auth/PostgREST in tests. No SQL, role changes or client secrets.
export function createAdminUserHandler({ createClient, env, log = (record) => console.info(JSON.stringify(record)) }) {
  return async (request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (request.method !== 'POST') return json({ error: 'Metode tidak diizinkan' }, 405);
    const requestId = crypto.randomUUID();
    let actor, target, action;
    const audit = (outcome, extra = {}) => log({ event: 'admin_user_update', request_id: requestId,
      actor_profile_id: actor?.id || null, target_profile_id: target?.id || null, action: action || null, outcome, ...extra });
    try {
      const url = env('SUPABASE_URL'), anon = env('SUPABASE_ANON_KEY'), service = env('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !anon || !service) throw fail('Layanan pengelolaan pengguna belum dikonfigurasi.', 503);
      const authorization = request.headers.get('Authorization');
      if (!/^Bearer\s+\S+$/i.test(authorization || '')) throw fail('Silakan masuk kembali.', 401);
      const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
      const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: identity, error: identityError } = await caller.auth.getUser();
      if (identityError || !identity.user) throw fail('Sesi tidak valid. Silakan masuk kembali.', 401);
      const { data: profile, error: profileError } = await admin.from('user_profiles').select('id,role_id,account_status').eq('auth_user_id', identity.user.id).single();
      if (profileError || profile?.account_status !== 'ACTIVE') throw fail('Hanya Super Admin aktif yang dapat mengubah pengguna.', 403);
      const { data: role, error: roleError } = await admin.from('roles').select('role_name').eq('id', profile.role_id).single();
      if (roleError || role?.role_name !== 'super_admin') throw fail('Hanya Super Admin aktif yang dapat mengubah pengguna.', 403);
      actor = profile;
      const raw = await request.text();
      if (raw.length > 16384) throw fail('Data permintaan terlalu besar.', 413);
      let payload;
      try { payload = JSON.parse(raw); } catch { throw fail('Data permintaan tidak valid.'); }
      if (!only(payload, ['action', 'profile_id', 'expected_updated_at', 'profile', 'password']) || !uuid.test(payload.profile_id || '')) throw fail('Data permintaan tidak valid.');
      action = payload.action;
      if (!['update_profile', 'reset_password'].includes(action)) throw fail('Tindakan tidak valid.');
      if (action === 'reset_password' && ('profile' in payload || 'expected_updated_at' in payload)) throw fail('Data reset password tidak valid.');
      if (action === 'update_profile' && 'password' in payload) throw fail('Ubah identitas dan password melalui tindakan terpisah.');
      const { data: record, error: targetError } = await admin.from('user_profiles')
        .select('id,auth_user_id,full_name,email,phone,department,department_id,sub_department_id,position,updated_at').eq('id', payload.profile_id).single();
      if (targetError || !record) throw fail('Pengguna tidak ditemukan. Muat ulang daftar.', 404);
      target = record;
      if (!uuid.test(target.auth_user_id || '')) throw fail('Pengguna belum terhubung ke akun login.', 409);
      const { data: authData, error: authLookupError } = await admin.auth.admin.getUserById(target.auth_user_id);
      if (authLookupError || !authData.user) throw fail('Akun login pengguna tidak ditemukan.', 404);

      if (action === 'reset_password') {
        const password = payload.password;
        if (typeof password !== 'string' || !password.trim() || password.length < 8 || password.length > 128) throw fail('Password baru harus 8–128 karakter.');
        const { error } = await admin.auth.admin.updateUserById(target.auth_user_id, { password });
        if (error) throw fail(authError(error), error.status === 429 ? 429 : 400);
        audit('success');
        return json({ success: true, request_id: requestId });
      }

      if (!('expected_updated_at' in payload) || payload.expected_updated_at !== target.updated_at) throw fail('Data pengguna sudah berubah. Tutup form dan muat ulang daftar.', 409);
      const fields = payload.profile;
      if (!only(fields, ['full_name', 'email', 'phone', 'department', 'department_id', 'sub_department_id', 'position'])) throw fail('Kolom identitas tidak valid.');
      const fullName = text(fields.full_name, 200), email = text(fields.email, 254)?.toLowerCase();
      const phone = text(fields.phone, 40), position = text(fields.position, 150);
      let department = text(fields.department, 150);
      const departmentId = fields.department_id || null, subDepartmentId = fields.sub_department_id || null;
      if (!fullName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone === null || position === null || department === null) throw fail('Periksa nama, email, nomor telepon dan jabatan.');
      if ((departmentId && !uuid.test(departmentId)) || (subDepartmentId && !uuid.test(subDepartmentId))) throw fail('Departemen tidak valid.');
      if (departmentId) {
        const { data: dept, error } = await admin.from('departments').select('id,department_name,is_active').eq('id', departmentId).single();
        if (error || !dept || (!dept.is_active && departmentId !== target.department_id)) throw fail('Departemen tidak valid atau tidak aktif.');
        department = dept.department_name;
      }
      if (subDepartmentId) {
        const { data: sub, error } = await admin.from('sub_departments').select('id,department_id,is_active').eq('id', subDepartmentId).single();
        if (error || !sub || !departmentId || sub.department_id !== departmentId || (!sub.is_active && subDepartmentId !== target.sub_department_id)) throw fail('Subdepartemen tidak sesuai dengan departemen yang dipilih.');
      }
      const authUser = authData.user;
      const emailChanged = authUser.email?.toLowerCase() !== email;
      const authChanged = emailChanged || authUser.user_metadata?.full_name !== fullName;
      const metadata = { full_name: fullName };
      let updatedAuth;
      if (authChanged) {
        const { data, error } = await admin.auth.admin.updateUserById(target.auth_user_id, { user_metadata: metadata, ...(emailChanged ? { email, email_confirm: true } : {}) });
        if (error) throw fail(authError(error));
        updatedAuth = data.user;
      }
      let saveQuery = admin.from('user_profiles').update({ full_name: fullName, email, phone, position, department,
        department_id: departmentId, sub_department_id: subDepartmentId, updated_at: new Date().toISOString() }).eq('id', target.id).eq('auth_user_id', target.auth_user_id);
      saveQuery = payload.expected_updated_at === null ? saveQuery.is('updated_at', null) : saveQuery.eq('updated_at', payload.expected_updated_at);
      const { data: saved, error: saveError } = await saveQuery.select('id').maybeSingle();
      if (saveError || !saved) {
        if (authChanged) {
          // Auth and public profiles are separate APIs. Compensate an unsuccessful
          // profile write, but never overwrite a newer concurrent Auth change.
          const [authCheck, profileCheck] = await Promise.all([
            admin.auth.admin.getUserById(target.auth_user_id),
            admin.from('user_profiles').select('updated_at,auth_user_id').eq('id', target.id).single()
          ]);
          const latest = authCheck.data;
          const unchanged = !authCheck.error && !profileCheck.error && profileCheck.data?.updated_at === target.updated_at
            && profileCheck.data?.auth_user_id === target.auth_user_id && latest.user?.email?.toLowerCase() === email && latest.user?.updated_at === updatedAuth?.updated_at;
          const rollback = unchanged ? await admin.auth.admin.updateUserById(target.auth_user_id, {
            user_metadata: { full_name: authUser.user_metadata?.full_name ?? null }, ...(emailChanged ? { email: authUser.email, email_confirm: Boolean(authUser.email_confirmed_at) } : {})
          }) : { error: true };
          if (rollback.error) {
            audit('partial_failure', { needs_review: true });
            return json({ error: 'Perubahan akun belum sepenuhnya tersinkron. Muat ulang daftar dan periksa email login pengguna sebelum mencoba kembali.', needs_review: true, request_id: requestId }, 409);
          }
        }
        throw fail('Identitas belum tersimpan atau sudah berubah. Muat ulang daftar lalu coba kembali.', 409);
      }
      audit('success', { fields: Object.keys(fields), email_changed: emailChanged });
      return json({ success: true, request_id: requestId });
    } catch (error) {
      audit('denied_or_failed', { status: error.status || 500 });
      return json({ error: error.status ? error.message : 'Layanan belum dapat memproses perubahan. Silakan coba kembali.', request_id: requestId }, error.status || 500);
    }
  };
}
