import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, MapPin, Check, RotateCcw, Layers, Pencil } from 'lucide-react';
import { BADGE_COLOR_CLASSES } from '../../lib/constants';
import ComponentPicker from './ComponentPicker';
import {
  createAnnotation,
  addNoteToAnnotation,
  updateAnnotationContext,
  setAnnotationStatus,
  deleteAnnotation,
  deleteNote,
  updateNote,
  nextPinNumber,
  decisionFirstNotes,
  fetchSpecsForComponentM3,
  ANNOTATION_STATUS,
  ANNOTATION_STATUS_LABELS,
  ANNOTATION_STATUS_COLORS,
  NOTE_TYPE,
  NOTE_TYPE_LABELS,
  NOTE_TYPE_COLORS,
  isBlankNote,
  componentDisplayLabel,
} from '../../lib/ppm-m3-helpers';

// ============================================================
// AnnotationPinDrawer — create new pin form + view/edit existing pin.
// - create mode: PIN BARU (Product Item -> Component -> Spec optional
//   -> Catatan -> Jenis). Component DIPILIH oleh user (tidak ditebak).
// - view mode: notes flat (decision menonjol), + Tambah Catatan,
//   edit konteks (notes utuh), OPEN/RESOLVED, hapus pin/note.
// Responsive: bottom sheet pada mobile, side panel pada desktop.
// ============================================================
export default function AnnotationPinDrawer({
  open,
  items,
  annotations,
  createPosition,
  viewAnnotation,
  defaultItemId,
  defaultComponentId,
  canManage,
  profile,
  meetingPoId,
  onClose,
  onChanged,
  onItemComponentAdded,
}) {
  const isCreate = !!createPosition;

  // ---- create form state ----
  const [itemId, setItemId] = useState('');
  const [componentId, setComponentId] = useState('');
  const [specId, setSpecId] = useState('');
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState(NOTE_TYPE.DISCUSSION);
  const [saving, setSaving] = useState(false);
  // M3.1: komponen yang baru ditambah dari Annotation (per item), agar
  // langsung terlihat tanpa menunggu refresh items dari parent.
  const [localCompsByItem, setLocalCompsByItem] = useState({});

  // ---- view state ----
  const [editingContext, setEditingContext] = useState(false);
  const [vItemId, setVItemId] = useState('');
  const [vComponentId, setVComponentId] = useState('');
  const [vSpecId, setVSpecId] = useState('');
  const [addNoteText, setAddNoteText] = useState('');
  const [addNoteType, setAddNoteType] = useState(NOTE_TYPE.DISCUSSION);
  // Edit catatan individual (inline per note). editingNoteId = id note yang
  // sedang di-edit (null = tidak ada). Membuka drawer / ganti pin -> reset.
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [editNoteType, setEditNoteType] = useState(NOTE_TYPE.DISCUSSION);
  const [specOptions, setSpecOptions] = useState([]);
  const [vSpecOptions, setVSpecOptions] = useState([]);
  const [loadingSpecs, setLoadingSpecs] = useState(false);

  // reset when open
  useEffect(() => {
    if (open) {
      setNoteText('');
      setNoteType(NOTE_TYPE.DISCUSSION);
      setSaving(false);
      setEditingContext(false);
      setAddNoteText('');
      setAddNoteType(NOTE_TYPE.DISCUSSION);
      setEditingNoteId(null);
      setEditNoteText('');
      setEditNoteType(NOTE_TYPE.DISCUSSION);
      setSpecOptions([]);
      setVSpecOptions([]);

      if (isCreate) {
        const first = defaultItemId || (items && items[0] ? items[0].id : '');
        setItemId(first);
        // M3: pre-select komponen saat quick-add dari Component Explorer (meeting).
        // Default ke '' (pilih manual) bila tidak ada konteks komponen.
        setComponentId(defaultComponentId || '');
        setSpecId('');
      } else if (viewAnnotation) {
        setVItemId(viewAnnotation.po_item_id);
        setVComponentId(viewAnnotation.item_component_id);
        setVSpecId(viewAnnotation.component_specification_id || '');
      }
    }
    // eslint-disable-next-line
  }, [open, viewAnnotation]);

  // load spec options when component changes (create)
  useEffect(() => {
    let cancelled = false;
    if (isCreate && componentId) {
      setLoadingSpecs(true);
      fetchSpecsForComponentM3(componentId)
        .then((rows) => { if (!cancelled) setSpecOptions(rows || []); })
        .catch(() => { if (!cancelled) setSpecOptions([]); })
        .finally(() => { if (!cancelled) setLoadingSpecs(false); });
    } else if (!isCreate) {
      setSpecOptions([]);
    }
    return () => { cancelled = true; };
  }, [componentId, isCreate]);

  // load spec options when component changes (view/edit context)
  useEffect(() => {
    let cancelled = false;
    if (editingContext && vComponentId) {
      setLoadingSpecs(true);
      fetchSpecsForComponentM3(vComponentId)
        .then((rows) => { if (!cancelled) setVSpecOptions(rows || []); })
        .catch(() => { if (!cancelled) setVSpecOptions([]); })
        .finally(() => { if (!cancelled) setLoadingSpecs(false); });
    } else {
      setVSpecOptions([]);
    }
    return () => { cancelled = true; };
  }, [editingContext, vComponentId]);

  const selectedItem = useMemo(
    () => (isCreate ? items.find((i) => i.id === itemId) : items.find((i) => i.id === vItemId)),
    [isCreate, items, itemId, vItemId]
  );
  const selectedComponents = (selectedItem && selectedItem.components) || [];
  const selectedComponent = selectedComponents.find((c) => c.id === (isCreate ? componentId : vComponentId));

  if (!open) return null;

  const pinNumber = viewAnnotation ? viewAnnotation.pin_number : nextPinNumber(annotations || []);
  const specDisplay = (spec) => {
    if (!spec) return '';
    const val =
      spec.value_type === 'NUMBER' ? spec.value_number :
      spec.value_type === 'BOOLEAN' ? (spec.value_boolean === true ? 'Ya' : spec.value_boolean === false ? 'Tidak' : '') :
      (spec.value_type === 'SELECT' || spec.value_type === 'MULTI_SELECT')
        ? (Array.isArray(spec.value_json) ? spec.value_json.filter(Boolean).join(', ') : (spec.value_json ? String(spec.value_json) : ''))
        : spec.value_text;
    return val ? `${spec.spec_label_snapshot || spec.spec_key_snapshot}: ${val}` : (spec.spec_label_snapshot || '');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    if (!itemId || !componentId) { alert('Pilih Product Item dan Komponen terlebih dahulu.'); return; }
    if (isBlankNote(noteText)) { alert('Catatan tidak boleh kosong.'); return; }
    setSaving(true);
    try {
      await createAnnotation({
        meeting_po_id: meetingPoId,
        po_item_id: itemId,
        item_component_id: componentId,
        component_specification_id: specId || null,
        pin_number: pinNumber,
        x_percent: createPosition.x,
        y_percent: createPosition.y,
        created_by: profile ? profile.id : null,
        note_text: noteText,
        note_type: noteType,
      });
      if (onChanged) await onChanged();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan pin: ' + (err && err.message ? err.message : 'unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!viewAnnotation || !canManage) return;
    if (isBlankNote(addNoteText)) { alert('Catatan tidak boleh kosong.'); return; }
    setSaving(true);
    try {
      await addNoteToAnnotation(viewAnnotation.id, {
        note_text: addNoteText,
        note_type: addNoteType,
        created_by: profile ? profile.id : null,
      });
      setAddNoteText('');
      setAddNoteType(NOTE_TYPE.DISCUSSION);
      if (onChanged) await onChanged();
    } catch (err) {
      console.error(err);
      alert('Gagal menambah catatan.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveContext = async () => {
    if (!viewAnnotation || !canManage) return;
    if (!vItemId || !vComponentId) { alert('Pilih Product Item dan Komponen.'); return; }
    setSaving(true);
    try {
      await updateAnnotationContext(viewAnnotation.id, {
        po_item_id: vItemId,
        item_component_id: vComponentId,
        component_specification_id: vSpecId || null,
      });
      setEditingContext(false);
      if (onChanged) await onChanged();
    } catch (err) {
      console.error(err);
      alert('Gagal mengubah konteks pin.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!viewAnnotation || !canManage) return;
    const next = viewAnnotation.status === ANNOTATION_STATUS.OPEN ? ANNOTATION_STATUS.RESOLVED : ANNOTATION_STATUS.OPEN;
    setSaving(true);
    try {
      await setAnnotationStatus(viewAnnotation.id, next);
      if (onChanged) await onChanged();
    } catch (err) {
      console.error(err);
      alert('Gagal mengubah status pin.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePin = async () => {
    if (!viewAnnotation || !canManage) return;
    if (!window.confirm(`Hapus Pin ${viewAnnotation.pin_number}?\n\nSemua catatan pada pin ini juga akan dihapus.`)) return;
    setSaving(true);
    try {
      await deleteAnnotation(viewAnnotation.id);
      if (onChanged) await onChanged();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus pin.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (note) => {
    if (!canManage) return;
    if (!window.confirm('Hapus catatan ini?')) return;
    try {
      await deleteNote(note.id);
      if (onChanged) await onChanged();
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus catatan.');
    }
  };

  // Mulai edit catatan individual (inline). Pre-fill text + jenis dari note.
  // Hanya satu note yang bisa di-edit pada satu waktu (editingNoteId).
  const handleStartEditNote = (note) => {
    if (!canManage) return;
    setEditingNoteId(note.id);
    setEditNoteText(note.note_text || '');
    setEditNoteType(note.note_type || NOTE_TYPE.DISCUSSION);
  };

  const handleCancelEditNote = () => {
    setEditingNoteId(null);
    setEditNoteText('');
    setEditNoteType(NOTE_TYPE.DISCUSSION);
  };

  // Simpan perubahan catatan via updateNote (validasi sama dgn add: blank-check).
  const handleSaveEditNote = async (note) => {
    if (!canManage) return;
    if (isBlankNote(editNoteText)) { alert('Catatan tidak boleh kosong.'); return; }
    setSaving(true);
    try {
      await updateNote(note.id, {
        note_text: editNoteText,
        note_type: editNoteType,
      });
      setEditingNoteId(null);
      setEditNoteText('');
      setEditNoteType(NOTE_TYPE.DISCUSSION);
      if (onChanged) await onChanged();
    } catch (err) {
      console.error(err);
      alert('Gagal mengubah catatan.');
    } finally {
      setSaving(false);
    }
  };

  const statusColor = BADGE_COLOR_CLASSES[ANNOTATION_STATUS_COLORS[viewAnnotation ? viewAnnotation.status : ANNOTATION_STATUS.OPEN]] || 'badge-gray';
  const noteBadge = (t) => BADGE_COLOR_CLASSES[NOTE_TYPE_COLORS[t]] || 'badge-gray';

  const renderItemSelect = (value, onChange, opts) => (
    <select
      value={value}
      onChange={(e) => { onChange(e.target.value); }}
      className="input w-full"
      disabled={!canManage}
    >
      <option value="">- Pilih Product Item -</option>
      {(opts || items).map((it) => (
        <option key={it.id} value={it.id}>{it.item_name}</option>
      ))}
    </select>
  );

  const renderComponentSelect = (value, onChange) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input w-full"
      disabled={!canManage || !selectedItem}
    >
      <option value="">- Pilih Komponen -</option>
      {(selectedComponents || []).map((c) => (
        <option key={c.id} value={c.id}>{componentDisplayLabel(c)}{c.is_custom ? ' (Custom)' : ''}</option>
      ))}
    </select>
  );

  const renderSpecSelect = (value, onChange, options) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input w-full"
      disabled={!canManage || !selectedComponent}
    >
      <option value="">Tidak spesifik</option>
      {(options || []).map((s) => (
        <option key={s.id} value={s.id}>{specDisplay(s)}</option>
      ))}
    </select>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-black/60" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-ink-900 border border-white/10 rounded-t-2xl sm:rounded-none shadow-2xl max-h-[85vh] sm:max-h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin size={18} className="text-primary-400 flex-shrink-0" />
            <h3 className="font-semibold text-white truncate">
              {isCreate ? 'PIN BARU' : 'PIN ' + (viewAnnotation ? viewAnnotation.pin_number : '')}
            </h3>
            {!isCreate && viewAnnotation && (
              <span className={'badge ' + statusColor}>{ANNOTATION_STATUS_LABELS[viewAnnotation.status]}</span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 text-ink-400 hover:text-white" title="Tutup">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* ============ CREATE MODE ============ */}
          {isCreate && (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs text-ink-400 mb-1">Product Item</label>
                {renderItemSelect(itemId, (v) => { setItemId(v); setComponentId(''); setSpecId(''); })}
              </div>
              <div>
                <label className="block text-xs text-ink-400 mb-1">Komponen *</label>
                <ComponentPicker
                  components={selectedComponents.concat(
                    (localCompsByItem[itemId] || []).filter(
                      (c) => !selectedComponents.some((s) => s.id === c.id)
                    )
                  )}
                  itemId={itemId}
                  value={componentId}
                  onChange={(v) => { setComponentId(v); setSpecId(''); }}
                  canManage={canManage}
                  profile={profile}
                  onComponentAdded={(created) => {
                    setLocalCompsByItem((prev) => ({
                      ...prev,
                      [itemId]: [...(prev[itemId] || []), created],
                    }));
                    if (onItemComponentAdded) onItemComponentAdded();
                  }}
                />
              </div>
              <div>
                <label className="block text-xs text-ink-400 mb-1">Spesifikasi terkait</label>
                {renderSpecSelect(specId, setSpecId, specOptions)}
                {loadingSpecs && <p className="text-xs text-ink-500 mt-1">Memuat spesifikasi...</p>}
              </div>
              <div>
                <label className="block text-xs text-ink-400 mb-1">Catatan *</label>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={3}
                  className="input w-full"
                  placeholder="Tulis catatan..."
                />
              </div>
              <div>
                <label className="block text-xs text-ink-400 mb-1">Jenis</label>
                <div className="flex gap-2">
                  {[NOTE_TYPE.DISCUSSION, NOTE_TYPE.INFO, NOTE_TYPE.DECISION].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNoteType(t)}
                      className={'btn btn-sm ' + (noteType === t ? 'btn-primary' : 'btn-secondary')}
                    >
                      {NOTE_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <button type="button" onClick={onClose} className="btn btn-ghost">Batal</button>
                <button type="submit" disabled={saving || !canManage} className="btn-primary">
                  <Check size={16} /> Simpan Pin
                </button>
              </div>
            </form>
          )}

          {/* ============ VIEW MODE ============ */}
          {!isCreate && viewAnnotation && (
            <>
              {/* Context */}
              <div className="rounded-lg border border-white/10 p-3 space-y-1">
                <p className="text-sm text-white font-medium">{viewAnnotation._componentLabel}</p>
                <p className="text-xs text-ink-400">{viewAnnotation._itemName}</p>
                {viewAnnotation.component_specification_id && viewAnnotation._specLabel && (
                  <p className="text-xs text-ink-300">• {viewAnnotation._specLabel}</p>
                )}
                <p className="text-xs text-ink-500">
                  Posisi: {viewAnnotation.x_percent != null ? Number(viewAnnotation.x_percent).toFixed(1) : '-'}%, {viewAnnotation.y_percent != null ? Number(viewAnnotation.y_percent).toFixed(1) : '-'}%
                </p>
              </div>

              {/* Edit context */}
              {editingContext ? (
                <div className="space-y-3 rounded-lg border border-white/10 p-3">
                  <p className="text-xs font-medium text-ink-300 uppercase tracking-wide">Ubah Konteks Pin</p>
                  {renderItemSelect(vItemId, (v) => { setVItemId(v); setVComponentId(''); setVSpecId(''); })}
                  {renderComponentSelect(vComponentId, (v) => { setVComponentId(v); setVSpecId(''); })}
                  {renderSpecSelect(vSpecId, setVSpecId, vSpecOptions)}
                  <div className="flex gap-2">
                    <button onClick={() => setEditingContext(false)} className="btn btn-ghost btn-sm">Batal</button>
                    <button onClick={handleSaveContext} disabled={saving} className="btn-primary btn-sm">
                      <Check size={14} /> Simpan
                    </button>
                  </div>
                </div>
              ) : (
                canManage && (
                  <button onClick={() => setEditingContext(true)} className="btn-secondary btn-sm w-full">
                    <Layers size={14} /> Ubah Konteks (Item / Komponen / Spesifikasi)
                  </button>
                )
              )}

              {/* Notes */}
              <div>
                <h4 className="text-xs font-medium text-ink-300 uppercase tracking-wide mb-2">Catatan ({viewAnnotation.notes.length})</h4>
                {viewAnnotation.notes.length === 0 ? (
                  <p className="text-sm text-ink-500">Belum ada catatan.</p>
                ) : (
                  <div className="space-y-2">
                    {decisionFirstNotes(viewAnnotation.notes).map((note) => {
                      const isEditing = editingNoteId === note.id;
                      return (
                      <div key={note.id} className={'rounded-lg border p-3 ' + (note.note_type === NOTE_TYPE.DECISION ? 'border-green-500/40 bg-green-500/5' : 'border-white/10 bg-black/20')}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={'badge ' + noteBadge(note.note_type)}>{NOTE_TYPE_LABELS[note.note_type]}</span>
                          {canManage && !isEditing && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleStartEditNote(note)} className="p-1 text-ink-400 hover:text-primary-400" title="Edit catatan">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => handleDeleteNote(note)} className="p-1 text-ink-400 hover:text-red-400" title="Hapus catatan">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={editNoteText}
                              onChange={(e) => setEditNoteText(e.target.value)}
                              rows={2}
                              className="input w-full"
                              placeholder="Tulis catatan..."
                            />
                            <div className="flex flex-wrap gap-2">
                              {[NOTE_TYPE.DISCUSSION, NOTE_TYPE.INFO, NOTE_TYPE.DECISION].map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => setEditNoteType(t)}
                                  className={'btn btn-sm ' + (editNoteType === t ? 'btn-primary' : 'btn-secondary')}
                                >
                                  {NOTE_TYPE_LABELS[t]}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={handleCancelEditNote} disabled={saving} className="btn btn-ghost btn-sm">Batal</button>
                              <button onClick={() => handleSaveEditNote(note)} disabled={saving} className="btn-primary btn-sm">
                                <Check size={14} /> Simpan
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-white whitespace-pre-wrap break-words">{note.note_text}</p>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add note */}
              {canManage && (
                <div className="space-y-2 rounded-lg border border-white/10 p-3">
                  <h4 className="text-xs font-medium text-ink-300 uppercase tracking-wide">+ Tambah Catatan</h4>
                  <textarea
                    value={addNoteText}
                    onChange={(e) => setAddNoteText(e.target.value)}
                    rows={2}
                    className="input w-full"
                    placeholder="Tulis catatan..."
                  />
                  <div className="flex flex-wrap gap-2">
                    {[NOTE_TYPE.DISCUSSION, NOTE_TYPE.INFO, NOTE_TYPE.DECISION].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setAddNoteType(t)}
                        className={'btn btn-sm ' + (addNoteType === t ? 'btn-primary' : 'btn-secondary')}
                      >
                        {NOTE_TYPE_LABELS[t]}
                      </button>
                    ))}
                  </div>
                  <button onClick={handleAddNote} disabled={saving} className="btn-primary btn-sm w-full">
                    <Plus size={14} /> Tambah Catatan
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button onClick={handleToggleStatus} disabled={saving || !canManage} className="btn-secondary btn-sm">
                  {viewAnnotation.status === ANNOTATION_STATUS.OPEN ? (
                    <><Check size={14} /> Tandai Selesai</>
                  ) : (
                    <><RotateCcw size={14} /> Buka Kembali</>
                  )}
                </button>
                {canManage && (
                  <button onClick={handleDeletePin} disabled={saving} className="btn btn-sm text-red-400 border border-red-500/40 hover:bg-red-500/10">
                    <Trash2 size={14} /> Hapus Pin
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
