import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return json({ error: 'Metode tidak diizinkan' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const authorization = request.headers.get('Authorization')

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return json({ error: 'Konfigurasi atau autentikasi tidak lengkap' }, 401)
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await callerClient.auth.getUser()
  if (userError || !userData.user) {
    return json({ error: 'Sesi tidak valid' }, 401)
  }

  const { data: callerProfile, error: profileError } = await adminClient
    .from('user_profiles')
    .select('id, account_status, role_id')
    .eq('auth_user_id', userData.user.id)
    .single()

  if (profileError || !callerProfile) {
    console.error('Caller profile lookup failed', profileError)
    return json({ error: 'Hanya Super Admin yang dapat membuat pengguna' }, 403)
  }

  const { data: callerRoleData, error: callerRoleError } = await adminClient
    .from('roles')
    .select('role_name')
    .eq('id', callerProfile.role_id)
    .single()

  if (callerRoleError || !callerRoleData) {
    console.error('Caller role lookup failed', callerRoleError)
    return json({ error: 'Hanya Super Admin yang dapat membuat pengguna' }, 403)
  }

  const callerStatus = callerProfile.account_status?.trim().toUpperCase()
  const callerRole = callerRoleData.role_name?.trim().toLowerCase()

  if (callerStatus !== 'ACTIVE' || callerRole !== 'super_admin') {
    return json({ error: 'Hanya Super Admin yang dapat membuat pengguna' }, 403)
  }

  let payload: Record<string, string>
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'Data tidak valid' }, 400)
  }

  const fullName = payload.full_name?.trim()
  const email = payload.email?.trim().toLowerCase()
  const password = payload.password ?? ''
  const roleName = payload.role?.trim()
  const departmentId = payload.department_id?.trim() || null
  const subDepartmentId = payload.sub_department_id?.trim() || null

  if (!fullName || !email || password.length < 8 || !roleName) {
    return json({ error: 'Nama, email, role, dan password minimal 8 karakter wajib diisi' }, 400)
  }

  const { data: role, error: roleError } = await adminClient
    .from('roles')
    .select('id')
    .eq('role_name', roleName)
    .eq('is_active', true)
    .single()

  if (roleError || !role) {
    return json({ error: 'Role tidak valid atau tidak aktif' }, 400)
  }

  let departmentName = payload.department?.trim() || ''
  let validDepartmentId = departmentId
  let validSubDepartmentId = subDepartmentId

  if (validDepartmentId) {
    const { data: department, error: departmentError } = await adminClient
      .from('departments')
      .select('id, department_name')
      .eq('id', validDepartmentId)
      .eq('is_active', true)
      .single()

    if (departmentError || !department) {
      return json({ error: 'Departemen tidak valid atau tidak aktif' }, 400)
    }

    departmentName = department.department_name
  }

  if (validSubDepartmentId) {
    const { data: subDepartment, error: subDepartmentError } = await adminClient
      .from('sub_departments')
      .select('id, department_id')
      .eq('id', validSubDepartmentId)
      .eq('is_active', true)
      .single()

    if (subDepartmentError || !subDepartment) {
      return json({ error: 'Subdepartemen tidak valid atau tidak aktif' }, 400)
    }

    if (!validDepartmentId || subDepartment.department_id !== validDepartmentId) {
      return json({ error: 'Subdepartemen tidak sesuai dengan departemen yang dipilih' }, 400)
    }
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createError || !created.user) {
    const duplicate = createError?.message?.toLowerCase().includes('already')
    return json({ error: duplicate ? 'Email sudah terdaftar' : (createError?.message || 'Gagal membuat akun') }, 400)
  }

  const { error: insertError } = await adminClient.from('user_profiles').insert({
    auth_user_id: created.user.id,
    full_name: fullName,
    email,
    phone: payload.phone?.trim() || '',
    department: departmentName,
    department_id: validDepartmentId,
    sub_department_id: validSubDepartmentId,
    position: payload.position?.trim() || '',
    role_id: role.id,
    account_status: 'ACTIVE',
    approved_at: new Date().toISOString(),
    approved_by: callerProfile.id,
  })

  if (insertError) {
    await adminClient.auth.admin.deleteUser(created.user.id)
    return json({ error: `Gagal membuat profil: ${insertError.message}` }, 400)
  }

  return json({
    success: true,
    user: { id: created.user.id, email, full_name: fullName, role: roleName },
  }, 201)
})
