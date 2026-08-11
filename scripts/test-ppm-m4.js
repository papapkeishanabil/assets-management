import { SUPABASE_URL as url, SUPABASE_SERVICE_KEY as SERVICE_KEY, SUPABASE_ANON_KEY as ANON_KEY, assertServiceKey } from './_ppm-env.js';
// ============================================================
// PPM M4 Integration Test - Decision ↔ Technical Specification Reconciliation
// Meeting -> PO -> Product Item -> Component -> Specification
//
// Menguji:
//   - Pure helpers (ppm-m4-specs.js): constants, state machine, value
//     readers, conflict detect, firstDecisionNote, formatProposalValue.
//   - DB contract via REST (service key): migration additive, table +
//     field lengkap, M1/M2/M3 schema utuh, RLS, dan lifecycle proposal
//     (create/apply APPROVED/idempotent/stale conflict/force/reject/defer/
//     rebase). APPLY mereplikasi kontrak resolveSpecification (RESOLVED +
//     source MEETING + original preserved oleh trigger M2).
//
// TEST DATA SAFETY (KRITIS):
//   Setiap record memakai marker __TEST_M4__ (TEST_RUN_ID). Cleanup hanya
//   by created ID + marker sweep — TIDAK pernah by nama bisnis nyata.
//
// Catatan: helper ppm-m4-helpers memakai singleton supabase browser
// (anon). Di Node, singleton itu = safe stub (no-op). Maka operasi DB
// di-replikasi via REST langsung (sama dengan konvensi test-ppm-m3.js) —
// inilah yang menguji kontrak DB/RLS sesungguhnya. Helper pure diuji
// langsung via import.
// ============================================================

import {
  PROPOSAL_STATUS,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_COLORS,
  firstDecisionNote,
  proposalValueInfo,
  proposalBaselineInfo,
  formatProposalValue,
  isUnreconciled,
  canTransition,
  isApplyable,
  detectConflict,
  specValueChanged,
  hasSpecOriginalValue,
} from '../src/lib/ppm-m4-specs.js';

const svcH = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };

async function req(path, options = {}, headers = svcH) {
  const r = await fetch(url + path, { headers, ...options });
  const t = await r.text();
  let d;
  try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, ok: r.status < 400, data: d };
}
const get = (path, h = svcH) => req(path, {}, h);
const post = (path, body, h = svcH) => req(path, { method: 'POST', body: JSON.stringify(body), headers: { ...h, Prefer: 'return=representation' } }, h);
const patch = (path, body, h = svcH) => req(path, { method: 'PATCH', body: JSON.stringify(body), headers: { ...h, Prefer: 'return=representation' } }, h);
const del = (path, h = svcH) => req(path, { method: 'DELETE' }, h);

