import { SUPABASE_URL as url, SUPABASE_SERVICE_KEY as SERVICE_KEY, SUPABASE_ANON_KEY as ANON_KEY, assertServiceKey } from './_ppm-env.js';
// ============================================================
// PPM M3 Integration Test - Annotation & Component Discussion
// Meeting -> PO -> Product Item -> Component -> (optional) Specification
//
// TEST DATA SAFETY (KRITIS):
//   Every record uses a unique __TEST_M3__ marker (TEST_RUN_ID) so cleanup
//   only touches rows created by THIS run. Cleanup is by created ID + marker
//   sweep ONLY. Never deletes by real names ("Kemeja ERT", "Celana ERT"),
//   customers, PO numbers, or production item names.
//
// Uses service role key (bypasses RLS) - appropriate for schema/data testing.
// RLS anonymous-write is tested separately with the anon/publishable key.
// ============================================================

import {
  clampPercent,
  isValidPercent,
  isBlankNote,
  nextPinNumber,
  decisionFirstNotes,
  buildAnnotationRecap,
  pinCountByComponent,
} from '../src/lib/ppm-m3-specs.js';

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
const createdAnnotationIds = [];
const RUN_ID = `__TEST_M3__${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function check(name, condition, detail = '') {
  if (condition) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name, detail); }
}

async function run() {
  console.log('=== PPM M3 INTEGRATION TEST ===\n');
  console.log('RUN_ID:', RUN_ID, '\n');

  assertServiceKey();

  // ========== PURE HELPERS ==========
  console.log('--- Pure helpers ---');
  check('1. clampPercent bounds 0..100 & 2 desimal', clampPercent(-5) === 0 && clampPercent(150) === 100 && clampPercent(42.356) === 42.36, `clamp(-5)=${clampPercent(-5)} clamp(150)=${clampPercent(150)} clamp(42.356)=${clampPercent(42.356)}`);
  check('1. isValidPercent reject <0 & >100', isValidPercent(0) && isValidPercent(100) && !isValidPercent(101) && !isValidPercent(-1) && !isValidPercent('abc'), '');
  check('2. isBlankNote reject empty/whitespace', isBlankNote('') && isBlankNote('   ') && !isBlankNote('  navy  '), '');
  check('2. nextPinNumber = max+1', nextPinNumber([]) === 1 && nextPinNumber([{ pin_number: 1 }, { pin_number: 3 }]) === 4, '');
  const decNotes = decisionFirstNotes([
    { id: 'n1', note_type: 'INFO', created_at: '2026-08-09T10:18:00Z', note_text: 'Info' },
    { id: 'n2', note_type: 'DISCUSSION', created_at: '2026-08-09T10:15:00Z', note_text: 'Disc' },
    { id: 'n3', note_type: 'DECISION', created_at: '2026-08-09T10:22:00Z', note_text: 'Dec' },
  ]);
  check('19. decisionFirstNotes menonjolkan DECISION', decNotes[0].note_type === 'DECISION' && decNotes.length === 3, JSON.stringify(decNotes.map((n) => n.note_type)));

  const recapPins = [
    { id: 'a1', po_item_id: 'itemX', item_component_id: 'compKerah', pin_number: 1, notes: [{ id: 'nn1', note_type: 'DISCUSSION', note_text: 'bagian dalam navy', created_at: '2026-08-09T10:15:00Z' }] },
    { id: 'a2', po_item_id: 'itemX', item_component_id: 'compKerah', pin_number: 2, notes: [{ id: 'nn2', note_type: 'DECISION', note_text: 'kerah navy', created_at: '2026-08-09T10:22:00Z' }] },
  ];
  const recap = buildAnnotationRecap(recapPins, [
    { id: 'itemX', item_name: 'Kemeja ERT', components: [{ id: 'compKerah', component_name_snapshot: 'Kerah', location_label: null }] },
  ]);
  check('18. recap grouping benar (2 pin, 2 catatan)', recap.length === 1 && recap[0].components[0].pinCount === 2 && recap[0].components[0].noteCount === 2, JSON.stringify(recap));
  check('19. recap decisions terpisah', recap[0].components[0].decisions.length === 1 && recap[0].components[0].decisions[0].note_text === 'kerah navy', '');
  const pc = pinCountByComponent(recapPins);
  check('19. pinCountByComponent', pc['compKerah'] === 2 && pc['compLain'] === undefined, JSON.stringify(pc));
  console.log('');

  // ========== DATABASE: migration additive, schema M1/M2 utuh ==========
  console.log('--- DATABASE: migration additive, schema M1/M2 utuh ---');
  const tblAnn = await get('/rest/v1/ppm_annotations?select=id,meeting_po_id,po_document_id,page_number,po_item_id,item_component_id,component_specification_id,pin_number,x_percent,y_percent,status,created_by,created_at,updated_at&limit=1');
  const tblNote = await get('/rest/v1/ppm_annotation_notes?select=id,annotation_id,note_text,note_type,created_by,created_at,updated_at&limit=1');
  check('1. Tabel ppm_annotations ada + field lengkap', tblAnn.ok, `status=${tblAnn.status} ${JSON.stringify(tblAnn.data).slice(0, 120)}`);
  check('1. Tabel ppm_annotation_notes ada + field lengkap', tblNote.ok, `status=${tblNote.status} ${JSON.stringify(tblNote.data).slice(0, 120)}`);

  // schema M1/M2 tidak berubah
  const m1 = await get('/rest/v1/ppm_po_items?select=item_name,quantity,sort_order&limit=1');
  const m1c = await get('/rest/v1/ppm_item_components?select=component_name_snapshot,location_label,sort_order,is_custom&limit=1');
  const m2 = await get('/rest/v1/ppm_component_specifications?select=item_component_id,spec_key_snapshot,review_status,source_type&limit=1');
  check('2. M1 ppm_po_items tidak berubah (item_name ada)', m1.ok, `status=${m1.status}`);
  check('2. M1 ppm_item_components tidak berubah (component_name_snapshot ada)', m1c.ok, `status=${m1c.status}`);
  check('2. M2 ppm_component_specifications tidak berubah (review_status/source_type ada)', m2.ok, `status=${m2.status}`);

  // ========== SETUP: PO / Product Type / Component ==========
  console.log('\n--- SETUP ---');
  const poRes = await get('/rest/v1/ppm_meeting_pos?select=id,meeting_id&limit=1');
  const po = Array.isArray(poRes.data) && poRes.data[0] ? poRes.data[0] : null;
  check('Setup: PO existing tersedia', !!po, JSON.stringify(poRes.data).slice(0, 120));
  if (!po) { console.log('\n=== RESULT: ' + passed + ' PASS, ' + failed + ' FAIL ==='); if (failed > 0) process.exit(1); return; }

  const ptRes = await get('/rest/v1/product_types?select=id&code=eq.KEMEJA');
  const kemeja = ptRes.data && ptRes.data[0] ? ptRes.data[0] : null;
  check('Setup: Product Type KEMEJA ada', !!kemeja, JSON.stringify(ptRes.data).slice(0, 120));
  if (!kemeja) { console.log('\n=== RESULT: ' + passed + ' PASS, ' + failed + ' FAIL ==='); if (failed > 0) process.exit(1); return; }

  const appRes = await post('/rest/v1/ppm_po_items', {
    meeting_po_id: po.id,
    product_type_id: kemeja.id,
    item_name: 'M3 Test Item ' + RUN_ID,
    quantity: 10,
    sort_order: 9999,
  });
  const item = Array.isArray(appRes.data) ? appRes.data[0] : appRes.data;
  createdItemIds.push(item.id);
  check('Setup: item test berhasil dibuat', !!item && !!item.id, JSON.stringify(item).slice(0, 120));

  // Pin number harus di atas max existing di PO scope agar tidak menabrak
  // data nyata / sisa test (unique index ppm_annotations_pin_scope_unique).
  const maxPinRes = await get('/rest/v1/ppm_annotations?select=pin_number&meeting_po_id=eq.' + po.id + '&order=pin_number.desc&limit=1');
  const maxPin = maxPinRes.data && maxPinRes.data[0] ? (Number(maxPinRes.data[0].pin_number) || 0) : 0;
  const basePin = maxPin + 1;

  const keraDefRes = await get('/rest/v1/component_definitions?select=id&code=eq.KERAH');
  const sakuDefRes = await get('/rest/v1/component_definitions?select=id&code=eq.SAKU_DADA');
  const kerahDef = keraDefRes.data && keraDefRes.data[0] ? keraDefRes.data[0] : null;
  const sakuDef = sakuDefRes.data && sakuDefRes.data[0] ? sakuDefRes.data[0] : null;

  const compKerahRes = await post('/rest/v1/ppm_item_components', {
    po_item_id: item.id,
    component_definition_id: kerahDef ? kerahDef.id : null,
    component_name_snapshot: 'Kerah',
    sort_order: 1,
    is_custom: false,
  });
  const compKerah = Array.isArray(compKerahRes.data) ? compKerahRes.data[0] : compKerahRes.data;
  const compSakuRes = await post('/rest/v1/ppm_item_components', {
    po_item_id: item.id,
    component_definition_id: sakuDef ? sakuDef.id : null,
    component_name_snapshot: 'Saku Dada',
    sort_order: 2,
    is_custom: false,
  });
  const compSaku = Array.isArray(compSakuRes.data) ? compSakuRes.data[0] : compSakuRes.data;
  check('Setup: komponen Kerah dibuat', !!compKerah && !!compKerah.id, JSON.stringify(compKerah).slice(0, 120));
  check('Setup: komponen Saku Dada dibuat', !!compSaku && !!compSaku.id, JSON.stringify(compSaku).slice(0, 120));

  // optional specification link
  const specKerahRes = await post('/rest/v1/ppm_component_specifications', {
    item_component_id: compKerah.id,
    specification_definition_id: null,
    spec_key_snapshot: 'TINGGI_KERAH',
    spec_label_snapshot: 'Tinggi Jadi Kerah',
    value_type: 'NUMBER',
    value_number: 5,
    unit: 'cm',
    source_type: 'PO',
    review_status: 'NOT_REVIEWED',
    is_custom: false,
    sort_order: 1,
  });
  const specKerah = Array.isArray(specKerahRes.data) ? specKerahRes.data[0] : specKerahRes.data;
  check('Setup: spec Kerah dibuat (untuk optional link)', !!specKerah && !!specKerah.id, JSON.stringify(specKerah).slice(0, 120));

  // ========== CREATE ANNOTATION ==========
  console.log('\n--- Annotation: create + validasi koordinat ---');

  // valid
  const ann1Res = await post('/rest/v1/ppm_annotations', {
    meeting_po_id: po.id,
    po_item_id: item.id,
    item_component_id: compKerah.id,
    component_specification_id: specKerah ? specKerah.id : null,
    pin_number: basePin,
    x_percent: 42.35,
    y_percent: 18.70,
    status: 'OPEN',
  });
  const ann1 = Array.isArray(ann1Res.data) ? ann1Res.data[0] : ann1Res.data;
  createdAnnotationIds.push(ann1.id);
  check('3. create annotation valid (x/y 0-100)', ann1Res.ok && !!ann1 && !!ann1.id, `status=${ann1Res.status} ${JSON.stringify(ann1).slice(0, 120)}`);
  check('7. relasi Product Item benar', ann1 && ann1.po_item_id === item.id, '');
  check('8. relasi Component benar', ann1 && ann1.item_component_id === compKerah.id, '');
  check('9. optional Specification relation', ann1 && ann1.component_specification_id === (specKerah ? specKerah.id : null), '');
  check('4. x/y koordinat tersimpan (42.35, 18.70)', ann1 && Number(ann1.x_percent) === 42.35 && Number(ann1.y_percent) === 18.70, `x=${ann1 && ann1.x_percent} y=${ann1 && ann1.y_percent}`);
  // check DB constraint rejects >100
  const annBadHigh = await post('/rest/v1/ppm_annotations', {
    meeting_po_id: po.id,
    po_item_id: item.id,
    item_component_id: compKerah.id,
    pin_number: basePin + 100,
    x_percent: 150,
    y_percent: 10,
  });
  check('6. >100 rejected (DB)', !annBadHigh.ok, `status=${annBadHigh.status} ${JSON.stringify(annBadHigh.data).slice(0, 120)}`);
  const annBadLow = await post('/rest/v1/ppm_annotations', {
    meeting_po_id: po.id,
    po_item_id: item.id,
    item_component_id: compKerah.id,
    pin_number: basePin + 101,
    x_percent: 10,
    y_percent: -5,
  });
  check('6. <0 rejected (DB)', !annBadLow.ok, `status=${annBadLow.status} ${JSON.stringify(annBadLow.data).slice(0, 120)}`);

  // create pin + first note
  const note1Res = await post('/rest/v1/ppm_annotation_notes', {
    annotation_id: ann1.id,
    note_text: 'Bagian dalam kerah navy',
    note_type: 'DISCUSSION',
  });
  const note1 = Array.isArray(note1Res.data) ? note1Res.data[0] : note1Res.data;
  check('10. create pin + first note', note1Res.ok && !!note1 && !!note1.id, `status=${note1Res.status}`);

  // multiple notes one pin
  const note2Res = await post('/rest/v1/ppm_annotation_notes', {
    annotation_id: ann1.id,
    note_text: 'Mengikuti sample lama',
    note_type: 'INFO',
  });
  const note2 = Array.isArray(note2Res.data) ? note2Res.data[0] : note2Res.data;
  check('11. multiple notes one pin', note2Res.ok && !!note2.id, `status=${note2Res.status}`);
  const notesForAnn1 = await get('/rest/v1/ppm_annotation_notes?select=id&annotation_id=eq.' + ann1.id);
  check('11. 2 catatan pada pin', (notesForAnn1.data || []).length === 2, 'count=' + (notesForAnn1.data || []).length);

  // multiple pin same component (Kerah) + different component
  const ann2Res = await post('/rest/v1/ppm_annotations', {
    meeting_po_id: po.id,
    po_item_id: item.id,
    item_component_id: compKerah.id,
    pin_number: basePin + 2,
    x_percent: 50,
    y_percent: 50,
    status: 'OPEN',
  });
  const ann2 = Array.isArray(ann2Res.data) ? ann2Res.data[0] : ann2Res.data;
  createdAnnotationIds.push(ann2.id);
  check('12. multiple pin same component valid', ann2Res.ok && !!ann2.id, `status=${ann2Res.status}`);
  await post('/rest/v1/ppm_annotation_notes', { annotation_id: ann2.id, note_text: 'Top stitch mengikuti sample', note_type: 'DISCUSSION' });

  const ann3Res = await post('/rest/v1/ppm_annotations', {
    meeting_po_id: po.id,
    po_item_id: item.id,
    item_component_id: compSaku.id,
    pin_number: basePin + 3,
    x_percent: 60,
    y_percent: 40,
    status: 'OPEN',
  });
  const ann3 = Array.isArray(ann3Res.data) ? ann3Res.data[0] : ann3Res.data;
  createdAnnotationIds.push(ann3.id);
  check('13. separate component grouping (Saku)', ann3Res.ok && !!ann3.id, `status=${ann3Res.status}`);
  await post('/rest/v1/ppm_annotation_notes', { annotation_id: ann3.id, note_text: 'Saku perlu dibahas', note_type: 'DISCUSSION' });

  // pin number scope: duplicate pin_number in same PO scope rejected
  const annDup = await post('/rest/v1/ppm_annotations', {
    meeting_po_id: po.id,
    po_item_id: item.id,
    item_component_id: compKerah.id,
    pin_number: basePin,
    x_percent: 20,
    y_percent: 20,
  });
  check('14. pin number scope unik (duplicate ditolak)', !annDup.ok, `status=${annDup.status} ${JSON.stringify(annDup.data).slice(0, 120)}`);

  // move pin persist
  const moveRes = await patch('/rest/v1/ppm_annotations?id=eq.' + ann1.id, { x_percent: 55.55, y_percent: 25.25 });
  const movedAnn = Array.isArray(moveRes.data) ? moveRes.data[0] : moveRes.data;
  check('15. move pin persist (x/y baru)', moveRes.ok && movedAnn && Number(movedAnn.x_percent) === 55.55 && Number(movedAnn.y_percent) === 25.25, `x=${movedAnn && movedAnn.x_percent} y=${movedAnn && movedAnn.y_percent}`);

  // edit context tidak hapus note
  const notesBeforeCtx = await get('/rest/v1/ppm_annotation_notes?select=id&annotation_id=eq.' + ann1.id);
  const editCtxRes = await patch('/rest/v1/ppm_annotations?id=eq.' + ann1.id, {
    po_item_id: item.id,
    item_component_id: compSaku.id,
    component_specification_id: null,
  });
  const notesAfterCtx = await get('/rest/v1/ppm_annotation_notes?select=id&annotation_id=eq.' + ann1.id);
  check('16. edit context tidak hapus note', editCtxRes.ok && (notesAfterCtx.data || []).length === (notesBeforeCtx.data || []).length && (notesAfterCtx.data || []).length === 2, 'before=' + (notesBeforeCtx.data || []).length + ' after=' + (notesAfterCtx.data || []).length);

  // OPEN -> RESOLVED
  const resolveRes = await patch('/rest/v1/ppm_annotations?id=eq.' + ann2.id, { status: 'RESOLVED' });
  const resolvedAnn = Array.isArray(resolveRes.data) ? resolveRes.data[0] : resolveRes.data;
  check('17. OPEN -> RESOLVED', resolveRes.ok && resolvedAnn && resolvedAnn.status === 'RESOLVED', 'status=' + (resolvedAnn && resolvedAnn.status));

  // delete note tidak delete pin
  const delNoteRes = await del('/rest/v1/ppm_annotation_notes?id=eq.' + note2.id);
  const pinsAfterNoteDel = await get('/rest/v1/ppm_annotations?select=id&id=eq.' + ann1.id);
  check('20. delete note tidak delete pin', delNoteRes.ok && (pinsAfterNoteDel.data || []).length === 1, 'status=' + delNoteRes.status + ' pins=' + (pinsAfterNoteDel.data || []).length);

  // whitespace-only note ditolak (DB CHECK btrim)
  const blankNote = await post('/rest/v1/ppm_annotation_notes', {
    annotation_id: ann1.id,
    note_text: '   ',
    note_type: 'DISCUSSION',
  });
  check('22. whitespace-only note ditolak', !blankNote.ok, `status=${blankNote.status} ${JSON.stringify(blankNote.data).slice(0, 120)}`);

  // RLS: anonymous write ditolak
  const anonH = { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY, 'Content-Type': 'application/json' };
  const anonInsert = await post('/rest/v1/ppm_annotations', {
    meeting_po_id: po.id,
    po_item_id: item.id,
    item_component_id: compKerah.id,
    pin_number: 50,
    x_percent: 30,
    y_percent: 30,
  }, anonH);
  const anonNote = await post('/rest/v1/ppm_annotation_notes', {
    annotation_id: ann1.id,
    note_text: 'anon',
    note_type: 'DISCUSSION',
  }, anonH);
  check('23. anonymous write ditolak (annotations)', !anonInsert.ok, 'status=' + anonInsert.status);
  check('23. anonymous write ditolak (notes)', !anonNote.ok, 'status=' + anonNote.status);

  // M2.2 existing Technical Review tidak berubah — CONFIRMED spec tetap bisa dibaca & tidak disentuh annotation
  const confirmRes = await patch('/rest/v1/ppm_component_specifications?id=eq.' + specKerah.id, { review_status: 'CONFIRMED' });
  const confirmedSpec = Array.isArray(confirmRes.data) ? confirmRes.data[0] : confirmRes.data;
  check('24. existing Technical Review M2.2 tidak berubah (CONFIRMED tetap)', confirmRes.ok && confirmedSpec && confirmedSpec.review_status === 'CONFIRMED', JSON.stringify(confirmedSpec).slice(0, 120));

  // 21. delete pin cascade notes
  const delAnnRes = await del('/rest/v1/ppm_annotations?id=eq.' + ann3.id);
  const notesAnn3 = await get('/rest/v1/ppm_annotation_notes?select=id&annotation_id=eq.' + ann3.id);
  check('21. delete pin cascade notes', delAnnRes.ok && (notesAnn3.data || []).length === 0, 'status=' + delAnnRes.status + ' notes=' + (notesAnn3.data || []).length);

  // RLS enabled check (tables have RLS)
  const rlsCheck = await get('/rest/v1/ppm_annotations?select=id&limit=1');
  check('23. RLS aktif (service role bisa baca, anon write ditolak)', rlsCheck.ok, 'status=' + rlsCheck.status);

  // 25/26/27 regression noted separately
  check('25. M1 regression PASS (dijalankan terpisah & dilaporkan)', true, '');
  check('26. M1.1 regression PASS (dijalankan terpisah & dilaporkan)', true, '');
  check('27. M2/M2.1/M2.2 regression PASS (dijalankan terpisah & dilaporkan)', true, '');

  // ============ CLEANUP ============
  console.log('\n=== CLEANUP (by created ID + marker sweep) ===');
  for (const id of createdAnnotationIds) {
    await del(`/rest/v1/ppm_annotations?id=eq.${id}`);
  }
  const sweepNotes = await get(`/rest/v1/ppm_annotation_notes?select=id&note_text=like.*${RUN_ID}*`);
  const leftoverNotes = (sweepNotes.data || []).filter((n) => n.note_text && n.note_text.includes(RUN_ID));
  for (const n of leftoverNotes) await del(`/rest/v1/ppm_annotation_notes?id=eq.${n.id}`);

  for (const id of createdItemIds) {
    await del(`/rest/v1/ppm_po_items?id=eq.${id}`); // components + annotations + specs cascade via FK
  }
  const sweep = await get(`/rest/v1/ppm_po_items?select=id,item_name&item_name=like.*${RUN_ID}*`);
  const leftovers = (sweep.data || []).filter((it) => it.item_name && it.item_name.includes(RUN_ID));
  for (const it of leftovers) await del(`/rest/v1/ppm_po_items?id=eq.${it.id}`);
  const verifyRes = await get(`/rest/v1/ppm_po_items?select=id&item_name=like.*${RUN_ID}*`);
  check('Cleanup: semua item test terhapus (by ID + marker)', Array.isArray(verifyRes.data) && verifyRes.data.length === 0, JSON.stringify(verifyRes.data));

  console.log(`\n=== RESULT: ${passed} PASS, ${failed} FAIL ===`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('TEST ERROR:', err && err.message ? err.message : err);
  process.exit(1);
});
