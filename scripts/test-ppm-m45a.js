import { SUPABASE_URL as url, SUPABASE_SERVICE_KEY as SERVICE_KEY, SUPABASE_ANON_KEY as ANON_KEY, assertServiceKey } from './_ppm-env.js';
// ============================================================
// PPM M4.5A Integration Test — Specification Template + Technical Standard
//
// Menguji:
//   - Migration additive: 5 tabel baru + schema M1/M2/M3/M4 utuh.
//   - Uniqueness NULL-safe: duplicate component/location & duplicate spec
//     dicegah BAIK untuk standard maupun CUSTOM (NULL component/spec def).
//   - Template CRUD: komposisi, snapshot label, value_type, default value
//     (TEXT/NUMBER/BOOLEAN/SELECT/MULTI via JSON), required, sort_order,
//     deactivate.
//   - Standard CRUD: scope product type, typed values, deactivate.
//   - DEFAULT vs STANDARD tetap terbedakan (kolom berbeda).
//   - RLS: anon write ditolak, non-super write ditolak, authenticated read
//     bekerja (via anon read 0 rows).
//   - Cleanup safe (by created ID + marker sweep, TIDAK pernah by nama bisnis).
//
// SETUP INVARIANT (KRITIS): mustCreate() — insert setup WAJIB berhasil;
// jika gagal -> SEGERA FAIL + abort. Tidak pernah query id=eq.undefined.
// ============================================================

