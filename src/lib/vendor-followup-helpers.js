import { supabase } from './supabase';

export const FOLLOWUP_SELECT = `*,
  candidate:vendor_candidates(id, candidate_code, business_name, category_id),
  internal_pic:user_profiles!vendor_followups_internal_pic_id_fkey(id, full_name),
  creator:user_profiles!vendor_followups_created_by_fkey(id, full_name)`;

export function isFollowupOverdue(row, now = Date.now()) {
  return row.task_status === 'OPEN' && Boolean(row.next_action_due) && new Date(row.next_action_due).getTime() < now;
}

export function formatFollowupTime(value) {
  return value ? new Date(value).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
  }) + ' WIB' : 'Belum dijadwalkan';
}

// datetime-local menampilkan WIB, terlepas dari zona waktu perangkat.
export function toJakartaInput(value = new Date()) {
  return new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0, 16);
}
export function fromJakartaInput(value) {
  return value ? new Date(`${value}:00+07:00`).toISOString() : null;
}

export async function fetchFollowups({ candidateId = '', picId = '', status = '', overdue = false, page = 0, pageSize = 25 } = {}) {
  let query = supabase.from('vendor_followups').select(FOLLOWUP_SELECT, { count: 'exact' });
  if (candidateId) query = query.eq('candidate_id', candidateId);
  if (picId) query = query.eq('internal_pic_id', picId);
  if (status && !overdue) query = query.eq('task_status', status);
  if (overdue) query = query.eq('task_status', 'OPEN').lt('next_action_due', new Date().toISOString());
  const { data, error, count } = await query.order('contact_at', { ascending: false }).order('id')
    .range(page * pageSize, (page + 1) * pageSize - 1);
  if (error) throw error;
  return { rows: data || [], count: count || 0 };
}

export async function saveFollowup(form) {
  const { data, error } = await supabase.from('vendor_followups').insert({
    candidate_id: form.candidate_id, contact_at: fromJakartaInput(form.contact_at),
    internal_pic_id: form.internal_pic_id, channel: form.channel, contact_outcome: form.contact_outcome,
    contact_result: form.contact_result.trim(), new_info: form.new_info.trim() || null,
    next_action: form.next_action.trim() || null, next_action_due: fromJakartaInput(form.next_action_due),
    attachment_path: form.attachment_path.trim() || null, notes: form.notes.trim() || null
  }).select('id').single();
  if (error) throw error;
  return data;
}

export async function closeFollowup(id, taskStatus) {
  if (!['SELESAI', 'DIBATALKAN'].includes(taskStatus)) throw new Error('Status penutupan tidak valid');
  const { data, error } = await supabase.from('vendor_followups').update({ task_status: taskStatus })
    .eq('id', id).eq('task_status', 'OPEN').select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Tugas sudah berubah atau akses ditolak. Muat ulang daftar.');
}

// Ambil semua opsi dengan pagination agar tidak berhenti diam-diam di 1.000 baris.
async function fetchAllOptions(table, select, order, configure = (q) => q) {
  const rows = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await configure(supabase.from(table).select(select)).order(order).order('id').range(start, start + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

export async function fetchFollowupOptions() {
  const [candidates, users, categories] = await Promise.all([
    fetchAllOptions('vendor_candidates', 'id,candidate_code,business_name,internal_pic_id', 'business_name'),
    fetchAllOptions('user_profiles', 'id,full_name', 'full_name', (q) => q.eq('account_status', 'ACTIVE')),
    fetchAllOptions('vendor_categories', 'id,name', 'name')
  ]);
  return { candidates, users, categories };
}

export async function fetchSourcingDashboard(categoryId = '', picId = '') {
  const { data, error } = await supabase.rpc('vendor_sourcing_dashboard', { p_category_id: categoryId || null, p_pic_id: picId || null });
  if (error) throw error;
  return data;
}

export async function remindOverdueFollowups() {
  const { data, error } = await supabase.rpc('vendor_remind_overdue_followups');
  if (error) throw error;
  return data;
}
