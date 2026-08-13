import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  Plus, Edit, Search, RefreshCw, X, Save, Power, Trash2, ShieldCheck, GitBranch, ListChecks
} from 'lucide-react';
import { fetchProductTypes, fetchComponentDefinitions } from '../lib/ppm-m1-helpers';
import { fetchSpecificationDefinitions } from '../lib/ppm-m2-helpers';
import SpecValueInput from '../components/ppm/SpecValueInput';
import {
  fetchStandards,
  fetchStandardDetail,
  saveStandard,
  toggleStandardActive,
  deleteStandard,
  STANDARD_TYPE,
  STANDARD_TYPE_LABELS,
} from '../lib/ppm-m45a-helpers';
import { ruleUnitLabel } from '../lib/ppm-m45a1-rules';

let seq = 0;
const uid = () => 's' + Date.now().toString(36) + (seq++).toString(36);

const emptySpecRow = () => ({
  _key: uid(),
  component_definition_id: '',
  specification_definition_id: '',
  spec_key_snapshot: '',
  value_type: 'TEXT',
  unit: '',
  value: '',
  is_required: false,
});

const emptyRuleRow = () => ({
  _key: uid(),
  component_definition_id: '',
  condition_specification_definition_id: '',
  condition_spec_key_snapshot: '',
  condition_spec_label_snapshot: '',
  condition_value_type: 'TEXT',
  condition_unit: '',
  condition_value: '',
  result_specification_definition_id: '',
  result_spec_key_snapshot: '',
  result_spec_label_snapshot: '',
  result_value_type: 'TEXT',
  result_unit: '',
  result_value: '',
});

