// ============================================================
// PPM M4 PURE HELPERS - Decision ↔ Technical Specification Reconciliation
// Pure (no DB / import.meta.env) — aman diimport dari test Node (ESM).
// Import dari src/lib/ppm-m4-helpers.js untuk dipakai frontend.
//
// Domain separation (eksplisit):
//   - Structured proposed value (proposal.value_* typed) ≠ discussion note
//     (proposal.decision_note free text).
//   - Proposal status (PROPOSED/APPROVED/REJECTED/DEFERRED) ≠ spec
//     review_status (NOT_REVIEWED/CONFIRMED/...) ≠ annotation status
//     (OPEN/RESOLVED). Tiga domain terpisah.
//   - APPROVE proposal -> side-effect pada spec via resolveSpecification()
//     (spec jadi RESOLVED + source MEETING). Spec mutation = konsekuensi
//     APPLY, bukan properti proposal.
// ============================================================

// ============================================================
// CONSTANTS
// ============================================================
export const PROPOSAL_STATUS = {
  PROPOSED: 'PROPOSED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  DEFERRED: 'DEFERRED',
};

export const PROPOSAL_STATUS_LABELS = {
  [PROPOSAL_STATUS.PROPOSED]: 'Diusulkan',
  [PROPOSAL_STATUS.APPROVED]: 'Diterapkan',
  [PROPOSAL_STATUS.REJECTED]: 'Ditolak',
  [PROPOSAL_STATUS.DEFERRED]: 'Ditunda',
};

export const PROPOSAL_STATUS_COLORS = {
  [PROPOSAL_STATUS.PROPOSED]: 'yellow',
  [PROPOSAL_STATUS.APPROVED]: 'green',
  [PROPOSAL_STATUS.REJECTED]: 'red',
  [PROPOSAL_STATUS.DEFERRED]: 'gray',
};

// Status yang belum terselesaikan (perlu aksi reconciler).
export const UNRECONCILED_STATUSES = [PROPOSAL_STATUS.PROPOSED, PROPOSAL_STATUS.DEFERRED];
// Status terminal (selesai; re-apply / re-reject = no-op idempotent).
export const TERMINAL_STATUSES = [PROPOSAL_STATUS.APPROVED, PROPOSAL_STATUS.REJECTED];

// ============================================================
// VALUE TYPE (mirror M2 SPEC_VALUE_TYPES — pure, no import of helpers)
// ============================================================
export const VALUE_TYPE = {
  TEXT: 'TEXT',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN',
  SELECT: 'SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
};

// ============================================================
// INTERNAL: typed value reader (shared by proposal value / baseline /
// current spec). `prefix` = '' (value_*) or 'baseline_' (baseline_value_*).
// ============================================================
function readTyped(row, valueType, prefix) {
  switch (valueType) {
    case VALUE_TYPE.NUMBER:
      return { field: prefix + 'value_number', value: row[prefix + 'value_number'] };
    case VALUE_TYPE.BOOLEAN:
      return { field: prefix + 'value_boolean', value: row[prefix + 'value_boolean'] };
    case VALUE_TYPE.SELECT:
    case VALUE_TYPE.MULTI_SELECT:
      return { field: prefix + 'value_json', value: row[prefix + 'value_json'] ?? row[prefix + 'value_text'] };
    case VALUE_TYPE.TEXT:
    default:
      return { field: prefix + 'value_text', value: row[prefix + 'value_text'] };
  }
}

// Baca nilai PROPOSED proposal -> { field, value }
export function proposalValueInfo(proposal) {
  return readTyped(proposal || {}, (proposal || {}).value_type, '');
}

// Baca nilai BASELINE proposal (spec's value at propose time) -> { field, value }
export function proposalBaselineInfo(proposal) {
  return readTyped(proposal || {}, (proposal || {}).value_type, 'baseline_');
}

