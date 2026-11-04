import { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  PROCESS_STAGE, PROCESS_STAGE_LABELS,
  QUALIFICATION_LABELS,
  OPERATIONAL_LABELS,
  VENDOR_SOURCES, LEGAL_STATUS, CAPACITY_UNITS, BUSINESS_TYPES,
  VENDOR_APPROVER_ROLES, DECISION_QUALIFICATION_STATUSES
} from '../../lib/vendor-constants';
import { saveVendorCandidate, findDuplicateCandidates } from '../../lib/vendor-helpers';
import { useAuth } from '../../contexts/AuthContext';

const EMPTY_FORM = {
  business_name: '',
  business_type: 'USAHA',
  category_id: '',
  internal_pic_id: '',
  source: '',
  process_stage: PROCESS_STAGE.LEAD,
  qualification_status: QUALIFICATION_STATUS.PROSPECT,
  operational_status: OPERATIONAL_STATUS.NOT_ACTIVE,
  capacity_qty: '',
  capacity_unit: 'pcs',
  moq: '',
  lead_time_days: '',
  indicative_price: '',
  payment_term: '',
  service_area: '',
  legal_status: 'BELUM_DICEK',
  notes: ''
};

const EMPTY_CONTACT = { contact_name: '', role_title: '', phone: '', whatsapp: '', email: '', is_primary: false };

