import { SUPABASE_URL as url, SUPABASE_SERVICE_KEY as SERVICE_KEY, SUPABASE_ANON_KEY as ANON_KEY, assertServiceKey } from './_ppm-env.js';
// ============================================================
// PPM M4.5A.1 Integration Test — Simple Conditional Technical
// Standards V1 (ONE CONDITION -> ONE RESULT, operator EQUALS)
//
// Menguji:
//   1.  create conditional rule (setup mustCreate invariant)
//   2.  NUMBER condition typed benar
//   3.  TEXT result typed benar
//   4.  lebar 1 inch -> Single Stitch (pure evaluator)
//   5.  lebar 2 inch -> Double Stitch
//   6.  lebar tidak dikenal -> tidak ada hasil
//   7.  condition & result spec milik komponen rule
//   8.  cross-component DITOLAK (trigger DB)
//   9.  duplicate rule DITOLAK (unique index)
//   10. aturan bertentangan DITOLAK (unique index — satu kondisi per standard)
//   11. aturan nonaktif diabaikan evaluator
//   12. Simple Standard (FIXED) TETAP berfungsi
//   13. contextual picker tetap benar (master patch + M4.5A)
//   14. evaluator TIDAK memutasi input
//   15. anon write ditolak (RLS)
//   16. non-super write ditolak (policy structure)
//   17. authenticated ACTIVE read allowed (policy structure)
//   18. cleanup aman (marker sweep, bukan by nama bisnis)
//
// RULES YANG DI-SEED DI TEST INI (contoh Harmas nyata, Part K):
//   RULE 1: JIKA LEBAR_SCOTCHLIGHT = 1 inch MAKA STITCH_SCOTCHLIGHT = Single Stitch
//   RULE 2: JIKA LEBAR_SCOTCHLIGHT = 2 inch MAKA STITCH_SCOTCHLIGHT = Double Stitch
// Company Technical Standard — BUKAN template default, BUKAN WIKA
// customer model (override tidak dibuat di sini; M4.5B yang compose).
// ============================================================

import {
  evaluateTechnicalStandardRules,
  ruleConditionValue,
  ruleResultValue,
  typedValuesEqual,
  formatRuleValue,
  ruleUnitLabel,
  validateTechnicalStandardRules,
} from '../src/lib/ppm-m45a1-rules.js';
import { defsForComponent } from '../src/lib/ppm-m45a-specs.js';

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
const cleanupIds = { standards: [], standardSpecs: [], rules: [] };
const RUN_ID = `__TEST_M45A1__${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function check(name, condition, detail = '') {
  if (condition) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name, detail); }
}

function mustCreate(res, label) {
  const row = Array.isArray(res.data) ? res.data[0] : res.data;
  const ok = res.ok && !!row && !!row.id;
  check('Setup: ' + label + ' berhasil dibuat', ok, `status=${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
  if (!ok) throw new Error('SETUP FAILED: ' + label + ' (status=' + res.status + '). Test dihentikan segera.');
  return row;
}

async function execSql(sql) {
  const r = await post('/rest/v1/rpc/exec_sql', { sql }, svcH);
  return r;
}

// typed value payload per prefix (condition_*/result_*)
function typedPayload(prefix, valueType, value) {
  switch (valueType) {
    case 'NUMBER': return { [prefix + 'value_number']: value === '' || value === null || value === undefined ? null : Number(value) };
    case 'BOOLEAN': return { [prefix + 'value_boolean']: !!value };
    case 'SELECT': return { [prefix + 'value_json']: value === '' || value === null || value === undefined ? null : value };
    case 'MULTI_SELECT': return { [prefix + 'value_json']: Array.isArray(value) ? value : (value ? [value] : null) };
    case 'TEXT':
    default: return { [prefix + 'value_text']: value === '' || value === null || value === undefined ? null : String(value) };
  }
}

