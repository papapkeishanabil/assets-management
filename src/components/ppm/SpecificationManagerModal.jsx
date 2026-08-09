import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { X, Plus, Trash2, GripVertical, Sparkles } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BADGE_COLOR_CLASSES } from '../../lib/constants';
import {
  fetchSpecsForComponent,
  previewStandardSpecifications,
  applyStandardSpecifications,
  createCustomSpecification,
  updateSpecificationValue,
  deleteSpecification,
  reorderSpecifications,
  confirmSpecification,
  markDiscussionRequired,
  markPending,
  resolveSpecification,
  computeReviewProgress,
  specValueAsInput,
  specOriginalInfo,
  SPEC_VALUE_TYPES,
  VALUE_TYPE_LABELS,
  SPEC_SOURCE_TYPES,
  SOURCE_TYPE_LABELS,
  REVIEW_STATUS,
  REVIEW_STATUS_LABELS,
    REVIEW_STATUS_COLORS,
  getSpecDisplayLabel,
  getSpecHelperText,
} from '../../lib/ppm-m2-helpers';

// Formati nilai ORIGINAL untuk ditampilkan (nilai PO semula)
function specOriginalInfoText(spec) {
  if (!spec) return '';
  const info = specOriginalInfo(spec);
  if (info.value === null || info.value === undefined || info.value === '') return '';
  if (spec.value_type === SPEC_VALUE_TYPES.BOOLEAN) return info.value === true ? 'Ya' : 'Tidak';
  const unit = spec.unit ? ' ' + spec.unit : '';
  if (spec.value_type === SPEC_VALUE_TYPES.SELECT || spec.value_type === SPEC_VALUE_TYPES.MULTI_SELECT) {
    const arr = Array.isArray(info.value) ? info.value : [info.value];
    return arr.filter(Boolean).join(', ') + unit;
  }
  return String(info.value) + unit;
}

// ============================================================
// Sortable Specification Item
// ============================================================
function SortableSpecItem({ spec, index, onValueChange, onDelete, onReviewAction, onDecision, canEdit }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: spec.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    zIndex: isDragging ? 50 : undefined,
    borderColor: isDragging ? 'rgba(99, 102, 241, 0.6)' : undefined,
  };

  const statusColor = REVIEW_STATUS_COLORS[spec.review_status] || 'gray';
  const statusClass = BADGE_COLOR_CLASSES[statusColor] || 'badge-gray';

  function ValueEditor() {
    const [val, setVal] = useState(() => specValueAsInput(spec));
    const [source, setSource] = useState(spec.source_type || SPEC_SOURCE_TYPES.PO);
    const [saving, setSaving] = useState(false);

    const save = async (e) => {
      if (e && e.key && e.key !== 'Enter') return;
      setSaving(true);
      try {
        await onValueChange(spec, val, source);
        toast.success('Nilai disimpan');
      } catch (err) {
        console.error(err);
        toast.error('Gagal menyimpan nilai');
      } finally {
        setSaving(false);
      }
    };

    return (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {spec.value_type === SPEC_VALUE_TYPES.BOOLEAN ? (
            <select
              value={val === true ? 'true' : val === false ? 'false' : ''}
              onChange={(e) => setVal(e.target.value === 'true' ? true : e.target.value === 'false' ? false : '')}
              className="input flex-1 min-w-[120px]"
              disabled={saving || !canEdit}
            >
              <option value="">- Pilih -</option>
              <option value="true">Ya</option>
              <option value="false">Tidak</option>
            </select>
          ) : (
            <input
              type={spec.value_type === SPEC_VALUE_TYPES.NUMBER ? 'number' : 'text'}
              value={val === null || val === undefined ? '' : val}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={save}
              placeholder="belum diisi"
              className="input flex-1 min-w-[120px]"
              disabled={saving || !canEdit}
            />
          )}
          {spec.unit && <span className="text-xs text-ink-400">{spec.unit}</span>}
          <button onClick={save} className="btn-primary btn-sm" disabled={saving || !canEdit}>
            Simpan
          </button>
        </div>
        {canEdit && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink-500">Sumber:</span>
            <label className="flex items-center gap-1 text-ink-300">
              <input
                type="radio"
                name={'src-' + spec.id}
                checked={source === SPEC_SOURCE_TYPES.PO}
                onChange={() => setSource(SPEC_SOURCE_TYPES.PO)}
              /> PO
            </label>
            <label className="flex items-center gap-1 text-ink-300">
              <input
                type="radio"
                name={'src-' + spec.id}
                checked={source === SPEC_SOURCE_TYPES.MANUAL}
                onChange={() => setSource(SPEC_SOURCE_TYPES.MANUAL)}
              /> Manual
            </label>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className={'flex items-start gap-2 border rounded-lg p-3 transition-colors ' + (isDragging ? 'border-primary-500/60 bg-primary-500/10' : 'border-white/10 bg-ink-900/50')}>
      <button {...attributes} {...listeners} className="touch-none p-1 mt-1 text-ink-500 hover:text-primary-400 cursor-grab active:cursor-grabbing flex-shrink-0" title="Drag untuk mengubah urutan">
        <GripVertical size={16} />
      </button>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-500 font-mono">{String(index + 1).padStart(2, '0')}</span>
          <p className="text-sm text-white font-medium">{getSpecDisplayLabel(spec)}</p>
          {spec.is_custom && <span className="badge badge-yellow text-[10px] px-1.5 py-0.5">Custom</span>}
          <span className={'badge ' + statusClass}>{REVIEW_STATUS_LABELS[spec.review_status]}</span>
        </div>

        {getSpecHelperText(spec) && (
          <p className="text-xs text-ink-400 mb-1">{getSpecHelperText(spec)}</p>
        )}
        <ValueEditor />

        {spec.notes && <p className="text-xs text-ink-400">Catatan: {spec.notes}</p>}

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <button onClick={() => onReviewAction(spec, 'CONFIRMED')} className="btn-ghost btn-sm" title="Tandai Sesuai">
              ✓ Sesuai
            </button>
          )}
          {canEdit && (
            <button onClick={() => onReviewAction(spec, 'DISCUSSION_REQUIRED')} className="btn-ghost btn-sm">
              Perlu Dibahas
            </button>
          )}
          {canEdit && (
            <button onClick={() => onReviewAction(spec, 'PENDING')} className="btn-ghost btn-sm">
              Pending
            </button>
          )}
          {canEdit && (spec.review_status === REVIEW_STATUS.DISCUSSION_REQUIRED || spec.review_status === REVIEW_STATUS.PENDING) && (
            <button onClick={() => onDecision(spec)} className="btn-secondary btn-sm">
              Set Keputusan
            </button>
          )}
          {canEdit && <button onClick={() => onDelete(spec)} className="p-1.5 text-ink-400 hover:text-red-400" title="Hapus"><Trash2 size={14} /></button>}
        </div>
      </div>
    </div>
  );
}


