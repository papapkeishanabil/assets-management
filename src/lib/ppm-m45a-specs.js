// ============================================================
// PPM M4.5A â€” pure spec helpers (no DB, no side-effects)
//
// SEMANTICS (eksplisit â€” jangan dicampur):
//   DEFAULT  = nilai awal yang disarankan (template_specs.default_value_*)
//   STANDARD = aturan teknis resmi Harmas/Ofissio
//              (ppm_company_technical_standards + _standard_specs)
//   REQUIRED = spec wajib punya nilai untuk kelengkapan
//   standard_id = referensi standard EKSPLIT per template spec, dipakai
//                 saat KOMPOSE (future M4.5B). BUKAN rule engine â€”
//                 conditional standard (IF ... THEN ...) = DEFERRED.
//
// Nilai tersimpan typed (value_text/value_number/value_boolean/value_json)
// â€” mirror M2 (ppm_component_specifications) + M4 (proposal value_*).
// ============================================================

// PURE module â€” TANPA import apa pun (test node ESM langsung mengimport file
// ini; import dari module ber-supabase akan gagal resolve di Node). Konstanta
// VALUE_TYPE sengaja di-definisikan ulang (mirror M2) bukan di-import.
export const VALUE_TYPE = {
  TEXT: 'TEXT',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN',
  SELECT: 'SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
};

export const VALUE_TYPE_LABELS = {
  [VALUE_TYPE.TEXT]: 'Teks',
  [VALUE_TYPE.NUMBER]: 'Angka',
  [VALUE_TYPE.BOOLEAN]: 'Ya/Tidak',
  [VALUE_TYPE.SELECT]: 'Pilihan',
  [VALUE_TYPE.MULTI_SELECT]: 'Multi Pilihan',
};

// Sumber nilai sebuah template spec (provenance saat compose nanti).
export const TEMPLATE_SPEC_SOURCE = {
  TEMPLATE: 'TEMPLATE',   // default_value_* template
  STANDARD: 'STANDARD',   // standard_id eksplisit (menang atas DEFAULT saat compose)
  OVERRIDE: 'OVERRIDE',   // nilai model/customer (future M4.5B)
};

// ============================================================
// VALUE READERS â€” mirror specValueInfo (M2) untuk kolom default_value_*
// dan value_* (standard). Return { field, value }.
// ============================================================
export function defaultFieldFor(valueType) {
  switch (valueType) {
    case VALUE_TYPE.NUMBER:
      return 'default_value_number';
    case VALUE_TYPE.BOOLEAN:
      return 'default_value_boolean';
    case VALUE_TYPE.SELECT:
    case VALUE_TYPE.MULTI_SELECT:
      return 'default_value_json';
    case VALUE_TYPE.TEXT:
    default:
      return 'default_value_text';
  }
}

export function valueFieldFor(valueType) {
  switch (valueType) {
    case VALUE_TYPE.NUMBER:
      return 'value_number';
    case VALUE_TYPE.BOOLEAN:
      return 'value_boolean';
    case VALUE_TYPE.SELECT:
    case VALUE_TYPE.MULTI_SELECT:
      return 'value_json';
    case VALUE_TYPE.TEXT:
    default:
      return 'value_text';
  }
}

// Baca DEFAULT value dari row template spec -> { field, value }
export function defaultValueInfo(templateSpec) {
  if (!templateSpec) return { field: null, value: null };
  return { field: defaultFieldFor(templateSpec.value_type), value: templateSpec[defaultFieldFor(templateSpec.value_type)] };
}

// Baca STANDARD value dari row standard spec -> { field, value }
export function standardValueInfo(standardSpec) {
  if (!standardSpec) return { field: null, value: null };
  return { field: valueFieldFor(standardSpec.value_type), value: standardSpec[valueFieldFor(standardSpec.value_type)] };
}

// Baca DEFAULT value dalam bentuk UI (string/boolean/array) â€” mirror specValueAsInput
export function templateDefaultAsInput(templateSpec) {
  if (!templateSpec) return '';
  const { value } = defaultValueInfo(templateSpec);
  if (templateSpec.value_type === VALUE_TYPE.SELECT) return value || '';
  if (templateSpec.value_type === VALUE_TYPE.MULTI_SELECT) {
    return Array.isArray(value) ? value : value ? [String(value)] : [];
  }
  return value ?? '';
}

