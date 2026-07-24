import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { VENDOR_TYPES } from '../lib/constants';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Search, RefreshCw, Truck, X, Save } from 'lucide-react';

export default function VendorsPage() {
  const { profile } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    vendor_code: '',
    vendor_name: '',
    vendor_type: '',
    contact_person: '',
    whatsapp_number: '',
    phone_number: '',
    email: '',
    address: '',
    city: '',
    tax_number: '',
    service_type: '',
    notes: '',
    is_active: true
  });

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('vendors')
        .select('*')
        .order('vendor_name', { ascending: true });

      if (search) {
        query = query.or(`vendor_name.ilike.%${search}%,vendor_code.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast.error('Gagal memuat data vendor');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vendor_code || !form.vendor_name) {
      toast.error('Kode dan nama vendor wajib diisi');
      return;
    }

    try {
      const dataToSubmit = { ...form, created_by: profile?.id };

      if (editingId) {
        const { error } = await supabase.from('vendors').update(dataToSubmit).eq('id', editingId);
        if (error) throw error;
        toast.success('Vendor berhasil diperbarui');
      } else {
        const { error } = await supabase.from('vendors').insert([dataToSubmit]);
        if (error) throw error;
        toast.success('Vendor berhasil ditambahkan');
      }

      setShowModal(false);
      setEditingId(null);
      setForm({
        vendor_code: '',
        vendor_name: '',
        vendor_type: '',
        contact_person: '',
        whatsapp_number: '',
        phone_number: '',
        email: '',
        address: '',
        city: '',
        tax_number: '',
        service_type: '',
        notes: '',
        is_active: true
      });
      fetchVendors();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleEdit = (vendor) => {
    setEditingId(vendor.id);
    setForm({
      vendor_code: vendor.vendor_code,
      vendor_name: vendor.vendor_name,
      vendor_type: vendor.vendor_type || '',
      contact_person: vendor.contact_person || '',
      whatsapp_number: vendor.whatsapp_number || '',
      phone_number: vendor.phone_number || '',
      email: vendor.email || '',
      address: vendor.address || '',
      city: vendor.city || '',
      tax_number: vendor.tax_number || '',
      service_type: vendor.service_type || '',
      notes: vendor.notes || '',
      is_active: vendor.is_active
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Yakin ingin menghapus vendor ini?')) return;
    try {
      const { error } = await supabase.from('vendors').delete().eq('id', id);
      if (error) throw error;
      toast.success('Vendor berhasil dihapus');
      fetchVendors();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Master Vendor</h1>
          <p className="text-sm text-ink-400 mt-1">Kelola daftar vendor dan supplier</p>
        </div>
        <button onClick={fetchVendors} className="btn-secondary text-sm" disabled={loading}>
          <RefreshCw size={14} className={`${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="card">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
            <input type="text" className="input pl-9" placeholder="Cari kode atau nama vendor..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button onClick={() => { setEditingId(null); setForm({ vendor_code: '', vendor_name: '', vendor_type: '', contact_person: '', whatsapp_number: '', phone_number: '', email: '', address: '', city: '', tax_number: '', service_type: '', notes: '', is_active: true }); setShowModal(true); }} className="btn-primary text-sm whitespace-nowrap">
            <Plus size={14} />
            Tambah Vendor
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-white/5 rounded-md animate-pulse"></div>
            ))}
          </div>
        ) : vendors.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Truck size={48} /></div>
            <h3 className="empty-state-title">Tidak ada data vendor</h3>
            <p className="empty-state-text">Tambahkan vendor baru untuk mulai mencatat supplier</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th>Tipe</th>
                  <th>Kontak</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td className="font-mono text-[13px] text-white">{vendor.vendor_code}</td>
                    <td className="font-medium text-white">{vendor.vendor_name}</td>
                    <td className="text-ink-400">{vendor.vendor_type || '-'}</td>
                    <td className="text-ink-400">{vendor.contact_person || vendor.phone_number || vendor.email || '-'}</td>
                    <td>
                      <span className={vendor.is_active ? 'badge-green' : 'badge-gray'}>
                        {vendor.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleEdit(vendor)} className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded-md transition-all" title="Edit"><Edit size={14} /></button>
                        <button onClick={() => handleDelete(vendor.id)} className="p-1.5 text-danger-400 hover:bg-danger-500/10 rounded-md transition-all" title="Hapus"><Trash2 size={14} /></button>
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
          <div className="modal-content max-w-lg">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
                  <Truck size={18} className="text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">{editingId ? 'Edit Vendor' : 'Tambah Vendor'}</h3>
              </div>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Kode Vendor <span className="text-danger-400">*</span></label>
                  <input type="text" className="input" value={form.vendor_code} onChange={(e) => setForm({...form, vendor_code: e.target.value})} required />
                </div>
                <div>
                  <label className="label">Nama Vendor <span className="text-danger-400">*</span></label>
                  <input type="text" className="input" value={form.vendor_name} onChange={(e) => setForm({...form, vendor_name: e.target.value})} required />
                </div>
              </div>
              <div>
                <label className="label">Jenis Vendor</label>
                <select className="input" value={form.vendor_type} onChange={(e) => setForm({...form, vendor_type: e.target.value})}>
                  <option value="">Pilih jenis...</option>
                  {Object.entries(VENDOR_TYPES).map(([key, label]) => (
                    <option key={key} value={label}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Nama Kontak</label>
                  <input type="text" className="input" value={form.contact_person} onChange={(e) => setForm({...form, contact_person: e.target.value})} />
                </div>
                <div>
                  <label className="label">WhatsApp</label>
                  <input type="text" className="input" value={form.whatsapp_number} onChange={(e) => setForm({...form, whatsapp_number: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Telepon</label>
                  <input type="text" className="input" value={form.phone_number} onChange={(e) => setForm({...form, phone_number: e.target.value})} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="label">Alamat</label>
                <textarea className="input" rows="2" value={form.address} onChange={(e) => setForm({...form, address: e.target.value})}></textarea>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Kota</label>
                  <input type="text" className="input" value={form.city} onChange={(e) => setForm({...form, city: e.target.value})} />
                </div>
                <div>
                  <label className="label">NPWP</label>
                  <input type="text" className="input" value={form.tax_number} onChange={(e) => setForm({...form, tax_number: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="label">Jenis Layanan</label>
                <textarea className="input" rows="2" value={form.service_type} onChange={(e) => setForm({...form, service_type: e.target.value})}></textarea>
              </div>
              <div>
                <label className="label">Catatan</label>
                <textarea className="input" rows="2" value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})}></textarea>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-ink-200">
                <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => setForm({...form, is_active: e.target.checked})} className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary-500 focus:ring-primary-500/30" />
                Aktif
              </label>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingId(null); }} className="btn-secondary">Batal</button>
                <button type="submit" className="btn-primary">
                  <Save size={14} />
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
