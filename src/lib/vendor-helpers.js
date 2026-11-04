// Helper data Modul Manajemen Vendor (Supabase client-side, pola sama
// dengan lib existing: asset-helpers.js / contract-helpers.js).
import { supabase } from './supabase';

export const CANDIDATE_SELECT = `
  id, candidate_code, business_name, business_type, category_id, internal_pic_id,
  source, process_stage, qualification_status, operational_status,
  capacity_qty, capacity_unit, moq, lead_time_days, indicative_price,
  payment_term, service_area, legal_status, notes,
  vendor_id, activated_at, created_at, updated_at,
  category:vendor_categories(id, name),
  internal_pic:user_profiles!vendor_candidates_internal_pic_id_fkey(id, full_name)
`;

/**
 * Ambil daftar calon vendor + relasi, dengan filter opsional.
 */
export async function fetchVendorCandidates({ search = '', categoryId = '', stage = '', qualification = '' } = {}) {
  let query = supabase
    .from('vendor_candidates')
    .select(CANDIDATE_SELECT)
    .order('created_at', { ascending: false });

  if (categoryId) query = query.eq('category_id', categoryId);
  if (stage) query = query.eq('process_stage', stage);
  if (qualification) query = query.eq('qualification_status', qualification);
  if (search) {
    query = query.or(`business_name.ilike.%${search}%,candidate_code.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Ambil satu kandidat lengkap + spesialisasi + kontak.
 */
export async function fetchVendorCandidateDetail(id) {
  const [{ data: candidate, error }, { data: specialties, error: specError }, { data: contacts, error: contactError }] = await Promise.all([
    supabase.from('vendor_candidates').select(CANDIDATE_SELECT).eq('id', id).single(),
    supabase
      .from('vendor_candidate_specialties')
      .select('specialty_id, specialty:vendor_specialties(id, name)')
      .eq('candidate_id', id),
    supabase.from('vendor_contacts').select('*').eq('candidate_id', id).order('is_primary', { ascending: false })
  ]);

  if (error) throw error;
  if (specError) throw specError;
  if (contactError) throw contactError;

  return {
    ...candidate,
    specialties: (specialties || []).map((s) => s.specialty).filter(Boolean),
    contacts: contacts || []
  };
}

/**
 * Deteksi duplikat kandidat (spec §2 — nama + nomor telepon):
 * nama kandidat mirip ATAU nomor telepon kontak sudah terdaftar.
 * Return array kandidat serupa untuk dikonfirmasi user.
 */
export async function findDuplicateCandidates(businessName, contactPhones = [], excludeId = null) {
  const phones = contactPhones.filter(Boolean);
  // 1) Nama mirip
  let nameQuery = supabase
    .from('vendor_candidates')
    .select('id, candidate_code, business_name, process_stage, qualification_status')
    .ilike('business_name', `%${businessName}%`);
  if (excludeId) nameQuery = nameQuery.neq('id', excludeId);
  const { data: byName, error: nameError } = await nameQuery;
  if (nameError) throw nameError;

  // 2) Telepon kontak sama
  let phoneMatches = [];
  if (phones.length > 0) {
    const { data, error } = await supabase
      .from('vendor_contacts')
      .select('candidate_id, phone, vendor_candidates(candidate_code, business_name)')
      .in('phone', phones);
    if (error) throw error;
    phoneMatches = (data || [])
      .filter((c) => c.candidate_id !== excludeId && c.vendor_candidates)
      .map((c) => ({
        id: c.candidate_id,
        candidate_code: c.vendor_candidates.candidate_code,
        business_name: c.vendor_candidates.business_name,
        matched_phone: c.phone
      }));
  }

  // Gabung unik berdasar id
  const map = new Map();
  for (const c of [...(byName || []), ...phoneMatches]) map.set(c.id, c);
  return [...map.values()];
}

/**
 * Simpan kandidat (insert/update) + sinkron spesialisasi & kontak.
 * Transaksi dilakukan berurutan (tanpa RPC) mengikuti pola form aset existing.
 */
export async function saveVendorCandidate({ candidateId = null, form, specialtyIds = [], contacts = [], actorId }) {
  const payload = {
    business_name: form.business_name,
    business_type: form.business_type,
    category_id: form.category_id || null,
    internal_pic_id: form.internal_pic_id || null,
    source: form.source || null,
    process_stage: form.process_stage,
    qualification_status: form.qualification_status,
    operational_status: form.operational_status || 'NOT_ACTIVE',
    capacity_qty: form.capacity_qty ? Number(form.capacity_qty) : null,
    capacity_unit: form.capacity_unit || null,
    moq: form.moq || null,
    lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : null,
    indicative_price: form.indicative_price ? Number(form.indicative_price) : null,
    payment_term: form.payment_term || null,
    service_area: form.service_area || null,
    legal_status: form.legal_status,
    notes: form.notes || null
  };

  let id = candidateId;
  if (candidateId) {
    payload.updated_by = actorId;
    const { error } = await supabase.from('vendor_candidates').update(payload).eq('id', candidateId);
    if (error) throw error;
  } else {
    payload.created_by = actorId;
    const { data, error } = await supabase.from('vendor_candidates').insert([payload]).select('id').single();
    if (error) throw error;
    id = data.id;
  }

  // Sinkron spesialisasi (delete lama → insert baru; M:N ringan)
  if (specialtyIds) {
    const { error: delError } = await supabase
      .from('vendor_candidate_specialties')
      .delete()
      .eq('candidate_id', id);
    if (delError) throw delError;
    if (specialtyIds.length > 0) {
      const rows = specialtyIds.map((sid) => ({ candidate_id: id, specialty_id: sid }));
      const { error: insError } = await supabase.from('vendor_candidate_specialties').insert(rows);
      if (insError) throw insError;
    }
  }

  // Sinkron kontak (replace; jejak perubahan tercatat di activity log fase berikutnya)
  if (contacts) {
    const { error: delError } = await supabase.from('vendor_contacts').delete().eq('candidate_id', id);
    if (delError) throw delError;
    const valid = contacts.filter((c) => c.contact_name && c.contact_name.trim());
    if (valid.length > 0) {
      const rows = valid.map((c) => ({
        candidate_id: id,
        contact_name: c.contact_name.trim(),
        role_title: c.role_title || null,
        phone: c.phone || null,
        whatsapp: c.whatsapp || null,
        email: c.email || null,
        is_primary: Boolean(c.is_primary),
        created_by: actorId
      }));
      const { error: insError } = await supabase.from('vendor_contacts').insert(rows);
      if (insError) throw insError;
    }
  }

  return id;
}

/**
 * Riwayat gabungan untuk tab Riwayat: status history + activity logs,
 * diurutkan terbaru dulu.
 */
export async function fetchCandidateHistory(candidateId) {
  const [{ data: statusHistory, error: e1 }, { data: activityLogs, error: e2 }] = await Promise.all([
    supabase
      .from('vendor_status_history')
      .select('id, field_name, old_value, new_value, changed_at, changed_by:user_profiles(id, full_name)')
      .eq('candidate_id', candidateId)
      .order('changed_at', { ascending: false }),
    supabase
      .from('vendor_activity_logs')
      .select('id, action, old_values, new_values, created_at, actor:user_profiles(id, full_name)')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return { statusHistory: statusHistory || [], activityLogs: activityLogs || [] };
}

export function formatRupiah(value) {
  if (value === null || value === undefined || value === '') return '-';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
}
