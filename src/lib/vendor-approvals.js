import { supabase } from './supabase';
import { preparePhoto } from './vendor-location-utils';
export const DECISIONS = { APPROVED: 'Disetujui', RESERVE: 'Cadangan', REJECTED: 'Ditolak', FROZEN: 'Dibekukan' };
export const approvalBackendMissing = (e) => ['PGRST202', 'PGRST205', '42P01', '42883'].includes(e?.code);
export const todayWIB = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
export async function fetchApprovalCandidates({ search = '', qualification = '', page = 0 } = {}) {
  const backend = await supabase.from('vendor_decisions').select('id').limit(0); if (backend.error) throw backend.error;
  let q = supabase.from('vendor_candidates').select('id,candidate_code,business_name,qualification_status,operational_status,vendor_id,updated_at', { count: 'exact' }).is('archived_at', null);
  if (qualification) q = q.eq('qualification_status', qualification);
  if (search.trim()) { const value = search.replace(/[(),]/g, '').trim(); q = q.or(`business_name.ilike.%${value}%,candidate_code.ilike.%${value}%`); }
  const r = await q.order('updated_at', { ascending: false }).order('id').range(page * 25, page * 25 + 24); if (r.error) throw r.error; return { rows: r.data, count: r.count };
}
export async function fetchApprovalDetail(id) {
  const [state, history, activations, users] = await Promise.all([
    supabase.rpc('vendor_approval_checklist', { p_candidate_id: id }),
    supabase.from('vendor_decisions').select('id,decision_code,decision_no,decision,basis_reason,scope_limit,sample_ref_id,qc_ref_id,effective_from,reeval_date,follow_up_action,pic_id,proof_path,override_reason,missing_checks,basis_snapshot,decided_at,actor:user_profiles!vendor_decisions_decided_by_fkey(full_name)').eq('candidate_id', id).order('decision_no', { ascending: false }),
    supabase.from('vendor_activations').select('id,vendor_id,created_master,activated_at,actor:user_profiles!vendor_activations_activated_by_fkey(full_name)').eq('candidate_id', id),
    supabase.from('user_profiles').select('id,full_name').eq('account_status', 'ACTIVE').order('full_name').limit(1000)
  ]); for (const r of [state, history, activations, users]) if (r.error) throw r.error;
  return { state: state.data, history: history.data, activations: activations.data, users: users.data };
}
export async function recordVendorDecision(state, payload, requestId) {
  const r = await supabase.rpc('vendor_record_decision', { p_candidate_id: state.candidate_id, p_payload: payload, p_expected_updated_at: state.updated_at, p_basis_token: state.basis_token, p_request_id: requestId }); if (r.error) throw r.error; return r.data;
}
export async function activateVendor(state) {
  const r = await supabase.rpc('activate_vendor_candidate', { p_candidate_id: state.candidate_id, p_expected_decision_id: state.latest_decision.id }); if (r.error) throw r.error; return r.data;
}
export async function uploadDecisionProof(candidateId, file) {
  if (!file?.size || file.size > 5242880) throw new Error('Berkas maksimal 5 MB');
  let blob = file, extension;
  if (file.type === 'application/pdf') { if (!/\.pdf$/i.test(file.name) || new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()) !== '%PDF-') throw new Error('Ekstensi dan signature PDF harus sesuai'); extension = 'pdf'; }
  else { blob = await preparePhoto(file); extension = 'webp'; }
  const path = `${candidateId}/${crypto.randomUUID()}.${extension}`;
  const r = await supabase.storage.from('vendor-decision-files').upload(path, blob, { contentType: blob.type, upsert: false }); if (r.error) throw r.error; return path;
}
export async function signedDecisionProof(path, bucket = 'vendor-decision-files') {
  if (!['vendor-decision-files', 'vendor-photos'].includes(bucket)) throw new Error('Bucket bukti tidak valid');
  const r = await supabase.storage.from(bucket).createSignedUrl(path, 600); if (r.error) throw r.error; return r.data.signedUrl;
}