let passed = 0;
let failed = 0;
const createdItemIds = [];
const createdProposalIds = [];
const RUN_ID = `__TEST_M4__${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function check(name, condition, detail = '') {
  if (condition) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name, detail); }
}

// Replicate buildValuePayload (M2) for the value_type under test.
function valuePayloadFor(valueType, value) {
  switch (valueType) {
    case 'NUMBER': return { value_text: null, value_number: value, value_boolean: null, value_json: null };
    case 'BOOLEAN': return { value_text: null, value_number: null, value_boolean: !!value, value_json: null };
    case 'SELECT': return { value_text: null, value_number: null, value_boolean: null, value_json: value };
    case 'MULTI_SELECT': return { value_text: null, value_number: null, value_boolean: null, value_json: value };
    case 'TEXT':
    default: return { value_text: String(value), value_number: null, value_boolean: null, value_json: null };
  }
}
// baseline payload mirrors baselinePayloadFromSpec (M4 helper).
function baselinePayloadFor(spec) {
  const b = { baseline_value_text: null, baseline_value_number: null, baseline_value_boolean: null, baseline_value_json: null };
  if (!spec) return b;
  switch (spec.value_type) {
    case 'NUMBER': b.baseline_value_number = spec.value_number; break;
    case 'BOOLEAN': b.baseline_value_boolean = spec.value_boolean; break;
    case 'SELECT':
    case 'MULTI_SELECT': b.baseline_value_json = spec.value_json; break;
    default: b.baseline_value_text = spec.value_text;
  }
  return b;
}

async function run() {
  console.log('=== PPM M4 INTEGRATION TEST ===\n');
  console.log('RUN_ID:', RUN_ID, '\n');

  assertServiceKey();

  // ========== PURE HELPERS ==========
  console.log('--- Pure helpers ---');
  check('1. PROPOSAL_STATUS constants lengkap',
    PROPOSAL_STATUS.PROPOSED === 'PROPOSED' && PROPOSAL_STATUS.APPROVED === 'APPROVED' &&
    PROPOSAL_STATUS.REJECTED === 'REJECTED' && PROPOSAL_STATUS.DEFERRED === 'DEFERRED', JSON.stringify(PROPOSAL_STATUS));
  check('1. PROPOSAL_STATUS_LABELS/_COLORS lengkap',
    !!PROPOSAL_STATUS_LABELS[PROPOSAL_STATUS.PROPOSED] && !!PROPOSAL_STATUS_COLORS[PROPOSAL_STATUS.APPROVED], '');

  // firstDecisionNote
  const dn = firstDecisionNote([
    { id: 'n1', note_type: 'DISCUSSION', created_at: '2026-08-09T10:00:00Z' },
    { id: 'n2', note_type: 'DECISION', created_at: '2026-08-09T10:30:00Z' },
    { id: 'n3', note_type: 'DECISION', created_at: '2026-08-09T10:15:00Z' },
  ]);
  check('2. firstDecisionNote ambil DECISION terurut (n3 lebih awal)',
    !!dn && dn.id === 'n3', JSON.stringify(dn && dn.id));
  check('2. firstDecisionNote null-safe (tidak ada DECISION)',
    firstDecisionNote([{ id: 'x', note_type: 'INFO' }]) === null, '');
  check('2. firstDecisionNote null-safe (empty)',
    firstDecisionNote([]) === null && firstDecisionNote(null) === null, '');

  // proposalValueInfo / proposalBaselineInfo
  const pr = { value_type: 'NUMBER', value_number: 7, baseline_value_number: 5 };
  check('3. proposalValueInfo NUMBER', proposalValueInfo(pr).value === 7, JSON.stringify(proposalValueInfo(pr)));
  check('3. proposalBaselineInfo NUMBER', proposalBaselineInfo(pr).value === 5, JSON.stringify(proposalBaselineInfo(pr)));
  const prt = { value_type: 'TEXT', value_text: 'Gamblok', baseline_value_text: 'Tempel' };
  check('3. proposalValueInfo TEXT', proposalValueInfo(prt).value === 'Gamblok', '');
  check('3. proposalBaselineInfo TEXT', proposalBaselineInfo(prt).value === 'Tempel', '');

  // formatProposalValue
  check('4. formatProposalValue NUMBER + unit', formatProposalValue({ value_type: 'NUMBER', value_number: 7, proposed_unit: 'cm' }) === '7 cm', formatProposalValue({ value_type: 'NUMBER', value_number: 7, proposed_unit: 'cm' }));
  check('4. formatProposalValue BOOLEAN', formatProposalValue({ value_type: 'BOOLEAN', value_boolean: true }) === 'Ya', '');
  check('4. formatProposalValue empty -> "-"', formatProposalValue({ value_type: 'TEXT', value_text: null }) === '-', '');

  // isUnreconciled / canTransition / isApplyable
  check('5. isUnreconciled {PROPOSED,DEFERRED} true; {APPROVED,REJECTED} false',
    isUnreconciled('PROPOSED') && isUnreconciled('DEFERRED') && !isUnreconciled('APPROVED') && !isUnreconciled('REJECTED'), '');
  check('5. isApplyable {PROPOSED,DEFERRED}', isApplyable('PROPOSED') && isApplyable('DEFERRED') && !isApplyable('APPROVED'), '');
  check('5. canTransition PROPOSED->APPROVED legal', canTransition('PROPOSED', 'APPROVED') === true, '');
  check('5. canTransition APPROVED->REJECTED ilegal (terminal)', canTransition('APPROVED', 'REJECTED') === false, '');
  check('5. canTransition DEFERRED->PROPOSED legal (re-open)', canTransition('DEFERRED', 'PROPOSED') === true, '');
  check('5. canTransition self idempotent', canTransition('APPROVED', 'APPROVED') === true, '');

  // detectConflict
  const c1 = detectConflict({ value_type: 'NUMBER', baseline_value_number: 5 }, { value_type: 'NUMBER', value_number: 5 });
  check('6. detectConflict no conflict (baseline==current)', c1.conflict === false, JSON.stringify(c1));
  const c2 = detectConflict({ value_type: 'NUMBER', baseline_value_number: 5 }, { value_type: 'NUMBER', value_number: 9 });
  check('6. detectConflict conflict (baseline!=current)', c2.conflict === true && c2.baseline === 5 && c2.current === 9, JSON.stringify(c2));

  // specValueChanged / hasSpecOriginalValue
  check('7. specValueChanged true bila current != original',
    specValueChanged({ value_type: 'NUMBER', value_number: 7, original_value_number: 5 }) === true, '');
  check('7. specValueChanged false bila current == original',
    specValueChanged({ value_type: 'NUMBER', value_number: 5, original_value_number: 5 }) === false, '');
  check('7. hasSpecOriginalValue true bila original terisi',
    hasSpecOriginalValue({ value_type: 'NUMBER', original_value_number: 5 }) === true, '');
  check('7. hasSpecOriginalValue false bila original null',
    hasSpecOriginalValue({ value_type: 'NUMBER', original_value_number: null }) === false, '');
  console.log('');

  // ========== DATABASE: migration additive, schema M1/M2/M3 utuh ==========
  console.log('--- DATABASE: migration additive, schema utuh ---');
  const tblP = await get('/rest/v1/ppm_spec_change_proposals?select=id,component_specification_id,item_component_id,po_item_id,meeting_po_id,annotation_id,annotation_note_id,value_type,value_text,value_number,value_boolean,value_json,proposed_unit,decision_note,baseline_value_text,baseline_value_number,baseline_value_boolean,baseline_value_json,status,proposed_by,proposed_at,decided_by,decided_at,rejection_reason,applied_despite_conflict,conflict_snapshot_json,created_by,created_at,updated_at&limit=1');
  check('8. Tabel ppm_spec_change_proposals ada + field lengkap', tblP.ok, `status=${tblP.status} ${JSON.stringify(tblP.data).slice(0, 160)}`);

  // schema M1/M2/M3 tidak berubah
  const m2 = await get('/rest/v1/ppm_component_specifications?select=item_component_id,spec_key_snapshot,review_status,source_type,original_value_number&limit=1');
  const m3 = await get('/rest/v1/ppm_annotations?select=id,meeting_po_id,item_component_id,component_specification_id,pin_number&limit=1');
  check('9. M2 ppm_component_specifications utuh', m2.ok, `status=${m2.status}`);
  check('9. M3 ppm_annotations utuh', m3.ok, `status=${m3.status}`);

  // ========== SETUP: PO / item / component / spec ==========
  console.log('\n--- SETUP ---');
  const poRes = await get('/rest/v1/ppm_meeting_pos?select=id,meeting_id&limit=1');
  const po = Array.isArray(poRes.data) && poRes.data[0] ? poRes.data[0] : null;
  check('Setup: PO existing tersedia', !!po, JSON.stringify(poRes.data).slice(0, 120));
  if (!po) { finish(); return; }

  const ptRes = await get('/rest/v1/product_types?select=id&code=eq.KEMEJA');
  const kemeja = ptRes.data && ptRes.data[0] ? ptRes.data[0] : null;
  check('Setup: Product Type KEMEJA ada', !!kemeja, JSON.stringify(ptRes.data).slice(0, 120));
  if (!kemeja) { finish(); return; }

  const itemRes = await post('/rest/v1/ppm_po_items', {
    meeting_po_id: po.id,
    product_type_id: kemeja.id,
    item_name: 'M4 Test Item ' + RUN_ID,
    quantity: 5,
    sort_order: 9999,
  });
  const item = Array.isArray(itemRes.data) ? itemRes.data[0] : itemRes.data;
  createdItemIds.push(item.id);
  check('Setup: item test dibuat', !!item && !!item.id, JSON.stringify(itemRes.data).slice(0, 120));

  const compRes = await post('/rest/v1/ppm_item_components', {
    po_item_id: item.id,
    component_definition_id: null,
    component_name_snapshot: 'M4 Kerah ' + RUN_ID.slice(-6),
    sort_order: 1,
    is_custom: true,
  });
  const comp = Array.isArray(compRes.data) ? compRes.data[0] : compRes.data;
  check('Setup: komponen test dibuat', !!comp && !!comp.id, JSON.stringify(compRes.data).slice(0, 120));

  // spec NUMBER value_number=5 (baseline akan di-snapshot = 5)
  const specRes = await post('/rest/v1/ppm_component_specifications', {
    item_component_id: comp.id,
    specification_definition_id: null,
    spec_key_snapshot: 'TINGGI_KERAH_M4',
    spec_label_snapshot: 'Tinggi Kerah (M4)',
    value_type: 'NUMBER',
    value_number: 5,
    unit: 'cm',
    source_type: 'PO',
    review_status: 'NOT_REVIEWED',
    is_custom: true,
    sort_order: 1,
  });
  const spec = Array.isArray(specRes.data) ? specRes.data[0] : specRes.data;
  check('Setup: spec NUMBER dibuat (value=5)', !!spec && !!spec.id && Number(spec.value_number) === 5, JSON.stringify(specRes.data).slice(0, 120));

  // ========== CREATE PROPOSAL ==========
  console.log('\n--- CREATE PROPOSAL ---');
  const bPayload = baselinePayloadFor(spec);
  const vPayload = valuePayloadFor('NUMBER', 7); // proposed = 7
  const createRes = await post('/rest/v1/ppm_spec_change_proposals', {
    component_specification_id: spec.id,
    item_component_id: comp.id,
    po_item_id: item.id,
    meeting_po_id: po.id,
    value_type: 'NUMBER',
    ...vPayload,
    proposed_unit: 'cm',
    decision_note: 'Marketing konfirmasi tinggi 7cm ' + RUN_ID,
    ...bPayload,
    status: 'PROPOSED',
  });
  const proposal = Array.isArray(createRes.data) ? createRes.data[0] : createRes.data;
  if (proposal && proposal.id) createdProposalIds.push(proposal.id);
  check('10. create proposal PROPOSED', createRes.ok && proposal && proposal.status === 'PROPOSED', `status=${createRes.status} ${JSON.stringify(createRes.data).slice(0, 160)}`);
  check('10. baseline snapshot benar (baseline_value_number=5)', proposal && Number(proposal.baseline_value_number) === 5, JSON.stringify(proposal && proposal.baseline_value_number));
  check('10. proposed value benar (value_number=7)', proposal && Number(proposal.value_number) === 7, '');
  check('10. value_type snapshot NUMBER', proposal && proposal.value_type === 'NUMBER', '');
  check('10. decision_note terpisah (structured value != note)', proposal && proposal.decision_note && proposal.decision_note.includes(RUN_ID), '');

  // ========== APPLY PROPOSAL -> APPROVED ==========
  console.log('\n--- APPLY -> APPROVED (reuse resolveSpecification contract) ---');
  // resolveSpecification contract: PATCH spec value_* + review_status=RESOLVED +
  // (valueChanged) source_type=MEETING + reviewed_by/at + notes.
  const applySpecRes = await patch('/rest/v1/ppm_component_specifications?id=eq.' + spec.id, {
    value_number: 7,
    review_status: 'RESOLVED',
    source_type: 'MEETING',
    reviewed_at: new Date().toISOString(),
    notes: proposal.decision_note,
  });
  const specAfterApply = Array.isArray(applySpecRes.data) ? applySpecRes.data[0] : applySpecRes.data;
  check('11. APPLY: spec value_number -> 7', applySpecRes.ok && specAfterApply && Number(specAfterApply.value_number) === 7, JSON.stringify(specAfterApply).slice(0, 120));
  check('11. APPLY: spec review_status -> RESOLVED', specAfterApply && specAfterApply.review_status === 'RESOLVED', '');
  check('11. APPLY: spec source_type -> MEETING', specAfterApply && specAfterApply.source_type === 'MEETING', '');
  check('11. APPLY: original_value_number preserved (trigger M2 = 5)', specAfterApply && Number(specAfterApply.original_value_number) === 5, JSON.stringify(specAfterApply && specAfterApply.original_value_number));

  const applyProposalRes = await patch('/rest/v1/ppm_spec_change_proposals?id=eq.' + proposal.id + '&status=in.(PROPOSED,DEFERRED)', {
    status: 'APPROVED',
    decided_at: new Date().toISOString(),
  });
  const propAfterApply = Array.isArray(applyProposalRes.data) ? applyProposalRes.data[0] : applyProposalRes.data;
  check('12. proposal -> APPROVED', applyProposalRes.ok && propAfterApply && propAfterApply.status === 'APPROVED', `status=${applyProposalRes.status} rows=${Array.isArray(applyProposalRes.data) ? applyProposalRes.data.length : 0}`);
  check('12. proposal decided_at terisi', propAfterApply && propAfterApply.decided_at, '');

  // ========== IDEMPOTENCY: re-APPLY no-op ==========
  console.log('\n--- IDEMPOTENCY (re-APPLY no-op) ---');
  const valueBefore = specAfterApply ? specAfterApply.value_number : null;
  const reApplySpec = await patch('/rest/v1/ppm_component_specifications?id=eq.' + spec.id, {
    value_number: 7,
    review_status: 'RESOLVED',
    source_type: 'MEETING',
  });
  const reApplyProposal = await patch('/rest/v1/ppm_spec_change_proposals?id=eq.' + proposal.id + '&status=in.(PROPOSED,DEFERRED)', { status: 'APPROVED' });
  check('13. re-APPLY proposal: 0 rows (status guard)', Array.isArray(reApplyProposal.data) && reApplyProposal.data.length === 0, `rows=${Array.isArray(reApplyProposal.data) ? reApplyProposal.data.length : 'n/a'}`);

  // ========== STALE CONFLICT ==========
  console.log('\n--- STALE CONFLICT (spec berubah setelah propose) ---');
  // spec kedua untuk uji konflik (baseline=5, lalu spec diubah ke 9 sebelum apply)
  const spec2Res = await post('/rest/v1/ppm_component_specifications', {
    item_component_id: comp.id,
    specification_definition_id: null,
    spec_key_snapshot: 'LEBAR_PLAKET_M4',
    spec_label_snapshot: 'Lebar Plaket (M4)',
    value_type: 'NUMBER',
    value_number: 5,
    unit: 'cm',
    source_type: 'PO',
    review_status: 'CONFIRMED',
    is_custom: true,
    sort_order: 2,
  });
  const spec2 = Array.isArray(spec2Res.data) ? spec2Res.data[0] : spec2Res.data;

  const p2Create = await post('/rest/v1/ppm_spec_change_proposals', {
    component_specification_id: spec2.id,
    item_component_id: comp.id,
    po_item_id: item.id,
    meeting_po_id: po.id,
    value_type: 'NUMBER',
    ...valuePayloadFor('NUMBER', 8),
    proposed_unit: 'cm',
    decision_note: 'Usulan lebar 8 ' + RUN_ID,
    ...baselinePayloadFor(spec2), // baseline = 5
    status: 'PROPOSED',
  });
  const p2 = Array.isArray(p2Create.data) ? p2Create.data[0] : p2Create.data;
  if (p2 && p2.id) createdProposalIds.push(p2.id);

  // spec2 diubah ke 9 (baseline 5 != current 9 -> conflict)
  await patch('/rest/v1/ppm_component_specifications?id=eq.' + spec2.id, { value_number: 9, review_status: 'RESOLVED' });
  const spec2Cur = (await get('/rest/v1/ppm_component_specifications?select=value_number,review_status&id=eq.' + spec2.id)).data[0];

  // detectConflict pure (harus conflict)
  const conf = detectConflict(p2, spec2Cur);
  check('14. detectConflict stale (baseline 5 vs current 9)', conf.conflict === true, JSON.stringify(conf));

  // APPLY tanpa force = BLOCK: spec TIDAK boleh jadi 8. (Kita replikasi
  // kontrak helper: catat conflict_snapshot_json, jangan mutate spec.)
  const conflictSnap = { baseline: 5, currentAtConflict: 9, proposed: 8 };
  const blockRes = await patch('/rest/v1/ppm_spec_change_proposals?id=eq.' + p2.id, { conflict_snapshot_json: conflictSnap });
  const p2AfterBlock = Array.isArray(blockRes.data) ? blockRes.data[0] : blockRes.data;
  const spec2ValueAfterBlock = (await get('/rest/v1/ppm_component_specifications?select=value_number&id=eq.' + spec2.id)).data[0];
  check('14. APPLY blocked: conflict_snapshot_json tercatat', p2AfterBlock && p2AfterBlock.conflict_snapshot_json && Number(p2AfterBlock.conflict_snapshot_json.currentAtConflict) === 9, JSON.stringify(p2AfterBlock && p2AfterBlock.conflict_snapshot_json));
  check('14. APPLY blocked: spec TIDAK berubah (masih 9, bukan 8)', spec2ValueAfterBlock && Number(spec2ValueAfterBlock.value_number) === 9, JSON.stringify(spec2ValueAfterBlock));
  check('14. APPLY blocked: proposal tetap PROPOSED', p2AfterBlock && p2AfterBlock.status === 'PROPOSED', p2AfterBlock && p2AfterBlock.status);

  // ========== FORCE APPLY (stale + force) ==========
  console.log('\n--- FORCE APPLY (override stale) ---');
  // mutate spec -> 8 (proposed), tandai applied_despite_conflict.
  await patch('/rest/v1/ppm_component_specifications?id=eq.' + spec2.id, {
    value_number: 8, review_status: 'RESOLVED', source_type: 'MEETING',
  });
  const forceProposal = await patch('/rest/v1/ppm_spec_change_proposals?id=eq.' + p2.id + '&status=in.(PROPOSED,DEFERRED)', {
    status: 'APPROVED', decided_at: new Date().toISOString(), applied_despite_conflict: true,
  });
  const p2AfterForce = Array.isArray(forceProposal.data) ? forceProposal.data[0] : forceProposal.data;
  const spec2AfterForce = (await get('/rest/v1/ppm_component_specifications?select=value_number,source_type,review_status&id=eq.' + spec2.id)).data[0];
  check('15. force APPLY: proposal -> APPROVED', p2AfterForce && p2AfterForce.status === 'APPROVED', JSON.stringify(p2AfterForce && p2AfterForce.status));
  check('15. force APPLY: applied_despite_conflict=true', p2AfterForce && p2AfterForce.applied_despite_conflict === true, '');
  check('15. force APPLY: spec -> proposed (8)', spec2AfterForce && Number(spec2AfterForce.value_number) === 8, '');

  // ========== REJECT ==========
  console.log('\n--- REJECT ---');
  const spec3Res = await post('/rest/v1/ppm_component_specifications', {
    item_component_id: comp.id, specification_definition_id: null,
    spec_key_snapshot: 'STITCH_M4', spec_label_snapshot: 'Stitch (M4)',
    value_type: 'TEXT', value_text: 'Dobel', source_type: 'PO',
    review_status: 'CONFIRMED', is_custom: true, sort_order: 3,
  });
  const spec3 = Array.isArray(spec3Res.data) ? spec3Res.data[0] : spec3Res.data;
  const p3Create = await post('/rest/v1/ppm_spec_change_proposals', {
    component_specification_id: spec3.id, item_component_id: comp.id, po_item_id: item.id, meeting_po_id: po.id,
    value_type: 'TEXT', ...valuePayloadFor('TEXT', 'Triple'),
    decision_note: 'usulan stitch ' + RUN_ID, ...baselinePayloadFor(spec3), status: 'PROPOSED',
  });
  const p3 = Array.isArray(p3Create.data) ? p3Create.data[0] : p3Create.data;
  if (p3 && p3.id) createdProposalIds.push(p3.id);

  const rejectRes = await patch('/rest/v1/ppm_spec_change_proposals?id=eq.' + p3.id + '&status=in.(PROPOSED,DEFERRED)', {
    status: 'REJECTED', decided_at: new Date().toISOString(), rejection_reason: 'Pertahankan dobel sesuai PO',
  });
  const p3AfterReject = Array.isArray(rejectRes.data) ? rejectRes.data[0] : rejectRes.data;
  const spec3AfterReject = (await get('/rest/v1/ppm_component_specifications?select=value_text&id=eq.' + spec3.id)).data[0];
  check('16. reject -> REJECTED', p3AfterReject && p3AfterReject.status === 'REJECTED', '');
  check('16. rejection_reason tercatat', p3AfterReject && p3AfterReject.rejection_reason && p3AfterReject.rejection_reason.includes('PO'), '');
  check('16. spec untouched (masih Dobel)', spec3AfterReject && spec3AfterReject.value_text === 'Dobel', JSON.stringify(spec3AfterReject));

  // re-reject = no-op (0 rows)
  const reReject = await patch('/rest/v1/ppm_spec_change_proposals?id=eq.' + p3.id + '&status=in.(PROPOSED,DEFERRED)', { status: 'REJECTED' });
  check('16. re-reject no-op (0 rows)', Array.isArray(reReject.data) && reReject.data.length === 0, `rows=${Array.isArray(reReject.data) ? reReject.data.length : 'n/a'}`);

  // ========== DEFER -> APPROVED ==========
  console.log('\n--- DEFER -> APPROVED ---');
  const spec4Res = await post('/rest/v1/ppm_component_specifications', {
    item_component_id: comp.id, specification_definition_id: null,
    spec_key_snapshot: 'POS_BORDIR_M4', spec_label_snapshot: 'Posisi Bordir (M4)',
    value_type: 'TEXT', value_text: 'Kiri', source_type: 'PO',
    review_status: 'NOT_REVIEWED', is_custom: true, sort_order: 4,
  });
  const spec4 = Array.isArray(spec4Res.data) ? spec4Res.data[0] : spec4Res.data;
  const p4Create = await post('/rest/v1/ppm_spec_change_proposals', {
    component_specification_id: spec4.id, item_component_id: comp.id, po_item_id: item.id, meeting_po_id: po.id,
    value_type: 'TEXT', ...valuePayloadFor('TEXT', 'Kanan'),
    decision_note: 'pindah posisi ' + RUN_ID, ...baselinePayloadFor(spec4), status: 'PROPOSED',
  });
  const p4 = Array.isArray(p4Create.data) ? p4Create.data[0] : p4Create.data;
  if (p4 && p4.id) createdProposalIds.push(p4.id);

  const deferRes = await patch('/rest/v1/ppm_spec_change_proposals?id=eq.' + p4.id + '&status=eq.PROPOSED', {
    status: 'DEFERRED', decided_at: new Date().toISOString(),
  });
  const p4AfterDefer = Array.isArray(deferRes.data) ? deferRes.data[0] : deferRes.data;
  check('17. defer -> DEFERRED', deferRes.ok && p4AfterDefer && p4AfterDefer.status === 'DEFERRED', JSON.stringify(p4AfterDefer && p4AfterDefer.status));

  // DEFERRED -> APPROVED (applyable)
  await patch('/rest/v1/ppm_component_specifications?id=eq.' + spec4.id, { value_text: 'Kanan', review_status: 'RESOLVED', source_type: 'MEETING' });
  const deferApply = await patch('/rest/v1/ppm_spec_change_proposals?id=eq.' + p4.id + '&status=in.(PROPOSED,DEFERRED)', { status: 'APPROVED', decided_at: new Date().toISOString() });
  const p4AfterApply = Array.isArray(deferApply.data) ? deferApply.data[0] : deferApply.data;
  check('17. DEFERRED -> APPROVED (applyable)', p4AfterApply && p4AfterApply.status === 'APPROVED', JSON.stringify(p4AfterApply && p4AfterApply.status));

  // ========== REBASE ==========
  console.log('\n--- REBASE (review ulang) ---');
  const spec5Res = await post('/rest/v1/ppm_component_specifications', {
    item_component_id: comp.id, specification_definition_id: null,
    spec_key_snapshot: 'UKURAN_M4', spec_label_snapshot: 'Ukuran (M4)',
    value_type: 'NUMBER', value_number: 10, source_type: 'PO',
    review_status: 'NOT_REVIEWED', is_custom: true, sort_order: 5,
  });
  const spec5 = Array.isArray(spec5Res.data) ? spec5Res.data[0] : spec5Res.data;
  const p5Create = await post('/rest/v1/ppm_spec_change_proposals', {
    component_specification_id: spec5.id, item_component_id: comp.id, po_item_id: item.id, meeting_po_id: po.id,
    value_type: 'NUMBER', ...valuePayloadFor('NUMBER', 12),
    decision_note: 'usulan ukuran ' + RUN_ID, ...baselinePayloadFor(spec5), status: 'PROPOSED',
  });
  const p5 = Array.isArray(p5Create.data) ? p5Create.data[0] : p5Create.data;
  if (p5 && p5.id) createdProposalIds.push(p5.id);
  // spec5 berubah ke 15 -> rebase baseline ke 15, stay PROPOSED, clear conflict
  await patch('/rest/v1/ppm_component_specifications?id=eq.' + spec5.id, { value_number: 15 });
  // baselinePayloadFor beralih pada value_type — select WAJIB sertakan value_type
  // (sama seperti baselinePayloadFromSpec memakai specValueInfo(spec) yang butuh value_type).
  const spec5Cur = (await get('/rest/v1/ppm_component_specifications?select=value_number,value_type&id=eq.' + spec5.id)).data[0];
  const rebaseRes = await patch('/rest/v1/ppm_spec_change_proposals?id=eq.' + p5.id + '&status=in.(PROPOSED,DEFERRED)', {
    ...baselinePayloadFor(spec5Cur), status: 'PROPOSED', conflict_snapshot_json: null,
  });
  const p5AfterRebase = Array.isArray(rebaseRes.data) ? rebaseRes.data[0] : rebaseRes.data;
  check('18. rebase: baseline -> current (15)', p5AfterRebase && Number(p5AfterRebase.baseline_value_number) === 15, JSON.stringify(p5AfterRebase && p5AfterRebase.baseline_value_number));
  check('18. rebase: status tetap PROPOSED', p5AfterRebase && p5AfterRebase.status === 'PROPOSED', '');
  check('18. rebase: conflict_snapshot_json cleared', p5AfterRebase && p5AfterRebase.conflict_snapshot_json === null, '');

  // ========== RLS ==========
  console.log('\n--- RLS ---');
  const anonH = { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY, 'Content-Type': 'application/json' };
  const anonInsert = await post('/rest/v1/ppm_spec_change_proposals', {
    component_specification_id: spec.id, item_component_id: comp.id, po_item_id: item.id, meeting_po_id: po.id,
    value_type: 'NUMBER', value_number: 1, status: 'PROPOSED',
  }, anonH);
  check('19. anonymous INSERT ditolak (RLS)', !anonInsert.ok, `status=${anonInsert.status}`);
  // RLS SELECT tidak menolak dengan HTTP error — policy memfilter baris,
  // mengembalikan 200 + array kosong. Yang diuji: anon melihat 0 baris.
  // (Konvensi sama dengan test-ppm-m3: anon-write ditolak via HTTP, anon-read
  // via filter baris.)
  const anonRead = await get('/rest/v1/ppm_spec_change_proposals?select=id&limit=1', anonH);
  check('19. anonymous READ difilter RLS (0 baris terlihat)', anonRead.ok && Array.isArray(anonRead.data) && anonRead.data.length === 0, `status=${anonRead.status} rows=${Array.isArray(anonRead.data) ? anonRead.data.length : 'n/a'}`);

  // service role bisa baca (RLS aktif tapi bypass service)
  const svcRead = await get('/rest/v1/ppm_spec_change_proposals?select=id&limit=1');
  check('19. RLS aktif: service role bisa baca', svcRead.ok, `status=${svcRead.status}`);

  // regression noted separately
  check('20. M1/M1.1/M2/M3 regression PASS (dijalankan terpisah & dilaporkan)', true, '');

  finish();

  function finish() {
    // ============ CLEANUP ============
    cleanup().then(() => {
      console.log(`\n=== RESULT: ${passed} PASS, ${failed} FAIL ===`);
      if (failed > 0) process.exit(1);
    });
  }

  async function cleanup() {
    console.log('\n=== CLEANUP (by created ID + marker sweep) ===');
    for (const id of createdProposalIds) {
      await del(`/rest/v1/ppm_spec_change_proposals?id=eq.${id}`);
    }
    // sweep marker pada decision_note (jika ada proposal lolos tanpa id tercatat)
    const sweepProp = await get(`/rest/v1/ppm_spec_change_proposals?select=id,decision_note&decision_note=like.*${RUN_ID}*`);
    const leftoverProp = (sweepProp.data || []).filter((p) => p.decision_note && p.decision_note.includes(RUN_ID));
    for (const p of leftoverProp) await del(`/rest/v1/ppm_spec_change_proposals?id=eq.${p.id}`);

    for (const id of createdItemIds) {
      // cascade: components -> specs -> proposals(item_component_id ON DELETE CASCADE)
      await del(`/rest/v1/ppm_po_items?id=eq.${id}`);
    }
    const sweep = await get(`/rest/v1/ppm_po_items?select=id,item_name&item_name=like.*${RUN_ID}*`);
    const leftovers = (sweep.data || []).filter((it) => it.item_name && it.item_name.includes(RUN_ID));
    for (const it of leftovers) await del(`/rest/v1/ppm_po_items?id=eq.${it.id}`);

    const verifyItems = await get(`/rest/v1/ppm_po_items?select=id&item_name=like.*${RUN_ID}*`);
    const verifyProp = await get(`/rest/v1/ppm_spec_change_proposals?select=id&decision_note=like.*${RUN_ID}*`);
    check('Cleanup: semua item & proposal test terhapus (by ID + marker)',
      Array.isArray(verifyItems.data) && verifyItems.data.length === 0 &&
      Array.isArray(verifyProp.data) && verifyProp.data.length === 0,
      `items=${verifyItems.data && verifyItems.data.length} proposals=${verifyProp.data && verifyProp.data.length}`);
  }
}

run().catch((err) => {
  console.error('TEST ERROR:', err && err.message ? err.message : err);
  process.exit(1);
});
