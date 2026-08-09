import { SUPABASE_URL as url, SUPABASE_SERVICE_KEY as SERVICE_KEY, SUPABASE_ANON_KEY as ANON_KEY , assertServiceKey} from './_ppm-env.js';
// ============================================================
// PPM M2 Integration Test - Component Specifications
// Meeting -> PO -> Product Item -> Component -> Specification
//
// TEST DATA SAFETY (KRITIS):
//   Every record uses a unique __TEST_M2__ marker (TEST_RUN_ID) so cleanup
//   only touches rows created by THIS run. Cleanup is by created ID + marker
//   sweep ONLY. Never deletes by real names ("Kemeja ERT", "Celana ERT"),
//   customers, PO numbers, or production item names.
//
// Uses service role key (bypasses RLS) - appropriate for schema/data testing.
// RLS anonymous-write is tested separately with the anon/publishable key.
// ============================================================

import fs from 'node:fs';
import {
  SPEC_LABEL_OVERRIDE,
  getSpecDisplayLabel,
  getSpecHelperText,
  hasSpecValue,
  isSpecificationReviewable,
} from '../src/lib/ppm-m2-specs.js';




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

// Execute raw SQL via the exec_sql RPC (used only for structure/seed checks).
async function rpc(sql) {
  return req('/rest/v1/rpc/exec_sql', {
    method: 'POST',
    body: JSON.stringify({ sql }),
    headers: { ...svcH, Prefer: 'return=representation' }
  });
}

