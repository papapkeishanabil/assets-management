// ============================================================
// PPM M3 Helper Functions - Annotation & Component Discussion
// Meeting -> PO -> Product Item -> Component -> (optional) Specification
//
// M3 = CRUD annotation stabil. BUKAN realtime.
// Decision note TIDAK mengubah ppm_component_specifications (M2.2 LOCKED).
// ============================================================
import { supabase } from './supabase.js';
import {
  ANNOTATION_STATUS,
  ANNOTATION_STATUS_LABELS,
  ANNOTATION_STATUS_COLORS,
  ANNOTATION_STATUSES,
  NOTE_TYPE,
  NOTE_TYPE_LABELS,
  NOTE_TYPE_COLORS,
  NOTE_TYPES,
  clampPercent,
  isValidPercent,
  isBlankNote,
  normalizeNoteText,
  nextPinNumber,
  decisionFirstNotes,
  componentDisplayLabel,
  buildAnnotationRecap,
  pinCountByComponent,
} from './ppm-m3-specs.js';

// Re-export: single source of truth lives in ppm-m3-specs, tapi komponen
// tetap import dari helpers (API tidak berubah).
export {
  ANNOTATION_STATUS,
  ANNOTATION_STATUS_LABELS,
  ANNOTATION_STATUS_COLORS,
  ANNOTATION_STATUSES,
  NOTE_TYPE,
  NOTE_TYPE_LABELS,
  NOTE_TYPE_COLORS,
  NOTE_TYPES,
  clampPercent,
  isValidPercent,
  isBlankNote,
  normalizeNoteText,
  nextPinNumber,
  decisionFirstNotes,
  componentDisplayLabel,
  buildAnnotationRecap,
  pinCountByComponent,
};

// ============================================================
// DB: FETCH
// ============================================================

// Fetch semua annotation sebuah PO (+ notes embed) dan relasi item/komponen
// yang dibutuhkan untuk display.
// documentId/pageNumber optional — filter dokumen/page jika tersedia.
export async function fetchAnnotationsForPO(meetingPoId, { documentId, pageNumber } = {}) {
  if (!meetingPoId) return [];
  let query = supabase
    .from('ppm_annotations')
    .select('*, ppm_po_items(item_name), ppm_item_components(component_name_snapshot, location_label, component_definitions(name)), ppm_component_specifications(spec_label_snapshot, value_type, value_text, value_number, value_boolean, value_json, unit)')
    .eq('meeting_po_id', meetingPoId)
    .order('pin_number');
  if (documentId) query = query.eq('po_document_id', documentId);
  if (pageNumber != null) query = query.eq('page_number', pageNumber);
  const { data, error } = await query;
  if (error) throw error;

  const rows = data || [];
  if (rows.length === 0) return [];

  const annIds = rows.map((r) => r.id);
  const { data: notes, error: notesError } = await supabase
    .from('ppm_annotation_notes')
    .select('*')
    .in('annotation_id', annIds)
    .order('created_at');
  if (notesError) throw notesError;

  const notesMap = {};
  (notes || []).forEach((n) => {
    if (!notesMap[n.annotation_id]) notesMap[n.annotation_id] = [];
    notesMap[n.annotation_id].push(n);
  });

  return rows.map((a) => ({
    ...a,
    notes: notesMap[a.id] || [],
    _itemName: a.ppm_po_items?.item_name || '',
    _componentLabel: componentDisplayLabel(a.ppm_item_components || {}),
    _specLabel: a.ppm_component_specifications ? formatAnnotationSpec(a.ppm_component_specifications) : '',
  }));
}

// Format nilai spec untuk disertakan pada label annotation (opsional).
function formatAnnotationSpec(spec) {
  if (!spec) return '';
  let val = null;
  if (spec.value_type === 'NUMBER') val = spec.value_number;
  else if (spec.value_type === 'BOOLEAN') val = spec.value_boolean === true ? 'Ya' : spec.value_boolean === false ? 'Tidak' : null;
  else if (spec.value_type === 'SELECT' || spec.value_type === 'MULTI_SELECT') {
    const arr = Array.isArray(spec.value_json) ? spec.value_json : (spec.value_json ? [spec.value_json] : []);
    val = arr.filter(Boolean).join(', ');
  } else val = spec.value_text;
  if (val === null || val === undefined || val === '') return spec.spec_label_snapshot || '';
  const unit = spec.unit ? ' ' + spec.unit : '';
  return `${spec.spec_label_snapshot || ''}: ${String(val)}${unit}`;
}