export default function PPMTechnicalStandardsPage() {
  const { role } = useAuth();
  const canEdit = role && role.role_name === 'super_admin';

  const [standards, setStandards] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [componentDefs, setComponentDefs] = useState([]);
  const [specDefs, setSpecDefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', description: '', product_type_id: '', standard_type: STANDARD_TYPE.FIXED });
  const [specs, setSpecs] = useState([]);
  const [rules, setRules] = useState([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [st, pt, cd, sd] = await Promise.all([
        fetchStandards(true),
        fetchProductTypes(),
        fetchComponentDefinitions(),
        fetchSpecificationDefinitions(),
      ]);
      setStandards(st);
      setProductTypes(pt || []);
      setComponentDefs(cd || []);
      setSpecDefs(sd || []);
    } catch (error) {
      console.error('Error fetching standards:', error);
      toast.error('Gagal memuat data standar teknis');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const specDefsByComponent = useCallback((componentDefinitionId) => {
    if (!componentDefinitionId) return specDefs;
    return (specDefs || []).filter((d) => d.component_definition_id === componentDefinitionId);
  }, [specDefs]);

  const defById = useCallback((defId) => (specDefs || []).find((d) => d.id === defId), [specDefs]);

  const resetForm = () => {
    setEditingId(null);
    setForm({ code: '', name: '', description: '', product_type_id: '', standard_type: STANDARD_TYPE.FIXED });
    setSpecs([]);
    setRules([]);
  };

  const handleAdd = () => { resetForm(); setShowModal(true); };

  const handleEdit = async (std) => {
    setEditingId(std.id);
    setForm({
      code: std.code,
      name: std.name,
      description: std.description || '',
      product_type_id: std.product_type_id || '',
      standard_type: std.standard_type === STANDARD_TYPE.CONDITIONAL ? STANDARD_TYPE.CONDITIONAL : STANDARD_TYPE.FIXED,
    });
    try {
      const detail = await fetchStandardDetail(std.id);
      setSpecs((detail?.specs || []).map((r) => ({
        _key: uid(),
        component_definition_id: r.component_definition_id || '',
        specification_definition_id: r.specification_definition_id || '',
        spec_key_snapshot: r.spec_key_snapshot || '',
        value_type: r.value_type || 'TEXT',
        unit: r.unit || '',
        value: uiValueFor(r),
        is_required: !!r.is_required,
      })));
      setRules((detail?.rules || []).map((r) => ({
        _key: uid(),
        component_definition_id: r.component_definition_id || '',
        condition_specification_definition_id: r.condition_specification_definition_id || '',
        condition_spec_key_snapshot: r.condition_spec_key_snapshot || '',
        condition_spec_label_snapshot: r.condition_spec_label_snapshot || '',
        condition_value_type: r.condition_value_type || 'TEXT',
        condition_unit: r.condition_unit || '',
        condition_value: uiValueFor({
          value_type: r.condition_value_type,
          value_text: r.condition_value_text,
          value_number: r.condition_value_number,
          value_boolean: r.condition_value_boolean,
          value_json: r.condition_value_json,
        }),
        result_specification_definition_id: r.result_specification_definition_id || '',
        result_spec_key_snapshot: r.result_spec_key_snapshot || '',
        result_spec_label_snapshot: r.result_spec_label_snapshot || '',
        result_value_type: r.result_value_type || 'TEXT',
        result_unit: r.result_unit || '',
        result_value: uiValueFor({
          value_type: r.result_value_type,
          value_text: r.result_value_text,
          value_number: r.result_value_number,
          value_boolean: r.result_value_boolean,
          value_json: r.result_value_json,
        }),
      })));
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat detail standar');
      return;
    }
    setShowModal(true);
  };

  const uiValueFor = (row) => {
    if (row.value_type === 'BOOLEAN') return row.value_boolean;
    if (row.value_type === 'SELECT') return row.value_json || '';
    if (row.value_type === 'MULTI_SELECT') {
      const v = row.value_json;
      return Array.isArray(v) ? v : v ? [String(v)] : [];
    }
    if (row.value_type === 'NUMBER') return row.value_number ?? '';
    return row.value_text || '';
  };

  const handleToggleActive = async (std) => {
    try {
      await toggleStandardActive(std.id, !std.is_active);
      toast.success(`Standar ${std.is_active ? 'dinonaktifkan' : 'diaktifkan'}`);
      fetchAll();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (std) => {
    if (!window.confirm(`Hapus standar "${std.name}"?`)) return;
    try {
      await deleteStandard(std.id);
      toast.success('Standar dihapus');
      fetchAll();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const addRow = () => setSpecs((rows) => [...rows, emptySpecRow()]);
  const removeRow = (key) => setSpecs((rows) => rows.filter((r) => r._key !== key));
  const addRule = () => setRules((rows) => [...rows, emptyRuleRow()]);
  const removeRule = (key) => setRules((rows) => rows.filter((r) => r._key !== key));

  const patchRow = (key, patch) => {
    setSpecs((rows) => rows.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  };
  const patchRule = (key, patch) => {
    setRules((rows) => rows.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  };

  const handleComponentChange = (key, defId) => {
    patchRow(key, { component_definition_id: defId, specification_definition_id: '' });
  };

  const handleSpecDefChange = (key, defId) => {
    const def = defById(defId);
    patchRow(key, {
      specification_definition_id: defId,
      spec_key_snapshot: def ? def.spec_key : '',
      value_type: def ? def.value_type : 'TEXT',
      unit: def ? def.default_unit || '' : '',
      value: '',
    });
  };

  // ---- Conditional rule handlers -------------------------------
  const handleRuleComponentChange = (key, defId) => {
    patchRule(key, {
      component_definition_id: defId,
      condition_specification_definition_id: '',
      condition_spec_key_snapshot: '',
      condition_spec_label_snapshot: '',
      condition_value_type: 'TEXT',
      condition_unit: '',
      condition_value: '',
      result_specification_definition_id: '',
      result_spec_key_snapshot: '',
      result_spec_label_snapshot: '',
      result_value_type: 'TEXT',
      result_unit: '',
      result_value: '',
    });
  };

  const handleRuleConditionDefChange = (key, defId) => {
    const def = defById(defId);
    patchRule(key, {
      condition_specification_definition_id: defId,
      condition_spec_key_snapshot: def ? def.spec_key : '',
      condition_spec_label_snapshot: def ? def.spec_label : '',
      condition_value_type: def ? def.value_type : 'TEXT',
      condition_unit: def ? def.default_unit || '' : '',
      condition_value: '',
    });
  };

  const handleRuleResultDefChange = (key, defId) => {
    const def = defById(defId);
    patchRule(key, {
      result_specification_definition_id: defId,
      result_spec_key_snapshot: def ? def.spec_key : '',
      result_spec_label_snapshot: def ? def.spec_label : '',
      result_value_type: def ? def.value_type : 'TEXT',
      result_unit: def ? def.default_unit || '' : '',
      result_value: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Kode dan nama standar wajib diisi');
      return;
    }
    setSaving(true);
    try {
      await saveStandard({
        standardId: editingId,
        code: form.code,
        name: form.name,
        description: form.description,
        product_type_id: form.product_type_id,
        created_by: null,
        standard_type: form.standard_type,
        specs: specs.map((r) => ({
          component_definition_id: r.component_definition_id || null,
          specification_definition_id: r.specification_definition_id || null,
          spec_key_snapshot: r.spec_key_snapshot,
          value_type: r.value_type,
          unit: r.unit || null,
          value: r.value,
          is_required: r.is_required,
        })),
        rules: rules.map((r) => ({
          component_definition_id: r.component_definition_id || null,
          condition_specification_definition_id: r.condition_specification_definition_id || null,
          condition_spec_key_snapshot: r.condition_spec_key_snapshot,
          condition_spec_label_snapshot: r.condition_spec_label_snapshot,
          condition_value_type: r.condition_value_type,
          condition_unit: r.condition_unit || null,
          condition_value: r.condition_value,
          result_specification_definition_id: r.result_specification_definition_id || null,
          result_spec_key_snapshot: r.result_spec_key_snapshot,
          result_spec_label_snapshot: r.result_spec_label_snapshot,
          result_value_type: r.result_value_type,
          result_unit: r.result_unit || null,
          result_value: r.result_value,
        })),
      });
      toast.success(editingId ? 'Standar diperbarui' : 'Standar ditambahkan');
      setShowModal(false);
      resetForm();
      fetchAll();
    } catch (error) {
      if (error.code === '23505') toast.error('Kode standar sudah ada / kondisi aturan duplikat atau bertentangan');
      else toast.error(error.message || 'Gagal menyimpan standar');
    } finally {
      setSaving(false);
    }
  };

  const filtered = standards.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Standar Teknis</h1>
          <p className="text-sm text-ink-400 mt-1">
            Aturan teknis resmi Harmas/Ofissio — Nilai Standar Tetap atau Aturan Bersyarat (JIKA = MAKA).
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
              Tambah Standar
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
            placeholder="Cari kode atau nama standar..."
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
            <div className="empty-state-icon"><ShieldCheck size={48} /></div>
            <h3 className="empty-state-title">Tidak ada standar teknis</h3>
            <p className="empty-state-text">Buat standar pertama untuk nilai teknis resmi Harmas/Ofissio</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th>Product Type</th>
                  <th>Tipe</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="hover-card">
                    <td className="font-mono text-[13px] text-white">{s.code}</td>
                    <td className="font-medium text-white">{s.name}</td>
                    <td className="text-ink-400">{s.product_types?.name || '-'}</td>
                    <td>
                      <span className="inline-flex items-center gap-1 text-xs text-primary-300">
                        {s.standard_type === STANDARD_TYPE.CONDITIONAL ? <GitBranch size={13} /> : <ListChecks size={13} />}
                        {STANDARD_TYPE_LABELS[s.standard_type] || STANDARD_TYPE_LABELS[STANDARD_TYPE.FIXED]}
                      </span>
                    </td>
                    <td>
                      <span className={s.is_active ? 'badge-green' : 'badge-gray'}>
                        {s.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <>
                            <button onClick={() => handleEdit(s)} className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded-md transition-all" title="Edit">
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleActive(s)}
                              className={`p-1.5 rounded-md transition-all ${s.is_active ? 'text-orange-400 hover:bg-orange-500/10' : 'text-success-400 hover:bg-success-500/10'}`}
                              title={s.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            >
                              <Power size={14} />
                            </button>
                            <button onClick={() => handleDelete(s)} className="p-1.5 text-danger-400 hover:bg-danger-500/10 rounded-md transition-all" title="Hapus">
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
          <div className="modal-content max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
                  <ShieldCheck size={18} className="text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {editingId ? 'Edit Standar Teknis' : 'Tambah Standar Teknis'}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Kode Standar</label>
                  <input
                    className="input"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="mis. STD_SCOTCHLIGHT_KEMEJA_LAPANGAN"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="label">Scope Product Type (opsional)</label>
                  <select
                    className="input"
                    value={form.product_type_id}
                    onChange={(e) => setForm({ ...form, product_type_id: e.target.value })}
                    disabled={saving}
                  >
                    <option value="">— Umum —</option>
                    {productTypes.map((pt) => (
                      <option key={pt.id} value={pt.id}>{pt.code} — {pt.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Nama Standar</label>
                  <input
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="mis. Standar Scotchlight Kemeja Lapangan"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="label">Tipe</label>
                  <select
                    className="input"
                    value={form.standard_type}
                    onChange={(e) => setForm({ ...form, standard_type: e.target.value })}
                    disabled={saving}
                  >
                    <option value={STANDARD_TYPE.FIXED}>{STANDARD_TYPE_LABELS[STANDARD_TYPE.FIXED]}</option>
                    <option value={STANDARD_TYPE.CONDITIONAL}>{STANDARD_TYPE_LABELS[STANDARD_TYPE.CONDITIONAL]}</option>
                  </select>
                </div>
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

              {form.standard_type === STANDARD_TYPE.CONDITIONAL ? (
                <>
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="text-sm font-semibold text-white flex items-center gap-2">
                      <GitBranch size={15} className="text-primary-400" />
                      Aturan Bersyarat
                      <span className="text-[11px] font-normal text-ink-500">
                        JIKA [ spesifikasi ] = [ nilai ] MAKA [ spesifikasi ] = [ nilai ] — kontradiksi & duplikat diblokir
                      </span>
                    </div>
                    <button type="button" onClick={addRule} className="btn-secondary btn-sm" disabled={saving}>
                      <Plus size={13} /> Tambah Aturan
                    </button>
                  </div>

                  <div className="space-y-3">
                    {rules.length === 0 && (
                      <div className="border border-dashed border-white/10 rounded-lg p-4 text-center text-xs text-ink-500">
                        Belum ada aturan. Tambahkan minimal satu aturan untuk standar bersyarat.
                      </div>
                    )}
                    {rules.map((r, idx) => (
                      <div key={r._key} className="border border-white/10 rounded-lg p-3 bg-ink-900/50">
                        <div className="flex items-center gap-2 mb-2 text-[11px] text-ink-500">
                          <span className="font-semibold text-primary-300">ATURAN {idx + 1}</span>
                          <button type="button" onClick={() => removeRule(r._key)} className="ml-auto p-1 text-danger-400 hover:bg-danger-500/10 rounded" disabled={saving}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <div className="flex items-start gap-2 flex-wrap">
                          <select
                            className="input text-sm py-1.5 flex-1 min-w-[150px]"
                            value={r.component_definition_id}
                            onChange={(e) => handleRuleComponentChange(r._key, e.target.value)}
                            disabled={saving}
                          >
                            <option value="">— Komponen —</option>
                            {componentDefs.map((d) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                          <span className="text-xs text-ink-400 mt-2">JIKA</span>
                          <select
                            className="input text-sm py-1.5 flex-1 min-w-[170px]"
                            value={r.condition_specification_definition_id}
                            onChange={(e) => handleRuleConditionDefChange(r._key, e.target.value)}
                            disabled={saving}
                          >
                            <option value="">— Spesifikasi —</option>
                            {specDefsByComponent(r.component_definition_id).map((d) => (
                              <option key={d.id} value={d.id}>{d.spec_label}</option>
                            ))}
                          </select>
                          <span className="text-xs text-ink-400 mt-2">=</span>
                          <div className="flex-1 min-w-[150px] flex items-center gap-1.5">
                            <div className="flex-1 min-w-[110px]">
                              <SpecValueInput
                                valueType={r.condition_value_type}
                                value={r.condition_value}
                                onChange={(v) => patchRule(r._key, { condition_value: v })}
                                options={r.condition_specification_definition_id ? defById(r.condition_specification_definition_id)?.options_json : null}
                                disabled={saving}
                              />
                            </div>
                            {ruleUnitLabel(r, 'condition') && (
                              <span className="text-xs text-ink-400 whitespace-nowrap">
                                {ruleUnitLabel(r, 'condition')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-start gap-2 flex-wrap mt-2">
                          <span className="text-xs text-ink-400 mt-2 ml-[1px]">MAKA</span>
                          <select
                            className="input text-sm py-1.5 flex-1 min-w-[170px]"
                            value={r.result_specification_definition_id}
                            onChange={(e) => handleRuleResultDefChange(r._key, e.target.value)}
                            disabled={saving}
                          >
                            <option value="">— Spesifikasi —</option>
                            {specDefsByComponent(r.component_definition_id).map((d) => (
                              <option key={d.id} value={d.id}>{d.spec_label}</option>
                            ))}
                          </select>
                          <span className="text-xs text-ink-400 mt-2">=</span>
                          <div className="flex-1 min-w-[150px] flex items-center gap-1.5">
                            <div className="flex-1 min-w-[110px]">
                              <SpecValueInput
                                valueType={r.result_value_type}
                                value={r.result_value}
                                onChange={(v) => patchRule(r._key, { result_value: v })}
                                options={r.result_specification_definition_id ? defById(r.result_specification_definition_id)?.options_json : null}
                                disabled={saving}
                              />
                            </div>
                            {ruleUnitLabel(r, 'result') && (
                              <span className="text-xs text-ink-400 whitespace-nowrap">
                                {ruleUnitLabel(r, 'result')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="text-sm font-semibold text-white">Nilai Standar</div>
                    <button type="button" onClick={addRow} className="btn-secondary btn-sm" disabled={saving}>
                      <Plus size={13} /> Tambah Nilai
                    </button>
                  </div>

                  <div className="space-y-2">
                    {specs.map((r) => {
                      const defOptions = specDefsByComponent(r.component_definition_id);
                      const options = r.specification_definition_id
                        ? defById(r.specification_definition_id)?.options_json
                        : null;
                      return (
                        <div key={r._key} className="border border-white/10 rounded-lg p-2.5 bg-ink-900/50">
                          <div className="flex items-center gap-2 flex-wrap">
                            <select
                              className="input text-sm py-1.5 flex-1 min-w-[140px]"
                              value={r.component_definition_id}
                              onChange={(e) => handleComponentChange(r._key, e.target.value)}
                              disabled={saving}
                            >
                              <option value="">— Komponen (opsional) —</option>
                              {componentDefs.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                            <select
                              className="input text-sm py-1.5 flex-1 min-w-[160px]"
                              value={r.specification_definition_id}
                              onChange={(e) => handleSpecDefChange(r._key, e.target.value)}
                              disabled={saving}
                            >
                              <option value="">— Custom spec —</option>
                              {defOptions.map((d) => (
                                <option key={d.id} value={d.id}>{d.spec_label}</option>
                              ))}
                            </select>
                            <input
                              className="input text-sm py-1.5 max-w-[120px]"
                              placeholder="spec_key"
                              value={r.spec_key_snapshot}
                              onChange={(e) => patchRow(r._key, { spec_key_snapshot: e.target.value })}
                              disabled={saving || !!r.specification_definition_id}
                            />
                            <input
                              className="input text-sm py-1.5 max-w-[70px]"
                              placeholder="Unit"
                              value={r.unit}
                              onChange={(e) => patchRow(r._key, { unit: e.target.value })}
                              disabled={saving || !!r.specification_definition_id}
                            />
                            <label className="flex items-center gap-1.5 text-xs text-ink-300 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={r.is_required}
                                onChange={(e) => patchRow(r._key, { is_required: e.target.checked })}
                                disabled={saving}
                              />
                              Wajib
                            </label>
                            <button type="button" onClick={() => removeRow(r._key)} className="p-1.5 text-danger-400 hover:bg-danger-500/10 rounded-md" disabled={saving}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="mt-2">
                            <div className="text-[11px] text-ink-500 mb-1">STANDARD — nilai resmi Harmas/Ofissio</div>
                            <SpecValueInput
                              valueType={r.value_type}
                              value={r.value}
                              onChange={(v) => patchRow(r._key, { value: v })}
                              options={options}
                              disabled={saving}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary btn-sm" disabled={saving}>
                  Batal
                </button>
                <button type="submit" className="btn-primary btn-sm" disabled={saving}>
                  <Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan Standar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}