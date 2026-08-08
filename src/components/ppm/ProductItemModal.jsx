import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { X, CheckSquare, Square, Layers } from 'lucide-react';
import { fetchProductTypes, createPOItemWithDefaults, updatePOItem, getMaxPOItemSortOrder, fetchDefaultComponents } from '../../lib/ppm-m1-helpers';

const GENDER_OPTIONS = [
  { value: '', label: 'Tidak Ditentukan' },
  { value: 'PRIA', label: 'Pria' },
  { value: 'WANITA', label: 'Wanita' },
  { value: 'UNISEX', label: 'Unisex' },
  { value: 'ANAK_PRIA', label: 'Anak Pria' },
  { value: 'ANAK_WANITA', label: 'Anak Wanita' }
];

export default function ProductItemModal({ open, onClose, meetingPoId, profile, item, onSaved }) {
  const isCreate = !item;
  const [productTypes, setProductTypes] = useState([]);
  const [form, setForm] = useState({
    item_name: '',
    product_type_id: '',
    quantity: '',
    gender_category: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);

  // M1.1 — Default Component Set (CREATE mode only)
  // setupMode: 'default' = clone selected default components, 'blank' = start empty
  const [setupMode, setSetupMode] = useState('default');
  const [defaults, setDefaults] = useState([]); // product_type_default_components rows for the selected type
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const [checkedMap, setCheckedMap] = useState({}); // { [defaultRowId]: true }

  // Edit-mode warning when the product type is changed on an existing item
  const [typeChangeWarn, setTypeChangeWarn] = useState(null); // { oldName, newName } | null

  // Load master product types whenever the modal opens
  useEffect(() => {
    if (!open) return;
    setLoadingTypes(true);
    fetchProductTypes()
      .then(setProductTypes)
      .catch((err) => {
        console.error('Error loading product types:', err);
        toast.error('Gagal memuat jenis produk');
      })
      .finally(() => setLoadingTypes(false));
  }, [open]);

  // Reset form when opening / switching between create & edit
  useEffect(() => {
    if (!open) return;
    if (item) {
      setForm({
        item_name: item.item_name || '',
        product_type_id: item.product_type_id || '',
        quantity: item.quantity ?? '',
        gender_category: item.gender_category || '',
        notes: item.notes || ''
      });
    } else {
      setForm({ item_name: '', product_type_id: '', quantity: '', gender_category: '', notes: '' });
      setSetupMode('default');
    }
    setDefaults([]);
    setCheckedMap({});
    setTypeChangeWarn(null);
  }, [open, item]);

  // CREATE only: when a product type is selected, fetch its default component set
  // and pre-check every component. Switching the type reloads + re-checks.
  useEffect(() => {
    if (!open || !isCreate) return;
    if (!form.product_type_id) {
      setDefaults([]);
      setCheckedMap({});
      return;
    }
    let cancelled = false;
    setLoadingDefaults(true);
    fetchDefaultComponents(form.product_type_id)
      .then((defs) => {
        if (cancelled) return;
        setDefaults(defs);
        const map = {};
        defs.forEach((d) => { map[d.id] = true; });
        setCheckedMap(map);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Error loading default components:', err);
        toast.error('Gagal memuat komponen dasar');
        setDefaults([]);
        setCheckedMap({});
      })
      .finally(() => { if (!cancelled) setLoadingDefaults(false); });
    return () => { cancelled = true; };
  }, [open, isCreate, form.product_type_id]);

  // EDIT only: warn if the product type is changed. Per spec, changing the type
  // must NOT automatically add/remove/replace existing components — we only flag it.
  useEffect(() => {
    if (!open || isCreate) return;
    if (form.product_type_id && form.product_type_id !== item.product_type_id) {
      const oldName = item.product_types?.name || 'jenis produk lama';
      const newType = productTypes.find((pt) => pt.id === form.product_type_id);
      setTypeChangeWarn({ oldName, newName: newType?.name || 'jenis produk baru' });
    } else {
      setTypeChangeWarn(null);
    }
  }, [open, isCreate, item, form.product_type_id, productTypes]);

  if (!open) return null;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSetupModeChange = (mode) => {
    setSetupMode(mode);
    // Returning to "Gunakan Komponen Dasar" restores the default-all-checked state.
    if (mode === 'default') {
      const map = {};
      defaults.forEach((d) => { map[d.id] = true; });
      setCheckedMap(map);
    }
  };

  const toggleDefault = (defaultRowId) => {
    setCheckedMap((prev) => ({ ...prev, [defaultRowId]: !prev[defaultRowId] }));
  };

  const selectedCount = defaults.filter((d) => checkedMap[d.id]).length;

  const handleSubmit = async () => {
    if (!form.item_name.trim()) {
      toast.error('Nama item wajib diisi');
      return;
    }

    setSaving(true);
    try {
      if (item) {
        // EDIT — only update item fields. Existing components are never touched here.
        await updatePOItem(item.id, {
          item_name: form.item_name.trim(),
          product_type_id: form.product_type_id || null,
          quantity: form.quantity ? Number(form.quantity) : null,
          gender_category: form.gender_category || null,
          notes: form.notes || null
        });
        toast.success('Item produk berhasil diperbarui');
      } else {
        // CREATE — clone the selected default components (if any) atomically.
        const sortOrder = await getMaxPOItemSortOrder(meetingPoId);
        let selectedDefaults = [];
        if (setupMode === 'default' && form.product_type_id) {
          // Preserve master sort_order by keeping the fetched (sort-ordered) sequence
          // and only keeping the checked rows.
          selectedDefaults = defaults
            .filter((d) => checkedMap[d.id])
            .map((d) => ({
              component_definition_id: d.component_definition_id,
              name: d.component_definitions?.name,
              default_location_label: d.default_location_label || null,
              sort_order: d.sort_order
            }));
        }

        await createPOItemWithDefaults({
          meeting_po_id: meetingPoId,
          product_type_id: form.product_type_id || null,
          item_name: form.item_name.trim(),
          quantity: form.quantity ? Number(form.quantity) : null,
          gender_category: form.gender_category || null,
          notes: form.notes || null,
          created_by: profile?.id || null,
          sort_order: sortOrder + 1,
          selectedDefaults
        });
        toast.success(
          selectedDefaults.length > 0
            ? `Item produk dibuat dengan ${selectedDefaults.length} komponen dasar`
            : 'Item produk berhasil ditambahkan'
        );
      }
      onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving product item:', error);
      toast.error('Gagal menyimpan item produk');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 overflow-y-auto" onClick={onClose}>
      <div className="card w-full max-w-lg mt-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">{item ? 'Edit Item Produk' : 'Tambah Item Produk'}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Nama Item *</label>
            <input
              type="text"
              name="item_name"
              value={form.item_name}
              onChange={handleChange}
              className="input"
              placeholder="Contoh: Kemeja ERT"
              disabled={saving}
            />
          </div>

          <div>
            <label className="label">Jenis Produk</label>
            {loadingTypes ? (
              <div className="input flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Memuat...
              </div>
            ) : (
              <select
                name="product_type_id"
                value={form.product_type_id}
                onChange={handleChange}
                className="input"
                disabled={saving}
              >
                <option value="">Pilih jenis produk</option>
                {productTypes.map((pt) => (
                  <option key={pt.id} value={pt.id}>{pt.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* ============ M1.1: SETUP KOMPONEN (CREATE only) ============ */}
          {isCreate && (
            <div className="border border-white/10 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-primary-400" />
                <h3 className="text-sm font-medium text-white">Setup Komponen</h3>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => handleSetupModeChange('default')}
                  disabled={saving}
                  className={'flex-1 px-3 py-2 text-xs rounded-lg border transition-colors text-left ' + (setupMode === 'default' ? 'border-primary-500/50 text-primary-300 bg-primary-500/10' : 'border-white/10 text-ink-400 hover:border-white/20')}
                >
                  <span className="block font-medium">Gunakan Komponen Dasar</span>
                  <span className="block text-[11px] text-ink-500 mt-0.5">Tambah otomatis komponen standar</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetupModeChange('blank')}
                  disabled={saving}
                  className={'flex-1 px-3 py-2 text-xs rounded-lg border transition-colors text-left ' + (setupMode === 'blank' ? 'border-primary-500/50 text-primary-300 bg-primary-500/10' : 'border-white/10 text-ink-400 hover:border-white/20')}
                >
                  <span className="block font-medium">Mulai Kosong</span>
                  <span className="block text-[11px] text-ink-500 mt-0.5">Tambah komponen manual nanti</span>
                </button>
              </div>

              {setupMode === 'default' && (
                loadingDefaults ? (
                  <div className="flex items-center justify-center py-4">
                    <svg className="animate-spin h-5 w-5 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                  </div>
                ) : defaults.length > 0 ? (
                  <div className="space-y-1">
                    <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                      {defaults.map((d) => {
                        const checked = !!checkedMap[d.id];
                        const label = d.component_definitions?.name || d.component_name_snapshot;
                        return (
                          <button
                            type="button"
                            key={d.id}
                            onClick={() => toggleDefault(d.id)}
                            disabled={saving}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.04] transition-colors text-left"
                          >
                            {checked
                              ? <CheckSquare size={16} className="text-primary-400 flex-shrink-0" />
                              : <Square size={16} className="text-ink-500 flex-shrink-0" />}
                            <span className={'text-sm truncate ' + (checked ? 'text-white' : 'text-ink-400')}>
                              {label}{d.default_location_label ? ' - ' + d.default_location_label : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-primary-300 pt-1">
                      {selectedCount} komponen dasar akan ditambahkan.
                    </p>
                  </div>
                ) : form.product_type_id ? (
                  <p className="text-xs text-ink-400">
                    Belum ada komponen dasar untuk jenis produk ini. Anda dapat menambahkan komponen secara manual setelah item dibuat.
                  </p>
                ) : (
                  <p className="text-xs text-ink-500">
                    Pilih jenis produk untuk memuat komponen dasar.
                  </p>
                )
              )}

              {setupMode === 'blank' && (
                <p className="text-xs text-ink-400">
                  Item akan dibuat tanpa komponen. Gunakan <span className="text-ink-300">Kelola Komponen</span> untuk menambah komponen secara manual.
                </p>
              )}
            </div>
          )}

          {/* ============ EDIT: product type change warning ============ */}
          {isCreate === false && typeChangeWarn && (
            <div className="border border-yellow-500/30 bg-yellow-500/10 rounded-lg p-3">
              <p className="text-xs text-yellow-300">
                Jenis produk berubah dari <strong>{typeChangeWarn.oldName}</strong> menjadi <strong>{typeChangeWarn.newName}</strong>. Komponen yang sudah ada tidak akan diubah otomatis.
              </p>
            </div>
          )}

          <div>
            <label className="label">Quantity</label>
            <input
              type="number"
              name="quantity"
              value={form.quantity}
              onChange={handleChange}
              className="input"
              placeholder="Contoh: 134"
              min="0"
              disabled={saving}
            />
          </div>

          <div>
            <label className="label">Gender</label>
            <select
              name="gender_category"
              value={form.gender_category}
              onChange={handleChange}
              className="input"
              disabled={saving}
            >
              {GENDER_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Catatan</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              className="input"
              rows={3}
              disabled={saving}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary" disabled={saving}>Batal</button>
          <button onClick={handleSubmit} className="btn-primary" disabled={saving}>
            {saving ? 'Menyimpan...' : (item ? 'Simpan Perubahan' : 'Buat Item')}
          </button>
        </div>
      </div>
    </div>
  );
}
