// ============================================================
// PPM M2 Helper Functions - Component Specifications
// Meeting -> PO -> Product Item -> Component -> Specification
// ============================================================
import { supabase } from './supabase';
import {
  SPEC_LABEL_OVERRIDE,
  SPEC_HELPER_TEXT,
  getSpecDisplayLabel,
  getSpecHelperText,
  hasSpecValue,
  isSpecificationReviewable,
} from './ppm-m2-specs';

// Re-export: single source of truth lives in ppm-m2-specs, tapi komponen
// tetap import dari helpers (API tidak berubah).
export {
  SPEC_LABEL_OVERRIDE,
  SPEC_HELPER_TEXT,
  getSpecDisplayLabel,
  getSpecHelperText,
  hasSpecValue,
  isSpecificationReviewable,
};

// ============================================================
// CONSTANTS
// ============================================================
export const SPEC_VALUE_TYPES = {
  TEXT: 'TEXT',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN',
  SELECT: 'SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
};

export const VALUE_TYPE_LABELS = {
  TEXT: 'Teks',
  NUMBER: 'Angka',
  BOOLEAN: 'Ya/Tidak',
  SELECT: 'Pilihan',
  MULTI_SELECT: 'Multi Pilihan',
};

// Sumber informasi sebuah nilai spec
export const SPEC_SOURCE_TYPES = {
  PO: 'PO',
  MANUAL: 'MANUAL',
  MEETING: 'MEETING',
  REFERENCE: 'REFERENCE',
};

export const SOURCE_TYPE_LABELS = {
  PO: 'PO',
  MANUAL: 'Manual',
  MEETING: 'Meeting',
  REFERENCE: 'Reference',
};

// Status review spec (Teknikal)
export const REVIEW_STATUS = {
  NOT_REVIEWED: 'NOT_REVIEWED',
  CONFIRMED: 'CONFIRMED',
  DISCUSSION_REQUIRED: 'DISCUSSION_REQUIRED',
  PENDING: 'PENDING',
  RESOLVED: 'RESOLVED',
};

export const REVIEW_STATUS_LABELS = {
  [REVIEW_STATUS.NOT_REVIEWED]: 'Belum Direview',
  [REVIEW_STATUS.CONFIRMED]: 'Sesuai',
  [REVIEW_STATUS.DISCUSSION_REQUIRED]: 'Perlu Dibahas',
  [REVIEW_STATUS.PENDING]: 'Menunggu Keputusan',
  [REVIEW_STATUS.RESOLVED]: 'Sudah Diputuskan',
};

export const REVIEW_STATUS_COLORS = {
  [REVIEW_STATUS.NOT_REVIEWED]: 'gray',
  [REVIEW_STATUS.CONFIRMED]: 'green',
  [REVIEW_STATUS.DISCUSSION_REQUIRED]: 'orange',
  [REVIEW_STATUS.PENDING]: 'yellow',
  [REVIEW_STATUS.RESOLVED]: 'blue',
};

// Status yang dianggap "selesai" pada Technical Review
// (CONFIRMED & RESOLVED selesai; sisanya belum selesai)
export const REVIEW_DONE_STATUSES = new Set([
  REVIEW_STATUS.CONFIRMED,
  REVIEW_STATUS.RESOLVED,
]);

// ============================================================
// VALUE HELPERS
// ============================================================

// Baca nilai spec berdasarkan value_type -> { field, value }
export function specValueInfo(spec) {
  switch (spec?.value_type) {
    case SPEC_VALUE_TYPES.NUMBER:
      return { field: 'value_number', value: spec.value_number };
    case SPEC_VALUE_TYPES.BOOLEAN:
      return { field: 'value_boolean', value: spec.value_boolean };
    case SPEC_VALUE_TYPES.SELECT:
    case SPEC_VALUE_TYPES.MULTI_SELECT:
      return { field: 'value_json', value: spec.value_json ?? spec.value_text };
    case SPEC_VALUE_TYPES.TEXT:
    default:
      return { field: 'value_text', value: spec.value_text };
  }
}