function rulePayload(std, comp, condDef, condVal, resDef, resVal, sort = 0) {
  return {
    standard_id: std.id,
    component_definition_id: comp,
    condition_specification_definition_id: condDef.id,
    condition_spec_key_snapshot: condDef.spec_key,
    condition_spec_label_snapshot: condDef.spec_label,
    condition_operator: 'EQUALS',
    condition_value_type: condDef.value_type,
    condition_unit: condDef.default_unit || null,
    ...typedPayload('condition_', condDef.value_type, condVal),
    result_specification_definition_id: resDef.id,
    result_spec_key_snapshot: resDef.spec_key,
    result_spec_label_snapshot: resDef.spec_label,
    result_value_type: resDef.value_type,
    result_unit: resDef.default_unit || null,
    ...typedPayload('result_', resDef.value_type, resVal),
    sort_order: sort,
    is_active: true,
  };
}

(async () => {
  console.log('RUN_ID:', RUN_ID);
  try {
    // ============================================================
    // SETUP: master refs
    // ============================================================
    const ptRes = await get('/rest/v1/product_types?select=id,code&code=eq.KEMEJA_LAPANGAN');
    const pt = ptRes.data?.[0];
    check('Setup: KEMEJA_LAPANGAN ada', !!pt, JSON.stringify(ptRes.data));

    const cdRes = await get('/rest/v1/component_definitions?select=id,code&code=in.(SCOTCHLIGHT,KERAH,SKODER_BAHU,BORDIR)');
    const cdMap = {};
    (cdRes.data || []).forEach((r) => { cdMap[r.code] = r.id; });
    const scotchDef = cdMap['SCOTCHLIGHT'];
    const kerahDef = cdMap['KERAH'];
    const skoderBahuDef = cdMap['SKODER_BAHU'];
    const bordirDef = cdMap['BORDIR'];
    check('Setup: SCOTCHLIGHT & KERAH & SKODER_BAHU & BORDIR ada', !!(scotchDef && kerahDef && skoderBahuDef && bordirDef), JSON.stringify(cdRes.data));

    const sdRes = await get('/rest/v1/component_specification_definitions?select=id,spec_key,spec_label,value_type,default_unit,options_json,component_definition_id&component_definition_id=in.(' + scotchDef + ',' + kerahDef + ',' + skoderBahuDef + ',' + bordirDef + ')');
    const allDefs = sdRes.data || [];
    const scotchDefs = allDefs.filter((d) => d.component_definition_id === scotchDef);
    const lebarDef = scotchDefs.find((d) => d.spec_key === 'LEBAR_SCOTCHLIGHT');
    const stitchDef = scotchDefs.find((d) => d.spec_key === 'STITCH_SCOTCHLIGHT');
    const kontinuitasDef = scotchDefs.find((d) => d.spec_key === 'KONTINUITAS_SCOTCHLIGHT_PLAKET');
    const jarakDef = scotchDefs.find((d) => d.spec_key === 'JARAK_SCOTCHLIGHT_DARI_BAHU');
    const tinggiKerahDef = allDefs.find((d) => d.spec_key === 'TINGGI_KERAH');
    check('Setup: LEBAR_SCOTCHLIGHT (NUMBER inch) ada', !!(lebarDef && lebarDef.value_type === 'NUMBER' && lebarDef.default_unit === 'inch'), JSON.stringify(scotchDefs.map((d) => d.spec_key)));
    check('Setup: STITCH_SCOTCHLIGHT (TEXT) ada', !!(stitchDef && stitchDef.value_type === 'TEXT'), JSON.stringify(scotchDefs.map((d) => d.spec_key)));
    check('Setup: KONTINUITAS_SCOTCHLIGHT_PLAKET (SELECT) ada', !!(kontinuitasDef && kontinuitasDef.value_type === 'SELECT'), JSON.stringify(scotchDefs.map((d) => d.spec_key)));
    check('Setup: JARAK_SCOTCHLIGHT_DARI_BAHU (NUMBER cm) ada', !!(jarakDef && jarakDef.value_type === 'NUMBER' && jarakDef.default_unit === 'cm'), JSON.stringify(scotchDefs.map((d) => d.spec_key)));
    check('Setup: TINGGI_KERAH (cross-component fixture) ada', !!tinggiKerahDef, JSON.stringify(allDefs.map((d) => d.spec_key)));

    // ============================================================
    // 1-3. CREATE CONDITIONAL RULES (typed)
    // ============================================================
    const stdCode = 'STD_' + RUN_ID.replace(/\W/g, '').slice(0, 22);
    const std = mustCreate(await post('/rest/v1/ppm_company_technical_standards', {
      code: stdCode,
      name: 'Standar Scotchlight Test ' + RUN_ID,
      description: 'test fixture M4.5A.1',
      product_type_id: pt.id,
      standard_type: 'CONDITIONAL',
      is_active: true,
    }), 'standard CONDITIONAL');
    cleanupIds.standards.push(std.id);

    const rule1 = mustCreate(await post('/rest/v1/ppm_company_technical_standard_rules',
      rulePayload(std, scotchDef, lebarDef, 1, stitchDef, 'Single Stitch', 0)), 'rule 1 inch -> Single Stitch');
    cleanupIds.rules.push(rule1.id);
    const rule2 = mustCreate(await post('/rest/v1/ppm_company_technical_standard_rules',
      rulePayload(std, scotchDef, lebarDef, 2, stitchDef, 'Double Stitch', 1)), 'rule 2 inch -> Double Stitch');
    cleanupIds.rules.push(rule2.id);
    check('1. conditional rule dibuat (standard_type=CONDITIONAL)', std.standard_type === 'CONDITIONAL', JSON.stringify(std));
    check('2. condition NUMBER typed benar (LEBAR_SCOTCHLIGHT=1, unit inch)',
      Number(rule1.condition_value_number) === 1 && rule1.condition_value_type === 'NUMBER' && rule1.condition_unit === 'inch',
      JSON.stringify(rule1));
    check('3. result TEXT typed benar (STITCH=Single Stitch)',
      rule1.result_value_text === 'Single Stitch' && rule1.result_value_type === 'TEXT',
      JSON.stringify(rule1));
    check('   operator EQUALS tersimpan', rule1.condition_operator === 'EQUALS', rule1.condition_operator);

    // Fixtures unit-context (manual verification bugfix 2026-08-13):
    // rule3 JIKA JARAK=10 (cm) MAKA STITCH=Double Stitch;
    // rule4 JIKA STITCH=Single Stitch MAKA LEBAR=1 (inch).
    const rule3 = mustCreate(await post('/rest/v1/ppm_company_technical_standard_rules',
      rulePayload(std, scotchDef, jarakDef, 10, stitchDef, 'Double Stitch', 3)), 'rule 10 cm jarak -> Double Stitch');
    cleanupIds.rules.push(rule3.id);
    const rule4 = mustCreate(await post('/rest/v1/ppm_company_technical_standard_rules',
      rulePayload(std, scotchDef, stitchDef, 'Single Stitch', lebarDef, 1, 4)), 'rule stitch Single -> lebar 1');
    cleanupIds.rules.push(rule4.id);

    // ============================================================
    // 4-6. PURE EVALUATOR (lebar -> stitch)
    // ============================================================
    const eval1 = evaluateTechnicalStandardRules({ rules: [rule1, rule2], valuesBySpecKey: { LEBAR_SCOTCHLIGHT: 1 } });
    check('4. lebar 1 inch -> STITCH_SCOTCHLIGHT = Single Stitch',
      eval1.byResultKey['STITCH_SCOTCHLIGHT']?.value === 'Single Stitch' && eval1.matched.length === 1,
      JSON.stringify(eval1.byResultKey));
    const eval2 = evaluateTechnicalStandardRules({ rules: [rule1, rule2], valuesBySpecKey: { LEBAR_SCOTCHLIGHT: 2 } });
    check('5. lebar 2 inch -> STITCH_SCOTCHLIGHT = Double Stitch',
      eval2.byResultKey['STITCH_SCOTCHLIGHT']?.value === 'Double Stitch' && eval2.matched.length === 1,
      JSON.stringify(eval2.byResultKey));
    const eval3 = evaluateTechnicalStandardRules({ rules: [rule1, rule2], valuesBySpecKey: { LEBAR_SCOTCHLIGHT: 3 } });
    check('6. lebar tidak dikenal (3 inch) -> TIDAK ada hasil',
      eval3.matched.length === 0 && !eval3.byResultKey['STITCH_SCOTCHLIGHT'],
      JSON.stringify(eval3.byResultKey));
    const eval3b = evaluateTechnicalStandardRules({ rules: [rule1, rule2], valuesBySpecKey: { LEBAR_SCOTCHLIGHT: 1.5 } });
    check('6b. lebar 1.5 inch -> TIDAK ada hasil (equality numerik tepat)',
      eval3b.matched.length === 0, JSON.stringify(eval3b.byResultKey));

    // 7. condition & result spec milik komponen rule (SCOTCHLIGHT)
    const condBelong = allDefs.find((d) => d.id === rule1.condition_specification_definition_id)?.component_definition_id;
    const resBelong = allDefs.find((d) => d.id === rule1.result_specification_definition_id)?.component_definition_id;
    check('7. condition & result spec milik komponen rule (SCOTCHLIGHT)',
      condBelong === scotchDef && resBelong === scotchDef,
      JSON.stringify({ condBelong, resBelong, scotchDef }));

    // 8. cross-component DITOLAK — trigger DB (Scotchlight rule dengan condition TINGGI_KERAH)
    const crossRule = await post('/rest/v1/ppm_company_technical_standard_rules',
      rulePayload(std, scotchDef, tinggiKerahDef, 5, stitchDef, 'Single Stitch', 9));
    check('8. cross-component rule DITOLAK (TINGGI_KERAH di rule SCOTCHLIGHT)',
      !crossRule.ok && crossRule.status >= 400,
      `status=${crossRule.status} ${JSON.stringify(crossRule.data).slice(0, 200)}`);
    const crossDetail = JSON.stringify(crossRule.data || '');
    check('8b. pesan error menyebut CONDITION_COMPONENT_MISMATCH', crossDetail.includes('CONDITION_COMPONENT_MISMATCH'), crossDetail.slice(0, 200));

    // 9. duplicate rule DITOLAK (sama persis)
    const dupRule = await post('/rest/v1/ppm_company_technical_standard_rules',
      rulePayload(std, scotchDef, lebarDef, 1, stitchDef, 'Single Stitch', 9));
    check('9. duplicate rule DITOLAK (409 unique)',
      !dupRule.ok && dupRule.status === 409, `status=${dupRule.status} ${JSON.stringify(dupRule.data).slice(0, 120)}`);

    // 10. kontradiksi DITOLAK (kondisi sama, hasil beda)
    const contraRule = await post('/rest/v1/ppm_company_technical_standard_rules',
      rulePayload(std, scotchDef, lebarDef, 2, stitchDef, 'Triple Stitch', 9));
    check('10. aturan bertentangan DITOLAK (1 kondisi hanya 1 hasil per standard)',
      !contraRule.ok && contraRule.status === 409, `status=${contraRule.status} ${JSON.stringify(contraRule.data).slice(0, 120)}`);

    // 10b. kondisi berbeda -> hasil sama/allowed (bukan konflik)
    const okRule = await post('/rest/v1/ppm_company_technical_standard_rules',
      rulePayload(std, scotchDef, kontinuitasDef, 'TERPUTUS_DI_PLAKET', stitchDef, 'Single Stitch', 2));
    check('10b. kondisi berbeda (KONTINUITAS=TERPUTUS) dengan hasil sama → diperbolehkan',
      okRule.ok && okRule.data?.[0]?.id, `status=${okRule.status} ${JSON.stringify(okRule.data).slice(0, 160)}`);

    // 11. aturan nonaktif diabaikan
    const deact = await patch('/rest/v1/ppm_company_technical_standard_rules?id=eq.' + rule2.id, { is_active: false });
    check('11a. rule2 dinonaktifkan', deact.ok && deact.data?.[0]?.is_active === false, JSON.stringify(deact.data));
    const rule2Inactive = deact.data?.[0] || { ...rule2, is_active: false };
    const evalInactive = evaluateTechnicalStandardRules({ rules: [rule1, rule2Inactive], valuesBySpecKey: { LEBAR_SCOTCHLIGHT: 2 } });
    check('11b. aturan nonaktif DIABAIKAN evaluator (2 inch -> tidak ada hasil)',
      evalInactive.matched.length === 0 && !evalInactive.byResultKey['STITCH_SCOTCHLIGHT'],
      JSON.stringify(evalInactive.byResultKey));
    const react = await patch('/rest/v1/ppm_company_technical_standard_rules?id=eq.' + rule2.id, { is_active: true });
    check('11c. rule2 re-aktif', react.ok && react.data?.[0]?.is_active === true, JSON.stringify(react.data));
    const rule2Active = react.data?.[0] || rule2;

    // 12. Simple Standard (FIXED) TETAP berfungsi
    const fixedStd = mustCreate(await post('/rest/v1/ppm_company_technical_standards', {
      code: 'STD_FIXED_' + RUN_ID.replace(/\W/g, '').slice(0, 18),
      name: 'Fixed Standard Test ' + RUN_ID,
      standard_type: 'FIXED',
      is_active: true,
    }), 'standard FIXED');
    cleanupIds.standards.push(fixedStd.id);
    await post('/rest/v1/ppm_company_technical_standard_specs', {
      standard_id: fixedStd.id,
      component_definition_id: null,
      specification_definition_id: null,
      spec_key_snapshot: 'STITCH_DOUBLE',
      value_type: 'TEXT',
      ...typedPayload('', 'TEXT', 'Double Stitch'),
      is_required: false,
    });
    const fixedSpecs = await get('/rest/v1/ppm_company_technical_standard_specs?select=value_text,spec_key_snapshot&standard_id=eq.' + fixedStd.id);
    check('12a. Simple Standard FIXED masih bisa dibuat + spec tersimpan',
      fixedSpecs.data?.some((s) => s.spec_key_snapshot === 'STITCH_DOUBLE' && s.value_text === 'Double Stitch'),
      JSON.stringify(fixedSpecs.data));
    const fixedRead = await get('/rest/v1/ppm_company_technical_standards?select=standard_type&id=eq.' + fixedStd.id);
    check('12b. standard_type default FIXED (backfill existing aman)',
      fixedRead.data?.[0]?.standard_type === 'FIXED', JSON.stringify(fixedRead.data));
    const badType = await post('/rest/v1/ppm_company_technical_standards', { code: 'STD_BAD_' + RUN_ID, name: 'bad', standard_type: 'SCRIPT' });
    check('12c. standard_type VALIDASI: nilai di luar FIXED/CONDITIONAL ditolak',
      !badType.ok && badType.status >= 400, `status=${badType.status} ${JSON.stringify(badType.data).slice(0, 120)}`);

    // 12d. standard CONDITIONAL TIDAK berisi simple spec (tipe eksklusif)
    const condSpecs = await get('/rest/v1/ppm_company_technical_standard_specs?select=id&standard_id=eq.' + std.id);
    check('12d. conditional standard tidak punya simple specs (eksklusif tipe)', (condSpecs.data || []).length === 0, JSON.stringify(condSpecs.data));

    // 13. contextual picker tetap benar (master patch tetap utuh)
    const scotchPicker = defsForComponent(allDefs, scotchDef);
    const skoderPicker = defsForComponent(allDefs, skoderBahuDef);
    const bordirPicker = defsForComponent(allDefs, bordirDef);
    check('13a. SCOTCHLIGHT picker HANYA spec Scotchlight (6 defs, tidak bocor)',
      scotchPicker.length === 6 && scotchPicker.every((d) => d.component_definition_id === scotchDef),
      JSON.stringify(scotchPicker.map((d) => d.spec_key)));
    check('13b. SKODER_BAHU picker HANYA LEBAR/PANJANG_SKODER',
      skoderPicker.length === 2 && skoderPicker.every((d) => ['LEBAR_SKODER', 'PANJANG_SKODER'].includes(d.spec_key)),
      JSON.stringify(skoderPicker.map((d) => d.spec_key)));
    check('13c. BORDIR picker HANYA 7 defs Bordir (tidak bocor Scotchlight)',
      bordirPicker.length === 7 && bordirPicker.every((d) => d.component_definition_id === bordirDef),
      JSON.stringify(bordirPicker.map((d) => d.spec_key)));
    check('13d. SCOTCHLIGHT picker TIDAK menampilkan TINGGI_KERAH',
      !scotchPicker.some((d) => d.spec_key === 'TINGGI_KERAH'), JSON.stringify(scotchPicker.map((d) => d.spec_key)));

    // ============================================================
    // UNIT CONTEXT (manual verification bugfix 2026-08-13):
    //   - suffix unit dirender dari SNAPSHOT definition (default_unit),
    //     bukan hardcode — ruleUnitLabel(rule, side).
    //   - unit tersimpan di payload & tetap ada setelah save/refresh.
    //   - kehadiran unit TIDAK mengubah semantik evaluator (matching
    //     hanya memakai nilai typed).
    // ============================================================
    check('U1. unit LEBAR_SCOTCHLIGHT (inch) tersimpan di condition rule (snapshot)',
      rule1.condition_unit === 'inch' && rule1.condition_value_type === 'NUMBER',
      JSON.stringify({ unit: rule1.condition_unit, type: rule1.condition_value_type }));
    check('U2. LEBAR_SCOTCHLIGHT -> suffix "inch"', ruleUnitLabel(rule1, 'condition') === 'inch', ruleUnitLabel(rule1, 'condition'));
    check('U3. JARAK_SCOTCHLIGHT_DARI_BAHU -> suffix "cm"', ruleUnitLabel(rule3, 'condition') === 'cm', ruleUnitLabel(rule3, 'condition'));
    check('U4. STITCH_SCOTCHLIGHT (TEXT tanpa unit) -> TIDAK ada suffix', ruleUnitLabel(rule4, 'condition') === '', ruleUnitLabel(rule4, 'condition'));
    check('U5. result LEBAR_SCOTCHLIGHT -> suffix "inch"', ruleUnitLabel(rule4, 'result') === 'inch', ruleUnitLabel(rule4, 'result'));
    check('U6. result STITCH_SCOTCHLIGHT -> TIDAK ada suffix', ruleUnitLabel(rule3, 'result') === '', ruleUnitLabel(rule3, 'result'));

    const refetchRules = await get('/rest/v1/ppm_company_technical_standard_rules?select=id,condition_unit,result_unit&standard_id=eq.' + std.id);
    const rf1 = (refetchRules.data || []).find((x) => x.id === rule1.id);
    const rf3 = (refetchRules.data || []).find((x) => x.id === rule3.id);
    check('U7. save/refresh: unit context tetap di DB (inch & cm)',
      rf1?.condition_unit === 'inch' && rf3?.condition_unit === 'cm', JSON.stringify(refetchRules.data));
    check('U7b. refresh row -> ruleUnitLabel tetap "inch"', ruleUnitLabel(rf1, 'condition') === 'inch', '');

    const evalU1 = evaluateTechnicalStandardRules({ rules: [rule1, rule3, rule4], valuesBySpecKey: { JARAK_SCOTCHLIGHT_DARI_BAHU: 10 } });
    check('U8. evaluator TIDAK terpengaruh unit (JARAK=10 cm -> STITCH=Double Stitch)',
      evalU1.matched.length === 1 && evalU1.byResultKey['STITCH_SCOTCHLIGHT']?.value === 'Double Stitch',
      JSON.stringify(evalU1.byResultKey));
    const evalU2 = evaluateTechnicalStandardRules({ rules: [rule1, rule3, rule4], valuesBySpecKey: { STITCH_SCOTCHLIGHT: 'Single Stitch' } });
    check('U9. evaluator: unit tidak mengubah matching (STITCH=Single -> LEBAR=1)',
      evalU2.matched.length === 1 && Number(evalU2.byResultKey['LEBAR_SCOTCHLIGHT']?.value) === 1,
      JSON.stringify(evalU2.byResultKey));

    // 14. evaluator TIDAK memutasi input
    const rulesSnapshot = JSON.stringify([rule1, rule2]);
    evaluateTechnicalStandardRules({ rules: [rule1, rule2], valuesBySpecKey: { LEBAR_SCOTCHLIGHT: 2 } });
    check('14. evaluator tidak memutasi input (deep-equal sebelum/sesudah)',
      JSON.stringify([rule1, rule2]) === rulesSnapshot, 'mutated!');

    // -- pure helper spot checks ---
    const cv = ruleConditionValue(rule1);
    check('C1. ruleConditionValue NUMBER -> condition_value_number=1', cv.field === 'condition_value_number' && Number(cv.value) === 1, JSON.stringify(cv));
    const rv = ruleResultValue(rule1);
    check('C2. ruleResultValue TEXT -> result_value_text=Single Stitch', rv.field === 'result_value_text' && rv.value === 'Single Stitch', JSON.stringify(rv));
    check('C3. typedValuesEqual NUMBER (1 == 1.0)', typedValuesEqual('NUMBER', 1, 1.0) === true, '');
    check('C4. typedValuesEqual NUMBER (1 != 2)', typedValuesEqual('NUMBER', 1, 2) === false, '');
    check('C5. formatRuleValue condition NUMBER+inch', formatRuleValue(rule1, 'condition') === '1 inch', formatRuleValue(rule1, 'condition'));
    check('C6. formatRuleValue result TEXT', formatRuleValue(rule1, 'result') === 'Single Stitch', formatRuleValue(rule1, 'result'));
    check('C7. validateTechnicalStandardRules: payload valid lolos', validateTechnicalStandardRules([rule1, rule2]) === true, '');
    let vErr = '';
    try { validateTechnicalStandardRules([rule1, { ...rule1, condition_value: 1 }]); } catch (e) { vErr = e.message; }
    check('C8. validate: duplicate rule client-side DITOLAK', vErr.includes('duplikat'), vErr);
    let vErr2 = '';
    try { validateTechnicalStandardRules([rule1, { ...rule1, condition_value: 2, result_value: 'Double Stitch' }, { ...rule1, condition_value: 2, result_value: 'Triple Stitch' }]); } catch (e) { vErr2 = e.message; }
    check('C9. validate: kontradiksi client-side DITOLAK', vErr2.includes('bertentangan'), vErr2);
    let vErr3 = '';
    try { validateTechnicalStandardRules([{ ...rule1, result_value: '' }]); } catch (e) { vErr3 = e.message; }
    check('C10. validate: nilai MAKA kosong DITOLAK', vErr3.includes('nilai MAKA'), vErr3);

    // ============================================================
    // 15-17. RLS
    // ============================================================
    const anonH = { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY, 'Content-Type': 'application/json' };
    const anonWrite = await post('/rest/v1/ppm_company_technical_standard_rules',
      { standard_id: std.id, component_definition_id: scotchDef, condition_spec_key_snapshot: 'X', result_spec_key_snapshot: 'Y' }, anonH);
    check('15. anonymous write ke rules DITOLAK (RLS)',
      !anonWrite.ok && [400, 401, 403].includes(anonWrite.status), `status=${anonWrite.status} ${JSON.stringify(anonWrite.data).slice(0, 120)}`);

    const polSql = `
      DO $pol$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies
          WHERE tablename='ppm_company_technical_standard_rules'
            AND policyname='ppm_company_technical_standard_rules: authenticated read')
          THEN RAISE EXCEPTION 'MISSING_POLICY: authenticated read';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies
          WHERE tablename='ppm_company_technical_standard_rules'
            AND policyname='ppm_company_technical_standard_rules: super_admin manage')
          THEN RAISE EXCEPTION 'MISSING_POLICY: super_admin manage';
        END IF;
        IF (SELECT count(*) FROM pg_policies WHERE tablename='ppm_company_technical_standard_rules') <> 2
          THEN RAISE EXCEPTION 'MISSING_POLICY: expected 2';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies
          WHERE tablename='ppm_company_technical_standards'
            AND policyname='ppm_company_technical_standards: authenticated read')
          THEN RAISE EXCEPTION 'MISSING_POLICY-M4.5A: standards read hilang';
        END IF;
      END
      $pol$;`;
    const polRes = await execSql(polSql);
    check('16. policy rules: authenticated read + super_admin manage (non-super write must fail)',
      polRes.ok, `status=${polRes.status}`);

    const anonRead = await get('/rest/v1/ppm_company_technical_standard_rules?select=id&standard_id=eq.' + std.id, anonH);
    check('17. anonymous read rules = 0 rows (RLS Pattern A aktif)',
      (anonRead.data || []).length === 0, JSON.stringify(anonRead.data));

    // standard_type column ada di schema (structural spot)
    const colCheck = await execSql(`
      DO $c$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='ppm_company_technical_standards' AND column_name='standard_type')
          THEN RAISE EXCEPTION 'NO_STANDARD_TYPE';
        END IF;
      END
      $c$;`);
    check('S1. kolom standard_type ada di ppm_company_technical_standards', colCheck.ok, `status=${colCheck.status}`);

    // 18. cleanup — cascade rules otomatis dari standard
    console.log('  --- cleanup ---');
    const delStd = await del('/rest/v1/ppm_company_technical_standards?id=eq.' + std.id);
    const delFixed = await del('/rest/v1/ppm_company_technical_standards?id=eq.' + fixedStd.id);
    check('18a. standard CONDITIONAL (dengan rules cascade) terhapus bersih', delStd.ok, `status=${delStd.status} ${JSON.stringify(delStd.data).slice(0, 200)}`);
    check('18b. standard FIXED terhapus bersih (simple specs cascade)', delFixed.ok, `status=${delFixed.status}`);
    const leftoverRules = await get('/rest/v1/ppm_company_technical_standard_rules?select=id&standard_id=eq.' + std.id);
    check('18c. marker sweep: tidak ada sisa rules test', (leftoverRules.data || []).length === 0, JSON.stringify(leftoverRules.data));
    const leftoverStd = await get('/rest/v1/ppm_company_technical_standards?select=id&code=like.*' + RUN_ID + '*');
    check('18d. marker sweep: tidak ada sisa standard test', (leftoverStd.data || []).length === 0, JSON.stringify(leftoverStd.data));

  } catch (error) {
    failed++;
    console.error('FATAL:', error.message);
    console.error('  cleanup partial IDs:', JSON.stringify(cleanupIds).slice(0, 500));
  } finally {
    for (const id of cleanupIds.rules) await del('/rest/v1/ppm_company_technical_standard_rules?id=eq.' + id);
    for (const id of cleanupIds.standardSpecs) await del('/rest/v1/ppm_company_technical_standard_specs?id=eq.' + id);
    for (const id of cleanupIds.standards) await del('/rest/v1/ppm_company_technical_standards?id=eq.' + id);
    console.log(`\nResult: ${passed} PASS / ${failed} FAIL`);
    process.exit(failed === 0 ? 0 : 1);
  }
})();