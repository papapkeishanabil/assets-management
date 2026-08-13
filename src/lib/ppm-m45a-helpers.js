// ============================================================
// PPM M4.5A Helper Functions — Specification Template + Technical Standard
//
// DB I/O untuk:
//   ppm_spec_templates / ppm_spec_template_components / ppm_spec_template_specs
//   ppm_company_technical_standards / ppm_company_technical_standard_specs
//
// Konvensi PPM:
//   - READ: authenticated ACTIVE (RLS Pattern A) — semua user aktif.
//   - WRITE: super_admin only (RLS Pattern B master).
//   - Semua nilai typed dipakai lewat buildValuePayload (M2) — shape
//     value_text/value_number/value_boolean/value_json konsisten.
//   - Template = komposisi; helper create/update template menulis komponen
//     + spec dalam satu alur client-orchestrated (tanpa RPC).
// ============================================================
import { supabase } from './supabase';
import { buildValuePayload, SPEC_VALUE_TYPES } from './ppm-m2-helpers';
import { validateTechnicalStandardRules } from './ppm-m45a1-rules';

export { SPEC_VALUE_TYPES, validateTechnicalStandardRules };

export const STANDARD_TYPE = {
  FIXED: 'FIXED',
  CONDITIONAL: 'CONDITIONAL',
};

export const STANDARD_TYPE_LABELS = {
  [STANDARD_TYPE.FIXED]: 'Nilai Standar Tetap',
  [STANDARD_TYPE.CONDITIONAL]: 'Aturan Bersyarat',
};

// ============================================================
// TEMPLATE — LIST / DETAIL
// ============================================================
export async function fetchTemplates(includeInactive = true) {
  let q = supabase
    .from('ppm_spec_templates')
    .select('*, product_types(code, name), ppm_spec_template_components(id)');
  if (!includeInactive) q = q.eq('is_active', true);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw error;
  // Enrich: nama product type + jumlah komponen (+ spec via detail bila perlu).
  return (data || []).map((t) => ({
    ...t,
    product_types: t.product_types || null,
    component_count: (t.ppm_spec_template_components || []).length,
  }));
}

// Detail template: row + components (sorted) + specs per component + linked
// product type name. Satu sumber data untuk editor.
export async function fetchTemplateDetail(templateId) {
  const { data: row, error: err1 } = await supabase
    .from('ppm_spec_templates')
    .select('*, product_types(code, name)')
    .eq('id', templateId)
    .single();
  if (err1) throw err1;
  if (!row) return null;

  const { data: comps, error: err2 } = await supabase
    .from('ppm_spec_template_components')
    .select('*')
    .eq('template_id', templateId)
    .order('sort_order');
  if (err2) throw err2;

  const { data: specs, error: err3 } = await supabase
    .from('ppm_spec_template_specs')
    .select('*')
    .in('template_component_id', (comps || []).map((c) => c.id).length ? (comps || []).map((c) => c.id) : ['00000000-0000-0000-0000-000000000000'])
    .order('sort_order');
  if (err3) throw err3;

  const components = (comps || []).map((c) => ({
    ...c,
    specs: (specs || []).filter((s) => s.template_component_id === c.id),
  }));
  return { ...row, components };
}

// ============================================================
// TEMPLATE — CREATE / UPDATE / TOGGLE
// ============================================================
function buildTemplateDefaultPayload(valueType, value) {
  const p = buildValuePayload(valueType, value);
  return {
    default_value_text: p.value_text,
    default_value_number: p.value_number,
    default_value_boolean: p.value_boolean,
    default_value_json: p.value_json,
  };
}

// Baris komponen yang kosong total (tidak ada def, nama, maupun lokasi)
// dianggap draft — TIDAK disimpan.
function isEmptyComponentRow(c) {
  return !c.component_definition_id
    && !(c.component_name_snapshot || '').trim()
    && !(c.location_label || '').trim();
}

// Baris spec yang kosong total (tidak ada def, key, label, nilai, maupun
// unit) — mis. spec yang di-clear saat ganti component
// (specsAfterComponentChange) — TIDAK disimpan (efek = dihapus).
function isEmptySpecRow(s) {
  return !s.specification_definition_id
    && !(s.spec_key_snapshot || '').trim()
    && !(s.spec_label_snapshot || '').trim()
    && (s.default_value === '' || s.default_value === null || s.default_value === undefined)
    && !(s.unit || '').trim();
}