// Baca nilai ORIGINAL spec -> { field: originalValue }
export function specOriginalInfo(spec) {
  const f = {
    TEXT: 'original_value_text',
    NUMBER: 'original_value_number',
    BOOLEAN: 'original_value_boolean',
    SELECT: 'original_value_json',
    MULTI_SELECT: 'original_value_json',
  }[spec?.value_type] || 'original_value_text';
  return { field: f, value: spec[f] };
}

// Format nilai spec untuk ditampilkan (ringkas)
export function formatSpecValue(spec) {
  if (!spec) return '-';
  const { value } = specValueInfo(spec);
  if (value === null || value === undefined || value === '') return '-';
  if (spec.value_type === SPEC_VALUE_TYPES.BOOLEAN) return value === true ? 'Ya' : 'Tidak';
  const unit = spec.unit ? ' ' + spec.unit : '';
  if (spec.value_type === SPEC_VALUE_TYPES.SELECT || spec.value_type === SPEC_VALUE_TYPES.MULTI_SELECT) {
    const arr = Array.isArray(value) ? value : [value];
    return arr.filter(Boolean).join(', ');
  }
  return String(value) + unit;
}

// ============================================================
// MASTER DATA
// ============================================================

// Fetch semua standard specification definitions (aktif)
export async function fetchSpecificationDefinitions() {
  const { data, error } = await supabase
    .from('component_specification_definitions')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

// Fetch definitions milik satu component definition
export async function fetchSpecificationDefinitionsForComponent(componentDefinitionId) {
  const { data, error } = await supabase
    .from('component_specification_definitions')
    .select('*')
    .eq('component_definition_id', componentDefinitionId)
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

// ============================================================
// TRANSACTION: PPM COMPONENT SPECIFICATIONS
// ============================================================

// Fetch semua spec milik satu component instance
export async function fetchSpecsForComponent(itemComponentId) {
  const { data, error } = await supabase
    .from('ppm_component_specifications')
    .select('*')
    .eq('item_component_id', itemComponentId)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

// Fetch semua spec untuk banyak component (batch, untuk list PO detail)
export async function fetchSpecsForComponents(itemComponentIds) {
  if (!itemComponentIds || itemComponentIds.length === 0) return {};
  const { data, error } = await supabase
    .from('ppm_component_specifications')
    .select('*')
    .in('item_component_id', itemComponentIds)
    .order('sort_order');
  if (error) throw error;
  const map = {};
  (data || []).forEach((s) => {
    if (!map[s.item_component_id]) map[s.item_component_id] = [];
    map[s.item_component_id].push(s);
  });
  return map;
}
// ============================================================
// STANDARD SPECIFICATIONS (Terapkan Spesifikasi Standar)
// ============================================================

// Read-only preview of what "Terapkan Spesifikasi Standar" would add.
// componentRow = row dari ppm_item_components (memuat component_definition_id)
// Returns { hasDefinition, definitions, existingMatched, toAdd }
export async function previewStandardSpecifications(componentRow) {
  const defId = componentRow?.component_definition_id;
  if (!defId) {
    return { hasDefinition: false, definitions: [], existingMatched: [], toAdd: [] };
  }

  const definitions = await fetchSpecificationDefinitionsForComponent(defId);
  const existing = await fetchSpecsForComponent(componentRow.id);
  const have = new Set(
    (existing || [])
      .filter((s) => s.specification_definition_id)
      .map((s) => s.specification_definition_id)
  );

  const existingMatched = [];
  const toAdd = [];
  (definitions || []).forEach((d) => {
    if (have.has(d.id)) existingMatched.push(d);
    else toAdd.push(d);
  });

  return { hasDefinition: definitions.length > 0, definitions, existingMatched, toAdd };
}

// Apply standard specs ke component yang SUDAH ADA - hanya insert yang belum ada.
// Nilai spec tetap KOSONG (tidak pernah mengisi nilai default).
export async function applyStandardSpecifications(componentRow, createdBy) {
  const { toAdd } = await previewStandardSpecifications(componentRow);
  if (!toAdd.length) {
    return { addedCount: 0, added: [], message: 'Semua spesifikasi standar sudah ada' };
  }

  const existing = await fetchSpecsForComponent(componentRow.id);
  const base = (existing || []).reduce((m, s) => Math.max(m, s.sort_order || 0), 0);

  const payloads = toAdd.map((d, i) => ({
    item_component_id: componentRow.id,
    specification_definition_id: d.id,
    spec_key_snapshot: d.spec_key,
    spec_label_snapshot: d.spec_label,
    value_type: d.value_type,
    unit: d.default_unit || null,
    source_type: SPEC_SOURCE_TYPES.MANUAL,
    review_status: REVIEW_STATUS.NOT_REVIEWED,
    is_custom: false,
    sort_order: base + i + 1,
    created_by: createdBy || null,
  }));

  const { data, error } = await supabase
    .from('ppm_component_specifications')
    .insert(payloads)
    .select('*');
  if (error) throw error;
  return { addedCount: (data || []).length, added: data || [], message: `${(data || []).length} spesifikasi ditambahkan` };
}

// AUTO-APPLY untuk Component BARU: clone standard definitions jadi spec kosong.
// Dipanggil setelah component baru dibuat (dengan component_definition_id).
export async function ensureStandardSpecsForComponents(componentRows, createdBy) {
  const withDef = (componentRows || []).filter((c) => c && c.component_definition_id);
  let total = 0;
  for (const c of withDef) {
    const res = await applyStandardSpecifications(
      { id: c.id, component_definition_id: c.component_definition_id },
      createdBy
    );
    total += res.addedCount;
  }
  return total;
}

// ============================================================
// CUSTOM SPECIFICATION (+ Tambah Spesifikasi)
// ============================================================
export async function createCustomSpecification({
  item_component_id,
  spec_label_snapshot,
  value_type,
  unit,
  value,
  notes,
  created_by,
  sort_order,
}) {
  const payload = {
    item_component_id,
    specification_definition_id: null,
    spec_key_snapshot: 'CUSTOM_' + Date.now().toString(36),
    spec_label_snapshot,
    value_type,
    unit: unit || null,
    source_type: SPEC_SOURCE_TYPES.MANUAL,
    review_status: REVIEW_STATUS.NOT_REVIEWED,
    is_custom: true,
    sort_order: sort_order || 0,
    notes: notes || null,
    created_by: created_by || null,
  };
  // set value field sesuai value_type
  const setValue = buildValuePayload(value_type, value);
  Object.assign(payload, setValue);

  const { data, error } = await supabase
    .from('ppm_component_specifications')
    .insert([payload])
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// VALUE BUILDERS
// ============================================================
// Ubah nilai UI -> kolom value_* yang sesuai value_type
export function buildValuePayload(valueType, value) {
  switch (valueType) {
    case SPEC_VALUE_TYPES.NUMBER:
      return { value_text: null, value_number: value === '' || value === null || value === undefined ? null : Number(value), value_boolean: null, value_json: null };
    case SPEC_VALUE_TYPES.BOOLEAN:
      return { value_text: null, value_number: null, value_boolean: value === true, value_json: null };
    case SPEC_VALUE_TYPES.SELECT:
      return { value_text: null, value_number: null, value_boolean: null, value_json: value === '' || value === null || value === undefined ? null : value };
    case SPEC_VALUE_TYPES.MULTI_SELECT:
      return { value_text: null, value_number: null, value_boolean: null, value_json: Array.isArray(value) ? value : (value ? [value] : null) };
    case SPEC_VALUE_TYPES.TEXT:
    default:
      return { value_text: value === '' || value === null || value === undefined ? null : String(value), value_number: null, value_boolean: null, value_json: null };
  }
}

// Baca nilai UI dari spec (untuk form) -> string|boolean|array
export function specValueAsInput(spec) {
  if (!spec) return '';
  const { value } = specValueInfo(spec);
  if (spec.value_type === SPEC_VALUE_TYPES.SELECT) return value || '';
  if (spec.value_type === SPEC_VALUE_TYPES.MULTI_SELECT) return Array.isArray(value) ? value : (value ? [String(value)] : []);
  return value ?? '';
}

// ============================================================
// SAVE / EDIT SPEC
// ============================================================

// Simpan perubahan nilai spec.
// EKSTRA SAFETY (edit confirmed value):
//   Jika nilai BERUBAH dan review_status = CONFIRMED / RESOLVED,
//   review kembali ke NOT_REVIEWED + reviewed_by/at = null.
//   Prinsip: jangan biarkan nilai berubah tapi badge tetap "Sesuai".
export async function updateSpecificationValue(specId, { value, unit, source_type, notes }) {
  const current = await fetchSpecById(specId);

  const valuePayload = buildValuePayload(current.value_type, value ?? null);
  const { field } = specValueInfo(current);
  const prev = current[field];
  const next = valuePayload[field];
  const valueChanged = String(prev ?? '') !== String(next ?? '');

  const patch = {
    ...valuePayload,
    unit: unit || null,
    source_type: source_type || SPEC_SOURCE_TYPES.MANUAL,
  };
  if (notes !== undefined) patch.notes = notes || null;

  if (valueChanged && (current.review_status === REVIEW_STATUS.CONFIRMED || current.review_status === REVIEW_STATUS.RESOLVED)) {
    patch.review_status = REVIEW_STATUS.NOT_REVIEWED;
    patch.reviewed_by = null;
    patch.reviewed_at = null;
  }

  const { data, error } = await supabase
    .from('ppm_component_specifications')
    .update(patch)
    .eq('id', specId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function fetchSpecById(specId) {
  const { data, error } = await supabase
    .from('ppm_component_specifications')
    .select('*')
    .eq('id', specId)
    .single();
  if (error) throw error;
  return data;
}

// Hapus spec (custom bebas dihapus; standard juga boleh bila user memilih)
export async function deleteSpecification(specId) {
  const { error } = await supabase
    .from('ppm_component_specifications')
    .delete()
    .eq('id', specId);
  if (error) throw error;
}

// ============================================================
// SPEC SORTING (dnd-kit) - persist sort_order via per-row UPDATE
// ============================================================
// Catatan: pakai per-row UPDATE (seperti reorderItemComponents M1) karena
// upsert parsial bisa gagal di RLS (proposed row kehilangan item_component_id).
export async function reorderSpecifications(itemComponentId, orderedIds) {
  if (!itemComponentId || !orderedIds || orderedIds.length === 0) return;

  const { data: specs, error: fetchError } = await supabase
    .from('ppm_component_specifications')
    .select('id, sort_order')
    .eq('item_component_id', itemComponentId);
  if (fetchError) throw fetchError;

  const oldMap = {};
  (specs || []).forEach((s) => { oldMap[s.id] = s.sort_order || 0; });

  const updates = [];
  orderedIds.forEach((id, index) => {
    const newOrder = index + 1;
    if (oldMap[id] !== newOrder) updates.push({ id, sort_order: newOrder });
  });
  if (updates.length === 0) return;

  const results = await Promise.all(updates.map((u) =>
    supabase.from('ppm_component_specifications').update({ sort_order: u.sort_order }).eq('id', u.id)
  ));
  const failed = results.find((r) => r.error);
  if (failed) throw failed.error;
}
// ============================================================
// TECHNICAL REVIEW ACTIONS
// ============================================================

// ✓ SESUAI
export async function confirmSpecification(specId, reviewerId, notes) {
  const patch = {
    review_status: REVIEW_STATUS.CONFIRMED,
    reviewed_by: reviewerId || null,
    reviewed_at: new Date().toISOString(),
  };
  if (notes !== undefined) patch.notes = notes || null;
  const { data, error } = await supabase
    .from('ppm_component_specifications')
    .update(patch)
    .eq('id', specId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// PERLU DIBAHAS
export async function markDiscussionRequired(specId, notes) {
  const patch = { review_status: REVIEW_STATUS.DISCUSSION_REQUIRED };
  if (notes !== undefined) patch.notes = notes || null;
  const { data, error } = await supabase
    .from('ppm_component_specifications')
    .update(patch)
    .eq('id', specId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// PENDING (bisa disertai catatan, mis. "Marketing akan konfirmasi ukuran")
export async function markPending(specId, notes) {
  const patch = { review_status: REVIEW_STATUS.PENDING };
  if (notes !== undefined) patch.notes = notes || null;
  const { data, error } = await supabase
    .from('ppm_component_specifications')
    .update(patch)
    .eq('id', specId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// SET KEPUTUSAN -> RESOLVED
// - valueChanged=false : pertahankan nilai lama
// - valueChanged=true  : ubah nilai, source_type -> MEETING
// Original value DIJAGA otomatis oleh trigger DB (tidak di-overwrite).
export async function resolveSpecification(specId, { value, unit, notes, reviewerId }) {
  const current = await fetchSpecById(specId);

  const valuePayload = buildValuePayload(current.value_type, value ?? null);
  const { field } = specValueInfo(current);
  const prev = current[field];
  const next = valuePayload[field];
  const valueChanged = String(prev ?? '') !== String(next ?? '');

  const patch = {
    ...valuePayload,
    unit: unit || null,
    notes: notes || null,
    review_status: REVIEW_STATUS.RESOLVED,
    reviewed_by: reviewerId || null,
    reviewed_at: new Date().toISOString(),
  };
  // Jika nilai berubah karena keputusan meeting -> sumber = MEETING
  if (valueChanged) patch.source_type = SPEC_SOURCE_TYPES.MEETING;

  const { data, error } = await supabase
    .from('ppm_component_specifications')
    .update(patch)
    .eq('id', specId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// PROGRESS
// ============================================================

// Hitung progres Technical Review dari list specs.
// Selesai: hanya CONFIRMED & RESOLVED.
export function computeReviewProgress(specs) {
  const list = specs || [];
  const progress = {
    total: list.length,
    selesai: 0,
    confirmed: 0,
    resolved: 0,
    discussion: 0,
    pending: 0,
    notReviewed: 0,
        belumSelesai: 0,
    // M2.1: denominator progress hanya spesifikasi yang reviewable.
    // Spec kosong & opsional tidak masuk denominator.
    reviewableTotal: 0,
    reviewableSelesai: 0,
  };
  list.forEach((s) => {
    if (s.review_status === REVIEW_STATUS.CONFIRMED) progress.confirmed += 1;
    else if (s.review_status === REVIEW_STATUS.RESOLVED) progress.resolved += 1;
    else if (s.review_status === REVIEW_STATUS.DISCUSSION_REQUIRED) progress.discussion += 1;
    else if (s.review_status === REVIEW_STATUS.PENDING) progress.pending += 1;
        else progress.notReviewed += 1;
    if (isSpecificationReviewable(s)) {
      progress.reviewableTotal += 1;
      if (s.review_status === REVIEW_STATUS.CONFIRMED || s.review_status === REVIEW_STATUS.RESOLVED) progress.reviewableSelesai += 1;
    }
  });
  progress.selesai = progress.confirmed + progress.resolved;
  progress.belumSelesai = progress.total - progress.selesai;
  return progress;
}

// Gabungkan progress beberapa item (untuk PO Summary)
export function mergeReviewProgress(items) {
  const merged = { total: 0, selesai: 0, discussion: 0, pending: 0 };
  (items || []).forEach((it) => {
    const p = it.reviewProgress || { total: 0, selesai: 0, discussion: 0, pending: 0 };
    merged.total += p.total;
    merged.selesai += p.selesai;
    merged.discussion += p.discussion;
    merged.pending += p.pending;
  });
  return merged;
}
