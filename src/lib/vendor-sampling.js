import { supabase } from './supabase';
import { preparePhoto } from './vendor-location-utils';

export const SAMPLE_TYPES = { JAHIT_PRODUK: 'Jahit produk', BORDIR: 'Bordir', SWATCH_KAIN: 'Swatch kain', UJI_KAIN: 'Uji kain', PRINTING: 'Printing', CUTTING: 'Cutting', FINISHING: 'Finishing', AKSESORIS: 'Aksesori', LAINNYA: 'Lainnya' };
export const MATERIAL_SOURCES = { HARMAS: 'HARMAS', VENDOR: 'Vendor', GABUNGAN: 'Gabungan', TIDAK_RELEVAN: 'Tidak relevan' };
export const SAMPLE_STATUSES = { BRIEF_DIBUAT: 'Brief Dibuat', DITUGASKAN: 'Ditugaskan', DIKERJAKAN: 'Dikerjakan', SAMPEL_DITERIMA: 'Sampel Diterima', SEDANG_QC: 'Sedang QC', PERLU_REVISI: 'Perlu Revisi', SELESAI: 'Selesai', DIBATALKAN: 'Dibatalkan' };
export const SAMPLE_TRANSITIONS = { BRIEF_DIBUAT: ['DITUGASKAN', 'DIBATALKAN'], DITUGASKAN: ['DIKERJAKAN', 'DIBATALKAN'], DIKERJAKAN: ['SAMPEL_DITERIMA', 'DIBATALKAN'], SAMPEL_DITERIMA: ['SEDANG_QC', 'DIBATALKAN'], SEDANG_QC: ['DIBATALKAN'], PERLU_REVISI: ['DIKERJAKAN', 'DIBATALKAN'], SELESAI: [], DIBATALKAN: [] };
export const QC_DECISIONS = { LULUS: 'Lulus', REVISI: 'Revisi', TIDAK_LULUS: 'Tidak Lulus' };
export const qcBadge = (value) => value === 'LULUS' ? 'badge-green' : value === 'REVISI' ? 'badge-orange' : value === 'TIDAK_LULUS' ? 'badge-red' : 'badge-gray';
export const missingSamplingBackend = (error) => ['PGRST202', 'PGRST205', '42P01', '42883'].includes(error?.code);
const baseColumns = 'id,sample_code,candidate_id,sample_type,product_code,brief,techpack_path,material_source,quantity,unit,cost,assigned_at,target_date,received_at,internal_pic_id,status,revision_note,related_sample_id,notes,created_by,created_at,updated_by,updated_at,business_name,candidate_code,category_id,candidate_archived_at,vendor_id,qc_count';
export async function fetchSamples({ candidateId = '', status = '', search = '', canQC = false, page = 0, includeArchived = false } = {}) {
  let q = supabase.from('vendor_sample_monitor').select(baseColumns + (canQC ? ',latest_decision,latest_score,latest_revision_due' : ''), { count: 'exact' });
  if (!includeArchived) q = q.is('candidate_archived_at', null);
  if (candidateId) q = q.eq('candidate_id', candidateId);
  if (status) q = q.eq('status', status);
  if (search.trim()) q = q.or(`business_name.ilike.%${search.replace(/[(),]/g, '')}%,sample_code.ilike.%${search.replace(/[(),]/g, '')}%,product_code.ilike.%${search.replace(/[(),]/g, '')}%`);
  const r = await q.order('created_at', { ascending: false }).order('id').range(page * 25, page * 25 + 24);
  if (r.error) throw r.error; return { rows: r.data, count: r.count };
}
export async function fetchSample(id, canQC) {
  const r = await supabase.from('vendor_sample_monitor').select(baseColumns + (canQC ? ',latest_decision,latest_score,latest_revision_due' : '')).eq('id', id).single(); if (r.error) throw r.error; return r.data;
}
export async function fetchSampleHistory(id) {
  const r = await supabase.from('vendor_sample_change_history').select('*,actor:user_profiles!vendor_sample_change_history_changed_by_fkey(full_name)').eq('sample_id', id).order('changed_at', { ascending: false }); if (r.error) throw r.error; return r.data;
}
async function all(table, columns, configure = (q) => q) {
  const rows = [];
  for (let from = 0; ; from += 500) { const r = await configure(supabase.from(table).select(columns)).order('id').range(from, from + 499); if (r.error) throw r.error; rows.push(...r.data); if (r.data.length < 500) return rows; }
}
export async function fetchSamplingOptions(canQC) {
  const [candidates, users, categories] = await Promise.all([
    all('vendor_candidates', 'id,candidate_code,business_name,category_id', (q) => q.is('archived_at', null)),
    all('user_profiles', 'id,full_name', (q) => q.eq('account_status', 'ACTIVE')),
    all('vendor_categories', 'id,name')
  ]);
  let parameters = [], employees = [];
  if (canQC) {
    parameters = await all('vendor_qc_parameters', '*');
    try { employees = await all('employees', 'id,full_name', (q) => q.eq('is_active', true)); } catch { /* A free-text inspector name remains available. */ }
  }
  return { candidates, users, categories, parameters, employees };
}
export async function saveSample(form, editing = null) {
  const payload = Object.fromEntries(['candidate_id', 'sample_type', 'product_code', 'brief', 'material_source', 'unit', 'notes', 'revision_note'].map((k) => [k, form[k]?.trim() || (['notes', 'revision_note', 'product_code'].includes(k) ? null : '')]));
  payload.quantity = Number(form.quantity); payload.cost = form.cost === '' ? null : Number(form.cost); payload.internal_pic_id = form.internal_pic_id || null;
  payload.target_date = form.target_date || null; payload.assigned_at = form.assigned_at || null; payload.received_at = form.received_at || null;
  if (!editing) { payload.related_sample_id = form.related_sample_id || null; payload.status = 'BRIEF_DIBUAT'; }
  return updateOrCreateSample(payload, editing);
}
async function updateOrCreateSample(payload, editing) {
  const q = editing ? supabase.from('vendor_samples').update(payload).eq('id', editing.id).eq('updated_at', editing.updated_at) : supabase.from('vendor_samples').insert(payload);
  const r = await q.select('*').maybeSingle(); if (r.error) throw r.error; if (!r.data) throw new Error('Data sampel sudah berubah. Muat ulang sebelum menyimpan.'); return r.data;
}
export async function updateSample(sample, payload) { return updateOrCreateSample(payload, sample); }
export async function fetchSampleQC(sampleId) {
  const r = await supabase.from('vendor_sample_qc_runs').select('*,input_user:user_profiles!vendor_sample_qc_runs_input_by_fkey(full_name),revisions:vendor_qc_run_revisions(*,editor:user_profiles!vendor_qc_run_revisions_edited_by_fkey(full_name))').eq('sample_id', sampleId).order('run_no', { ascending: false });
  if (r.error) throw r.error; return r.data;
}
export async function saveSampleQC(sampleId, payload, editing) {
  const r = await supabase.rpc('vendor_record_sample_qc', { p_sample_id: sampleId, p_payload: payload, p_qc_id: editing?.id || null, p_expected_updated_at: editing?.updated_at || null });
  if (r.error) throw r.error; return r.data;
}
export async function fetchSamplingDashboard(category = '', pic = '') {
  const r = await supabase.rpc('vendor_sampling_dashboard', { p_category_id: category || null, p_pic_id: pic || null }); if (r.error) throw r.error; return r.data;
}
export async function saveQCParameter(form, id) {
  const payload = { parameter_name: form.parameter_name.trim(), category_id: form.category_id || null, weight: Number(form.weight), display_order: Number(form.display_order), is_active: form.is_active };
  const r = id ? await supabase.from('vendor_qc_parameters').update(payload).eq('id', id) : await supabase.from('vendor_qc_parameters').insert(payload);
  if (r.error) throw r.error;
}
export async function uploadSampleEvidence(sample, file) {
  if (!file?.size || file.size > 5242880) throw new Error('Berkas maksimal 5 MB');
  let blob = file, extension;
  if (file.type === 'application/pdf') {
    if (!/\.pdf$/i.test(file.name) || new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()) !== '%PDF-') throw new Error('Ekstensi dan signature PDF harus sesuai'); extension = 'pdf';
  } else { blob = await preparePhoto(file); extension = 'webp'; }
  const path = `${sample.candidate_id}/${sample.id}/${crypto.randomUUID()}.${extension}`;
  const r = await supabase.storage.from('vendor-sample-files').upload(path, blob, { upsert: false, contentType: blob.type }); if (r.error) throw r.error; return path;
}
export async function signedSampleEvidence(path) {
  const r = await supabase.storage.from('vendor-sample-files').createSignedUrl(path, 600); if (r.error) throw r.error; return r.data.signedUrl;
}