// Modal tambah/edit calon vendor. Disimpan setelah deteksi duplikat nama/telepon.
export default function VendorFormModal({ open, onClose, onSaved, editing = null, categories = [], users = [], currentUserId }) {
  const { role } = useAuth();
  const isApprover = role && VENDOR_APPROVER_ROLES.includes(role.role_name);
  // Nilai keputusan akhir disembunyikan dari non-approver (guard DB tetap berlaku).
  const qualificationOptions = Object.entries(QUALIFICATION_LABELS).filter(
    ([value]) => isApprover || !DECISION_QUALIFICATION_STATUSES.includes(value)
  );
  const [form, setForm] = useState(EMPTY_FORM);
  const [specialtyIds, setSpecialtyIds] = useState([]);
  const [contacts, setContacts] = useState([{ ...EMPTY_CONTACT, is_primary: true }]);
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState(null); // null = belum dicek / tidak ada

  const specialties = categories.length > 0 ? (categories.find((c) => c.id === form.category_id)?.specialties || []) : [];

  useEffect(() => {
    if (!open) return;
    setDuplicates(null);
    if (editing) {
      setForm({
        business_name: editing.business_name || '',
        business_type: editing.business_type || 'USAHA',
        category_id: editing.category_id || '',
        internal_pic_id: editing.internal_pic_id || '',
        source: editing.source || '',
        process_stage: editing.process_stage || PROCESS_STAGE.LEAD,
        qualification_status: editing.qualification_status || QUALIFICATION_STATUS.PROSPECT,
        operational_status: editing.operational_status || OPERATIONAL_STATUS.NOT_ACTIVE,
        capacity_qty: editing.capacity_qty ?? '',
        capacity_unit: editing.capacity_unit || 'pcs',
        moq: editing.moq || '',
        lead_time_days: editing.lead_time_days ?? '',
        indicative_price: editing.indicative_price ?? '',
        payment_term: editing.payment_term || '',
        service_area: editing.service_area || '',
        legal_status: editing.legal_status || 'BELUM_DICEK',
        notes: editing.notes || ''
      });
      setSpecialtyIds((editing.specialties || []).map((s) => s.id));
      setContacts(editing.contacts?.length ? editing.contacts.map((c) => ({ ...c })) : [{ ...EMPTY_CONTACT, is_primary: true }]);
    } else {
      setForm({ ...EMPTY_FORM, internal_pic_id: currentUserId || '' });
      setSpecialtyIds([]);
      setContacts([{ ...EMPTY_CONTACT, is_primary: true }]);
    }
  }, [open, editing, currentUserId]);

  if (!open) return null;

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    if (key === 'category_id') setSpecialtyIds([]); // spesialisasi mengikuti kategori
  };

  const toggleSpecialty = (id) => {
    setSpecialtyIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const setContact = (idx, key, value) => {
    setContacts((prev) => prev.map((c, i) => {
      if (i !== idx) return key === 'is_primary' ? { ...c, is_primary: false } : c;
      return { ...c, [key]: value };
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.business_name.trim()) {
      toast.error('Nama vendor wajib diisi');
      return;
    }
    if (!form.category_id) {
      toast.error('Kategori wajib dipilih');
      return;
    }

    try {
      // Deteksi duplikat dulu (spec §2); user boleh memaksa lanjut.
      if (!duplicates) {
        const dup = await findDuplicateCandidates(
          form.business_name.trim(),
          contacts.map((c) => c.phone).filter(Boolean),
          editing?.id
        );
        if (dup.length > 0) {
          setDuplicates(dup);
          return;
        }
      }

      setSaving(true);
      await saveVendorCandidate({
        candidateId: editing?.id || null,
        form,
        specialtyIds,
        contacts,
        actorId: currentUserId
      });
      toast.success(editing ? 'Calon vendor berhasil diperbarui' : 'Calon vendor berhasil ditambahkan');
      onSaved();
    } catch (error) {
      console.error('Error saving vendor candidate:', error);
      toast.error(`Gagal menyimpan: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-white/5">
          <div>
            <h2 className="text-lg font-semibold text-white">{editing ? 'Edit Calon Vendor' : 'Tambah Calon Vendor'}</h2>
            <p className="text-xs text-ink-400 mt-1">
              Kandidat baru berstatus Prospek dan tidak otomatis menjadi vendor aktif.
            </p>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-white hover:bg-white/5 p-1.5 rounded-md transition-all">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-5">
            {duplicates && duplicates.length > 0 && (
              <div className="rounded-lg border border-warning-500/30 bg-warning-500/10 p-4">
                <div className="flex items-center gap-2 text-warning-400 font-medium text-sm mb-2">
                  <AlertTriangle size={15} />
                  Calon vendor serupa sudah ada
                </div>
                <ul className="text-xs text-ink-300 space-y-1 mb-3">
                  {duplicates.map((d) => (
                    <li key={d.id}>
                      • <span className="font-mono">{d.candidate_code}</span> — {d.business_name}
                      {d.matched_phone ? ` (telepon sama: ${d.matched_phone})` : ''}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-ink-400">
                  Periksa detail vendor di atas sebelum melanjutkan.{' '}
                  <button type="button" className="text-primary-400 hover:text-primary-300 underline" onClick={() => setDuplicates([])}>
                    Tetap simpan
                  </button>
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">Nama Vendor *</label>
                <input className="input" placeholder="Nama usaha / perorangan" value={form.business_name} onChange={set('business_name')} required />
              </div>
              <div>
                <label className="label">Jenis</label>
                <select className="input" value={form.business_type} onChange={set('business_type')}>
                  {Object.entries(BUSINESS_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Kategori *</label>
                <select className="input" value={form.category_id} onChange={set('category_id')} required>
                  <option value="">— Pilih kategori —</option>
                  {categories.filter((c) => c.is_active !== false).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Sumber Lead</label>
                <select className="input" value={form.source} onChange={set('source')}>
                  <option value="">— Tidak dicatat —</option>
                  {Object.entries(VENDOR_SOURCES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">PIC Harmas</label>
                <select className="input" value={form.internal_pic_id} onChange={set('internal_pic_id')}>
                  <option value="">— Belum ditugaskan —</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
            </div>

            {specialties.length > 0 && (
              <div>
                <label className="label">Spesialisasi (boleh lebih dari satu)</label>
                <div className="flex flex-wrap gap-2">
                  {specialties.filter((s) => s.is_active !== false).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSpecialty(s.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        specialtyIds.includes(s.id)
                          ? 'bg-primary-500/20 border-primary-500/50 text-primary-300'
                          : 'border-white/10 text-ink-300 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Kapasitas / Bulan</label>
                <div className="flex gap-2">
                  <input type="number" min="0" step="any" className="input" placeholder="cth. 2000" value={form.capacity_qty} onChange={set('capacity_qty')} />
                  <select className="input w-28" value={form.capacity_unit} onChange={set('capacity_unit')}>
                    {CAPACITY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Minimum Order (MOQ)</label>
                <input className="input" placeholder="cth. 200 pcs" value={form.moq} onChange={set('moq')} />
              </div>
              <div>
                <label className="label">Lead Time (hari)</label>
                <input type="number" min="0" className="input" placeholder="cth. 14" value={form.lead_time_days} onChange={set('lead_time_days')} />
              </div>
              <div>
                <label className="label">Harga Indikatif (Rp)</label>
                <input type="number" min="0" className="input" placeholder="cth. 85000" value={form.indicative_price} onChange={set('indicative_price')} />
              </div>
              <div>
                <label className="label">Termin Pembayaran</label>
                <input className="input" placeholder="cth. DP 50%, tempo 30 hari" value={form.payment_term} onChange={set('payment_term')} />
              </div>
              <div>
                <label className="label">Status Legal</label>
                <select className="input" value={form.legal_status} onChange={set('legal_status')}>
                  {Object.entries(LEGAL_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label">Area Layanan</label>
                <input className="input" placeholder="cth. Bandung raya & sekitarnya" value={form.service_area} onChange={set('service_area')} />
              </div>
              <div className="md:col-span-2">
                <label className="label">Catatan</label>
                <textarea className="input min-h-[70px]" placeholder="Catatan tambahan profil vendor" value={form.notes} onChange={set('notes')} />
              </div>
            </div>

            <div>
              <label className="label">Status (3 dimensi berbeda)</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-[11px] text-ink-500 mb-1.5">Tahap Proses</p>
                  <select className="input" value={form.process_stage} onChange={set('process_stage')}>
                    {Object.entries(PROCESS_STAGE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[11px] text-ink-500 mb-1.5">Kelayakan</p>
                  <select
                    className="input"
                    value={form.qualification_status}
                    onChange={set('qualification_status')}
                    disabled={!isApprover && DECISION_QUALIFICATION_STATUSES.includes(form.qualification_status)}
                  >
                    {qualificationOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  {!isApprover && (
                    <p className="text-[10px] text-ink-500 mt-1">
                      {DECISION_QUALIFICATION_STATUSES.includes(form.qualification_status)
                        ? 'Sudah berstatus keputusan — hanya Direksi/Super Admin dapat mengubahnya'
                        : 'Keputusan akhir ditetapkan Direksi/Super Admin'}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] text-ink-500 mb-1.5">Operasional</p>
                  <select className="input" value={form.operational_status} onChange={set('operational_status')} disabled>
                    {Object.entries(OPERATIONAL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <p className="text-[10px] text-ink-500 mt-1">Aktivasi hanya lewat modul persetujuan (fase 5)</p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Kontak Vendor</label>
                <button type="button" onClick={() => setContacts((prev) => [...prev, { ...EMPTY_CONTACT }])} className="btn-ghost text-xs text-primary-400 hover:text-primary-300">
                  <Plus size={13} /> Tambah kontak
                </button>
              </div>
              <div className="space-y-3">
                {contacts.map((c, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                    <div className="md:col-span-3">
                      <input className="input" placeholder="Nama kontak *" value={c.contact_name} onChange={(e) => setContact(idx, 'contact_name', e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <input className="input" placeholder="Jabatan" value={c.role_title} onChange={(e) => setContact(idx, 'role_title', e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <input className="input" placeholder="Telepon" value={c.phone} onChange={(e) => setContact(idx, 'phone', e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <input className="input" placeholder="WhatsApp" value={c.whatsapp} onChange={(e) => setContact(idx, 'whatsapp', e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <input className="input" placeholder="Email" value={c.email} onChange={(e) => setContact(idx, 'email', e.target.value)} />
                    </div>
                    <div className="md:col-span-1 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        title="Kontak utama"
                        onClick={() => setContact(idx, 'is_primary', true)}
                        className={`p-1.5 rounded-md text-xs ${c.is_primary ? 'text-primary-300 bg-primary-500/20' : 'text-ink-500 hover:bg-white/5'}`}
                      >
                        ★
                      </button>
                      {contacts.length > 1 && (
                        <button
                          type="button"
                          title="Hapus kontak"
                          onClick={() => setContacts((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 rounded-md text-ink-500 hover:text-danger-400 hover:bg-danger-500/10"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 p-5 border-t border-white/5 bg-white/[0.02]">
            <button type="button" onClick={onClose} className="btn-secondary text-sm">Batal</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Tambah Calon Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
