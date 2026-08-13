// ============================================================
// PPM M4.5A.1 — pure conditional rule evaluator (V1)
//
// V1 SEMANTICS (eksplisit):
//   ONE CONDITION -> ONE RESULT. Operator EQUALS saja.
//   TIDAK ada AND/OR/nested/formula/scripting/arbitrary expression.
//
// PURE module — TANPA import apa pun (test node ESM import langsung).
// Tidak ada DB mutation / PO mutation / Customer Model mutation:
// fungsi evaluator hanya MEMBACA rules + valuesBySpecKey.
//
// PROVENANCE (future M4.5B compose — lihat Part L):
//   hasil evaluasi adalah STANDARD value. Customer explicit value yang
//   berbeda = OVERRIDE dan menang saat compose; standard TIDAK berubah.
//   Evaluator ini hanya menyediakan lapisan "applicable standard",
//   bukan precedence resolver (M4.5B).
// ============================================================

// VALUE_TYPE whitelist (mirror M2/M4.5A).
export const RULE_VALUE_TYPE = {
  TEXT: 'TEXT',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN',
  SELECT: 'SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
};

export const RULE_OPERATOR = { EQUALS: 'EQUALS' };

// Baca nilai condition dari row rule -> { field, value }.
// field = kolom typed yang dipakai (mirror standardValueInfo M4.5A).
export function ruleConditionValue(rule) {
  if (!rule) return { field: null, value: null };
  switch (rule.condition_value_type) {
    case RULE_VALUE_TYPE.NUMBER:
      return { field: 'condition_value_number', value: rule.condition_value_number };
    case RULE_VALUE_TYPE.BOOLEAN:
      return { field: 'condition_value_boolean', value: rule.condition_value_boolean };
    case RULE_VALUE_TYPE.SELECT:
    case RULE_VALUE_TYPE.MULTI_SELECT:
      return { field: 'condition_value_json', value: rule.condition_value_json };
    case RULE_VALUE_TYPE.TEXT:
    default:
      return { field: 'condition_value_text', value: rule.condition_value_text };
  }
}

// Baca nilai result dari row rule -> { field, value }.
export function ruleResultValue(rule) {
  if (!rule) return { field: null, value: null };
  switch (rule.result_value_type) {
    case RULE_VALUE_TYPE.NUMBER:
      return { field: 'result_value_number', value: rule.result_value_number };
    case RULE_VALUE_TYPE.BOOLEAN:
      return { field: 'result_value_boolean', value: rule.result_value_boolean };
    case RULE_VALUE_TYPE.SELECT:
    case RULE_VALUE_TYPE.MULTI_SELECT:
      return { field: 'result_value_json', value: rule.result_value_json };
    case RULE_VALUE_TYPE.TEXT:
    default:
      return { field: 'result_value_text', value: rule.result_value_text };
  }
}

