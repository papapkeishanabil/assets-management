import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { X, Plus, Trash2, Search, GripVertical, Sparkles, Check, CornerUpRight } from 'lucide-react';
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
import {
  fetchComponentDefinitions,
  fetchItemComponents,
  createItemComponent,
  deleteItemComponent,
  getMaxComponentSortOrder,
  reorderItemComponents,
  previewDefaultComponents,
  applyDefaultComponents
} from '../../lib/ppm-m1-helpers';

// ============================================================
// Sortable Component Item
// Uses a drag handle (GripVertical) - the rest of the card is
// NOT draggable, so page scroll is not disrupted.
// ============================================================
function SortableComponentItem({ component, index, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: component.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    zIndex: isDragging ? 50 : undefined,
    boxShadow: isDragging ? '0 10px 25px -5px rgba(0, 0, 0, 0.5)' : undefined,
    borderColor: isDragging ? 'rgba(99, 102, 241, 0.6)' : undefined,
    background: isDragging ? 'rgba(99, 102, 241, 0.08)' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={'flex items-center gap-2 border rounded-lg p-3 transition-colors ' + (isDragging ? 'border-primary-500/60 bg-primary-500/10' : 'border-white/10 bg-ink-900/50')}
    >
      {/* Drag handle - only this element is draggable */}
      <button
        {...attributes}
        {...listeners}
        className="touch-none p-1.5 text-ink-500 hover:text-primary-400 cursor-grab active:cursor-grabbing flex-shrink-0"
        title="Drag untuk mengubah urutan"
        aria-label={'Drag ' + component.component_name_snapshot}
      >
        <GripVertical size={16} />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-500 font-mono">{String(index + 1).padStart(2, '0')}</span>
          <p className="text-sm text-white font-medium truncate">{component.component_name_snapshot}</p>
          {component.is_custom && (
            <span className="badge badge-yellow text-[10px] px-1.5 py-0.5">Custom</span>
          )}
        </div>
        {component.location_label && (
          <p className="text-xs text-ink-400 mt-0.5">{component.location_label}</p>
        )}
      </div>

      <button
        onClick={() => onDelete(component)}
        className="p-1.5 text-ink-400 hover:text-red-400 flex-shrink-0"
        title="Hapus"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export default function ComponentManagerModal({ open, onClose, item, profile, onSaved }) {
  const [components, setComponents] = useState([]);
  const [definitions, setDefinitions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isCustom, setIsCustom] = useState(false);
  const [form, setForm] = useState({
    component_definition_id: '',
    location_label: '',
    notes: ''
  });
  const [customForm, setCustomForm] = useState({
    component_name: '',
    location_label: '',
    notes: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  // M1.1 — "Terapkan Komponen Dasar" preview/confirm state.
  // applyPreview holds the { existingMatched, toAdd } diff (read-only) shown to
  // the user for confirmation before anything is written.
  const [applyPreview, setApplyPreview] = useState(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyingDefaults, setApplyingDefaults] = useState(false);

  // dnd-kit sensors: PointerSensor for desktop, TouchSensor for mobile.
  // activationConstraint on TouchSensor (delay 150ms + tolerance 5px) ensures
  // normal scroll is NOT blocked when user scrolls without intentionally dragging.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 8,
      },
    })
  );

  const loadComponents = async () => {
    if (!item) return;
    setLoading(true);
    try {
      const comps = await fetchItemComponents(item.id);
      setComponents(comps);
    } catch (error) {
      console.error('Error loading components:', error);
      toast.error('Gagal memuat komponen');
    } finally {
      setLoading(false);
    }
  };

  const loadDefinitions = async () => {
    try {
      const defs = await fetchComponentDefinitions();
      setDefinitions(defs);
    } catch (error) {
      console.error('Error loading component definitions:', error);
      toast.error('Gagal memuat daftar komponen');
    }
  };

  useEffect(() => {
    if (open) {
      setShowAddForm(false);
      setIsCustom(false);
      setSearchTerm('');
      setForm({ component_definition_id: '', location_label: '', notes: '' });
      setCustomForm({ component_name: '', location_label: '', notes: '' });
      setApplyPreview(null);
      loadComponents();
      loadDefinitions();
    }
  }, [open, item]);

  if (!open || !item) return null;

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Save old order for rollback if DB update fails
    const oldOrder = [...components];

    // Compute new order locally (immediate UI update)
    const oldIndex = components.findIndex(c => c.id === active.id);
    const newIndex = components.findIndex(c => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(components, oldIndex, newIndex);
    setComponents(newOrder);

    // Persist only after drop - batch update DB
    try {
      await reorderItemComponents(item.id, newOrder.map(c => c.id));
      toast.success('Urutan komponen disimpan');
      onSaved(); // refresh parent list without full page reload
    } catch (error) {
      console.error('Error reordering components:', error);
      // Rollback UI to previous order
      setComponents(oldOrder);
      toast.error('Gagal menyimpan urutan komponen.');
    }
  };

  const handleDeleteComponent = async (component) => {
    if (!window.confirm('Hapus komponen ini?')) return;
    try {
      await deleteItemComponent(component.id);
      toast.success('Komponen dihapus');
      await loadComponents();
      onSaved();
    } catch (error) {
      console.error('Error deleting component:', error);
      toast.error('Gagal menghapus komponen');
    }
  };

  const handleSubmitComponent = async () => {
    if (isCustom) {
      if (!customForm.component_name.trim()) {
        toast.error('Nama komponen wajib diisi');
        return;
      }
    } else {
      if (!form.component_definition_id) {
        toast.error('Pilih komponen dari daftar');
        return;
      }
    }

    setSaving(true);
    try {
      const maxSort = await getMaxComponentSortOrder(item.id);

      if (isCustom) {
        await createItemComponent({
          po_item_id: item.id,
          component_definition_id: null,
          component_name_snapshot: customForm.component_name.trim(),
          location_label: customForm.location_label || null,
          sort_order: maxSort + 1,
          is_custom: true,
          notes: customForm.notes || null,
          created_by: profile?.id || null
        });
        toast.success('Komponen custom ditambahkan');
      } else {
        const def = definitions.find(d => d.id === form.component_definition_id);
        if (!def) {
          toast.error('Komponen tidak ditemukan');
          return;
        }
        await createItemComponent({
          po_item_id: item.id,
          component_definition_id: def.id,
          component_name_snapshot: def.name,
          location_label: form.location_label || null,
          sort_order: maxSort + 1,
          is_custom: false,
          notes: form.notes || null,
          created_by: profile?.id || null
        });
        toast.success('Komponen ditambahkan');
      }

      await loadComponents();
      setShowAddForm(false);
      setIsCustom(false);
      setForm({ component_definition_id: '', location_label: '', notes: '' });
      setCustomForm({ component_name: '', location_label: '', notes: '' });
      setSearchTerm('');
      onSaved();
    } catch (error) {
      console.error('Error adding component:', error);
      toast.error('Gagal menambahkan komponen');
    } finally {
      setSaving(false);
    }
  };

  const filteredDefinitions = definitions.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ============ M1.1: Terapkan Komponen Dasar ============
  // Two-step flow: preview (read-only diff) -> confirm -> insert only missing.
  const handleOpenApplyDefaults = async () => {
    if (!item?.product_type_id) return;
    setApplyLoading(true);
    try {
      const { hasProductType, defaults, existingMatched, toAdd } = await previewDefaultComponents(item.id, item.product_type_id);
      if (!hasProductType || defaults.length === 0) {
        toast('Belum ada komponen dasar untuk jenis produk ini.', { icon: 'ℹ️' });
        return;
      }
      if (toAdd.length === 0) {
        toast('Semua komponen dasar sudah ada.', { icon: '✓' });
        return;
      }
      setApplyPreview({ existingMatched, toAdd });
    } catch (error) {
      console.error('Error previewing default components:', error);
      toast.error('Gagal memuat komponen dasar');
    } finally {
      setApplyLoading(false);
    }
  };

  const handleConfirmApplyDefaults = async () => {
    if (!item?.product_type_id) return;
    setApplyingDefaults(true);
    try {
      // applyDefaultComponents recomputes the diff at write time, so it stays
      // correct even if components changed between preview and confirm.
      const result = await applyDefaultComponents(item.id, item.product_type_id, profile?.id || null);
      toast.success(`${result.addedCount} komponen dasar ditambahkan`);
      setApplyPreview(null);
      await loadComponents();
      onSaved();
    } catch (error) {
      console.error('Error applying default components:', error);
      toast.error('Gagal menerapkan komponen dasar');
    } finally {
      setApplyingDefaults(false);
    }
  };

  const handleCancelApplyDefaults = () => setApplyPreview(null);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 overflow-y-auto" onClick={onClose}>
      <div className="card w-full max-w-lg mt-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold text-white">{item.item_name}</h2>
            <p className="text-sm text-ink-400">Kelola Komponen</p>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-white"><X size={20} /></button>
        </div>

        {/* ============ M1.1: Terapkan Komponen Dasar ============ */}
        {item.product_type_id && !applyPreview && (
          <button
            onClick={handleOpenApplyDefaults}
            disabled={applyLoading || saving || applyingDefaults}
            className="btn-secondary w-full mb-4 flex items-center justify-center gap-2"
          >
            <Sparkles size={14} />
            {applyLoading ? 'Memuat...' : 'Terapkan Komponen Dasar'}
          </button>
        )}

        {applyPreview && (
          <div className="border border-primary-500/30 bg-primary-500/[0.06] rounded-lg p-4 mb-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-primary-400" />
              <h4 className="text-sm font-medium text-white">Terapkan Komponen Dasar</h4>
            </div>

            {applyPreview.existingMatched.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-ink-300 uppercase tracking-wide mb-1">Sudah Ada</p>
                <div className="space-y-1">
                  {applyPreview.existingMatched.map((d) => (
                    <div key={'ex-' + d.id} className="flex items-center gap-2 text-sm text-ink-300">
                      <Check size={14} className="text-green-400 flex-shrink-0" />
                      <span className="truncate">{d.component_definitions?.name || d.component_name_snapshot}{d.default_location_label ? ' - ' + d.default_location_label : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-[11px] font-medium text-primary-300 uppercase tracking-wide mb-1">Akan Ditambahkan</p>
              <div className="space-y-1">
                {applyPreview.toAdd.map((d) => (
                  <div key={'add-' + d.id} className="flex items-center gap-2 text-sm text-white">
                    <CornerUpRight size={14} className="text-primary-400 flex-shrink-0" />
                    <span className="truncate">{d.component_definitions?.name || d.component_name_snapshot}{d.default_location_label ? ' - ' + d.default_location_label : ''}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={handleCancelApplyDefaults} className="btn-secondary btn-sm" disabled={applyingDefaults}>Batalkan</button>
              <button onClick={handleConfirmApplyDefaults} className="btn-primary btn-sm" disabled={applyingDefaults}>
                {applyingDefaults ? 'Menerapkan...' : 'Terapkan (' + applyPreview.toAdd.length + ')'}
              </button>
            </div>
          </div>
        )}

        {/* Component list with drag-and-drop */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white">KOMPONEN</h3>
            <span className="text-xs text-ink-400">{components.length} komponen</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-6 w-6 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            </div>
          ) : components.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-white/10 rounded-lg">
              <p className="text-sm text-ink-400 mb-2">Belum ada komponen</p>
              <button onClick={() => setShowAddForm(true)} className="btn-secondary btn-sm"><Plus size={14} />Tambah Komponen</button>
            </div>
          ) : (
            <>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={components.map(c => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {components.map((comp, index) => (
                      <SortableComponentItem
                        key={comp.id}
                        component={comp}
                        index={index}
                        onDelete={handleDeleteComponent}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <p className="text-xs text-ink-400 mt-2 flex items-center gap-1">
                <GripVertical size={12} /> Seret handle untuk mengubah urutan komponen.
              </p>
            </>
          )}
        </div>

        {/* Add component form */}
        {showAddForm ? (
          <div className="border border-white/10 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-white">Tambah Komponen</h4>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setIsCustom(false);
                }}
                className="text-xs text-ink-400 hover:text-white"
              >
                Batal
              </button>
            </div>

            {/* Toggle master/custom */}
            <div className="flex gap-2">
              <button
                onClick={() => setIsCustom(false)}
                className={'flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ' + (isCustom ? 'border-white/10 text-ink-400 hover:border-white/20' : 'border-primary-500/50 text-primary-400 bg-primary-500/10')}
              >
                Dari Master
              </button>
              <button
                onClick={() => setIsCustom(true)}
                className={'flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ' + (isCustom ? 'border-primary-500/50 text-primary-400 bg-primary-500/10' : 'border-white/10 text-ink-400 hover:border-white/20')}
              >
                Komponen Custom
              </button>
            </div>

            {isCustom ? (
              <>
                <div>
                  <label className="label">Nama Komponen *</label>
                  <input
                    type="text"
                    value={customForm.component_name}
                    onChange={(e) => setCustomForm({ ...customForm, component_name: e.target.value })}
                    className="input"
                    placeholder="Contoh: Ventilasi Mesh Punggung"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="label">Lokasi</label>
                  <input
                    type="text"
                    value={customForm.location_label}
                    onChange={(e) => setCustomForm({ ...customForm, location_label: e.target.value })}
                    className="input"
                    placeholder="Contoh: Punggung"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="label">Catatan</label>
                  <textarea
                    value={customForm.notes}
                    onChange={(e) => setCustomForm({ ...customForm, notes: e.target.value })}
                    className="input"
                    rows={2}
                    disabled={saving}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="label">Komponen *</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="input pl-9"
                      placeholder="Cari komponen..."
                      disabled={saving}
                    />
                  </div>
                  <select
                    value={form.component_definition_id}
                    onChange={(e) => setForm({ ...form, component_definition_id: e.target.value })}
                    className="input mt-2"
                    disabled={saving}
                  >
                    <option value="">Pilih komponen</option>
                    {filteredDefinitions.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Lokasi / Nama Khusus</label>
                  <input
                    type="text"
                    value={form.location_label}
                    onChange={(e) => setForm({ ...form, location_label: e.target.value })}
                    className="input"
                    placeholder="Contoh: Dada Kiri"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="label">Catatan</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="input"
                    rows={2}
                    disabled={saving}
                  />
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-2">
              <button onClick={handleSubmitComponent} className="btn-primary" disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <button onClick={() => setShowAddForm(true)} className="btn-secondary w-full"><Plus size={16} />+ Tambah Komponen</button>
          </div>
        )}

        <div className="mt-4 text-xs text-ink-400">
          <p>Urutan komponen diatur dengan drag-and-drop untuk memudahkan Technical Review.</p>
        </div>
      </div>
    </div>
  );
}