// Simpan template (create atau update) beserta komponen + spec.
// Mode create: insert template -> components -> specs (cascade).
// Mode update: template row + replace children (delete + reinsert) —
//   aman karena children hanya dipakai oleh template ini.
//
// PENTING (bugfix 2026-08-13): SEMUA payload komponen+spec di-build dan
// divalidasi SEBELUM menulis DB. Sebelumnya error di tengah reinsert
// (mis. baris spec kosong hasil clear saat ganti component, atau komponen
// duplikat) memutus simpan SETELAH anak terhapus -> komponen+spec existing
// hilang permanen (replace children non-atomic). Kini: baris kosong dilewati,
// duplikat komponen/spec diblokir lebih dulu dengan pesan jelas.
export async function saveTemplate({ templateId, code, name, description, product_type_id, created_by, components = [] }) {
  const header = {
    code: code.trim(),
    name: name.trim(),
    description: description || null,
    product_type_id: product_type_id || null,
  };

  // ---- 1. BUILD + VALIDATE semua payload (sebelum DELETE) ----
  const orderedComponents = components
    .map((c, i) => ({ ...c, _sort: c.sort_order ?? i }))
    .sort((a, b) => (a._sort ?? 0) - (b._sort ?? 0));

  const rows = [];
  const seenComponents = new Set();

  for (let ci = 0; ci < orderedComponents.length; ci++) {
    const comp = orderedComponents[ci];
    if (isEmptyComponentRow(comp)) continue;

    const compPayload = {
      component_definition_id: comp.component_definition_id || null,
      component_name_snapshot: (comp.component_name_snapshot || '').trim(),
      location_label: comp.location_label || null,
      is_required: !!comp.is_required,
    };
    // Jika component_definition_id dipilih, isi nama snapshot dari definition.
    if (comp.component_definition_id) {
      const { data: def } = await supabase
        .from('component_definitions')
        .select('name')
        .eq('id', comp.component_definition_id)
        .single();
      if (def) compPayload.component_name_snapshot = def.name;
    }
    if (!compPayload.component_name_snapshot) {
      throw new Error('Nama komponen wajib diisi (custom component membutuhkan nama)');
    }

    // Mirror unique index DB (NULL-safe via COALESCE lokasi): def sama +
    // lokasi sama (atau custom: nama + lokasi sama) hanya boleh sekali.
    const compDupKey = compPayload.component_definition_id
      ? `def|${compPayload.component_definition_id}|${compPayload.location_label || ''}`
      : `custom|${compPayload.component_name_snapshot}|${compPayload.location_label || ''}`;
    if (seenComponents.has(compDupKey)) {
      throw new Error(
        `Komponen duplikat di template: "${compPayload.component_name_snapshot}"${compPayload.location_label ? ` (lokasi "${compPayload.location_label}")` : ''} — komponen yang sama hanya boleh muncul sekali per lokasi`
      );
    }
    seenComponents.add(compDupKey);

    const specRows = [];
    const seenSpecs = new Set();
    const specs = (comp.specs || [])
      .map((s, j) => ({ ...s, _sort: s.sort_order ?? j }))
      .sort((a, b) => (a._sort ?? 0) - (b._sort ?? 0));

    for (let si = 0; si < specs.length; si++) {
      const spec = specs[si];
      if (isEmptySpecRow(spec)) continue;
      const specPayload = {
        specification_definition_id: spec.specification_definition_id || null,
        spec_key_snapshot: (spec.spec_key_snapshot || '').trim(),
        spec_label_snapshot: (spec.spec_label_snapshot || '').trim(),
        value_type: spec.value_type,
        unit: spec.unit || null,
        is_required: !!spec.is_required,
        standard_id: spec.standard_id || null,
        ...buildTemplateDefaultPayload(spec.value_type, spec.default_value),
      };
      if (spec.specification_definition_id) {
        const { data: def } = await supabase
          .from('component_specification_definitions')
          .select('spec_key, spec_label')
          .eq('id', spec.specification_definition_id)
          .single();
        if (def) {
          specPayload.spec_key_snapshot = def.spec_key;
          specPayload.spec_label_snapshot = def.spec_label;
        }
      }
      if (!specPayload.spec_key_snapshot || !specPayload.spec_label_snapshot) {
        throw new Error(`Spec di komponen "${compPayload.component_name_snapshot}" wajib memiliki key & label (custom spec membutuhkan keduanya)`);
      }
      // Mirror unique index DB per template_component: def sama (atau custom
      // key sama) hanya boleh sekali.
      const specDupKey = specPayload.specification_definition_id
        ? `def|${specPayload.specification_definition_id}`
        : `custom|${specPayload.spec_key_snapshot}`;
      if (seenSpecs.has(specDupKey)) {
        throw new Error(`Spec duplikat di komponen "${compPayload.component_name_snapshot}": ${specPayload.spec_label_snapshot}`);
      }
      seenSpecs.add(specDupKey);
      specRows.push(specPayload);
    }
    rows.push({ compPayload, specRows });
  }

  // ---- 2. WRITE (header + replace children) ----
  let templateRow;
  if (templateId) {
    const { data, error } = await supabase
      .from('ppm_spec_templates')
      .update(header)
      .eq('id', templateId)
      .select('*')
      .single();
    if (error) throw error;
    templateRow = data;
    // replace children (delete + reinsert) — payload sudah tervalidasi.
    const { error: delComp } = await supabase
      .from('ppm_spec_template_components')
      .delete()
      .eq('template_id', templateId);
    if (delComp) throw delComp;
  } else {
    const { data, error } = await supabase
      .from('ppm_spec_templates')
      .insert([{ ...header, created_by: created_by || null }])
      .select('*')
      .single();
    if (error) throw error;
    templateRow = data;
  }

  for (let ci = 0; ci < rows.length; ci++) {
    const { compPayload, specRows } = rows[ci];
    const { data: compRow, error: errComp } = await supabase
      .from('ppm_spec_template_components')
      .insert([{ ...compPayload, template_id: templateRow.id, sort_order: ci }])
      .select('*')
      .single();
    if (errComp) throw errComp;

    for (let si = 0; si < specRows.length; si++) {
      const { error: errSpec } = await supabase
        .from('ppm_spec_template_specs')
        .insert([{ ...specRows[si], template_component_id: compRow.id, sort_order: si }]);
      if (errSpec) throw errSpec;
    }
  }

  return templateRow;
}

