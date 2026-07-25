/**
 * Edge Function: generate-reminders
 *
 * Dijalankan sekali sehari (via pg_cron + pg_net) pukul 08:00 WIB.
 * Tugasnya:
 *   Fase 1 — cek seluruh jadwal pemeliharaan aktif, tentukan notifikasi
 *            yang jatuh pada hari ini (H-7/H-3/H-1/H-0/terlambat, atau
 *            reminder khusus sesuai reminder_days_before), lalu INSERT ke
 *            tabel notifications untuk semua penerima (admin + PJ).
 *   Fase 2 — kirim Web Push ke perangkat penerima yang sudah berlangganan
 *            (best-effort; gagal push tidak menggagalkan notifikasi in-app).
 *
 * Berjalan dengan service_role (bypass RLS). Aman karena hanya pg_cron yang
 * memanggil (dilindungi header x-cron-secret).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// Tanggal hari ini (YYYY-MM-DD) di zona Asia/Jakarta (WIB)
function getTodayWIB(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find(p => p.type === 'year')!.value
  const m = parts.find(p => p.type === 'month')!.value
  const d = parts.find(p => p.type === 'day')!.value
  return `${y}-${m}-${d}`
}

function getDayDiff(nextDateStr: string, todayStr: string): number {
  const d1 = new Date(`${nextDateStr}T00:00:00Z`).getTime()
  const d2 = new Date(`${todayStr}T00:00:00Z`).getTime()
  return Math.round((d1 - d2) / 86_400_000)
}

type NotifType =
  | 'REMINDER_7_DAYS' | 'REMINDER_3_DAYS' | 'REMINDER_1_DAY'
  | 'REMINDER_CUSTOM' | 'DUE_TODAY' | 'OVERDUE'

function buildMessage(
  type: NotifType, mName: string, assetLabel: string,
  daysLate: number, reminderDays: number,
): { title: string; body: string } {
  switch (type) {
    case 'OVERDUE':
      return { title: 'Pemeliharaan Terlambat', body: `${mName} untuk ${assetLabel} telah terlambat ${daysLate} hari.` }
    case 'DUE_TODAY':
      return { title: 'Pemeliharaan Jatuh Tempo Hari Ini', body: `${mName} untuk ${assetLabel} harus dilaksanakan hari ini.` }
    case 'REMINDER_1_DAY':
      return { title: 'Jadwal Pemeliharaan Mendatang', body: `${mName} untuk ${assetLabel} akan jatuh tempo besok.` }
    case 'REMINDER_CUSTOM':
      return { title: 'Jadwal Pemeliharaan Mendatang', body: `${mName} untuk ${assetLabel} akan jatuh tempo dalam ${reminderDays} hari.` }
    case 'REMINDER_7_DAYS':
      return { title: 'Jadwal Pemeliharaan Mendatang', body: `${mName} untuk ${assetLabel} akan jatuh tempo dalam 7 hari.` }
    case 'REMINDER_3_DAYS':
      return { title: 'Jadwal Pemeliharaan Mendatang', body: `${mName} untuk ${assetLabel} akan jatuh tempo dalam 3 hari.` }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Metode tidak diizinkan' }, 405)

  // Lindungi endpoint: hanya pemanggil dengan x-cron-secret yang benar
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  const provided = req.headers.get('x-cron-secret') ?? ''
  if (cronSecret && provided !== cronSecret) {
    return json({ error: 'Tidak diizinkan' }, 403)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Konfigurasi server tidak lengkap' }, 500)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const today = getTodayWIB()

  // 1. Ambil jadwal aktif + aset aktif + jenis pemeliharaan
  const { data: schedules, error: sErr } = await admin
    .from('maintenance_schedules')
    .select(
      'id, next_maintenance_date, reminder_days_before, responsible_user_id, '
      + 'maintenance_type:maintenance_types!inner(maintenance_name), '
      + 'asset:assets!inner(asset_code, asset_name)',
    )
    .eq('is_active', true)
    .eq('asset.is_active', true)

  if (sErr) return json({ error: 'Gagal mengambil jadwal', detail: sErr.message }, 500)
  if (!schedules || schedules.length === 0) {
    return json({ success: true, today, created: 0, reason: 'no active schedules' })
  }

  // 2. Penerima ber-role (dua langkah untuk menghindari PGRST201 relasi ambigu)
  const { data: roles } = await admin
    .from('roles').select('id').in('role_name', ['super_admin', 'hrd', 'direksi'])
  const roleIds = (roles ?? []).map(r => r.id)
  const { data: adminUsers } = await admin
    .from('user_profiles').select('id')
    .eq('account_status', 'ACTIVE').in('role_id', roleIds)
  const adminIds = (adminUsers ?? []).map(u => u.id)

  // 3. Bangun notifikasi
  interface Row { user_id: string; maintenance_schedule_id: string; notification_type: NotifType; title: string; message: string; notification_date: string; reference_url: string }
  interface Target { userId: string; title: string; body: string; url: string }
  const notifications: Row[] = []
  const pushTargets: Target[] = []

  for (const s of schedules as any[]) {
    const daysDiff = getDayDiff(s.next_maintenance_date, today)
    const reminderDays = Number(s.reminder_days_before) || 0
    let type: NotifType | null = null
    let daysLate = 0

    if (daysDiff === 0) type = 'DUE_TODAY'
    else if (daysDiff < 0) { type = 'OVERDUE'; daysLate = Math.abs(daysDiff) }
    else if (daysDiff === 7) type = 'REMINDER_7_DAYS'
    else if (daysDiff === 3) type = 'REMINDER_3_DAYS'
    else if (daysDiff === 1) type = 'REMINDER_1_DAY'
    else if (reminderDays > 0 && daysDiff === reminderDays) type = 'REMINDER_CUSTOM'

    if (!type) continue

    const mt: any = Array.isArray(s.maintenance_type) ? s.maintenance_type[0] : s.maintenance_type
    const mName = mt?.maintenance_name || '-'
    const assetLabel = `${s.asset?.asset_code || '-'} - ${s.asset?.asset_name || '-'}`
    const { title, body } = buildMessage(type, mName, assetLabel, daysLate, reminderDays)
    const url = `/maintenance/schedules/${s.id}`

    const recipientIds = new Set<string>(adminIds)
    if (s.responsible_user_id) recipientIds.add(s.responsible_user_id)

    recipientIds.forEach(uid => {
      notifications.push({
        user_id: uid,
        maintenance_schedule_id: s.id,
        notification_type: type as NotifType,
        title, message: body, notification_date: today, reference_url: url,
      })
      pushTargets.push({ userId: uid, title, body, url })
    })
  }

  // 4. Upsert notifikasi (anti-duplikat via ON CONFLICT DO NOTHING)
  let created = 0
  if (notifications.length > 0) {
    const { data: ins, error: iErr } = await admin
      .from('notifications')
      .upsert(notifications, {
        onConflict: 'user_id,maintenance_schedule_id,notification_type,notification_date',
        ignoreDuplicates: true,
      })
    if (iErr) return json({ error: 'Gagal menyimpan notifikasi', detail: iErr.message }, 500)
    created = Array.isArray(ins) ? ins.length : 0
  }

  // 5. Push (best-effort, tidak menggagalkan in-app)
  let pushSent = 0
  let pushError: string | null = null
  try {
    pushSent = await sendPush(admin, pushTargets)
  } catch (e: any) {
    pushError = e?.message || String(e)
  }

  return json({ success: true, today, created, evaluated: schedules.length, pushSent, pushError })
})

// Kirim Web Push ke subscription penerima (best-effort)
async function sendPush(admin: ReturnType<typeof createClient>, targets: Target[]): Promise<number> {
  const publicVapid = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
  const privateVapid = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
  if (!publicVapid || !privateVapid) return 0 // push belum dikonfigurasi → skip diam-diam
  if (!targets.length) return 0

  let webPush: any
  try {
    const mod: any = await import('https://esm.sh/web-push@3.6.7')
    webPush = mod.default || mod
  } catch (e) {
    console.error('[generate-reminders] web-push import gagal:', e)
    return 0
  }
  webPush.setVapidDetails('mailto:admin@harmas.co.id', publicVapid, privateVapid)

  const userIds = [...new Set(targets.map(t => t.userId))]
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('user_id, subscription')
    .in('user_id', userIds)
  if (!subs || subs.length === 0) return 0

  // Kelompokkan SEMUA subscription per user (mendukung banyak perangkat sekaligus)
  const subsByUser = new Map<string, any[]>()
  for (const s of subs as any[]) {
    if (!subsByUser.has(s.user_id)) subsByUser.set(s.user_id, [])
    subsByUser.get(s.user_id)!.push(s.subscription)
  }

  let sent = 0
  for (const t of targets) {
    const userSubs = subsByUser.get(t.userId)
    if (!userSubs || userSubs.length === 0) continue
    for (const sub of userSubs) {
      try {
        await webPush.sendNotification(sub, JSON.stringify({ title: t.title, body: t.body, url: t.url }))
        sent++
      } catch (e: any) {
        // 404/410 = subscription kedaluwarsa → hapus per endpoint saja (jangan sentuh perangkat lain)
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint).catch(() => {})
        } else {
          console.error('[generate-reminders] push gagal untuk', t.userId, e?.statusCode, e?.message)
        }
      }
    }
  }
  return sent
}
