// ============================================================
// PPM M4 Helper Functions - Decision ↔ Technical Specification Reconciliation
// Governs Spec Change Proposals (PROPOSED -> APPROVED/REJECTED/DEFERRED).
//
// APPLY proposal REUSES resolveSpecification() (M2.2 path) — tidak ada
// jalur spec-mutation baru. resolveSpecification menulis:
//   value_* + review_status=RESOLVED + (jika value berubah) source_type=MEETING
//   + reviewed_by/at. Original value dijaga trigger DB.
//
// Stale protection: baseline_value_* di-snapshot saat propose; APPLY
// membandingkan spec current vs baseline — block default, force=true untuk
// override (mencatat applied_despite_conflict + conflict_snapshot_json).
//
// Idempotency: APPLY/REJECT memakai WHERE id=? AND status IN (PROPOSED,DEFERRED).
// Re-APPLY setelah APPROVED = no-op.
// ============================================================
import { supabase } from './supabase';
import {
  resolveSpecification,
  buildValuePayload,
  specValueInfo,
  SPEC_VALUE_TYPES,
} from './ppm-m2-helpers';

// Re-export: single source of truth lives in ppm-m4-specs, tapi komponen
// tetap import dari helpers (API tidak berubah).
export {
  PROPOSAL_STATUS,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_COLORS,
  UNRECONCILED_STATUSES,
  TERMINAL_STATUSES,
  VALUE_TYPE,
  proposalValueInfo,
  proposalBaselineInfo,
  firstDecisionNote,
  formatProposalValue,
  isUnreconciled,
  canTransition,
  isApplyable,
  detectConflict,
  specValueChanged,
  hasSpecOriginalValue,
} from './ppm-m4-specs';

import {
  PROPOSAL_STATUS as STATUS,
  isApplyable,
  proposalValueInfo,
  detectConflict,
} from './ppm-m4-specs';

// ============================================================
// INTERNAL: fetch satu spec row (mirror private fetchSpecById di m2-helpers)
// ============================================================
async function fetchSpecRow(specId) {
  const { data, error } = await supabase
    .from('ppm_component_specifications')
    .select('*')
    .eq('id', specId)
    .single();
  if (error) throw error;
  return data;
}

// Bangun baseline_value_* payload dari spec current value (snapshot at propose).
// Memetakan spec value_* -> baseline_value_* berdasarkan value_type.
function baselinePayloadFromSpec(spec) {
  const baseline = {
    baseline_value_text: null,
    baseline_value_number: null,
    baseline_value_boolean: null,
    baseline_value_json: null,
  };
  if (!spec) return baseline;
  const cur = specValueInfo(spec); // { field: 'value_number', value: 5 }
  const baselineField = 'baseline_' + cur.field;
  baseline[baselineField] = cur.value;
  return baseline;
}

// ============================================================
// FETCH
// ============================================================