import {
  VALUE_TYPE,
  defaultValueInfo,
  standardValueInfo,
  formatTemplateDefault,
  formatStandardValue,
  resolveComposeValue,
  defsForComponent,
  specsAfterComponentChange,
} from '../src/lib/ppm-m45a-specs.js';

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
const cleanupIds = { templates: [], components: [], specs: [], standards: [], standardSpecs: [], productTypes: [] };
const RUN_ID = `__TEST_M45A__${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function check(name, condition, detail = '') {
  if (condition) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name, detail); }
}

function mustCreate(res, label) {
  const row = Array.isArray(res.data) ? res.data[0] : res.data;
  const ok = res.ok && !!row && !!row.id;
  check('Setup: ' + label + ' berhasil dibuat', ok, `status=${res.status} ${JSON.stringify(res.data).slice(0, 160)}`);
  if (!ok) {
    throw new Error('SETUP FAILED: ' + label + ' (status=' + res.status + '). Test dihentikan segera.');
  }
  return row;
}

async function execSql(sql) {
  const r = await post('/rest/v1/rpc/exec_sql', { sql }, svcH);
  return r;
}

// value payload builder (mirror buildValuePayload M2)
function valuePayload(valueType, value) {
  switch (valueType) {
    case 'NUMBER': return { value_number: value === '' || value === null || value === undefined ? null : Number(value) };
    case 'BOOLEAN': return { value_boolean: !!value };
    case 'SELECT': return { value_json: value === '' || value === null || value === undefined ? null : value };
    case 'MULTI_SELECT': return { value_json: Array.isArray(value) ? value : (value ? [value] : null) };
    case 'TEXT':
    default: return { value_text: value === '' || value === null || value === undefined ? null : String(value) };
  }
}

function defaultPayload(valueType, value) {
  const p = valuePayload(valueType, value);
  return {
    default_value_text: p.value_text ?? null,
    default_value_number: p.value_number ?? null,
    default_value_boolean: p.value_boolean ?? null,
    default_value_json: p.value_json ?? null,
  };
}

(async () => {
  console.log('RUN_ID:', RUN_ID);
  try {
    // ============================================================
    // 1. TABLES EXIST + SCHEMA ADDITIVE
    // exec_sql mengembalikan 204 untuk SELECT (tanpa rows), jadi verifikasi
    // struktur memakai: DO block yang RAISE EXCEPTION (mirror verify script)
    // + REST probe (GET per tabel/kolom; error 4xx jika tidak ada).
    // ============================================================
    const probe = async (path) => {
      const r = await req(path, {}, svcH);
      return r.status < 400;
    };
    check('1. 5 tabel M4.5A ada di DB (REST probe)',
      (await probe('/rest/v1/ppm_spec_templates?select=id&limit=1'))
      && (await probe('/rest/v1/ppm_spec_template_components?select=id&limit=1'))
      && (await probe('/rest/v1/ppm_spec_template_specs?select=id&limit=1'))
      && (await probe('/rest/v1/ppm_company_technical_standards?select=id&limit=1'))
      && (await probe('/rest/v1/ppm_company_technical_standard_specs?select=id&limit=1')));

    // 2. Schema additive — M1/M2 tables + kolom kunci masih utuh.
    check('2a. ppm_po_items masih ada', await probe('/rest/v1/ppm_po_items?select=id&limit=1'));
    check('2b. ppm_item_components masih ada', await probe('/rest/v1/ppm_item_components?select=id&limit=1'));
    check('2c. ppm_component_specifications masih ada', await probe('/rest/v1/ppm_component_specifications?select=id&limit=1'));
    check('2d. component_specification_definitions masih ada', await probe('/rest/v1/component_specification_definitions?select=id&limit=1'));
    check('2e. product_types masih ada', await probe('/rest/v1/product_types?select=id&limit=1'));
    check('2f. component_definitions masih ada', await probe('/rest/v1/component_definitions?select=id&limit=1'));

    // 3. Seed product types.
    const ptRes = await get('/rest/v1/product_types?select=id,code&code=in.(KEMEJA_LAPANGAN,KEMEJA_KANTOR,KEMEJA)');
    const ptCodes = (ptRes.data || []).map((r) => r.code).sort();
    check('3a. KEMEJA_LAPANGAN di-seed', ptCodes.includes('KEMEJA_LAPANGAN'), JSON.stringify(ptCodes));
    check('3b. KEMEJA_KANTOR di-seed', ptCodes.includes('KEMEJA_KANTOR'), JSON.stringify(ptCodes));
    check('3c. Legacy KEMEJA tetap ada', ptCodes.includes('KEMEJA'), JSON.stringify(ptCodes));

    const [ptKemejaLapangan] = (ptRes.data || []).filter((r) => r.code === 'KEMEJA_LAPANGAN');
    const [ptKantor] = (ptRes.data || []).filter((r) => r.code === 'KEMEJA_KANTOR');
    const [ptKemeja] = (ptRes.data || []).filter((r) => r.code === 'KEMEJA');

    // ============================================================
    // SETUP MASTER REFS (existing M1/M2 master rows)
    // ============================================================
    const cdRes = await get('/rest/v1/component_definitions?select=id,code&code=in.(KERAH,SCOTCHLIGHT,SAKU_DADA)');
    const cdMap = {};
    (cdRes.data || []).forEach((r) => { cdMap[r.code] = r.id; });
    const kerahDef = cdMap['KERAH'];
    const scotchDef = cdMap['SCOTCHLIGHT'];
    const sakuDadaDef = cdMap['SAKU_DADA'];
    check('Setup: component_definitions KERAH & SCOTCHLIGHT ada', !!(kerahDef && scotchDef), JSON.stringify(cdRes.data));
    check('Setup: component_definitions SAKU_DADA ada', !!sakuDadaDef, JSON.stringify(cdRes.data));

    const sdRes = await get('/rest/v1/component_specification_definitions?select=id,spec_key,spec_label,value_type,default_unit,options_json&component_definition_id=eq.' + kerahDef);
    const kerahSpecDefs = sdRes.data || [];
    const tinggiKerahDef = kerahSpecDefs.find((d) => d.spec_key === 'TINGGI_KERAH');
    const modelKerahDef = kerahSpecDefs.find((d) => d.spec_key === 'MODEL_KERAH');
    check('Setup: spec defs TINGGI_KERAH & MODEL_KERAH ada', !!(tinggiKerahDef && modelKerahDef), JSON.stringify(kerahSpecDefs.map((d) => d.spec_key)));

    // Semua spec definitions + komponen pemiliknya (untuk test picker contextual).
    const allDefsRes = await get('/rest/v1/component_specification_definitions?select=id,spec_key,spec_label,component_definition_id,value_type,default_unit,options_json&order=component_definition_id');
    const allSpecDefs = allDefsRes.data || [];
    const sakuSpecDefs = allSpecDefs.filter((d) => d.component_definition_id === sakuDadaDef);
    check('Setup: spec defs SAKU_DADA ada (TINGGI_SAKU dkk)', sakuSpecDefs.some((d) => d.spec_key === 'TINGGI_SAKU'), JSON.stringify(sakuSpecDefs.map((d) => d.spec_key)));

    // 2g. Master integrity: SEMUA spec definitions punya component_definition_id
    //     (tanpa ini, picker contextual tidak bisa membedakan komponen).
    check('2g. Semua spec definitions punya component_definition_id (master integrity)',
      allSpecDefs.length > 0 && allSpecDefs.every((d) => !!d.component_definition_id),
      JSON.stringify(allSpecDefs.filter((d) => !d.component_definition_id).map((d) => d.spec_key)));

    // ============================================================
    // 4-17. TEMPLATE CRUD
    // ============================================================
    const tplCode = 'TP_' + RUN_ID.replace(/\W/g, '').slice(0, 24);
    const tpl = mustCreate(await post('/rest/v1/ppm_spec_templates', {
      code: tplCode,
      name: 'Template Test ' + RUN_ID,
      description: 'test fixture',
      product_type_id: ptKemejaLapangan.id,
      is_active: true,
    }), 'template');
    cleanupIds.templates.push(tpl.id);

    // 5. template product type link
    const tplRead = await get('/rest/v1/ppm_spec_templates?select=*,product_types(code,name)&id=eq.' + tpl.id);
    check('5. template ter-link ke product type', tplRead.data?.[0]?.product_types?.code === 'KEMEJA_LAPANGAN', JSON.stringify(tplRead.data));

    // 6. add component (standard, dari component_definitions)
    const comp1 = mustCreate(await post('/rest/v1/ppm_spec_template_components', {
      template_id: tpl.id,
      component_definition_id: kerahDef,
      component_name_snapshot: 'Kerah',
      location_label: null,
      sort_order: 0,
      is_required: true,
    }), 'component Kerah');
    cleanupIds.components.push(comp1.id);

    const comp2 = mustCreate(await post('/rest/v1/ppm_spec_template_components', {
      template_id: tpl.id,
      component_definition_id: scotchDef,
      component_name_snapshot: 'Scotchlight',
      location_label: 'Punggung',
      sort_order: 1,
      is_required: false,
    }), 'component Scotchlight');
    cleanupIds.components.push(comp2.id);

    // 8. snapshot label preserved
    check('8. component_name_snapshot tersimpan', comp1.component_name_snapshot === 'Kerah' && comp2.component_name_snapshot === 'Scotchlight', JSON.stringify(comp1));

    // 7. duplicate standard component/location DITOLAK
    const dupComp = await post('/rest/v1/ppm_spec_template_components', {
      template_id: tpl.id,
      component_definition_id: kerahDef,
      component_name_snapshot: 'Kerah Lagi',
      location_label: null,
      sort_order: 9,
    });
    check('7a. duplicate standard component (def+location) ditolak', !dupComp.ok && dupComp.status === 409, `status=${dupComp.status}`);

    // 7b. duplicate component definition dgn location BERBEDA BOLEH
    const dupComp2Loc = await post('/rest/v1/ppm_spec_template_components', {
      template_id: tpl.id,
      component_definition_id: kerahDef,
      component_name_snapshot: 'Kerah Depan',
      location_label: 'Depan',
      sort_order: 9,
    });
    check('7b. komponen sama def dgn lokasi berbeda diizinkan', dupComp2Loc.ok, `status=${dupComp2Loc.status}`);
    if (dupComp2Loc.ok && dupComp2Loc.data?.[0]?.id) cleanupIds.components.push(dupComp2Loc.data[0].id);

    // 7c. CUSTOM component (component_definition_id NULL): duplicate nama+location DITOLAK
    const custom1 = mustCreate(await post('/rest/v1/ppm_spec_template_components', {
      template_id: tpl.id,
      component_definition_id: null,
      component_name_snapshot: 'Trim Reflektif',
      location_label: 'Lengan',
      sort_order: 9,
    }), 'custom component Trim Reflektif');
    cleanupIds.components.push(custom1.id);
    const customDup = await post('/rest/v1/ppm_spec_template_components', {
      template_id: tpl.id,
      component_definition_id: null,
      component_name_snapshot: 'Trim Reflektif',
      location_label: 'Lengan',
      sort_order: 9,
    });
    check('7c. duplicate CUSTOM component (nama+lokasi sama) ditolak', !customDup.ok && customDup.status === 409, `status=${customDup.status}`);

    // 9-16. SPECS
    const spec1 = mustCreate(await post('/rest/v1/ppm_spec_template_specs', {
      template_component_id: comp1.id,
      specification_definition_id: tinggiKerahDef.id,
      spec_key_snapshot: 'TINGGI_KERAH',
      spec_label_snapshot: 'Tinggi Jadi Kerah',
      value_type: 'NUMBER',
      unit: 'cm',
      is_required: true,
      sort_order: 0,
      ...defaultPayload('NUMBER', 5),
    }), 'spec TINGGI_KERAH default 5');
    cleanupIds.specs.push(spec1.id);

    const spec2 = mustCreate(await post('/rest/v1/ppm_spec_template_specs', {
      template_component_id: comp1.id,
      specification_definition_id: modelKerahDef.id,
      spec_key_snapshot: 'MODEL_KERAH',
      spec_label_snapshot: 'Model Kerah',
      value_type: 'TEXT',
      unit: null,
      is_required: false,
      sort_order: 1,
      ...defaultPayload('TEXT', 'Hans'),
    }), 'spec MODEL_KERAH default Hans');
    cleanupIds.specs.push(spec2.id);

    const spec3 = mustCreate(await post('/rest/v1/ppm_spec_template_specs', {
      template_component_id: comp2.id,
      specification_definition_id: null,
      spec_key_snapshot: 'LEBAR_TRIM',
      spec_label_snapshot: 'Lebar Trim Reflektif',
      value_type: 'NUMBER',
      unit: 'inch',
      is_required: true,
      sort_order: 0,
      ...defaultPayload('NUMBER', 2),
    }), 'custom spec LEBAR_TRIM');
    cleanupIds.specs.push(spec3.id);

    // 10. duplicate standard spec DITOLAK (sama def)
    const dupSpec = await post('/rest/v1/ppm_spec_template_specs', {
      template_component_id: comp1.id,
      specification_definition_id: tinggiKerahDef.id,
      spec_key_snapshot: 'TINGGI_KERAH',
      spec_label_snapshot: 'Tinggi Jadi Kerah',
      value_type: 'NUMBER',
      sort_order: 9,
    });
    check('10a. duplicate standard spec (def sama) ditolak', !dupSpec.ok && dupSpec.status === 409, `status=${dupSpec.status}`);

    // 10b. custom spec duplicate key DITOLAK (NULL-safe)
    const dupCustomSpec = await post('/rest/v1/ppm_spec_template_specs', {
      template_component_id: comp2.id,
      specification_definition_id: null,
      spec_key_snapshot: 'LEBAR_TRIM',
      spec_label_snapshot: 'Lebar Trim Reflektif Lagi',
      value_type: 'NUMBER',
      sort_order: 9,
    });
    check('10b. duplicate CUSTOM spec (key sama) ditolak', !dupCustomSpec.ok && dupCustomSpec.status === 409, `status=${dupCustomSpec.status}`);

    // 11. value_type preserved
    const specRead = await get('/rest/v1/ppm_spec_template_specs?select=*&id=eq.' + spec1.id);
    check('11. value_type NUMBER tersimpan', specRead.data?.[0]?.value_type === 'NUMBER', JSON.stringify(specRead.data));

    // 12-15. default value per type
    check('12. default TEXT tersimpan', spec2.default_value_text === 'Hans', JSON.stringify(spec2));
    check('13. default NUMBER tersimpan', Number(spec1.default_value_number) === 5, JSON.stringify(spec1));
    check('14. default BOOLEAN tersimpan', specRead.data?.[0]?.default_value_boolean === null, JSON.stringify(specRead.data));

    const boolSpec = mustCreate(await post('/rest/v1/ppm_spec_template_specs', {
      template_component_id: comp2.id,
      specification_definition_id: null,
      spec_key_snapshot: 'REFLEKTIF',
      spec_label_snapshot: 'Reflektif',
      value_type: 'BOOLEAN',
      sort_order: 1,
      ...defaultPayload('BOOLEAN', true),
    }), 'custom spec BOOLEAN');
    cleanupIds.specs.push(boolSpec.id);
    check('14b. default BOOLEAN tersimpan', boolSpec.default_value_boolean === true, JSON.stringify(boolSpec));

    const selSpec = mustCreate(await post('/rest/v1/ppm_spec_template_specs', {
      template_component_id: comp2.id,
      specification_definition_id: null,
      spec_key_snapshot: 'POSISI_TRIM',
      spec_label_snapshot: 'Posisi Trim',
      value_type: 'SELECT',
      sort_order: 2,
      ...defaultPayload('SELECT', 'Punggung'),
    }), 'custom spec SELECT');
    cleanupIds.specs.push(selSpec.id);
    check('15. default SELECT/JSON tersimpan', selSpec.default_value_json === 'Punggung', JSON.stringify(selSpec));

    const multiSpec = mustCreate(await post('/rest/v1/ppm_spec_template_specs', {
      template_component_id: comp2.id,
      specification_definition_id: null,
      spec_key_snapshot: 'STITCH_TRIM',
      spec_label_snapshot: 'Stitch Trim',
      value_type: 'MULTI_SELECT',
      sort_order: 3,
      ...defaultPayload('MULTI_SELECT', ['Double', 'Zigzag']),
    }), 'custom spec MULTI_SELECT');
    cleanupIds.specs.push(multiSpec.id);
    check('15b. default MULTI_SELECT/JSON array tersimpan', Array.isArray(multiSpec.default_value_json) && multiSpec.default_value_json.includes('Double'), JSON.stringify(multiSpec));

    // 16. required flag
    check('16. required flag tersimpan', spec1.is_required === true && spec2.is_required === false, JSON.stringify({ s1: spec1.is_required, s2: spec2.is_required }));

    // 17. sort order
    const compSortRes = await get('/rest/v1/ppm_spec_template_components?select=id,sort_order&template_id=eq.' + tpl.id + '&order=sort_order.asc');
    const sorts = (compSortRes.data || []).map((c) => c.sort_order);
    check('17. sort_order komponen tersimpan & urut', sorts.length >= 2 && sorts[0] <= sorts[1], JSON.stringify(sorts));

    // 22. deactivate template
    const deactTpl = await patch('/rest/v1/ppm_spec_templates?id=eq.' + tpl.id, { is_active: false });
    check('22. template dapat dinonaktifkan', deactTpl.ok && deactTpl.data?.[0]?.is_active === false, JSON.stringify(deactTpl.data));
    const reactTpl = await patch('/rest/v1/ppm_spec_templates?id=eq.' + tpl.id, { is_active: true });
    check('22b. template dapat diaktifkan kembali', reactTpl.ok && reactTpl.data?.[0]?.is_active === true, JSON.stringify(reactTpl.data));

    // ============================================================
    // 18-21, 23. TECHNICAL STANDARD CRUD
    // ============================================================
    const stdCode = 'STD_' + RUN_ID.replace(/\W/g, '').slice(0, 24);
    const std = mustCreate(await post('/rest/v1/ppm_company_technical_standards', {
      code: stdCode,
      name: 'Standar Test ' + RUN_ID,
      description: 'test fixture',
      product_type_id: ptKantor.id,
      is_active: true,
    }), 'standard');
    cleanupIds.standards.push(std.id);

    // 19. standard product type scope
    const stdRead = await get('/rest/v1/ppm_company_technical_standards?select=*,product_types(code,name)&id=eq.' + std.id);
    check('19. standard ter-scope ke product type', stdRead.data?.[0]?.product_types?.code === 'KEMEJA_KANTOR', JSON.stringify(stdRead.data));

    // 20. standard typed values
    const stdSpec1 = mustCreate(await post('/rest/v1/ppm_company_technical_standard_specs', {
      standard_id: std.id,
      component_definition_id: kerahDef,
      specification_definition_id: tinggiKerahDef.id,
      spec_key_snapshot: 'TINGGI_KERAH',
      value_type: 'NUMBER',
      unit: 'cm',
      ...valuePayload('NUMBER', 4.5),
      is_required: true,
    }), 'standard spec TINGGI_KERAH 4.5');
    cleanupIds.standardSpecs.push(stdSpec1.id);

    const stdSpec2 = mustCreate(await post('/rest/v1/ppm_company_technical_standard_specs', {
      standard_id: std.id,
      component_definition_id: null,
      specification_definition_id: null,
      spec_key_snapshot: 'STITCH_DOUBLE',
      value_type: 'TEXT',
      unit: null,
      ...valuePayload('TEXT', 'Double Stitch'),
      is_required: false,
    }), 'standard spec STITCH_DOUBLE');
    cleanupIds.standardSpecs.push(stdSpec2.id);

    check('20a. standard NUMBER value', Number(stdSpec1.value_number) === 4.5, JSON.stringify(stdSpec1));
    check('20b. standard TEXT value', stdSpec2.value_text === 'Double Stitch', JSON.stringify(stdSpec2));

    // duplicate standard spec key ditolak
    const dupStdSpec = await post('/rest/v1/ppm_company_technical_standard_specs', {
      standard_id: std.id,
      spec_key_snapshot: 'TINGGI_KERAH',
      value_type: 'NUMBER',
      ...valuePayload('NUMBER', 5),
    });
    check('20c. duplicate standard spec key ditolak', !dupStdSpec.ok && dupStdSpec.status === 409, `status=${dupStdSpec.status}`);

    // 21. DEFAULT vs STANDARD distinguishability — kolom terpisah & nilai berbeda
    check('21a. DEFAULT (template) terpisah dari STANDARD: default_value_number=5 vs value_number=4.5',
      Number(spec1.default_value_number) === 5 && Number(stdSpec1.value_number) === 4.5,
      JSON.stringify({ tpl: spec1.default_value_number, std: stdSpec1.value_number }));

    // 23. deactivate standard
    const deactStd = await patch('/rest/v1/ppm_company_technical_standards?id=eq.' + std.id, { is_active: false });
    check('23. standard dapat dinonaktifkan', deactStd.ok && deactStd.data?.[0]?.is_active === false, JSON.stringify(deactStd.data));

    // 21b. template spec link ke standard (standard_id FK) — simple explicit mapping
    const linkRes = await patch('/rest/v1/ppm_spec_template_specs?id=eq.' + spec1.id, { standard_id: std.id });
    check('21b. template spec dapat me-link 1 standard (simple mapping, bukan rule engine)', linkRes.ok && linkRes.data?.[0]?.standard_id === std.id, JSON.stringify(linkRes.data));

    // ============================================================
    // PURE HELPERS
    // ============================================================
    const di = defaultValueInfo(spec1);
    check('P1. defaultValueInfo NUMBER -> default_value_number=5', di.field === 'default_value_number' && Number(di.value) === 5, JSON.stringify(di));
    const si = standardValueInfo(stdSpec2);
    check('P2. standardValueInfo TEXT -> value_text=Double Stitch', si.field === 'value_text' && si.value === 'Double Stitch', JSON.stringify(si));
    check('P3. formatTemplateDefault NUMBER+unit', formatTemplateDefault(spec1) === '5 cm', formatTemplateDefault(spec1));
    check('P4. formatStandardValue TEXT', formatStandardValue(stdSpec2) === 'Double Stitch', formatStandardValue(stdSpec2));
    // compose semantics: standard menang atas default (simple explicit, no engine)
    const composed = resolveComposeValue({ ...spec1, standard_id: std.id }, stdSpec1);
    check('P5. resolveComposeValue: STANDARD menang atas DEFAULT (4.5 cm)', String(composed) === '4.5', JSON.stringify(composed));
    const composedNoStd = resolveComposeValue(spec2, null);
    check('P6. resolveComposeValue tanpa standard -> DEFAULT (Hans)', composedNoStd === 'Hans', JSON.stringify(composedNoStd));

    // ============================================================
    // P7-P12. CONTEXTUAL SPEC PICKER (manual verification bugfix)
    // Prinsip: dropdown spec HANYA menampilkan defs milik component aktif.
    // Custom spec (value '') tetap tersedia sebagai escape hatch.
    // ============================================================
    // P7. Kerah picker: HANYA defs Kerah; TIDAK menampilkan Tinggi Saku.
    const kerahPicker = defsForComponent(allSpecDefs, kerahDef);
    check('P7a. Kerah picker menampilkan TINGGI_KERAH', kerahPicker.some((d) => d.spec_key === 'TINGGI_KERAH'), JSON.stringify(kerahPicker.map((d) => d.spec_key)));
    check('P7b. Kerah picker TIDAK menampilkan TINGGI_SAKU', !kerahPicker.some((d) => d.spec_key === 'TINGGI_SAKU'), JSON.stringify(kerahPicker.map((d) => d.spec_key)));
    check('P7c. Kerah picker TIDAK menampilkan TINGGI_MANSET', !kerahPicker.some((d) => d.spec_key === 'TINGGI_MANSET'), JSON.stringify(kerahPicker.map((d) => d.spec_key)));

    // P8. Saku picker: HANYA defs Saku Dada; TIDAK menampilkan Tinggi Kerah.
    const sakuPicker = defsForComponent(allSpecDefs, sakuDadaDef);
    check('P8a. Saku picker menampilkan TINGGI_SAKU', sakuPicker.some((d) => d.spec_key === 'TINGGI_SAKU'), JSON.stringify(sakuPicker.map((d) => d.spec_key)));
    check('P8b. Saku picker TIDAK menampilkan TINGGI_KERAH', !sakuPicker.some((d) => d.spec_key === 'TINGGI_KERAH'), JSON.stringify(sakuPicker.map((d) => d.spec_key)));
    check('P8c. Saku picker TIDAK menampilkan STITCH_BAH', !sakuPicker.some((d) => d.spec_key === 'STITCH_BAH'), JSON.stringify(sakuPicker.map((d) => d.spec_key)));

    // P9. Scotchlight picker (setelah seed approved 2026-08-12): HANYA defs
    //     milik Scotchlight; TIDAK menampilkan defs komponen lain (tidak fallback).
    const scotchPicker = defsForComponent(allSpecDefs, scotchDef);
    const scotchKeys = scotchPicker.map((d) => d.spec_key);
    check('P9a. Scotchlight picker menampilkan JENIS_SCOTCHLIGHT', scotchKeys.includes('JENIS_SCOTCHLIGHT'), JSON.stringify(scotchKeys));
    check('P9b. Scotchlight picker menampilkan LEBAR_SCOTCHLIGHT (unit inch)', scotchPicker.some((d) => d.spec_key === 'LEBAR_SCOTCHLIGHT' && d.default_unit === 'inch'), JSON.stringify(scotchPicker.map((d) => [d.spec_key, d.default_unit])));
    check('P9c. Scotchlight picker menampilkan POSISI_SCOTCHLIGHT', scotchKeys.includes('POSISI_SCOTCHLIGHT'), JSON.stringify(scotchKeys));
    check('P9d. Scotchlight picker menampilkan STITCH_SCOTCHLIGHT', scotchKeys.includes('STITCH_SCOTCHLIGHT'), JSON.stringify(scotchKeys));
    check('P9e. Scotchlight picker TIDAK menampilkan MODEL_KERAH', !scotchKeys.includes('MODEL_KERAH'), JSON.stringify(scotchKeys));
    check('P9f. Scotchlight picker HANYA defs Scotchlight (tidak bocor komponen lain)', scotchPicker.length > 0 && scotchPicker.every((d) => d.component_definition_id === scotchDef), JSON.stringify(scotchKeys));

    // P9g. Lebar Manset hanya muncul di picker MANSET (seed approved).
    const mansetDefRes = await get('/rest/v1/component_definitions?select=id,code&code=eq.MANSET');
    const mansetDef = mansetDefRes.data?.[0]?.id;
    check('Setup: component_definitions MANSET ada', !!mansetDef, JSON.stringify(mansetDefRes.data));
    const mansetPicker = defsForComponent(allSpecDefs, mansetDef);
    const mansetKeys = mansetPicker.map((d) => d.spec_key);
    check('P9g1. Manset picker menampilkan LEBAR_MANSET (unit cm)', mansetPicker.some((d) => d.spec_key === 'LEBAR_MANSET' && d.default_unit === 'cm'), JSON.stringify(mansetKeys));
    check('P9g2. Manset picker menampilkan TINGGI_MANSET', mansetKeys.includes('TINGGI_MANSET'), JSON.stringify(mansetKeys));
    check('P9g3. Kerah picker TIDAK menampilkan LEBAR_MANSET', !kerahPicker.some((d) => d.spec_key === 'LEBAR_MANSET'), JSON.stringify(kerahPicker.map((d) => d.spec_key)));
    check('P9g4. Scotchlight picker TIDAK menampilkan LEBAR_MANSET', !scotchKeys.includes('LEBAR_MANSET'), JSON.stringify(scotchKeys));

    // P10. Custom spec tetap tersedia: component tanpa def -> defsForComponent=[],
    //      row custom (specification_definition_id='') tetap valid di specs list.
    const noCompDefs = defsForComponent(allSpecDefs, '');
    check('P10a. Row tanpa component -> picker kosong (Custom spec saja)', noCompDefs.length === 0, JSON.stringify(noCompDefs));
    const customSurvives = specsAfterComponentChange(
      [{ _key: 's1', specification_definition_id: '', spec_key_snapshot: 'LEBAR_TRIM', value_type: 'NUMBER', unit: 'inch', default_value: 2, standard_id: '' }],
      scotchDef,
      allSpecDefs,
    );
    check('P10b. Custom spec (tanpa def) dipertahankan saat ganti component', customSurvives[0].specification_definition_id === '' && customSurvives[0].spec_key_snapshot === 'LEBAR_TRIM', JSON.stringify(customSurvives));

    // P11. Component change -> incompatible selected spec HARUS di-clear.
    const before = { specification_definition_id: tinggiKerahDef.id, spec_key_snapshot: 'TINGGI_KERAH', value_type: 'NUMBER', unit: 'cm', default_value: 5, standard_id: std.id };
    const changedToScotch = specsAfterComponentChange([{ _key: 's1', ...before }], scotchDef, allSpecDefs);
    check('P11a. Kerah -> Scotchlight: TINGGI_KERAH di-clear (tidak simpan Scotchlight->Tinggi Kerah)',
      changedToScotch[0].specification_definition_id === '' && changedToScotch[0].spec_key_snapshot === '' && changedToScotch[0].standard_id === '',
      JSON.stringify(changedToScotch));
    const changedToKerah = specsAfterComponentChange([{ _key: 's1', ...before }], kerahDef, allSpecDefs);
    check('P11b. Kerah -> Kerah: TINGGI_KERAH kompatibel, dipertahankan',
      changedToKerah[0].specification_definition_id === tinggiKerahDef.id && changedToKerah[0].spec_key_snapshot === 'TINGGI_KERAH',
      JSON.stringify(changedToKerah));
    const changedToSaku = specsAfterComponentChange([{ _key: 's1', ...before }], sakuDadaDef, allSpecDefs);
    check('P11c. Kerah -> Saku: TINGGI_KERAH di-clear (tidak kompatibel)',
      changedToSaku[0].specification_definition_id === '' && changedToSaku[0].spec_key_snapshot === '',
      JSON.stringify(changedToSaku));

    // P12. Saved template tetap valid: spec dengan def Kerah tetap utuh
    //      (tidak di-clear oleh bugfix picker — defsForComponent hanya dipakai
    //      saat user ganti component di UI).
    const intact = specsAfterComponentChange(
      [{ _key: 's1', specification_definition_id: tinggiKerahDef.id, spec_key_snapshot: 'TINGGI_KERAH', value_type: 'NUMBER', unit: 'cm', default_value: 5, standard_id: '' }],
      kerahDef,
      allSpecDefs,
    );
    check('P12. Saved template (def Kerah + component Kerah) tetap valid', intact[0].specification_definition_id === tinggiKerahDef.id, JSON.stringify(intact));

    // ============================================================
    // P13+. WIKA MASTER PATCH (2026-08-13): 5 komponen + 18 defs
    // (user-approved scope dari task "Master Patch + M4.5A.1").
    // ============================================================
    const newCdRes = await get('/rest/v1/component_definitions?select=id,code&code=in.(SKODER_BAHU,SKODER_LENGAN,KELIM_BAWAH,BELAHAN_SAMPING,LIST,BORDIR,PLAKET,SLIT_LENGAN)');
    const newCdMap = {};
    (newCdRes.data || []).forEach((r) => { newCdMap[r.code] = r.id; });
    const skoderBahuDef = newCdMap['SKODER_BAHU'];
    const skoderLenganDef = newCdMap['SKODER_LENGAN'];
    const kelimBawahDef = newCdMap['KELIM_BAWAH'];
    const belahanSampingDef = newCdMap['BELAHAN_SAMPING'];
    const listDef = newCdMap['LIST'];
    const bordirDef = newCdMap['BORDIR'];
    const plaketDef = newCdMap['PLAKET'];
    const slitLenganDef = newCdMap['SLIT_LENGAN'];

    check('P13a. 5 komponen baru ada (SKODER_BAHU, SKODER_LENGAN, KELIM_BAWAH, BELAHAN_SAMPING, LIST)',
      !!(skoderBahuDef && skoderLenganDef && kelimBawahDef && belahanSampingDef && listDef),
      JSON.stringify(newCdRes.data));

    // Skoder: duplicate spec_key lintas komponen DISENGAJA (M2-compatible).
    const skoderBahuPicker = defsForComponent(allSpecDefs, skoderBahuDef);
    const skoderBahuKeys = skoderBahuPicker.map((d) => d.spec_key);
    check('P13b. SKODER_BAHU picker: LEBAR_SKODER (cm)', skoderBahuPicker.some((d) => d.spec_key === 'LEBAR_SKODER' && d.default_unit === 'cm'), JSON.stringify(skoderBahuKeys));
    check('P13c. SKODER_BAHU picker: PANJANG_SKODER (cm)', skoderBahuPicker.some((d) => d.spec_key === 'PANJANG_SKODER' && d.default_unit === 'cm'), JSON.stringify(skoderBahuKeys));
    check('P13d. SKODER_BAHU HANYA 2 defs skoder', skoderBahuPicker.length === 2 && skoderBahuKeys.every((k) => ['LEBAR_SKODER', 'PANJANG_SKODER'].includes(k)), JSON.stringify(skoderBahuKeys));
    const skoderLenganPicker = defsForComponent(allSpecDefs, skoderLenganDef);
    const skoderLenganKeys = skoderLenganPicker.map((d) => d.spec_key);
    check('P13e. SKODER_LENGAN HANYA LEBAR/PANJANG_SKODER (duplicate intended)', skoderLenganPicker.length === 2 && skoderLenganKeys.every((k) => ['LEBAR_SKODER', 'PANJANG_SKODER'].includes(k)), JSON.stringify(skoderLenganKeys));
    check('P13f. SKODER_BAHU tidak bocor LEBAR_SAKU / STITCH_BAH', !skoderBahuKeys.includes('LEBAR_SAKU') && !skoderBahuKeys.includes('STITCH_BAH'), JSON.stringify(skoderBahuKeys));
    check('P13g. Scotchlight picker TIDAK menampilkan LEBAR_SKODER', !scotchKeys.includes('LEBAR_SKODER'), JSON.stringify(scotchKeys));

    // Kelim & Belahan & List
    const kelimPicker = defsForComponent(allSpecDefs, kelimBawahDef);
    check('P14a. KELIM_BAWAH: LEBAR_KELIM_BAWAH (cm)', kelimPicker.length === 1 && kelimPicker[0].spec_key === 'LEBAR_KELIM_BAWAH' && kelimPicker[0].default_unit === 'cm', JSON.stringify(kelimPicker.map((d) => [d.spec_key, d.value_type, d.default_unit])));
    const belahanPicker = defsForComponent(allSpecDefs, belahanSampingDef);
    check('P14b. BELAHAN_SAMPING: TINGGI_BELAHAN_SAMPING (cm)', belahanPicker.length === 1 && belahanPicker[0].spec_key === 'TINGGI_BELAHAN_SAMPING' && belahanPicker[0].default_unit === 'cm', JSON.stringify(belahanPicker.map((d) => [d.spec_key, d.value_type])));
    const listPicker = defsForComponent(allSpecDefs, listDef);
    const listKeys = listPicker.map((d) => d.spec_key);
    check('P14c. LIST: WARNA_LIST (TEXT)', listPicker.some((d) => d.spec_key === 'WARNA_LIST' && d.value_type === 'TEXT'), JSON.stringify(listKeys));
    check('P14d. LIST: LEBAR_LIST (cm)', listPicker.some((d) => d.spec_key === 'LEBAR_LIST' && d.default_unit === 'cm'), JSON.stringify(listKeys));
    check('P14e. LIST hanya 2 defs (reusable single component — bukan per lokasi)', listPicker.length === 2, JSON.stringify(listKeys));

    // Plaket dalam/luar + legacy
    const plaketPicker = defsForComponent(allSpecDefs, plaketDef);
    const plaketKeys = plaketPicker.map((d) => d.spec_key);
    check('P15a. PLAKET: LEBAR_PLAKET_DALAM (cm)', plaketPicker.some((d) => d.spec_key === 'LEBAR_PLAKET_DALAM' && d.default_unit === 'cm'), JSON.stringify(plaketKeys));
    check('P15b. PLAKET: LEBAR_PLAKET_LUAR (cm)', plaketPicker.some((d) => d.spec_key === 'LEBAR_PLAKET_LUAR' && d.default_unit === 'cm'), JSON.stringify(plaketKeys));
    check('P15c. LEBAR_PLAKET legacy tetap ADA & aktif (tidak di-deactivate)', plaketPicker.some((d) => d.spec_key === 'LEBAR_PLAKET' && d.is_active !== false), JSON.stringify(plaketKeys));

    // Slit lengan — PANJANG, TANPA UKURAN_KOTAK_SLIT
    const slitPicker = defsForComponent(allSpecDefs, slitLenganDef);
    check('P16a. SLIT_LENGAN: PANJANG_SLIT_LENGAN (cm)', slitPicker.length === 1 && slitPicker[0].spec_key === 'PANJANG_SLIT_LENGAN' && slitPicker[0].default_unit === 'cm', JSON.stringify(slitPicker.map((d) => d.spec_key)));
    check('P16b. UKURAN_KOTAK_SLIT TIDAK dibuat (menunggu verifikasi user)', !allSpecDefs.some((d) => d.spec_key === 'UKURAN_KOTAK_SLIT'), '=' + JSON.stringify(allSpecDefs.filter((d) => d.spec_key.includes('KOTAK')).map((d) => d.spec_key)));

    // Scotchlight: 2 defs baru (JARAK + KONTINUITAS SELECT), existing tetap
    check('P17a. SCOTCHLIGHT: JARAK_SCOTCHLIGHT_DARI_BAHU (cm)', scotchPicker.some((d) => d.spec_key === 'JARAK_SCOTCHLIGHT_DARI_BAHU' && d.default_unit === 'cm'), JSON.stringify(scotchKeys));
    const kontinuitasDef = scotchPicker.find((d) => d.spec_key === 'KONTINUITAS_SCOTCHLIGHT_PLAKET');
    const kontOpts = kontinuitasDef?.options_json || [];
    const kontVals = kontOpts.map((o) => o.value);
    check('P17b. KONTINUITAS_SCOTCHLIGHT_PLAKET: value_type SELECT', kontinuitasDef?.value_type === 'SELECT', JSON.stringify(kontinuitasDef));
    check('P17c. KONTINUITAS options: MENYAMBUNG_TIDAK_TERPUTUS & TERPUTUS_DI_PLAKET', kontVals.includes('MENYAMBUNG_TIDAK_TERPUTUS') && kontVals.includes('TERPUTUS_DI_PLAKET'), JSON.stringify(kontVals));
    check('P17d. KONTINUITAS labels user-facing', kontOpts.some((o) => o.value === 'MENYAMBUNG_TIDAK_TERPUTUS' && o.label.includes('Menyambung')) && kontOpts.some((o) => o.value === 'TERPUTUS_DI_PLAKET' && o.label.includes('Terputus di Plaket')), JSON.stringify(kontOpts));
    check('P17e. POSISI_SCOTCHLIGHT TETAP ada (tidak di-deactivate)', scotchKeys.includes('POSISI_SCOTCHLIGHT') && scotchPicker.find((d) => d.spec_key === 'POSISI_SCOTCHLIGHT').is_active !== false, JSON.stringify(scotchKeys));
    check('P17f. SCOTCHLIGHT kini 6 defs (4 existing + 2 baru), tidak bocor', scotchPicker.length === 6 && scotchPicker.every((d) => d.component_definition_id === scotchDef), JSON.stringify(scotchKeys));

    // Bordir: 4 defs baru, existing tetap
    const bordirPicker = defsForComponent(allSpecDefs, bordirDef);
    const bordirKeys = bordirPicker.map((d) => d.spec_key);
    check('P18a. BORDIR: JENIS_BORDIR (TEXT)', bordirPicker.some((d) => d.spec_key === 'JENIS_BORDIR' && d.value_type === 'TEXT'), JSON.stringify(bordirKeys));
    check('P18b. BORDIR: REFERENSI_POSISI_BORDIR (TEXT)', bordirPicker.some((d) => d.spec_key === 'REFERENSI_POSISI_BORDIR' && d.value_type === 'TEXT'), JSON.stringify(bordirKeys));
    check('P18c. BORDIR: JARAK_BORDIR_DARI_REFERENSI (cm)', bordirPicker.some((d) => d.spec_key === 'JARAK_BORDIR_DARI_REFERENSI' && d.default_unit === 'cm'), JSON.stringify(bordirKeys));
    const arahDef = bordirPicker.find((d) => d.spec_key === 'ARAH_POSISI_BORDIR');
    const arahVals = (arahDef?.options_json || []).map((o) => o.value);
    check('P18d. ARAH_POSISI_BORDIR: SELECT + 4 opsi (DI_ATAS/DI_BAWAH/DI_KIRI/DI_KANAN)',
      arahDef?.value_type === 'SELECT' && arahVals.length === 4 && ['DI_ATAS', 'DI_BAWAH', 'DI_KIRI', 'DI_KANAN'].every((v) => arahVals.includes(v)), JSON.stringify(arahVals));
    check('P18e. ARAH_POSISI_BORDIR labels user-facing (Di Atas dll)',
      (arahDef?.options_json || []).every((o) => o.label.startsWith('Di ')), JSON.stringify(arahDef?.options_json || []));
    check('P18f. BORDIR existing ARTWORK/UKURAN/POSISI tetap ada', ['ARTWORK_BORDIR', 'UKURAN_BORDIR', 'POSISI_BORDIR'].every((k) => bordirKeys.includes(k)), JSON.stringify(bordirKeys));
    check('P18g. BORDIR kini 7 defs, tidak bocor', bordirPicker.length === 7 && bordirPicker.every((d) => d.component_definition_id === bordirDef), JSON.stringify(bordirKeys));

    // Konstruksi saku — field terpisah (JANGAN digabung jadi "Tempel (Dijepit)")
    const sakuPickerAfter = defsForComponent(allSpecDefs, sakuDadaDef);
    const konstruksiDef = sakuPickerAfter.find((d) => d.spec_key === 'KONSTRUKSI_SAKU');
    check('P19a. SAKU_DADA: KONSTRUKSI_SAKU (TEXT) ada', !!(konstruksiDef && konstruksiDef.value_type === 'TEXT'), JSON.stringify(sakuPickerAfter.map((d) => d.spec_key)));
    check('P19b. KONSTRUKSI_SAKU label terpisah (bukan "Tempel (Dijepit)" satu field)', konstruksiDef && konstruksiDef.spec_label === 'Konstruksi / Pemasangan Saku' && !['Tempel (Dijepit)', 'Tempel(Dijepit)'].includes(konstruksiDef.spec_label), JSON.stringify(konstruksiDef));
    check('P19c. SAKU_DADA kini 4 defs (MODEL/LEBAR/TINGGI + KONSTRUKSI)', sakuPickerAfter.length === 4, JSON.stringify(sakuPickerAfter.map((d) => d.spec_key)));

    // M1/M2 defs tidak berubah
    check('P20a. M2 defs KERAH masih utuh (MODEL+TINGGI, persis 2)', defsForComponent(allSpecDefs, kerahDef).length === 2 && defsForComponent(allSpecDefs, kerahDef).every((d) => ['MODEL_KERAH', 'TINGGI_KERAH'].includes(d.spec_key)), JSON.stringify(defsForComponent(allSpecDefs, kerahDef).map((d) => d.spec_key)));
    check('P20b. MANSET defs masih utuh (TINGGI+LEBAR, persis 2)', defsForComponent(allSpecDefs, mansetDef).length === 2, JSON.stringify(defsForComponent(allSpecDefs, mansetDef).map((d) => d.spec_key)));

    // ============================================================
    // 24-26. RLS
    // ============================================================
    const anonH = { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY, 'Content-Type': 'application/json' };
    // 24. anonymous write rejected
    const anonWrite = await post('/rest/v1/ppm_spec_templates', { code: 'ANON_' + RUN_ID, name: 'anon', is_active: true }, anonH);
    check('24. anonymous write ditolak (RLS)', !anonWrite.ok && (anonWrite.status === 401 || anonWrite.status === 403), `status=${anonWrite.status} ${JSON.stringify(anonWrite.data).slice(0, 120)}`);
    // 25. non-super write must fail — structural: policy super_admin-only
    //     untuk manage + authenticated-only untuk read. exec_sql SELECT
    //     mengembalikan 204 tanpa rows, jadi DO block yang RAISE EXCEPTION
    //     (mirror verify-ppm-m45a-migration.js).
    const polSql = `
      DO $pol$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies
          WHERE tablename='ppm_spec_templates' AND policyname='ppm_spec_templates: authenticated read')
          THEN RAISE EXCEPTION 'MISSING_POLICY: authenticated read';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies
          WHERE tablename='ppm_spec_templates' AND policyname='ppm_spec_templates: super_admin manage')
          THEN RAISE EXCEPTION 'MISSING_POLICY: super_admin manage';
        END IF;
        IF (SELECT count(*) FROM pg_policies WHERE tablename IN
            ('ppm_spec_templates','ppm_spec_template_components','ppm_spec_template_specs',
             'ppm_company_technical_standards','ppm_company_technical_standard_specs')) <> 10
          THEN RAISE EXCEPTION 'MISSING_POLICY: expected 10 policies';
        END IF;
      END
      $pol$;`;
    const polRes = await execSql(polSql);
    check('25. policy template: authenticated read + super_admin manage (non-super write must fail)',
      polRes.ok, `status=${polRes.status}`);
    // 26. anon read filtered (0 rows — RLS Pattern A denies anonymous)
    const anonRead = await get('/rest/v1/ppm_spec_templates?select=id&code=eq.' + tplCode, anonH);
    check('26. anonymous read = 0 rows (RLS aktif)', (anonRead.data || []).length === 0, JSON.stringify(anonRead.data));

    // 27. cleanup — hapus dari children ke parents (cascade). RLS: service role bypass.
    console.log('  --- cleanup ---');
    // Specs & components terhapus otomatis oleh CASCADE dari template/standard.
    const delTpl = await del('/rest/v1/ppm_spec_templates?id=eq.' + tpl.id);
    check('27a. template (dengan komponen+spec) terhapus bersih', delTpl.ok, `status=${delTpl.status}`);
    const delStd = await del('/rest/v1/ppm_company_technical_standards?id=eq.' + std.id);
    check('27b. standard (dengan specs) terhapus bersih', delStd.ok, `status=${delStd.status}`);

    // marker sweep — pastikan tidak ada sisa
    const sweep1 = await get('/rest/v1/ppm_spec_templates?select=id&code=like.*' + RUN_ID + '*');
    const sweep2 = await get('/rest/v1/ppm_company_technical_standards?select=id&code=like.*' + RUN_ID + '*');
    check('27c. marker sweep: tidak ada sisa template/standard test', (sweep1.data || []).length === 0 && (sweep2.data || []).length === 0, JSON.stringify({ t: sweep1.data, s: sweep2.data }));

  } catch (error) {
    failed++;
    console.error('FATAL:', error.message);
    console.error('  cleanup partial IDs:', JSON.stringify(cleanupIds).slice(0, 400));
  } finally {
    // Best-effort cleanup by ID (cascade handles children).
    for (const id of cleanupIds.specs) await del('/rest/v1/ppm_spec_template_specs?id=eq.' + id);
    for (const id of cleanupIds.components) await del('/rest/v1/ppm_spec_template_components?id=eq.' + id);
    for (const id of cleanupIds.templates) await del('/rest/v1/ppm_spec_templates?id=eq.' + id);
    for (const id of cleanupIds.standardSpecs) await del('/rest/v1/ppm_company_technical_standard_specs?id=eq.' + id);
    for (const id of cleanupIds.standards) await del('/rest/v1/ppm_company_technical_standards?id=eq.' + id);
    console.log(`\nResult: ${passed} PASS / ${failed} FAIL`);
    process.exit(failed === 0 ? 0 : 1);
  }
})();