// Baca STANDARD value dalam bentuk UI (string/boolean/array)
export function standardValueAsInput(standardSpec) {
  if (!standardSpec) return '';
  const { value } = standardValueInfo(standardSpec);
  if (standardSpec.value_type === VALUE_TYPE.SELECT) return value || '';
  if (standardSpec.value_type === VALUE_TYPE.MULTI_SELECT) {
    return Array.isArray(value) ? value : value ? [String(value)] : [];
  }
  return value ?? '';
}

// ============================================================
// DISPLAY FORMATTERS
// ============================================================
export function formatTemplateDefault(templateSpec) {
  if (!templateSpec) return '-';
  const { value } = defaultValueInfo(templateSpec);
  if (value === null || value === undefined || value === '') return '-';
  if (templateSpec.value_type === VALUE_TYPE.BOOLEAN) return value === true ? 'Ya' : 'Tidak';
  const unit = templateSpec.unit ? ' ' + templateSpec.unit : '';
  if (templateSpec.value_type === VALUE_TYPE.SELECT || templateSpec.value_type === VALUE_TYPE.MULTI_SELECT) {
    const arr = Array.isArray(value) ? value : [value];
    return arr.filter(Boolean).join(', ') + unit;
  }
  return String(value) + unit;
}

export function formatStandardValue(standardSpec) {
  if (!standardSpec) return '-';
  const { value } = standardValueInfo(standardSpec);
  if (value === null || value === undefined || value === '') return '-';
  if (standardSpec.value_type === VALUE_TYPE.BOOLEAN) return value === true ? 'Ya' : 'Tidak';
  const unit = standardSpec.unit ? ' ' + standardSpec.unit : '';
  if (standardSpec.value_type === VALUE_TYPE.SELECT || standardSpec.value_type === VALUE_TYPE.MULTI_SELECT) {
    const arr = Array.isArray(value) ? value : [value];
    return arr.filter(Boolean).join(', ') + unit;
  }
  return String(value) + unit;
}

// ============================================================
// CONTEXTUAL SPEC PICKER (M4.5A manual verification bugfix)
// ------------------------------------------------------------
// Prinsip: dropdown specification HARUS contextual terhadap component
// aktif. Komponen standard (component_definition_id terisi) HANYA boleh
// menampilkan spec definitions miliknya. Custom spec (value '') tetap
// tersedia sebagai escape hatch — JANGAN pernah fallback ke semua defs.
// ============================================================

// Defs yang boleh dipilih untuk satu component row.
//   - componentDefinitionId terisi  -> HANYA defs milik komponen itu.
//   - componentDefinitionId kosong  -> [] (row belum punya komponen /
//     custom component: gunakan Custom Spec dulu, bukan defs komponen lain).
export function defsForComponent(specDefs, componentDefinitionId) {
  if (!componentDefinitionId) return [];
  return (specDefs || []).filter((d) => d.component_definition_id === componentDefinitionId);
}

// Setelah user mengganti component row: spec yang memakai definition milik
// komponen lain HARUS di-reset (tidak boleh Scotchlight -> Tinggi Kerah).
// - spec tanpa definition (custom spec) dipertahankan apa adanya.
// - spec dengan definition kompatibel dipertahankan.
// - spec dengan definition tidak kompatibel / unknown di-reset ke kosong.
export function specsAfterComponentChange(specs, newComponentDefinitionId, specDefs) {
  return (specs || []).map((s) => {
    if (!s.specification_definition_id) return s;
    const def = (specDefs || []).find((d) => d.id === s.specification_definition_id);
    if (def && newComponentDefinitionId && def.component_definition_id === newComponentDefinitionId) return s;
    return {
      ...s,
      specification_definition_id: '',
      spec_key_snapshot: '',
      spec_label_snapshot: '',
      value_type: VALUE_TYPE.TEXT,
      unit: '',
      default_value: '',
      standard_id: '',
    };
  });
}

// ============================================================
// COMPOSE SEMANTICS (V1 â€” dokumentasi + keputusan simple)
// ------------------------------------------------------------
// Saat M4.5B kompose model dari template:
//   resolved = standard_value (bila standard_id terisi) ATAU default_value
//              (bila tidak) â€” EKSPLISIT per template spec.
// TIDAK ada lookup engine / conditional rule. Fungsi di bawah adalah
// representasi murni keputusan ini agar bisa diuji & dipakai UI preview.
// ============================================================
// Nilai yang akan dipakai saat kompose (standard menang atas default).
export function resolveComposeValue(templateSpec, standardSpec) {
  if (!templateSpec) return null;
  if (templateSpec.standard_id && standardSpec) {
    return standardValueAsInput(standardSpec);
  }
  return templateDefaultAsInput(templateSpec);
}