// Fetch semua proposal milik satu PO (untuk enrichment UI).
export async function fetchProposalsForPO(poId) {
  const { data, error } = await supabase
    .from('ppm_spec_change_proposals')
    .select('*')
    .eq('meeting_po_id', poId)
    .order('proposed_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ============================================================
// CREATE PROPOSAL
// Membentuk governance record satu keputusan -> satu spec.
// Baseline snapshot otomatis dari spec's current value_* (value_type driven).
// ============================================================
export async function createProposal({
  component_specification_id,
  item_component_id,
  po_item_id,
  meeting_po_id,
  annotation_id,
  annotation_note_id,
  value_type,
  value,
  proposed_unit,
  decision_note,
  proposed_by,
  created_by,
}) {
  if (!item_component_id) throw new Error('item_component_id wajib');
  if (!meeting_po_id) throw new Error('meeting_po_id wajib');

  // Resolve value_type + baseline dari target spec jika ada.
  let resolvedValueType = value_type;
  let baseline = {
    baseline_value_text: null,
    baseline_value_number: null,
    baseline_value_boolean: null,
    baseline_value_json: null,
  };
  if (component_specification_id) {
    const spec = await fetchSpecRow(component_specification_id);
    resolvedValueType = resolvedValueType || spec.value_type;
    baseline = baselinePayloadFromSpec(spec);
  }
  if (!resolvedValueType) {
    throw new Error('value_type wajib (atau berikan component_specification_id)');
  }

  // Proposed value_* (typed).
  const valuePayload = buildValuePayload(resolvedValueType, value);

  const payload = {
    component_specification_id: component_specification_id || null,
    item_component_id,
    po_item_id: po_item_id || null,
    meeting_po_id,
    annotation_id: annotation_id || null,
    annotation_note_id: annotation_note_id || null,
    value_type: resolvedValueType,
    ...valuePayload,
    proposed_unit: proposed_unit || null,
    decision_note: decision_note || null,
    ...baseline,
    status: STATUS.PROPOSED,
    proposed_by: proposed_by || null,
    created_by: created_by || proposed_by || null,
  };

  const { data, error } = await supabase
    .from('ppm_spec_change_proposals')
    .insert([payload])
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// APPLY PROPOSAL (-> APPROVED) — reuse resolveSpecification.
//
// Alur:
//   1. Fetch proposal. Jika !isApplyable (sudah APPROVED/REJECTED) -> idempotent no-op.
//   2. Fetch target spec. Jika null (spec dihapus) -> throw (tidak bisa apply).
//   3. detectConflict(proposal, spec): baseline vs current.
//      - conflict && !force -> catat conflict_snapshot_json (audit), return
//        { conflict:true } TANPA mutate spec.
//      - conflict && force -> lanjut; tandai applied_despite_conflict.
//   4. resolveSpecification(specId, {value, unit, notes, reviewerId}) ->
//      spec RESOLVED + (valueChanged) source MEETING. Original dijaga trigger.
//   5. UPDATE proposal SET status=APPROVED, decided_by/at, applied_despite_conflict,
//      conflict_snapshot_json WHERE id=? AND status IN (PROPOSED,DEFERRED).
//      0 rows -> race (sudah diputus konkuren) -> idempotent.
// ============================================================
export async function applyProposal(proposalId, { force = false, actorId } = {}) {
  // 1. Fetch proposal
  const { data: proposal, error: pErr } = await supabase
    .from('ppm_spec_change_proposals')
    .select('*')
    .eq('id', proposalId)
    .single();
  if (pErr) throw pErr;
  if (!proposal) throw new Error('Proposal tidak ditemukan');

  if (!isApplyable(proposal.status)) {
    // Idempotent: sudah terminal.
    return { idempotent: true, status: proposal.status, proposal };
  }

  // 2. Target spec wajib ada untuk APPLY.
  if (!proposal.component_specification_id) {
    throw new Error('Proposal tidak punya target spec (tidak bisa diterapkan)');
  }
  const spec = await fetchSpecRow(proposal.component_specification_id);

  // 3. Conflict detection (baseline vs current).
  const conflictInfo = detectConflict(proposal, spec);
  let applied_despite_conflict = false;
  let conflict_snapshot_json = proposal.conflict_snapshot_json || null;

  if (conflictInfo.conflict) {
    conflict_snapshot_json = {
      baseline: conflictInfo.baseline,
      currentAtConflict: conflictInfo.current,
      proposed: conflictInfo.proposed,
    };
    if (!force) {
      // Catat audit tapi JANGAN mutate spec. UI menampilkan kartu konflik.
      await supabase
        .from('ppm_spec_change_proposals')
        .update({ conflict_snapshot_json })
        .eq('id', proposalId);
      return {
        conflict: true,
        baseline: conflictInfo.baseline,
        current: conflictInfo.current,
        proposed: conflictInfo.proposed,
        proposal,
        spec,
      };
    }
    applied_despite_conflict = true;
  }

  // 4. Mutate spec via resolveSpecification (REUSE — no new path).
  const proposedValue = proposalValueInfo(proposal).value;
  const updatedSpec = await resolveSpecification(proposal.component_specification_id, {
    value: proposedValue,
    unit: proposal.proposed_unit,
    notes: proposal.decision_note,
    reviewerId: actorId,
  });

  // 5. UPDATE proposal -> APPROVED (WHERE guard = idempotency).
  const { data: updated, error: uErr } = await supabase
    .from('ppm_spec_change_proposals')
    .update({
      status: STATUS.APPROVED,
      decided_by: actorId || null,
      decided_at: new Date().toISOString(),
      applied_despite_conflict,
      conflict_snapshot_json,
    })
    .eq('id', proposalId)
    .in('status', [STATUS.PROPOSED, STATUS.DEFERRED])
    .select('*')
    .single();

  if (uErr) {
    // 0 rows (PGRST116 / no match) -> race: sudah diputus konkuren.
    if (uErr.code === 'PGRST116' || (uErr.details && /0 rows/i.test(String(uErr.details)))) {
      const refetch = await fetchProposalById(proposalId);
      return { idempotent: true, status: refetch.status, proposal: refetch, spec: updatedSpec };
    }
    throw uErr;
  }

  return { applied: true, proposal: updated, spec: updatedSpec };
}

async function fetchProposalById(id) {
  const { data, error } = await supabase
    .from('ppm_spec_change_proposals')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// REJECT PROPOSAL (-> REJECTED) — spec TIDAK disentuh.
// rejection_reason optional. Re-reject = idempotent no-op.
// ============================================================
export async function rejectProposal(proposalId, { reason, actorId } = {}) {
  const { data: updated, error } = await supabase
    .from('ppm_spec_change_proposals')
    .update({
      status: STATUS.REJECTED,
      decided_by: actorId || null,
      decided_at: new Date().toISOString(),
      rejection_reason: reason || null,
    })
    .eq('id', proposalId)
    .in('status', [STATUS.PROPOSED, STATUS.DEFERRED])
    .select('*')
    .single();
  if (error) {
    if (error.code === 'PGRST116' || (error.details && /0 rows/i.test(String(error.details)))) {
      const refetch = await fetchProposalById(proposalId);
      return { idempotent: true, status: refetch.status, proposal: refetch };
    }
    throw error;
  }
  return { rejected: true, proposal: updated };
}

// ============================================================
// DEFER PROPOSAL (PROPOSED -> DEFERRED)
// ============================================================
export async function deferProposal(proposalId, { actorId } = {}) {
  const { data: updated, error } = await supabase
    .from('ppm_spec_change_proposals')
    .update({
      status: STATUS.DEFERRED,
      decided_by: actorId || null,
      decided_at: new Date().toISOString(),
    })
    .eq('id', proposalId)
    .eq('status', STATUS.PROPOSED)
    .select('*')
    .single();
  if (error) {
    if (error.code === 'PGRST116' || (error.details && /0 rows/i.test(String(error.details)))) {
      const refetch = await fetchProposalById(proposalId);
      return { idempotent: true, status: refetch.status, proposal: refetch };
    }
    throw error;
  }
  return { deferred: true, proposal: updated };
}

// ============================================================
// REBASE PROPOSAL (Review Ulang) — update baseline ke spec current value,
// stay PROPOSED (reset conflict). Hanya valid jika belum terminal.
// Dipakai setelah konflik terdeteksi & user ingin meninjau ulang dari nilai
// terkini.
// ============================================================
export async function rebaseProposal(proposalId) {
  const proposal = await fetchProposalById(proposalId);
  if (!isApplyable(proposal.status)) {
    return { idempotent: true, status: proposal.status, proposal };
  }
  if (!proposal.component_specification_id) {
    throw new Error('Proposal tidak punya target spec (tidak bisa re-base)');
  }
  const spec = await fetchSpecRow(proposal.component_specification_id);
  const baseline = baselinePayloadFromSpec(spec);

  const { data: updated, error } = await supabase
    .from('ppm_spec_change_proposals')
    .update({
      ...baseline,
      status: STATUS.PROPOSED,
      conflict_snapshot_json: null,
    })
    .eq('id', proposalId)
    .in('status', [STATUS.PROPOSED, STATUS.DEFERRED])
    .select('*')
    .single();
  if (error) {
    if (error.code === 'PGRST116' || (error.details && /0 rows/i.test(String(error.details)))) {
      const refetch = await fetchProposalById(proposalId);
      return { idempotent: true, status: refetch.status, proposal: refetch };
    }
    throw error;
  }
  return { rebased: true, proposal: updated };
}