// ============================================================
// TYPED EQUALITY — EQUALS operator
// ============================================================
function normalizeNumber(v) {
  if (v === null || v === undefined || v === '') return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

// Ekspor untuk test langsung (tipe-dan-nilai sama).
export function typedValuesEqual(valueType, a, b) {
  switch (valueType) {
    case RULE_VALUE_TYPE.NUMBER: {
      const na = normalizeNumber(a);
      const nb = normalizeNumber(b);
      return !Number.isNaN(na) && !Number.isNaN(nb) && na === nb;
    }
    case RULE_VALUE_TYPE.BOOLEAN:
      return !!a === !!b;
    case RULE_VALUE_TYPE.SELECT:
    case RULE_VALUE_TYPE.MULTI_SELECT: {
      const sa = JSON.stringify(Array.isArray(a) ? a.slice().sort() : [a]);
      const sb = JSON.stringify(Array.isArray(b) ? b.slice().sort() : [b]);
      return sa === sb;
    }
    case RULE_VALUE_TYPE.TEXT:
    default: {
      const sa = a === null || a === undefined ? '' : String(a).trim();
      const sb = b === null || b === undefined ? '' : String(b).trim();
      return sa === sb;
    }
  }
}

// Nilai display rule (string) untuk UI — format typed + unit.
export function formatRuleValue(rule, side) {
  const isCondition = side === 'condition';
  const v = isCondition ? ruleConditionValue(rule) : ruleResultValue(rule);
  const type = isCondition ? rule.condition_value_type : rule.result_value_type;
  const unit = isCondition ? rule.condition_unit : rule.result_unit;
  if (v.value === null || v.value === undefined || v.value === '') return '-';
  if (type === RULE_VALUE_TYPE.BOOLEAN) return v.value === true ? 'Ya' : 'Tidak';
  if (type === RULE_VALUE_TYPE.SELECT || type === RULE_VALUE_TYPE.MULTI_SELECT) {
    const arr = Array.isArray(v.value) ? v.value : [v.value];
    return arr.filter(Boolean).join(', ') + (unit ? ' ' + unit : '');
  }
  return String(v.value) + (unit ? ' ' + unit : '');
}

// Label unit yang dirender sebagai suffix setelah input value (JIKA/MAKA).
// Kembalikan '' bila rule/side tidak punya unit — UI TIDAK menampilkan
// suffix (TEXT tanpa unit, SELECT tanpa unit, dst). Memakai SNAPSHOT
// rule.condition_unit / rule.result_unit (bukan hardcode).
export function ruleUnitLabel(rule, side) {
  if (!rule) return '';
  const unit = side === 'result' ? rule.result_unit : rule.condition_unit;
  return (unit === null || unit === undefined ? '' : String(unit)).trim();
}

// ============================================================
// EVALUATOR — V1 (EQUALS saja)
// ============================================================
// Input:
//   rules            — rows ppm_company_technical_standard_rules
//                      (incl. snapshot + typed values + is_active)
//   valuesBySpecKey  — { [spec_key]: typedValue } dari model/input.
//                      typedValue: number utk NUMBER, boolean utk BOOLEAN,
//                      string utk TEXT/SELECT, string[] utk MULTI_SELECT.
// Output:
//   {
//     matched: [ rule, ... ]                       — aturan yang FIRE,
//                                                    urut sort_order (hanya aktif),
//     byResultKey: { [result_spec_key]: { rule, value, valueType, unit } }
//   }
// TIDAK memodifikasi input (no mutation — Part Q #14 test).
export function evaluateTechnicalStandardRules({ rules, valuesBySpecKey }) {
  if (!Array.isArray(rules) || !valuesBySpecKey) {
    return { matched: [], byResultKey: {} };
  }
  const matched = rules
    .filter((r) => r && r.is_active !== false)
    // V1: semua rule EQUALS (CHECK constraint memastikan; non-EQUALS
    // dianggap tidak applicable — masukan di luar kontrak V1).
    .filter((r) => !r.condition_operator || r.condition_operator === RULE_OPERATOR.EQUALS)
    .filter((r) => {
      const actual = valuesBySpecKey[r.condition_spec_key_snapshot];
      if (actual === undefined || actual === null) return false;
      return typedValuesEqual(r.condition_value_type, ruleConditionValue(r).value, actual);
    })
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const byResultKey = {};
  for (const rule of matched) {
    const { value } = ruleResultValue(rule);
    byResultKey[rule.result_spec_key_snapshot] = {
      rule,
      value,
      valueType: rule.result_value_type,
      unit: rule.result_unit || null,
    };
  }
  return { matched, byResultKey };
}

// Versi ringkas: evaluasi lalu ambil nilai per key (untuk compose M4.5B).
export function evaluateStandardResultKeys(rules, valuesBySpecKey) {
  const { byResultKey } = evaluateTechnicalStandardRules({ rules, valuesBySpecKey });
  const out = {};
  for (const [k, entry] of Object.entries(byResultKey)) out[k] = entry.value;
  return out;
}

// ============================================================
// VALIDATION (client-side, friendly) — V1 aturan bersyarat
//   - komponen, condition & result spec WAJIB terisi (nilai juga)
//   - condition/result spec harus milik komponen rule
//   - duplicate rule diblokir (kondisi + nilai typed sama)
//   - kontradiksi diblokir (kondisi sama, result berbeda)
// DB tetap penjaga terakhir (unique index + trigger).
// ============================================================
function hasValue(val, valueType) {
  if (val === null || val === undefined) return false;
  if (valueType === RULE_VALUE_TYPE.NUMBER) return val !== '';
  if (valueType === RULE_VALUE_TYPE.BOOLEAN) return typeof val === 'boolean';
  if (valueType === RULE_VALUE_TYPE.MULTI_SELECT) return Array.isArray(val) && val.length > 0;
  return val !== '';
}

// Terima dua shape: UI row ({ condition_value, result_value }) maupun
// DB row (condition_value_*, result_value_* typed columns).
function uiConditionValue(r) {
  return r.condition_value !== undefined ? r.condition_value : ruleConditionValue(r).value;
}
function uiResultValue(r) {
  return r.result_value !== undefined ? r.result_value : ruleResultValue(r).value;
}

export function validateTechnicalStandardRules(rules) {
  const seen = [];
  for (const r of rules || []) {
    const cLabel = r.condition_spec_label_snapshot || '-';
    const condValue = uiConditionValue(r);
    const resValue = uiResultValue(r);
    if (!r.component_definition_id) throw new Error('Setiap aturan wajib memilih komponen');
    if (!r.condition_specification_definition_id) throw new Error(`Aturan ${cLabel}: spec JIKA (kondisi) wajib dipilih`);
    if (!hasValue(condValue, r.condition_value_type)) {
      throw new Error(`Aturan ${cLabel}: nilai JIKA wajib diisi`);
    }
    if (!r.result_specification_definition_id) throw new Error(`Aturan ${cLabel}: spec MAKA (hasil) wajib dipilih`);
    if (!hasValue(resValue, r.result_value_type)) {
      throw new Error(`Aturan ${cLabel}: nilai MAKA wajib diisi`);
    }
    const key = `${r.component_definition_id}|${r.condition_specification_definition_id}|${r.condition_value_type}|${JSON.stringify(condValue)}`;
    const prev = seen.find((s) => s.key === key);
    if (prev) {
      const sameResult =
        prev.r.result_specification_definition_id === r.result_specification_definition_id &&
        typedValuesEqual(r.result_value_type, prev.r.result_value, resValue);
      throw new Error(sameResult
        ? 'Aturan duplikat: kondisi yang sama sudah ada di aturan lain'
        : 'Aturan bertentangan: kondisi yang sama dipakai dengan hasil yang berbeda');
    }
    seen.push({ key, r: { ...r, result_value: resValue } });
  }
  return true;
}