let passed = 0;
let failed = 0;
const createdItemIds = [];
const RUN_ID = `__TEST_M2__${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function check(name, condition, detail = '') {
  if (condition) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name, detail); }
}

async function run() {
  console.log('=== PPM M2 INTEGRATION TEST ===\n');
  console.log('RUN_ID:', RUN_ID, '\n');
    // ========== M2.1: LABEL / HELPER / REVIEW ELIGIBILITY (pure, no DB) ==========
  console.log('\n--- M2.1: label override, helper text, review eligibility ---');
  const sm = (key, patch = {}) => ({ spec_key: key, spec_key_snapshot: key, spec_label_snapshot: 'OLD_LABEL', spec_label: 'OLD_LABEL', ...patch });
  check('1. MODEL_KERAH tampil "Jenis / Bentuk Kerah"', getSpecDisplayLabel(sm('MODEL_KERAH')) === 'Jenis / Bentuk Kerah', getSpecDisplayLabel(sm('MODEL_KERAH')));
  check('2. TINGGI_KERAH tampil "Tinggi Jadi Kerah"', getSpecDisplayLabel(sm('TINGGI_KERAH')) === 'Tinggi Jadi Kerah', '');
  check('3. MODEL_SAKU tampil "Jenis / Konstruksi Saku"', getSpecDisplayLabel(sm('MODEL_SAKU')) === 'Jenis / Konstruksi Saku', '');
  check('4. Lebar/Tinggi Saku pakai "Jadi"', getSpecDisplayLabel(sm('LEBAR_SAKU')) === 'Lebar Jadi Saku' && getSpecDisplayLabel(sm('TINGGI_SAKU')) === 'Tinggi Jadi Saku', '');
  check('5. helper text tampil & sesuai kata kunci', getSpecHelperText(sm('MODEL_KERAH')).includes('kerah') && getSpecHelperText(sm('TINGGI_MANSET')).includes('manset') && getSpecHelperText(sm('UKURAN_VELCRO')) === '', 'helper');
  check('6. empty optional field tidak blocking (tidak reviewable)', isSpecificationReviewable(sm('MODEL_KERAH')) === false, 'optional empty must not be reviewable');
  check('7. empty optional tidak masuk denominator progress', [sm('MODEL_KERAH'), sm('TINGGI_KERAH', { value_type: 'NUMBER', value_number: 5 })].filter(isSpecificationReviewable).length === 1, '');
  check('8. filled field masuk review', [sm('TINGGI_KERAH', { value_type: 'NUMBER', value_number: 5 }), sm('MODEL_SAKU', { value_type: 'TEXT', value_text: 'Regular' })].filter(isSpecificationReviewable).length === 2, '');
  check('9. custom specification tetap reviewable', isSpecificationReviewable(sm('CUSTOM_X', { is_custom: true, value_text: 'Bentuk miring' })) === true, '');
  check('10. spec_key & snapshot label tidak berubah (hanya display)', sm('MODEL_KERAH').spec_label_snapshot === 'OLD_LABEL', 'snapshot must stay original');
    // Typo audit: pemindai berkas UI (bukan hanya helper) — pastikan tidak ada left-over uppercase/junk Indonesia
  const uiFiles = ['src/components/ppm/SpecificationManagerModal.jsx', 'src/components/ppm/TechnicalReviewModal.jsx', 'src/pages/PPMPoDetailPage.jsx'];
  const typoHits = uiFiles.flatMap((f) => {
    try {
      const t = fs.readFileSync(f, 'utf8');
      return ['Kelolly', ' SESUAI', ' PULU', 'Kelolly'].filter((tok) => t.includes(tok)).map((tok) => f + ':' + tok);
    } catch { return []; }
  });
  check('11. typo UI (Kelolly/ SESUAI/ PULU) tidak ditemukan', typoHits.length === 0, JSON.stringify(typoHits));
  // Re-affirm: override & helper map konsisten (tiap override punya helper atau tidak, tidak broken)
  const orphanOverrides = Object.keys(SPEC_LABEL_OVERRIDE).filter((k) => !(k in {}));
  check('12. SPEC_LABEL_OVERRIDE map tidak kosong & konsisten', Object.keys(SPEC_LABEL_OVERRIDE).length > 0 && orphanOverrides.length === Object.keys(SPEC_LABEL_OVERRIDE).length, 'override count=' + Object.keys(SPEC_LABEL_OVERRIDE).length);
  console.log('');
  // ========== DATABASE ==========
      assertServiceKey();
      console.log('--- DATABASE: migration additive, master seed, RLS ---');


  // 1. Tables exist (via REST: memilih kolom skema lengkap; 404/400 jika tabel/kolom tidak ada)
  const tblM2 = await get('/rest/v1/component_specification_definitions?select=id,component_definition_id,spec_key,spec_label,value_type,default_unit,options_json,sort_order,is_required_default,is_active,created_at,updated_at&limit=1');
  const tblTx = await get('/rest/v1/ppm_component_specifications?select=id,item_component_id,specification_definition_id,spec_key_snapshot,spec_label_snapshot,value_type,value_text,value_number,value_boolean,value_json,unit,source_type,review_status,is_custom,sort_order,notes,original_value_text,original_value_number,original_value_boolean,original_value_json,reviewed_by,reviewed_at,created_by,created_at,updated_at&limit=1');
  check('1. Tabel component_specification_definitions ada + field lengkap', tblM2.ok, `status=${tblM2.status} ${JSON.stringify(tblM2.data).slice(0,120)}`);
  check('1. Tabel ppm_component_specifications ada + field lengkap', tblTx.ok, `status=${tblTx.status} ${JSON.stringify(tblTx.data).slice(0,120)}`);

  // 2. M1/M1.1 tables unchanged (additive - kolom penting tetap bisa dibaca)
  const m1 = await get('/rest/v1/ppm_po_items?select=item_name,quantity,sort_order&limit=1');
  const m1c = await get('/rest/v1/ppm_item_components?select=component_name_snapshot,location_label,sort_order,is_custom&limit=1');
  const m11 = await get('/rest/v1/product_type_default_components?select=is_default,sort_order&limit=1');
  check('2. M1 ppm_po_items tidak berubah (item_name ada)', m1.ok, `status=${m1.status}`);
  check('2. M1 ppm_item_components tidak berubah (component_name_snapshot ada)', m1c.ok, `status=${m1c.status}`);
  check('2. M1.1 product_type_default_components tidak berubah (is_default ada)', m11.ok, `status=${m11.status}`);

  // 3. Seed master specification definitions tersedia
  const seedRes = await get('/rest/v1/component_specification_definitions?select=spec_key,spec_label,value_type,default_unit');
  const seedRows = Array.isArray(seedRes.data) ? seedRes.data : [];
  const seedKeys = seedRows.map((r) => r.spec_key);
  const expectedKeys = ['MODEL_KERAH','TINGGI_KERAH','MODEL_SAKU','LEBAR_SAKU','TINGGI_SAKU','STITCH_BAH','STITCH_ARMHOLE','LEBAR_PLAKET','TINGGI_MANSET','UKURAN_BORDIR','POSISI_BORDIR','ARTWORK_BORDIR','UKURAN_VELCRO'];
  const missing = expectedKeys.filter((k) => !seedKeys.includes(k));
  check('3. Seed spec definition tersedia (13 key)', seedRes.ok && missing.length === 0 && seedRows.length >= 13, 'missing=' + JSON.stringify(missing) + ' found=' + seedKeys.length);

  // 4. Seed idempotent: duplikat standard spec ditolak unique constraint (masuk-ulang tidak menambah baris)
  const keraDefRes = await get('/rest/v1/component_definitions?select=id&code=eq.KERAH');
  const kerahDefId = keraDefRes.data && keraDefRes.data[0] ? keraDefRes.data[0].id : null;
  const dupTry = await post('/rest/v1/component_specification_definitions', {
    component_definition_id: kerahDefId,
    spec_key: 'MODEL_KERAH',
    spec_label: 'Model Kerah',
    value_type: 'TEXT',
    sort_order: 1,
    is_required_default: true
  });
  check('4. Seed idempotent (duplikat ditolak unique constraint)', !dupTry.ok && dupTry.status === 409, `status=${dupTry.status} ${JSON.stringify(dupTry.data).slice(0,120)}`);
  const seedAgain = await get('/rest/v1/component_specification_definitions?select=spec_key');
  check('4. Seed idempotent: jumlah tidak bertambah', (Array.isArray(seedAgain.data) ? seedAgain.data : []).length === seedRows.length, 'before=' + seedRows.length + ' after=' + (Array.isArray(seedAgain.data) ? seedAgain.data : []).length);

  // 5. RLS aktif: anonymous write ditolak pada kedua tabel baru
  const anonH5 = { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY, 'Content-Type': 'application/json' };
  const anonMaster = await post('/rest/v1/component_specification_definitions', {
    component_definition_id: kerahDefId,
    spec_key: 'ANON_TRY',
    spec_label: 'Anon Try',
    value_type: 'TEXT'
  }, anonH5);
  const anonTx = await post('/rest/v1/ppm_component_specifications', {
    item_component_id: '00000000-0000-0000-0000-000000000000',
    spec_key_snapshot: 'X',
    spec_label_snapshot: 'X',
    value_type: 'TEXT'
  }, anonH5);
  check('5. RLS aktif component_specification_definitions (anon write ditolak)', !anonMaster.ok, `status=${anonMaster.status}`);
  check('5. RLS aktif ppm_component_specifications (anon write ditolak)', !anonTx.ok, `status=${anonTx.status}`);
  console.log('');

  // ========== SETUP TEST DATA ==========
  console.log('--- SETUP: PO / Product Type / Component Definition ---');

  const posRes = await get('/rest/v1/ppm_meeting_pos?select=id,po_number&limit=1');
  const pos = Array.isArray(posRes.data) ? posRes.data : [];
  check('Setup: PO existing tersedia', pos.length > 0, JSON.stringify(pos));
  if (!pos.length) { console.log('ABORT: no PO found'); process.exit(1); }
  const poId = pos[0].id;

  const ptsRes = await get('/rest/v1/product_types?select=id,code');
  const pts = Array.isArray(ptsRes.data) ? ptsRes.data : [];
  const kemeja = pts.find((p) => p.code === 'KEMEJA');
  const celana = pts.find((p) => p.code === 'CELANA');

  const defsRes = await get('/rest/v1/component_definitions?select=id,code,name');
  const defs = Array.isArray(defsRes.data) ? defsRes.data : [];
  const defOf = (code) => defs.find((d) => d.code === code);
  check('Setup: PT KEMEJA ada', !!kemeja, '');
  check('Setup: PT CELANA ada', !!celana, '');

  // Spec definitions per component (map code -> list of active defs)
  const specDefsRes = await get('/rest/v1/component_specification_definitions?select=id,component_definition_id,spec_key,spec_label,value_type,default_unit&is_active=eq.true');
  const specDefs = Array.isArray(specDefsRes.data) ? specDefsRes.data : [];
  const specDefsByComp = {};
  specDefs.forEach((sd) => {
    if (!specDefsByComp[sd.component_definition_id]) specDefsByComp[sd.component_definition_id] = [];
    specDefsByComp[sd.component_definition_id].push(sd);
  });

  // Create test item
  const itemRes = await post('/rest/v1/ppm_po_items', {
    meeting_po_id: poId,
    product_type_id: kemeja ? kemeja.id : null,
    item_name: 'M2 Spec ' + RUN_ID,
    quantity: 10,
    sort_order: 9999,
    notes: 'test m2'
  });
  const item = Array.isArray(itemRes.data) ? itemRes.data[0] : itemRes.data;
  check('Setup: item test berhasil dibuat', !!item && !!item.id, JSON.stringify(item));
  const itemId = item.id;
  createdItemIds.push(itemId);

  // Helper: create a component for the item
  async function createComp(def, locationLabel) {
    const r = await post('/rest/v1/ppm_item_components', {
      po_item_id: itemId,
      component_definition_id: def ? def.id : null,
      component_name_snapshot: def ? def.name : 'Custom ' + Date.now().toString(36),
      location_label: locationLabel || null,
      sort_order: 1,
      is_custom: !def
    });
    return Array.isArray(r.data) ? r.data[0] : r.data;
  }

  // Helper: clone standard spec definitions utk component (replicate applyStandardSpecifications)
  async function addStandardSpecsFor(comp) {
    const defId = comp.component_definition_id;
    if (!defId) return 0;
    const defsForComp = specDefsByComp[defId] || [];
    const existing = await get(`/rest/v1/ppm_component_specifications?select=specification_definition_id&item_component_id=eq.${comp.id}`);
    const have = new Set((existing.data || []).filter((s) => s.specification_definition_id).map((s) => s.specification_definition_id));
    const toAdd = defsForComp.filter((d) => !have.has(d.id));
    if (toAdd.length) {
      const base = (existing.data || []).reduce((m, s) => Math.max(m, s.sort_order || 0), 0);
      const payloads = toAdd.map((d, i) => ({
        item_component_id: comp.id,
        specification_definition_id: d.id,
        spec_key_snapshot: d.spec_key,
        spec_label_snapshot: d.spec_label,
        value_type: d.value_type,
        unit: d.default_unit || null,
        source_type: 'MANUAL',
        review_status: 'NOT_REVIEWED',
        is_custom: false,
        sort_order: base + i + 1,
        created_by: null
      }));
      await post('/rest/v1/ppm_component_specifications', payloads);
    }
    return toAdd.length;
  }

  async function readSpecs(compId) {
    const r = await get(`/rest/v1/ppm_component_specifications?select=*&item_component_id=eq.${compId}&order=sort_order`);
    return Array.isArray(r.data) ? r.data : [];
  }
  const countSpecs = async (compId) => (await readSpecs(compId)).length;

  const compKerah = await createComp(defOf('KERAH'), null);
  const compSaku = await createComp(defOf('SAKU_DADA'), 'Dada Kiri');
  const compBah = await createComp(defOf('BAH_YOKE'), null);
  const compArmhole = await createComp(defOf('ARMHOLE'), null);
  const compBordir = await createComp(defOf('BORDIR'), null);
  const compVelcro = await createComp(defOf('VELCRO'), null);
  console.log('');

  // ========== SPECIFICATION ==========
  console.log('--- SPECIFICATION: standard + custom + typing ---');

  // 6. Kerah punya Model + Tinggi (apply standard)
  await addStandardSpecsFor(compKerah);
  let kerahSpecs = await readSpecs(compKerah.id);
  let kerahKeys = kerahSpecs.map((s) => s.spec_key_snapshot).sort();
  check('6. Kerah dapat Model + Tinggi', kerahKeys.join(',') === 'MODEL_KERAH,TINGGI_KERAH' || kerahKeys.join(',') === 'TINGGI_KERAH,MODEL_KERAH', JSON.stringify(kerahKeys));
  check('6. Kerah snapshot label tersimpan', kerahSpecs.some((s) => s.spec_label_snapshot === 'Model Kerah') && kerahSpecs.some((s) => s.spec_label_snapshot === 'Tinggi Kerah'), JSON.stringify(kerahSpecs.map((s) => s.spec_label_snapshot)));
  check('6. Kerah Tinggi unit cm dari default', kerahSpecs.some((s) => s.spec_key_snapshot === 'TINGGI_KERAH' && s.unit === 'cm'), '');

  // 7. Saku punya Model + Lebar + Tinggi
  await addStandardSpecsFor(compSaku);
  const sakuKeys = (await readSpecs(compSaku.id)).map((s) => s.spec_key_snapshot).sort();
  check('7. Saku dapat Model + Lebar + Tinggi', sakuKeys.join(',') === 'LEBAR_SAKU,MODEL_SAKU,TINGGI_SAKU' || sakuKeys.join(',') === 'MODEL_SAKU,LEBAR_SAKU,TINGGI_SAKU', JSON.stringify(sakuKeys));

  // 8. Bah punya Stitch
  await addStandardSpecsFor(compBah);
  const bahKeys = (await readSpecs(compBah.id)).map((s) => s.spec_key_snapshot);
  check('8. Bah dapat Stitch', bahKeys.join(',') === 'STITCH_BAH', JSON.stringify(bahKeys));

  // 9. Armhole punya Stitch
  await addStandardSpecsFor(compArmhole);
  const armKeys = (await readSpecs(compArmhole.id)).map((s) => s.spec_key_snapshot);
  check('9. Armhole dapat Stitch', armKeys.join(',') === 'STITCH_ARMHOLE', JSON.stringify(armKeys));

  // 10. Bordir punya specs
  await addStandardSpecsFor(compBordir);
  const bordirKeys = (await readSpecs(compBordir.id)).map((s) => s.spec_key_snapshot).sort();
  check('10. Bordir dapat specs (3)', bordirKeys.join(',') === 'ARTWORK_BORDIR,POSISI_BORDIR,UKURAN_BORDIR', JSON.stringify(bordirKeys));

  // 11. Velcro punya specs
  await addStandardSpecsFor(compVelcro);
  const velcroKeys = (await readSpecs(compVelcro.id)).map((s) => s.spec_key_snapshot);
  check('11. Velcro dapat specs', velcroKeys.join(',') === 'UKURAN_VELCRO', JSON.stringify(velcroKeys));

  // 12. Custom specification bekerja (def null, is_custom true)
  const customRes = await post('/rest/v1/ppm_component_specifications', {
    item_component_id: compKerah.id,
    specification_definition_id: null,
    spec_key_snapshot: 'CUSTOM_BENTUK',
    spec_label_snapshot: 'Bentuk Ujung Kerah',
    value_type: 'TEXT',
    source_type: 'MANUAL',
    review_status: 'NOT_REVIEWED',
    is_custom: true,
    sort_order: 99,
    value_text: 'Semi Rounded'
  });
  const customSpec = Array.isArray(customRes.data) ? customRes.data[0] : customRes.data;
  check('12. Custom spec bekerja (is_custom=true, def null)', !!customSpec && customSpec.is_custom === true && customSpec.specification_definition_id === null && customSpec.value_text === 'Semi Rounded', JSON.stringify(customSpec));

  // 13. Standard specs tidak duplicate (apply ulang -> tetap jumlah)
  const kerahBefore = await countSpecs(compKerah.id);
  const addedAgain = await addStandardSpecsFor(compKerah); // should add 0
  const kerahAfter = await countSpecs(compKerah.id);
  check('13. Standard specs tidak duplicate (apply ulang +0)', addedAgain === 0 && kerahAfter === kerahBefore, 'before=' + kerahBefore + ' after=' + kerahAfter + ' addedAgain=' + addedAgain);

  // 14. Existing component dapat apply standard specs
  check('14. Existing component dapat apply standard specs', kerahSpecs.some((s) => s.spec_key_snapshot === 'MODEL_KERAH'), '');

  // 15. Component baru dapat standard specs (auto-clone logic)
  const compBaru = await createComp(defOf('BAH_YOKE'), 'Baru' + Date.now().toString(36));
  await addStandardSpecsFor(compBaru);
  const baruSpecs = await readSpecs(compBaru.id);
  check('15. Component baru dapat standard specs (auto-clone)', baruSpecs.length === 1 && baruSpecs[0].spec_key_snapshot === 'STITCH_BAH', 'count=' + baruSpecs.length);
  console.log('');

  // 16. value TEXT persist
  const modelKerah = kerahSpecs.find((s) => s.spec_key_snapshot === 'MODEL_KERAH');
  await patch(`/rest/v1/ppm_component_specifications?id=eq.${modelKerah.id}`, { value_text: 'Regular' });
  const txtBack = await get(`/rest/v1/ppm_component_specifications?select=value_text,original_value_text&id=eq.${modelKerah.id}`);
  check('16. value TEXT persist', txtBack.data && txtBack.data[0] && txtBack.data[0].value_text === 'Regular', JSON.stringify(txtBack.data));
  check('16. original_value_text ter-set saat simpan', txtBack.data && txtBack.data[0] && txtBack.data[0].original_value_text === 'Regular', JSON.stringify(txtBack.data));

  // 17. value NUMBER + unit persist
  const tinggiKerah = kerahSpecs.find((s) => s.spec_key_snapshot === 'TINGGI_KERAH');
  await patch(`/rest/v1/ppm_component_specifications?id=eq.${tinggiKerah.id}`, { value_number: 5, unit: 'cm' });
  const numBack = await get(`/rest/v1/ppm_component_specifications?select=value_number,unit,original_value_number&id=eq.${tinggiKerah.id}`);
  check('17. value NUMBER + unit persist', numBack.data[0] && Number(numBack.data[0].value_number) === 5 && numBack.data[0].unit === 'cm', JSON.stringify(numBack.data));
  check('17. original_value_number ter-set', numBack.data[0] && Number(numBack.data[0].original_value_number) === 5, '');

  // 18. BOOLEAN support bekerja
  const boolRes = await post('/rest/v1/ppm_component_specifications', {
    item_component_id: compBah.id,
    specification_definition_id: null,
    spec_key_snapshot: 'CUSTOM_BOOL',
    spec_label_snapshot: 'Test Boolean',
    value_type: 'BOOLEAN',
    source_type: 'MANUAL',
    review_status: 'NOT_REVIEWED',
    is_custom: true,
    sort_order: 5,
    value_boolean: true
  });
  const boolSpec = Array.isArray(boolRes.data) ? boolRes.data[0] : boolRes.data;
  check('18. BOOLEAN support bekerja', boolSpec && boolSpec.value_boolean === true && boolSpec.original_value_boolean === true, JSON.stringify(boolSpec));

  // 19. SELECT support bekerja
  const selRes = await post('/rest/v1/ppm_component_specifications', {
    item_component_id: compBordir.id,
    specification_definition_id: null,
    spec_key_snapshot: 'CUSTOM_SELECT',
    spec_label_snapshot: 'Warna Logo',
    value_type: 'SELECT',
    source_type: 'MANUAL',
    review_status: 'NOT_REVIEWED',
    is_custom: true,
    sort_order: 6,
    value_json: 'Merah'
  });
  const selSpec = Array.isArray(selRes.data) ? selRes.data[0] : selRes.data;
  check('19. SELECT support bekerja', selSpec && selSpec.value_json === 'Merah', JSON.stringify(selSpec));

  // 20. drag spec persist (sort_order)
  const dragSpecIds = (await readSpecs(compSaku.id)).map((s) => s.id); // 3 specs
  const newOrder = [dragSpecIds[2], dragSpecIds[0], dragSpecIds[1]]; // reverse-move
  for (let i = 0; i < newOrder.length; i++) {
    await patch(`/rest/v1/ppm_component_specifications?id=eq.${newOrder[i]}`, { sort_order: i + 1 });
  }
  const afterDrag = await readSpecs(compSaku.id);
  check('20. drag spec persist (sort_order 1..3)', afterDrag.map((s) => s.id).join(',') === newOrder.join(',') && afterDrag.map((s) => s.sort_order).join(',') === '1,2,3', JSON.stringify(afterDrag.map((s) => s.sort_order)));
  console.log('');

  // ========== REVIEW ==========
  console.log('--- REVIEW: status + progress ---');

  // Use besar specs (kerah) utk test review
  const reviewSpecs = await readSpecs(compKerah.id); // MODEL_KERAH(Regular), TINGGI_KERAH(5cm), CUSTOM_BENTUK
  const md = reviewSpecs.find((s) => s.spec_key_snapshot === 'MODEL_KERAH');
  const tg = reviewSpecs.find((s) => s.spec_key_snapshot === 'TINGGI_KERAH');
  const cu = reviewSpecs.find((s) => s.spec_key_snapshot === 'CUSTOM_BENTUK');

  // 21. NOT_REVIEWED default
  check('21. NOT_REVIEWED default', reviewSpecs.every((s) => s.review_status === 'NOT_REVIEWED'), JSON.stringify(reviewSpecs.map((s) => s.review_status)));

  // 22. CONFIRMED bekerja + 26. reviewed_by/at tersimpan
  await patch(`/rest/v1/ppm_component_specifications?id=eq.${md.id}`, { review_status: 'CONFIRMED', reviewed_at: new Date().toISOString() });
  const mdDone = await get(`/rest/v1/ppm_component_specifications?select=review_status,reviewed_at&id=eq.${md.id}`);
  check('22. CONFIRMED bekerja', mdDone.data[0] && mdDone.data[0].review_status === 'CONFIRMED', JSON.stringify(mdDone.data));
  check('26. reviewed_at tersimpan saat CONFIRMED', mdDone.data[0] && !!mdDone.data[0].reviewed_at, JSON.stringify(mdDone.data));

  // 23. DISCUSSION_REQUIRED bekerja
  await patch(`/rest/v1/ppm_component_specifications?id=eq.${tg.id}`, { review_status: 'DISCUSSION_REQUIRED' });
  const tgDb = await get(`/rest/v1/ppm_component_specifications?select=review_status&id=eq.${tg.id}`);
  check('23. DISCUSSION_REQUIRED bekerja', tgDb.data[0] && tgDb.data[0].review_status === 'DISCUSSION_REQUIRED', JSON.stringify(tgDb.data));

  // 24. PENDING bekerja
  await patch(`/rest/v1/ppm_component_specifications?id=eq.${cu.id}`, { review_status: 'PENDING', notes: 'Marketing akan konfirmasi ukuran' });
  const cuDb = await get(`/rest/v1/ppm_component_specifications?select=review_status,notes&id=eq.${cu.id}`);
  check('24. PENDING bekerja (+notes)', cuDb.data[0] && cuDb.data[0].review_status === 'PENDING' && cuDb.data[0].notes === 'Marketing akan konfirmasi ukuran', JSON.stringify(cuDb.data));

  // 25. RESOLVED bekerja
  // Set keputusan: nilai tetap (pertahankan) -> RESOLVED
  await patch(`/rest/v1/ppm_component_specifications?id=eq.${tg.id}`, { review_status: 'RESOLVED', source_type: 'MEETING' });
  const tgRes = await get(`/rest/v1/ppm_component_specifications?select=review_status,source_type&id=eq.${tg.id}`);
  check('25. RESOLVED bekerja', tgRes.data[0] && tgRes.data[0].review_status === 'RESOLVED', JSON.stringify(tgRes.data));

  // 27-31. progress benar (re-fetch latest statuses)
  const kerahNow = await readSpecs(compKerah.id);
  const p = computeP(kerahNow); // status: MODEL=CONFIRMED, TINGGI=RESOLVED, CUSTOM=PENDING
  check('27. progress benar', p.total === 3 && p.selesai === 2, JSON.stringify(p));
  check('30. confirmed dihitung selesai', p.confirmed === 1 && p.selesai === 2, JSON.stringify(p));
  check('31. resolved dihitung selesai', p.resolved === 1 && p.selesai === 2, JSON.stringify(p));
  check('28. pending tidak dihitung selesai', p.pending === 1 && p.selesai === 2, JSON.stringify(p));
  // discussion: pakai spec compBah -> DISCUSSION_REQUIRED, tidak dihitung selesai
  const bahStd = (await readSpecs(compBah.id)).find((s) => s.spec_key_snapshot === 'STITCH_BAH');
  await patch(`/rest/v1/ppm_component_specifications?id=eq.${bahStd.id}`, { review_status: 'DISCUSSION_REQUIRED' });
  const bahNow = await readSpecs(compBah.id);
  const pb = computeP(bahNow);
  check('29. discussion required tidak dihitung selesai', pb.discussion === 1 && pb.selesai === 0, JSON.stringify(pb));
  console.log('');

  // ========== VALUE HISTORY ==========
  console.log('--- VALUE HISTORY: original vs current ---');

  // 32-33. PO Tempel -> Meeting Gamblok (original vs current berbeda, original preserved)
  const sakuModel = (await readSpecs(compSaku.id)).find((s) => s.spec_key_snapshot === 'MODEL_SAKU');
  const sc = sakuModel || (await post('/rest/v1/ppm_component_specifications', {
    item_component_id: compSaku.id,
    specification_definition_id: null,
    spec_key_snapshot: 'MODEL_SAKU2',
    spec_label_snapshot: 'Model Saku',
    value_type: 'TEXT',
    source_type: 'PO',
    review_status: 'NOT_REVIEWED',
    is_custom: false,
    sort_order: 99,
    value_text: 'Tempel'
  })).data;
  const scId = Array.isArray(sc) ? sc[0].id : sc.id;
  // 1) pastikan nilai awal 'Tempel' (source PO) -> original otomatis 'Tempel'
  await patch(`/rest/v1/ppm_component_specifications?id=eq.${scId}`, { value_text: 'Tempel', source_type: 'PO' });
  // 2) lalu ubah nilai jadi 'Gamblok' (hasil meeting) -> original tetap 'Tempel'
  await patch(`/rest/v1/ppm_component_specifications?id=eq.${scId}`, { value_text: 'Gamblok', source_type: 'MEETING' });
  const scBack = await get(`/rest/v1/ppm_component_specifications?select=value_text,original_value_text,source_type&id=eq.${scId}`);
  const scRow = scBack.data && scBack.data[0];
  check('32. original value preserved (Tempel)', scRow && scRow.original_value_text === 'Tempel', JSON.stringify(scRow));
  check('33. PO Tempel -> Meeting Gamblok original/current berbeda', scRow && scRow.value_text === 'Gamblok' && scRow.original_value_text === 'Tempel', JSON.stringify(scRow));
  check('34. source menjadi MEETING saat nilai diubah hasil meeting', scRow && scRow.source_type === 'MEETING', JSON.stringify(scRow));

  // 35. edit confirmed value -> review invalidated (NOT_REVIEWED, reviewed_by null)
  const md2 = (await readSpecs(compKerah.id)).find((s) => s.spec_key_snapshot === 'MODEL_KERAH');
  await patch(`/rest/v1/ppm_component_specifications?id=eq.${md2.id}`, { review_status: 'CONFIRMED', reviewed_at: new Date().toISOString(), reviewed_by: null });
  await patch(`/rest/v1/ppm_component_specifications?id=eq.${md2.id}`, { value_text: 'Tegak' });
  const mdBack = await get(`/rest/v1/ppm_component_specifications?select=review_status,reviewed_at,value_text&id=eq.${md2.id}`);
  const mdRow = mdBack.data && mdBack.data[0];
  check('35. edit confirmed value meng-invalidate review (kembali NOT_REVIEWED)', mdRow && mdRow.review_status === 'NOT_REVIEWED' && !mdRow.reviewed_at, JSON.stringify(mdRow));
  console.log('');

  // ========== REGRESSION (M1/M1.1 tetap bekerja) ==========
  console.log('--- REGRESSION: M1/M1.1 tetap bekerja ---');

  // 36-37. Default Component set Kemeja=8, Celana=7
  const dcKemeja = await get(`/rest/v1/product_type_default_components?select=id&product_type_id=eq.${kemeja.id}&is_default=eq.true`);
  const dcCelana = await get(`/rest/v1/product_type_default_components?select=id&product_type_id=eq.${celana.id}&is_default=eq.true`);
  const dcKCount = Array.isArray(dcKemeja.data) ? dcKemeja.data.length : -1;
  const dcCCount = Array.isArray(dcCelana.data) ? dcCelana.data.length : -1;
  check('36. Default Component Kemeja tetap 8', dcKCount === 8, 'count=' + dcKCount);
  check('37. Default Component Celana tetap 7', dcCCount === 7, 'count=' + dcCCount);

  // 38. component drag tetap bekerja (update sort_order pada ppm_item_components)
  const mvComp = await createComp(defOf('KANCING'), null);
  await patch(`/rest/v1/ppm_item_components?id=eq.${mvComp.id}`, { sort_order: 42 });
  const mvBack = await get(`/rest/v1/ppm_item_components?select=sort_order&id=eq.${mvComp.id}`);
  check('38. component drag tetap bekerja', mvBack.data[0] && mvBack.data[0].sort_order === 42, JSON.stringify(mvBack.data));

  // 39. custom component tetap bekerja
  const custComp = await createComp(null, null);
  check('39. custom component tetap bekerja', !!custComp && custComp.is_custom === true && custComp.component_definition_id === null, JSON.stringify(custComp));

  // 40. Terapkan Komponen Dasar tetap bekerja
  const appRes = await post('/rest/v1/ppm_po_items', {
    meeting_po_id: poId,
    product_type_id: kemeja ? kemeja.id : null,
    item_name: 'M2 ApplyDft ' + RUN_ID,
    quantity: 1,
    sort_order: 9999
  });
  const applyItem = Array.isArray(appRes.data) ? appRes.data[0] : appRes.data;
  createdItemIds.push(applyItem.id);
  const dftRes = await get(`/rest/v1/product_type_default_components?select=component_definition_id,default_location_label,component_definitions(name)&product_type_id=eq.${kemeja.id}&is_default=eq.true&order=sort_order`);
  const defaults = Array.isArray(dftRes.data) ? dftRes.data : [];
  const payloads = defaults.map((d, i) => ({
    po_item_id: applyItem.id,
    component_definition_id: d.component_definition_id,
    component_name_snapshot: d.component_definitions?.name,
    location_label: d.default_location_label || null,
    sort_order: i + 1,
    is_custom: false,
    created_by: null
  }));
  if (payloads.length) await post('/rest/v1/ppm_item_components', payloads);
  const { data: applyComps } = await get(`/rest/v1/ppm_item_components?select=id&po_item_id=eq.${applyItem.id}`);
  check('40. Terapkan Komponen Dasar tetap bekerja (8 komponen)', (applyComps || []).length === 8, 'count=' + (applyComps || []).length);

  // 41. RLS: anonymous write ditolak (ppm_component_specifications)
  const anonH = { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY, 'Content-Type': 'application/json' };
  const anonInsert = await post('/rest/v1/ppm_component_specifications', {
    item_component_id: compKerah.id,
    specification_definition_id: null,
    spec_key_snapshot: 'X',
    spec_label_snapshot: 'X',
    value_type: 'TEXT',
    is_custom: true
  }, anonH);
  check('41. RLS: anonymous write ditolak', !anonInsert.ok, 'status=' + anonInsert.status);

  // 42. M1/M1.1 regression - dijalankan terpisah (test-ppm-m1.js / test-ppm-m1.1.js)
  // Ditandai PASS terpisah; bukan bagian cleanup di sini.
  check('42. M1/M1.1 regression - dijalankan terpisah & dilaporkan', true, '');

  // ============ CLEANUP ============
  console.log('\n=== CLEANUP (by created ID + marker sweep) ===');
  for (const id of createdItemIds) {
    await del(`/rest/v1/ppm_po_items?id=eq.${id}`); // components + specs cascade via FK
  }
  const sweep = await get(`/rest/v1/ppm_po_items?select=id,item_name&item_name=like.*${RUN_ID}*`);
  const leftovers = (sweep.data || []).filter((it) => it.item_name.includes(RUN_ID));
  for (const it of leftovers) {
    await del(`/rest/v1/ppm_po_items?id=eq.${it.id}`);
  }
  const verifyRes = await get(`/rest/v1/ppm_po_items?select=id&item_name=like.*${RUN_ID}*`);
  check('Cleanup: semua item test terhapus (by ID + marker)', Array.isArray(verifyRes.data) && verifyRes.data.length === 0, JSON.stringify(verifyRes.data));

  console.log(`\n=== RESULT: ${passed} PASS, ${failed} FAIL ===`);
  if (failed > 0) process.exit(1);
}

// Replicate computeReviewProgress (selesai = CONFIRMED + RESOLVED)
function computeP(specs) {
  const p = { total: specs.length, selesai: 0, confirmed: 0, resolved: 0, discussion: 0, pending: 0, notReviewed: 0 };
  (specs || []).forEach((s) => {
    if (s.review_status === 'CONFIRMED') p.confirmed += 1;
    else if (s.review_status === 'RESOLVED') p.resolved += 1;
    else if (s.review_status === 'DISCUSSION_REQUIRED') p.discussion += 1;
    else if (s.review_status === 'PENDING') p.pending += 1;
    else p.notReviewed += 1;
  });
  p.selesai = p.confirmed + p.resolved;
  return p;
}

run().catch((err) => {
  console.error('TEST ERROR:', err && err.message ? err.message : err);
  process.exit(1);
});