export async function toggleTemplateActive(templateId, isActive) {
  const { data, error } = await supabase
    .from('ppm_spec_templates')
    .update({ is_active: !!isActive })
    .eq('id', templateId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTemplate(templateId) {
  const { error } = await supabase.from('ppm_spec_templates').delete().eq('id', templateId);
  if (error) throw error;
}

// ============================================================
// TECHNICAL STANDARD — LIST / DETAIL
// ============================================================
export async function fetchStandards(includeInactive = true) {
  let q = supabase.from('ppm_company_technical_standards').select('*');
  if (!includeInactive) q = q.eq('is_active', true);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchStandardDetail(standardId) {
  const { data: row, error: err1 } = await supabase
    .from('ppm_company_technical_standards')
    .select('*, product_types(code, name)')
    .eq('id', standardId)
    .single();
  if (err1) throw err1;
  if (!row) return null;

  const { data: specs, error: err2 } = await supabase
    .from('ppm_company_technical_standard_specs')
    .select('*')
    .eq('standard_id', standardId)
    .order('created_at');
  if (err2) throw err2;

  const { data: rules, error: err3 } = await supabase
    .from('ppm_company_technical_standard_rules')
    .select('*')
    .eq('standard_id', standardId)
    .order('sort_order');
  if (err3) throw err3;

  return { ...row, specs: specs || [], rules: rules || [] };
}

// ============================================================
// TECHNICAL STANDARD — CREATE / UPDATE / TOGGLE
// ============================================================
// Validasi client-side aturan bersyarat dipakai dari
// validateTechnicalStandardRules (ppm-m45a1-rules, pure, teruji).
// DB tetap penjaga terakhir (unique index + trigger konsistensi).

function buildRulePayload(rule) {
  const condPayload = buildValuePayload(rule.condition_value_type, rule.condition_value);
  const resPayload = buildValuePayload(rule.result_value_type, rule.result_value);
  return {
    standard_id: rule.standard_id,
    component_definition_id: rule.component_definition_id,
    condition_specification_definition_id: rule.condition_specification_definition_id,
    condition_spec_key_snapshot: rule.condition_spec_key_snapshot,
    condition_spec_label_snapshot: rule.condition_spec_label_snapshot,
    condition_operator: 'EQUALS',
    condition_value_type: rule.condition_value_type,
    condition_unit: rule.condition_unit || null,
    condition_value_text: condPayload.value_text,
    condition_value_number: condPayload.value_number,
    condition_value_boolean: condPayload.value_boolean,
    condition_value_json: condPayload.value_json,
    result_specification_definition_id: rule.result_specification_definition_id,
    result_spec_key_snapshot: rule.result_spec_key_snapshot,
    result_spec_label_snapshot: rule.result_spec_label_snapshot,
    result_value_type: rule.result_value_type,
    result_unit: rule.result_unit || null,
    result_value_text: resPayload.value_text,
    result_value_number: resPayload.value_number,
    result_value_boolean: resPayload.value_boolean,
    result_value_json: resPayload.value_json,
    sort_order: rule.sort_order ?? 0,
    is_active: rule.is_active !== false,
  };
}

export async function saveStandard({ standardId, code, name, description, product_type_id, created_by, standard_type, specs = [], rules = [] }) {
  const type = standard_type === STANDARD_TYPE.CONDITIONAL ? STANDARD_TYPE.CONDITIONAL : STANDARD_TYPE.FIXED;
  const header = {
    code: code.trim(),
    name: name.trim(),
    description: description || null,
    product_type_id: product_type_id || null,
  };
  if (type === STANDARD_TYPE.CONDITIONAL) validateTechnicalStandardRules(rules);

  // Build + validate SEMUA payload SEBELUM menulis DB (bugfix 2026-08-13:
  // error di tengah reinsert setelah DELETE anak tidak boleh menghapus
  // spesifikasi existing — sama seperti saveTemplate).
  let fixedSpecPayloads = null;
  if (type === STANDARD_TYPE.FIXED) {
    fixedSpecPayloads = [];
    const seenKeys = new Set();
    for (const spec of specs || []) {
      const valuePayload = buildValuePayload(spec.value_type, spec.value);
      const specPayload = {
        component_definition_id: spec.component_definition_id || null,
        specification_definition_id: spec.specification_definition_id || null,
        spec_key_snapshot: (spec.spec_key_snapshot || '').trim(),
        value_type: spec.value_type,
        unit: spec.unit || null,
        ...valuePayload,
        is_required: !!spec.is_required,
      };
      if (!specPayload.spec_key_snapshot) {
        throw new Error('spec_key_snapshot wajib diisi');
      }
      if (seenKeys.has(specPayload.spec_key_snapshot)) {
        throw new Error(`Spec duplikat di standard: ${specPayload.spec_key_snapshot}`);
      }
      seenKeys.add(specPayload.spec_key_snapshot);
      fixedSpecPayloads.push(specPayload);
    }
  }

  let stdRow;
  if (standardId) {
    const { data, error } = await supabase
      .from('ppm_company_technical_standards')
      .update({ ...header, standard_type: type })
      .eq('id', standardId)
      .select('*')
      .single();
    if (error) throw error;
    stdRow = data;
    const { error: delSpecs } = await supabase
      .from('ppm_company_technical_standard_specs')
      .delete()
      .eq('standard_id', standardId);
    if (delSpecs) throw delSpecs;
    const { error: delRules } = await supabase
      .from('ppm_company_technical_standard_rules')
      .delete()
      .eq('standard_id', standardId);
    if (delRules) throw delRules;
  } else {
    const { data, error } = await supabase
      .from('ppm_company_technical_standards')
      .insert([{ ...header, standard_type: type, created_by: created_by || null }])
      .select('*')
      .single();
    if (error) throw error;
    stdRow = data;
  }

  if (type === STANDARD_TYPE.FIXED) {
    for (const specPayload of fixedSpecPayloads) {
      const { error: errSpec } = await supabase
        .from('ppm_company_technical_standard_specs')
        .insert([{ ...specPayload, standard_id: stdRow.id }]);
      if (errSpec) throw errSpec;
    }
  } else {
    for (let i = 0; i < (rules || []).length; i++) {
      const { error: errRule } = await supabase
        .from('ppm_company_technical_standard_rules')
        .insert([buildRulePayload({ ...rules[i], standard_id: stdRow.id, sort_order: i, is_active: true })]);
      if (errRule) throw errRule;
    }
  }

  return stdRow;
}

export async function toggleStandardActive(standardId, isActive) {
  const { data, error } = await supabase
    .from('ppm_company_technical_standards')
    .update({ is_active: !!isActive })
    .eq('id', standardId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteStandard(standardId) {
  const { error } = await supabase
    .from('ppm_company_technical_standards')
    .delete()
    .eq('id', standardId);
  if (error) throw error;
}