// ============================================================
// firstDecisionNote — centralize the "find first DECISION note" pattern
// (was inlined in FloatingPinCard / AnnotationSidebar). Sort DECISION first
// then by created_at, ambil yang pertama. Null-safe.
// ============================================================
export function firstDecisionNote(notes) {
  const list = (notes || []).filter((n) => n && n.note_type === 'DECISION');
  if (list.length === 0) return null;
  list.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  return list[0];
}

// ============================================================
// Format nilai PROPOSED untuk ditampilkan (mirror formatSpecValue logic,
// tapi baca proposal.value_* + value_type). Ringkas.
// ============================================================
export function formatProposalValue(proposal) {
  if (!proposal) return '-';
  const { value } = proposalValueInfo(proposal);
  if (value === null || value === undefined || value === '') return '-';
  if (proposal.value_type === VALUE_TYPE.BOOLEAN) return value === true ? 'Ya' : 'Tidak';
  const unit = proposal.proposed_unit ? ' ' + proposal.proposed_unit : '';
  if (proposal.value_type === VALUE_TYPE.SELECT || proposal.value_type === VALUE_TYPE.MULTI_SELECT) {
    const arr = Array.isArray(value) ? value : [value];
    return arr.filter(Boolean).join(', ');
  }
  return String(value) + unit;
}

// ============================================================
// STATE MACHINE
// ============================================================
// Status yang belum terselesaikan (perlu aksi reconciler).
export function isUnreconciled(status) {
  return UNRECONCILED_STATUSES.includes(status);
}

// Transisi legal antar status. APPROVED / REJECTED = terminal.
// PROPOSED/DEFERRED -> APPROVED (apply), REJECTED (reject).
// DEFERRED -> PROPOSED (re-open). Terminal -> self = idempotent OK.
export function canTransition(from, to) {
  if (from === to) return true; // idempotent self-transition (re-apply APPROVED, dsb.)
  if (TERMINAL_STATUSES.includes(from)) return false; // terminal: no transition out
  // from in {PROPOSED, DEFERRED}
  if (to === PROPOSAL_STATUS.APPROVED || to === PROPOSAL_STATUS.REJECTED || to === PROPOSAL_STATUS.DEFERRED) return true;
  if (from === PROPOSAL_STATUS.DEFERRED && to === PROPOSAL_STATUS.PROPOSED) return true; // re-open
  return false;
}

// Apakah statusProposal memungkinkan APPLY (mutate spec)?
export function isApplyable(status) {
  return status === PROPOSAL_STATUS.PROPOSED || status === PROPOSAL_STATUS.DEFERRED;
}

// ============================================================
// STALE / CONFLICT DETECTION
// Bandingkan baseline proposal (spec's value at propose time) vs spec's
// CURRENT value. Konvensi compare sama dengan resolveSpecification:
// String(prev ?? '') !== String(next ?? '').
//
// Returns { conflict: boolean, baseline, current, proposed }
// (raw values; UI yang format). conflict=true -> APPLY butuh force=true
// atau re-baseline.
// ============================================================
export function detectConflict(proposal, currentSpec) {
  const baseline = proposalBaselineInfo(proposal).value;
  // spec current = proposal.value_type snapshot read on spec's value_* columns
  const current = readTyped(currentSpec || {}, (currentSpec || {}).value_type, '').value;
  const proposed = proposalValueInfo(proposal).value;
  const conflict = String(baseline ?? '') !== String(current ?? '');
  return { conflict, baseline, current, proposed };
}

// ============================================================
// GENERIC SPEC HELPERS (net-new; juga reusable oleh M2 UI nanti)
// specValueChanged(spec): apakah current value_* berbeda dari original_value_*
// hasSpecOriginalValue(spec): apakah original_value_* sudah terisi (trigger)
// ============================================================
export function specValueChanged(spec) {
  if (!spec) return false;
  const cur = readTyped(spec, spec.value_type, '').value;
  const orig = readTyped(spec, spec.value_type, 'original_').value;
  return String(cur ?? '') !== String(orig ?? '');
}

export function hasSpecOriginalValue(spec) {
  if (!spec) return false;
  const orig = readTyped(spec, spec.value_type, 'original_').value;
  return orig !== null && orig !== undefined && orig !== '';
}
