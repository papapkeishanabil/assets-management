// ============================================================
// PPM M3 PURE HELPERS - Annotation & Component Discussion
// Pure (no DB/import.meta.env) — aman diimport dari test Node (ESM).
// Import dari src/lib/ppm-m3-helpers.js untuk dipakai frontend.
// ============================================================

// ============================================================
// CONSTANTS
// ============================================================
export const ANNOTATION_STATUS = {
  OPEN: 'OPEN',
  RESOLVED: 'RESOLVED',
};

export const ANNOTATION_STATUS_LABELS = {
  [ANNOTATION_STATUS.OPEN]: 'Terbuka',
  [ANNOTATION_STATUS.RESOLVED]: 'Selesai',
};

export const ANNOTATION_STATUS_COLORS = {
  [ANNOTATION_STATUS.OPEN]: 'yellow',
  [ANNOTATION_STATUS.RESOLVED]: 'green',
};

export const NOTE_TYPE = {
  DISCUSSION: 'DISCUSSION',
  DECISION: 'DECISION',
  INFO: 'INFO',
};

export const NOTE_TYPE_LABELS = {
  [NOTE_TYPE.DISCUSSION]: 'Diskusi',
  [NOTE_TYPE.DECISION]: 'Keputusan',
  [NOTE_TYPE.INFO]: 'Info',
};

export const NOTE_TYPE_COLORS = {
  [NOTE_TYPE.DISCUSSION]: 'blue',
  [NOTE_TYPE.DECISION]: 'green',
  [NOTE_TYPE.INFO]: 'gray',
};

export const ANNOTATION_STATUSES = [ANNOTATION_STATUS.OPEN, ANNOTATION_STATUS.RESOLVED];
export const NOTE_TYPES = [NOTE_TYPE.DISCUSSION, NOTE_TYPE.INFO, NOTE_TYPE.DECISION];

// ============================================================
// PURE HELPERS
// ============================================================

// Bulatkan koordinat relative ke 2 desimal (0-100) untuk deterministik
export function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const clamped = Math.max(0, Math.min(100, n));
  return Math.round(clamped * 100) / 100;
}

export function isValidPercent(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

// Tolak note kosong / whitespace-only (DB juga enforce via CHECK constraint)
export function isBlankNote(text) {
  return !text || String(text).trim().length === 0;
}

export function normalizeNoteText(text) {
  return String(text == null ? '' : text).trim();
}

// Penomoran pin berikutnya dalam satu scope PO (dokumen/page)
// = max(pin_number) + 1, atau 1 jika belum ada.
export function nextPinNumber(annotations) {
  const max = (annotations || []).reduce(
    (m, a) => Math.max(m, Number(a.pin_number) || 0),
    0
  );
  return max + 1;
}

// Urutkan notes: DECISION paling menonjol (pertama), sisanya oleh created_at.
// History diskusi tetap terlihat setelahnya.
export function decisionFirstNotes(notes) {
  const list = (notes || []).slice();
  const rank = (t) => (t === NOTE_TYPE.DECISION ? 0 : 1);
  list.sort((a, b) => {
    const r = rank(a.note_type) - rank(b.note_type);
    if (r !== 0) return r;
    return new Date(a.created_at || 0) - new Date(b.created_at || 0);
  });
  return list;
}

// Label tampilan komponen: "Kerah - Dada Kiri" bila ada location_label
export function componentDisplayLabel(component) {
  if (!component) return '';
  const base = component.component_name_snapshot || component.name || '';
  const loc = component.location_label;
  if (loc && String(loc).trim()) return `${base} - ${loc.trim()}`;
  return base;
}

// ============================================================
// RECAP: Rangkuman Komponen
// Group live/query dari: Product Item -> Component -> Pins -> Notes.
// TIDAK membuat table recap baru.
//
// Input:
//   annotations - list annotasi dengan `notes` embed (dari fetchAnnotationsForPO)
//   items       - list item (dengan `components`) dari fetchPOItems
// Output:
//   [
//     {
//       item: <item row>,
//       components: [
//         {
//           component: <component row>,
//           label: 'Kerah',
//           pinCount, noteCount,
//           decisions: [<note decision>],
//           notes: [<all notes, decision first>],
//           pins: [<annotations>],
//         }
//       ],
//       pinCount, noteCount,
//     },
//     ...
//   ]
// ============================================================
export function buildAnnotationRecap(annotations, items) {
  const list = (annotations || []).filter((a) => a && a.id);
  const pinByComponent = {};
  list.forEach((a) => {
    if (!pinByComponent[a.item_component_id]) pinByComponent[a.item_component_id] = [];
    pinByComponent[a.item_component_id].push(a);
  });

  return (items || []).map((item) => {
    const itemPins = list.filter((a) => a.po_item_id === item.id);
    const comps = (item.components || []).map((c) => {
      const pins = pinByComponent[c.id] || [];
      const notes = [];
      pins.forEach((p) => (p.notes || []).forEach((n) => notes.push({ ...n, _pinNumber: p.pin_number, _pinId: p.id })));
      return {
        component: c,
        label: componentDisplayLabel(c),
        pinCount: pins.length,
        noteCount: notes.length,
        decisions: notes.filter((n) => n.note_type === NOTE_TYPE.DECISION),
        notes: decisionFirstNotes(notes),
        pins,
      };
    });

    const notes = [];
    comps.forEach((g) => g.notes.forEach((n) => notes.push(n)));
    return {
      item,
      pinCount: itemPins.length,
      noteCount: notes.length,
      components: comps,
    };
  }).filter((g) => g.pinCount > 0 || g.noteCount > 0);
}

// Badge count pin per komponen: { componentId: count }. 0 -> tidak perlu badge.
export function pinCountByComponent(annotations) {
  const map = {};
  (annotations || []).forEach((a) => {
    if (a && a.item_component_id) map[a.item_component_id] = (map[a.item_component_id] || 0) + 1;
  });
  return map;
}