// ============================================================
// Specification Manager Modal
// ============================================================
export default function SpecificationManagerModal({ open, onClose, component, profile, onSaved }) {
  const [specs, setSpecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [applyPreview, setApplyPreview] = useState(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyingStandard, setApplyingStandard] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  // Panel "Set Keputusan" utk spec DISCUSSION_REQUIRED / PENDING
  const [decision, setDecision] = useState(null); // { spec, value, notes, saving }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  const canEdit = !!(profile && profile.id);

  const loadSpecs = async () => {
    if (!component) return;
    setLoading(true);
    fetchSpecsForComponent(component.id)
      .then(setSpecs)
      .catch((err) => { console.error(err); toast.error('Gagal memuat spesifikasi'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open && component) {
      setShowAddForm(false);
      setApplyPreview(null);
      setDecision(null);
      loadSpecs();
    }
    // eslint-disable-next-line
  }, [open, component]);

  if (!open || !component) return null;

  async function loadPreview() {
    setApplyLoading(true);
    try {
      const p = await previewStandardSpecifications(component);
      setApplyPreview(p);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat spesifikasi standar');
    } finally {
      setApplyLoading(false);
    }
  }

  async function handleApplyStandard() {
    if (!applyPreview || !applyPreview.toAdd.length) return;
    setApplyingStandard(true);
    try {
      const res = await applyStandardSpecifications(component, profile?.id);
      toast.success(res.message);
      setApplyPreview(null);
      await loadSpecs();
      if (onSaved) onSaved();
    } catch (err) {
      console.error(err);
      toast.error('Gagal menerapkan spesifikasi standar');
    } finally {
      setApplyingStandard(false);
    }
  }

  async function handleValueChange(spec, value, source) {
    const prev = specValueAsInput(spec);
    if (String(prev ?? '') === String(value ?? '')) {
      // hanya ganti source bila perlu
      if (source === spec.source_type) return;
    }
    await updateSpecificationValue(spec.id, {
      value,
      unit: spec.unit,
      source_type: source,
      notes: undefined,
    });
    await loadSpecs();
    if (onSaved) onSaved();
  }

  async function handleDelete(spec) {
    if (!window.confirm('Hapus spesifikasi "' + spec.spec_label_snapshot + '"?')) return;
    try {
      await deleteSpecification(spec.id);
      toast.success('Spesifikasi dihapus');
      await loadSpecs();
      if (onSaved) onSaved();
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghapus spesifikasi');
    }
  }

  async function handleReviewAction(spec, action) {
    try {
      const isConfirmed = spec.review_status === REVIEW_STATUS.CONFIRMED && action === 'CONFIRMED';
      if (!isConfirmed) {
        if (action === 'CONFIRMED') await confirmSpecification(spec.id, profile?.id);
        else if (action === 'DISCUSSION_REQUIRED') await markDiscussionRequired(spec.id);
        else if (action === 'PENDING') await markPending(spec.id);
      }
      await loadSpecs();
      if (onSaved) onSaved();
    } catch (err) {
      console.error(err);
      toast.error('Gagal memperbarui status');
    }
  }

  async function handleDecisionSave() {
    if (!decision) return;
    setDecision({ ...decision, saving: true });
    try {
      await resolveSpecification(decision.spec.id, {
        value: decision.value,
        unit: decision.spec.unit,
        notes: decision.notes || null,
        reviewerId: profile?.id,
      });
      toast.success('Keputusan disimpan');
      setDecision(null);
      await loadSpecs();
      if (onSaved) onSaved();
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan keputusan');
    } finally {
      setDecision((d) => d ? { ...d, saving: false } : d);
    }
  }

  function handleOpenDecision(spec) {
    setDecision({
      spec,
      value: specValueAsInput(spec),
      notes: spec.notes || '',
      saving: false,
    });
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldOrder = [...specs];
    const oldIndex = specs.findIndex((s) => s.id === active.id);
    const newIndex = specs.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(specs, oldIndex, newIndex);
    setSpecs(newOrder);
    try {
      await reorderSpecifications(component.id, newOrder.map((s) => s.id));
      toast.success('Urutan spesifikasi disimpan');
      if (onSaved) onSaved();
    } catch (err) {
      console.error(err);
      setSpecs(oldOrder);
      toast.error('Gagal menyimpan urutan');
    }
  };

  const progress = computeReviewProgress(specs);

const componentLabel = component.location_label
    ? component.component_name_snapshot + ' - ' + component.location_label
    : component.component_name_snapshot;

  const customFormInitial = {
    spec_label_snapshot: '',
    value_type: SPEC_VALUE_TYPES.TEXT,
    unit: '',
    value: '',
    notes: '',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-ink-900 border border-white/10 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h3 className="text-base font-semibold text-white">Spesifikasi</h3>
            <p className="text-xs text-ink-400">{componentLabel}</p>
          </div>
          <button onClick={onClose} className="p-2 text-ink-400 hover:text-white"><X size={18} /></button>
        </div>

        {/* Progress mini */}
        <div className="px-5 pt-3 flex flex-wrap items-center gap-2 text-xs text-ink-300">
          <span>Technical Review: <span className="text-white font-medium">{progress.selesai} / {progress.total} selesai</span></span>
          {progress.discussion > 0 && <span className="badge badge-orange">{progress.discussion} perlu dibahas</span>}
          {progress.pending > 0 && <span className="badge badge-yellow">{progress.pending} pending</span>}
        </div>

        <div className="px-5 pt-2 flex flex-wrap gap-2">
          {component.component_definition_id && (
            <button onClick={loadPreview} className="btn-secondary btn-sm" disabled={applyLoading}>
              <Sparkles size={14} /> Terapkan Spesifikasi Standar
            </button>
          )}
          <button onClick={() => setShowAddForm((v) => !v)} className="btn-secondary btn-sm" disabled={saving}>
            <Plus size={14} /> Tambah Spesifikasi
          </button>
        </div>

        {/* Preview Terapkan Spesifikasi Standar */}
        {applyPreview && (
          <div className="mx-5 mt-3 border border-primary-500/40 bg-primary-500/10 rounded-lg p-3">
            <p className="text-xs text-primary-300 mb-1 font-medium">AKAN DITAMBAHKAN</p>
            {applyPreview.toAdd.length === 0 ? (
              <p className="text-xs text-ink-300">Semua spesifikasi standar sudah ada.</p>
            ) : (
              <div className="space-y-1">
                {applyPreview.toAdd.map((d) => (
                  <p key={d.id} className="text-sm text-white flex items-center gap-2">
                    <span className="text-green-400">+</span> {d.spec_label} {d.default_unit ? `(${d.default_unit})` : ''}
                  </p>
                ))}
              </div>
            )}
            {applyPreview.toAdd.length > 0 && (
              <div className="flex gap-2 mt-2">
                <button onClick={handleApplyStandard} className="btn-primary btn-sm" disabled={applyingStandard}>
                  {applyingStandard ? 'Menerapkan...' : 'Terapkan'}
                </button>
                <button onClick={() => setApplyPreview(null)} className="btn-ghost btn-sm">Batal</button>
              </div>
            )}
          </div>
        )}

        {/* List Spesifikasi (dnd-kit sortable) */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-6 w-6 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : specs.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-white/10 rounded-lg">
              <p className="text-sm text-ink-400 mb-1">Belum ada spesifikasi.</p>
              <p className="text-xs text-ink-500 mb-3">Gunakan "Terapkan Spesifikasi Standar" atau tambah manual.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={specs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {specs.map((spec, index) => (
                    <SortableSpecItem
                      key={spec.id}
                      spec={spec}
                      index={index}
                      onValueChange={handleValueChange}
                      onDelete={handleDelete}
                      onReviewAction={handleReviewAction}
                      onDecision={handleOpenDecision}
                      canEdit={canEdit}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Add custom spec form */}
        {showAddForm && (
          <div className="border-t border-white/10 px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-white">Tambah Spesifikasi</h4>
              <button onClick={() => setShowAddForm(false)} className="text-xs text-ink-400 hover:text-white">Batal</button>
            </div>
            <CustomSpecForm
              onCreated={async () => {
                setShowAddForm(false);
                await loadSpecs();
                if (onSaved) onSaved();
              }}
              itemComponentId={component.id}
              creatorId={profile?.id}
              maxSortOrder={specs.length}
            />
          </div>
        )}

        {/* Set Keputusan panel */}
        {decision && (
          <div className="border-t border-white/10 px-5 py-4 space-y-3 bg-black/30">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-white">Set Keputusan — {decision.spec.spec_label_snapshot}</h4>
              <button onClick={() => setDecision(null)} className="text-xs text-ink-400 hover:text-white">Batal</button>
            </div>
            {specOriginalInfoText(decision.spec) && (
              <p className="text-xs text-ink-400">
                Nilai PO (semula): <span className="text-ink-200">{specOriginalInfoText(decision.spec)}</span>
              </p>
            )}
            <div>
              <label className="label">Nilai</label>
              <input
                type={decision.spec.value_type === SPEC_VALUE_TYPES.NUMBER ? 'number' : 'text'}
                value={decision.value ?? ''}
                onChange={(e) => setDecision({ ...decision, value: e.target.value })}
                className="input"
                disabled={decision.saving}
              />
              {decision.spec.unit && <span className="text-xs text-ink-400">{decision.spec.unit}</span>}
            </div>
            <div>
              <label className="label">Catatan Keputusan</label>
              <textarea value={decision.notes} onChange={(e) => setDecision({ ...decision, notes: e.target.value })} className="input" rows={2} disabled={decision.saving} />
            </div>
            <div className="flex justify-end">
              <button onClick={handleDecisionSave} className="btn-primary btn-sm" disabled={decision.saving}>
                {decision.saving ? 'Menyimpan...' : 'Sudah Diputuskan'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Custom Spec Form (+ Tambah Spesifikasi)
// ============================================================
function CustomSpecForm({ itemComponentId, creatorId, maxSortOrder, onCreated }) {
  const [form, setForm] = useState({
    spec_label_snapshot: '',
    value_type: SPEC_VALUE_TYPES.TEXT,
    unit: '',
    value: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.spec_label_snapshot.trim()) {
      toast.error('Nama spesifikasi wajib diisi');
      return;
    }
    setSaving(true);
    try {
      await createCustomSpecification({
        item_component_id: itemComponentId,
        spec_label_snapshot: form.spec_label_snapshot.trim(),
        value_type: form.value_type,
        unit: form.unit,
        value: form.value,
        notes: form.notes,
        created_by: creatorId,
        sort_order: (maxSortOrder || 0) + 1,
      });
      toast.success('Spesifikasi ditambahkan');
      onCreated();
    } catch (err) {
      console.error(err);
      toast.error('Gagal menambahkan spesifikasi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Nama Spesifikasi *</label>
        <input type="text" value={form.spec_label_snapshot} onChange={(e) => setForm({ ...form, spec_label_snapshot: e.target.value })} className="input" placeholder="Contoh: Bentuk Ujung Kerah" disabled={saving} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Tipe Nilai *</label>
          <select value={form.value_type} onChange={(e) => setForm({ ...form, value_type: e.target.value })} className="input" disabled={saving}>
            {Object.entries(VALUE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Unit</label>
          <input type="text" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input" placeholder="cm / pcs / dll" disabled={saving} />
        </div>
      </div>
      <div>
        <label className="label">Nilai</label>
        <input type="text" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="input" placeholder="opsional" disabled={saving} />
      </div>
      <div>
        <label className="label">Catatan</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" rows={2} disabled={saving} />
      </div>
      <div className="flex justify-end">
        <button onClick={submit} className="btn-primary btn-sm" disabled={saving}>
          {saving ? 'Menyimpan...' : 'Simpan Spesifikasi'}
        </button>
      </div>
    </div>
  );
}