// Fetch spesifikasi sebuah komponen (untuk opsi "Spesifikasi terkait")
export async function fetchSpecsForComponentM3(itemComponentId) {
  if (!itemComponentId) return [];
  const { data, error } = await supabase
    .from('ppm_component_specifications')
    .select('*')
    .eq('item_component_id', itemComponentId)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

// ============================================================
// DB: WRITE
// ============================================================

// Buat pin + note pertama (wajib: pin baru minimal 1 note).
export async function createAnnotation({
  meeting_po_id,
  po_document_id,
  page_number,
  po_item_id,
  item_component_id,
  component_specification_id,
  pin_number,
  x_percent,
  y_percent,
  created_by,
  note_text,
  note_type,
}) {
  if (!meeting_po_id || !po_item_id || !item_component_id) {
    throw new Error('meeting_po_id, po_item_id dan item_component_id wajib diisi');
  }
  if (isBlankNote(note_text)) {
    throw new Error('Catatan tidak boleh kosong');
  }

  const { data: pin, error: pinError } = await supabase
    .from('ppm_annotations')
    .insert([{
      meeting_po_id,
      po_document_id: po_document_id || null,
      page_number: page_number ?? null,
      po_item_id,
      item_component_id,
      component_specification_id: component_specification_id || null,
      pin_number,
      x_percent: clampPercent(x_percent),
      y_percent: clampPercent(y_percent),
      status: ANNOTATION_STATUS.OPEN,
      created_by: created_by || null,
    }])
    .select('*')
    .single();
  if (pinError) throw pinError;

  await addNoteToAnnotation(pin.id, { note_text, note_type, created_by });
  return fetchAnnotationById(pin.id);
}

export async function fetchAnnotationById(annotationId) {
  const { data, error } = await supabase
    .from('ppm_annotations')
    .select('*')
    .eq('id', annotationId)
    .single();
  if (error) throw error;
  const notes = await fetchNotesForAnnotation(annotationId);
  return { ...data, notes };
}

export async function fetchNotesForAnnotation(annotationId) {
  const { data, error } = await supabase
    .from('ppm_annotation_notes')
    .select('*')
    .eq('annotation_id', annotationId)
    .order('created_at');
  if (error) throw error;
  return data || [];
}

// Tambah note ke pin yang sudah ada. note_type default DISCUSSION.
export async function addNoteToAnnotation(annotationId, { note_text, note_type, created_by }) {
  if (!annotationId) throw new Error('annotation_id wajib diisi');
  if (isBlankNote(note_text)) {
    throw new Error('Catatan tidak boleh kosong');
  }
  const { data, error } = await supabase
    .from('ppm_annotation_notes')
    .insert([{
      annotation_id: annotationId,
      note_text: normalizeNoteText(note_text),
      note_type: note_type || NOTE_TYPE.DISCUSSION,
      created_by: created_by || null,
    }])
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// Edit konteks pin (Product Item / Component / Specification optional).
// Notes tetap utuh.
export async function updateAnnotationContext(annotationId, { po_item_id, item_component_id, component_specification_id }) {
  if (!annotationId) throw new Error('annotation_id wajib diisi');
  if (!po_item_id || !item_component_id) {
    throw new Error('po_item_id dan item_component_id wajib diisi');
  }
  const patch = {
    po_item_id,
    item_component_id,
    component_specification_id: component_specification_id || null,
  };
  const { data, error } = await supabase
    .from('ppm_annotations')
    .update(patch)
    .eq('id', annotationId)
    .select('*')
    .single();
  if (error) throw error;
  return fetchAnnotationById(annotationId);
}

// Pindah pin — persis saat drag END (bukan setiap movement).
export async function moveAnnotation(annotationId, x_percent, y_percent) {
  if (!annotationId) throw new Error('annotation_id wajib diisi');
  const { data, error } = await supabase
    .from('ppm_annotations')
    .update({
      x_percent: clampPercent(x_percent),
      y_percent: clampPercent(y_percent),
    })
    .eq('id', annotationId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// OPEN <-> RESOLVED
export async function setAnnotationStatus(annotationId, status) {
  if (!annotationId) throw new Error('annotation_id wajib diisi');
  if (![ANNOTATION_STATUS.OPEN, ANNOTATION_STATUS.RESOLVED].includes(status)) {
    throw new Error('status annotation tidak valid: ' + String(status));
  }
  const next = status === ANNOTATION_STATUS.RESOLVED ? ANNOTATION_STATUS.RESOLVED : ANNOTATION_STATUS.OPEN;
  const { data, error } = await supabase
    .from('ppm_annotations')
    .update({ status: next })
    .eq('id', annotationId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// Hapus pin — notes ikut terhapus (FK ON DELETE CASCADE).
export async function deleteAnnotation(annotationId) {
  const { error } = await supabase
    .from('ppm_annotations')
    .delete()
    .eq('id', annotationId);
  if (error) throw error;
}

// Edit note individual (note_text dan/atau note_type). Validasi sama dengan
// addNoteToAnnotation (blank-check + normalize). note_type opsional; bila
// tidak diberikan, jenis catatan tidak berubah. RLS update via annotation
// (creator meeting / super_admin) — sama dengan delete.
export async function updateNote(noteId, { note_text, note_type } = {}) {
  if (!noteId) throw new Error('note_id wajib diisi');
  if (note_text === undefined) {
    throw new Error('note_text wajib diisi (gunakan deleteNote untuk menghapus)');
  }
  if (isBlankNote(note_text)) {
    throw new Error('Catatan tidak boleh kosong');
  }
  const patch = { note_text: normalizeNoteText(note_text) };
  if (note_type !== undefined) patch.note_type = note_type;
  const { data, error } = await supabase
    .from('ppm_annotation_notes')
    .update(patch)
    .eq('id', noteId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// Hapus note individual — TIDAK otomatis menghapus pin.
export async function deleteNote(noteId) {
  const { error } = await supabase
    .from('ppm_annotation_notes')
    .delete()
    .eq('id', noteId);
  if (error) throw error;
}
