import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  Plus, Edit, Search, RefreshCw, X, Save, Power, Trash2,
  ChevronUp, ChevronDown, Layers
} from 'lucide-react';
import { fetchProductTypes, fetchComponentDefinitions } from '../lib/ppm-m1-helpers';
import { fetchSpecificationDefinitions } from '../lib/ppm-m2-helpers';
import SpecValueInput from '../components/ppm/SpecValueInput';
import {
  fetchTemplates,
  fetchTemplateDetail,
  saveTemplate,
  toggleTemplateActive,
  deleteTemplate,
  fetchStandards,
} from '../lib/ppm-m45a-helpers';
import { defsForComponent, specsAfterComponentChange } from '../lib/ppm-m45a-specs';

let seq = 0;
const uid = () => 'c' + Date.now().toString(36) + (seq++).toString(36);

const emptySpec = () => ({
  _key: uid(),
  specification_definition_id: '',
  spec_key_snapshot: '',
  spec_label_snapshot: '',
  value_type: 'TEXT',
  unit: '',
  is_required: false,
  default_value: '',
  standard_id: '',
});

const emptyComponent = () => ({
  _key: uid(),
  component_definition_id: '',
  component_name_snapshot: '',
  location_label: '',
  is_required: false,
  specs: [],
});

export default function PPMSpecTemplatesPage() {
  const { role } = useAuth();
  const canEdit = role && role.role_name === 'super_admin';

  const [templates, setTemplates] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [componentDefs, setComponentDefs] = useState([]);
  const [specDefs, setSpecDefs] = useState([]);
  const [standards, setStandards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', description: '', product_type_id: '' });
  const [components, setComponents] = useState([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [t, pt, cd, sd, st] = await Promise.all([
        fetchTemplates(true),
        fetchProductTypes(),
        fetchComponentDefinitions(),
        fetchSpecificationDefinitions(),
        fetchStandards(true),
      ]);
      setTemplates(t);
      setProductTypes(pt || []);
      setComponentDefs(cd || []);
      setSpecDefs(sd || []);
      setStandards(st || []);
    } catch (error) {
      console.error('Error fetching M4.5A master data:', error);
      toast.error('Gagal memuat data master spesifikasi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const specDefsByComponent = useCallback((componentDefinitionId) => {
    return defsForComponent(specDefs, componentDefinitionId);
  }, [specDefs]);

  const resetForm = () => {
    setEditingId(null);
    setForm({ code: '', name: '', description: '', product_type_id: '' });
    setComponents([]);
  };

  const handleAdd = () => { resetForm(); setShowModal(true); };

  const handleEdit = async (tpl) => {
    setEditingId(tpl.id);
    setForm({
      code: tpl.code,
      name: tpl.name,
      description: tpl.description || '',
      product_type_id: tpl.product_type_id || '',
    });
    try {
      const detail = await fetchTemplateDetail(tpl.id);
      setComponents((detail?.components || []).map((c) => ({
        _key: uid(),
        component_definition_id: c.component_definition_id || '',
        component_name_snapshot: c.component_name_snapshot || '',
        location_label: c.location_label || '',
        is_required: !!c.is_required,
        specs: (c.specs || []).map((s) => ({
          _key: uid(),
          specification_definition_id: s.specification_definition_id || '',
          spec_key_snapshot: s.spec_key_snapshot || '',
          spec_label_snapshot: s.spec_label_snapshot || '',
          value_type: s.value_type || 'TEXT',
          unit: s.unit || '',
          is_required: !!s.is_required,
          default_value: uiValueFor(s),
          standard_id: s.standard_id || '',
        })),
      })));
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat detail template');
      return;
    }
    setShowModal(true);
  };

  const uiValueFor = (spec) => {
    if (spec.value_type === 'BOOLEAN') return spec.default_value_boolean;
    if (spec.value_type === 'SELECT') return spec.default_value_json || '';
    if (spec.value_type === 'MULTI_SELECT') {
      const v = spec.default_value_json;
      return Array.isArray(v) ? v : v ? [String(v)] : [];
    }
    if (spec.value_type === 'NUMBER') return spec.default_value_number ?? '';
    return spec.default_value_text || '';
  };

  const handleToggleActive = async (tpl) => {
    try {
      await toggleTemplateActive(tpl.id, !tpl.is_active);
      toast.success(`Template ${tpl.is_active ? 'dinonaktifkan' : 'diaktifkan'}`);
      fetchAll();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (tpl) => {
    if (!window.confirm(`Hapus template "${tpl.name}"? Komponen & spec ikut terhapus.`)) return;
    try {
      await deleteTemplate(tpl.id);
      toast.success('Template dihapus');
      fetchAll();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const addComponent = () => setComponents((cs) => [...cs, emptyComponent()]);
  const removeComponent = (key) => setComponents((cs) => cs.filter((c) => c._key !== key));
  const moveComponent = (idx, dir) => {
    setComponents((cs) => {
      const next = [...cs];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return cs;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const patchComponent = (key, patch) => {
    setComponents((cs) => cs.map((c) => (c._key === key ? { ...c, ...patch } : c)));
  };

  const addSpec = (cKey) => {
    setComponents((cs) => cs.map((c) => (c._key === cKey ? { ...c, specs: [...c.specs, emptySpec()] } : c)));
  };
  const removeSpec = (cKey, sKey) => {
    setComponents((cs) => cs.map((c) => (c._key === cKey ? { ...c, specs: c.specs.filter((s) => s._key !== sKey) } : c)));
  };
  const moveSpec = (cKey, idx, dir) => {
    setComponents((cs) => cs.map((c) => {
      if (c._key !== cKey) return c;
      const next = [...c.specs];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return c;
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...c, specs: next };
    }));
  };

  const patchSpec = (cKey, sKey, patch) => {
    setComponents((cs) => cs.map((c) => (
      c._key === cKey
        ? { ...c, specs: c.specs.map((s) => (s._key === sKey ? { ...s, ...patch } : s)) }
        : c
    )));
  };

  const handleComponentDefChange = (key, defId) => {
    const def = componentDefs.find((d) => d.id === defId);
    if (defId) {
      const row = components.find((c) => c._key === key);
      const loc = (row?.location_label || '').trim();
      const dup = components.some(
        (c) => c._key !== key && c.component_definition_id === defId && (c.location_label || '').trim() === loc
      );
      if (dup) {
        toast.error(
          `Komponen "${def.name}" sudah ada di template${loc ? ` (lokasi "${loc}")` : ''}. Ubah lokasi dulu atau hapus baris duplikat.`
        );
        return;
      }
    }
    setComponents((cs) => cs.map((c) => {
      if (c._key !== key) return c;
      return {
        ...c,
        component_definition_id: defId,
        component_name_snapshot: def ? def.name : '',
        specs: specsAfterComponentChange(c.specs, defId, specDefs),
      };
    }));
  };

  const handleSpecDefChange = (cKey, sKey, defId) => {
    const def = specDefs.find((d) => d.id === defId);
    patchSpec(cKey, sKey, {
      specification_definition_id: defId,
      spec_key_snapshot: def ? def.spec_key : '',
      spec_label_snapshot: def ? def.spec_label : '',
      value_type: def ? def.value_type : 'TEXT',
      unit: def ? def.default_unit || '' : '',
      default_value: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Kode dan nama template wajib diisi');
      return;
    }
    setSaving(true);
    try {
      await saveTemplate({
        templateId: editingId,
        code: form.code,
        name: form.name,
        description: form.description,
        product_type_id: form.product_type_id,
        created_by: null,
        components: components.map((c) => ({
          component_definition_id: c.component_definition_id || null,
          component_name_snapshot: c.component_name_snapshot,
          location_label: c.location_label || null,
          is_required: c.is_required,
          specs: c.specs.map((s) => ({
            specification_definition_id: s.specification_definition_id || null,
            spec_key_snapshot: s.spec_key_snapshot,
            spec_label_snapshot: s.spec_label_snapshot,
            value_type: s.value_type,
            unit: s.unit || null,
            is_required: s.is_required,
            default_value: s.default_value,
            standard_id: s.standard_id || null,
          })),
        })),
      });
      toast.success(editingId ? 'Template diperbarui' : 'Template ditambahkan');
      setShowModal(false);
      resetForm();
      fetchAll();
    } catch (error) {
      if (error.code === '23505') toast.error('Kode template sudah ada atau ada komponen/spec duplikat');
      else toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = templates.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.code.toLowerCase().includes(q) || t.name.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Template Spesifikasi</h1>
          <p className="text-sm text-ink-400 mt-1">
            Komposisi komponen + spec (DEFAULT &amp; REQUIRED) per product type. Dipakai saat kompose model (M4.5B).
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAll} className="btn-secondary text-sm" disabled={loading}>
            <RefreshCw size={14} className={`${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {canEdit && (
            <button onClick={handleAdd} className="btn-primary text-sm">
              <Plus size={14} />
              Tambah Template
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="relative group">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Cari kode atau nama template..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-white/5 rounded-md animate-pulse"></div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Layers size={48} /></div>
            <h3 className="empty-state-title">Tidak ada template spesifikasi</h3>
            <p className="empty-state-text">Buat template pertama untuk komposisi komponen &amp; spec per product type</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th>Product Type</th>
                  <th>Komponen</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="hover-card">
                    <td className="font-mono text-[13px] text-white">{t.code}</td>
                    <td className="font-medium text-white">{t.name}</td>
                    <td className="text-ink-400">{t.product_types?.name || '-'}</td>
                    <td className="text-ink-300">{t.component_count ?? '-'}</td>
                    <td>
                      <span className={t.is_active ? 'badge-green' : 'badge-gray'}>
                        {t.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <>
                            <button onClick={() => handleEdit(t)} className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded-md transition-all" title="Edit">
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleActive(t)}
                              className={`p-1.5 rounded-md transition-all ${t.is_active ? 'text-orange-400 hover:bg-orange-500/10' : 'text-success-400 hover:bg-success-500/10'}`}
                              title={t.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            >
                              <Power size={14} />
                            </button>
                            <button onClick={() => handleDelete(t)} className="p-1.5 text-danger-400 hover:bg-danger-500/10 rounded-md transition-all" title="Hapus">
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
                  <Layers size={18} className="text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {editingId ? 'Edit Template Spesifikasi' : 'Tambah Template Spesifikasi'}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Kode Template</label>
                  <input
                    className="input"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="mis. KEMEJA_LAPANGAN_STD"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="label">Product Type</label>
                  <select
                    className="input"
                    value={form.product_type_id}
                    onChange={(e) => setForm({ ...form, product_type_id: e.target.value })}
                    disabled={saving}
                  >
                    <option value="">— Tanpa scope —</option>
                    {productTypes.map((pt) => (
                      <option key={pt.id} value={pt.id}>{pt.code} — {pt.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Nama Template</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="mis. Kemeja Lapangan Standar"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="label">Deskripsi</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  disabled={saving}
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div className="text-sm font-semibold text-white">Komponen &amp; Spec</div>
                <button type="button" onClick={addComponent} className="btn-secondary btn-sm" disabled={saving}>
                  <Plus size={13} /> Tambah Komponen
                </button>
              </div>

              <div className="space-y-3">
                {components.map((c, ci) => (
                  <div key={c._key} className="border border-white/10 rounded-lg p-3 bg-ink-900/50">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <button type="button" onClick={() => moveComponent(ci, -1)} disabled={ci === 0 || saving} className="p-0.5 text-ink-500 hover:text-white disabled:opacity-30">
                          <ChevronUp size={14} />
                        </button>
                        <button type="button" onClick={() => moveComponent(ci, 1)} disabled={ci === components.length - 1 || saving} className="p-0.5 text-ink-500 hover:text-white disabled:opacity-30">
                          <ChevronDown size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                        <select
                          className="input text-sm py-2"
                          value={c.component_definition_id}
                          onChange={(e) => handleComponentDefChange(c._key, e.target.value)}
                          disabled={saving}
                        >
                          <option value="">— Komponen custom (isi nama) —</option>
                          {componentDefs.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                        <input
                          className="input text-sm py-2"
                          placeholder="Nama snapshot"
                          value={c.component_name_snapshot}
                          onChange={(e) => patchComponent(c._key, { component_name_snapshot: e.target.value })}
                          disabled={saving}
                        />
                      </div>
                      <input
                        className="input text-sm py-2 max-w-[140px]"
                        placeholder="Lokasi (opsional)"
                        value={c.location_label}
                        onChange={(e) => patchComponent(c._key, { location_label: e.target.value })}
                        disabled={saving}
                      />
                      <label className="flex items-center gap-1.5 text-xs text-ink-300 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={c.is_required}
                          onChange={(e) => patchComponent(c._key, { is_required: e.target.checked })}
                          disabled={saving}
                        />
                        Wajib
                      </label>
                      <button type="button" onClick={() => removeComponent(c._key)} className="p-1.5 text-danger-400 hover:bg-danger-500/10 rounded-md" title="Hapus komponen" disabled={saving}>
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="mt-2 space-y-2">
                      {c.specs.map((s, si) => {
                        const defOptions = specDefsByComponent(c.component_definition_id);
                        return (
                          <div key={s._key} className="border border-white/5 rounded-md p-2 bg-ink-950/60">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex flex-col">
                                <button type="button" onClick={() => moveSpec(c._key, si, -1)} disabled={si === 0 || saving} className="p-0.5 text-ink-500 hover:text-white disabled:opacity-30">
                                  <ChevronUp size={13} />
                                </button>
                                <button type="button" onClick={() => moveSpec(c._key, si, 1)} disabled={si === c.specs.length - 1 || saving} className="p-0.5 text-ink-500 hover:text-white disabled:opacity-30">
                                  <ChevronDown size={13} />
                                </button>
                              </div>
                              <select
                                className="input text-sm py-1.5 flex-1 min-w-[160px]"
                                value={s.specification_definition_id}
                                onChange={(e) => handleSpecDefChange(c._key, s._key, e.target.value)}
                                disabled={saving}
                              >
                                <option value="">— Custom spec —</option>
                                {defOptions.map((d) => (
                                  <option key={d.id} value={d.id}>{d.spec_label}</option>
                                ))}
                              </select>
                              <input
                                className="input text-sm py-1.5 max-w-[150px]"
                                placeholder="Label"
                                value={s.spec_label_snapshot}
                                onChange={(e) => patchSpec(c._key, s._key, { spec_label_snapshot: e.target.value })}
                                disabled={saving || !!s.specification_definition_id}
                              />
                              <input
                                className="input text-sm py-1.5 max-w-[70px]"
                                placeholder="Unit"
                                value={s.unit}
                                onChange={(e) => patchSpec(c._key, s._key, { unit: e.target.value })}
                                disabled={saving || !!s.specification_definition_id}
                              />
                              <label className="flex items-center gap-1.5 text-xs text-ink-300 whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={s.is_required}
                                  onChange={(e) => patchSpec(c._key, s._key, { is_required: e.target.checked })}
                                  disabled={saving}
                                />
                                Wajib
                              </label>
                              <select
                                className="input text-sm py-1.5 max-w-[150px]"
                                value={s.standard_id}
                                onChange={(e) => patchSpec(c._key, s._key, { standard_id: e.target.value })}
                                disabled={saving}
                                title="STANDARD (opsional): aturan resmi Harmas/Ofissio — menang atas DEFAULT saat kompose (M4.5B)"
                              >
                                <option value="">— STANDARD: tanpa —</option>
                                {standards.filter((st) => st.is_active).map((st) => (
                                  <option key={st.id} value={st.id}>{st.code}</option>
                                ))}
                              </select>
                              <button type="button" onClick={() => removeSpec(c._key, s._key)} className="p-1 text-danger-400 hover:bg-danger-500/10 rounded-md" disabled={saving}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <div className="text-[11px] text-ink-500 mb-1">
                                  DEFAULT — nilai awal yang disarankan
                                  {s.standard_id ? ' (STANDARD terpilih akan menang saat kompose)' : ''}
                                </div>
                                <SpecValueInput
                                  valueType={s.value_type}
                                  value={s.default_value}
                                  onChange={(v) => patchSpec(c._key, s._key, { default_value: v })}
                                  options={s.specification_definition_id ? defOptions.find((d) => d.id === s.specification_definition_id)?.options_json : null}
                                  disabled={saving}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <button type="button" onClick={() => addSpec(c._key)} className="btn-secondary btn-sm" disabled={saving}>
                        <Plus size={12} /> Tambah Spec
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary btn-sm" disabled={saving}>
                  Batal
                </button>
                <button type="submit" className="btn-primary btn-sm" disabled={saving}>
                  <Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
