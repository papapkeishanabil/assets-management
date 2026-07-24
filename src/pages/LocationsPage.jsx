import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Search, RefreshCw, MapPin, X, Save } from 'lucide-react';

export default function LocationsPage() {
  const { profile } = useAuth();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    location_code: '',
    location_name: '',
    location_type: '',
    parent_location_id: '',
    address: '',
    responsible_user_id: '',
    description: '',
    is_active: true
  });

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('asset_locations')
        .select('*, parent:parent_location_id(location_name)')
        .order('location_name', { ascending: true });

      if (search) {
        query = query.or(`location_name.ilike.%${search}%,location_code.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast.error('Gagal memuat data lokasi');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.location_code || !form.location_name) {
      toast.error('Kode dan nama lokasi wajib diisi');
      return;
    }

    try {
      const dataToSubmit = {
        ...form,
        parent_location_id: form.parent_location_id || null,
        responsible_user_id: form.responsible_user_id || null,
        created_by: profile?.id
      };

      if (editingId) {
        const { error } = await supabase
          .from('asset_locations')
          .update(dataToSubmit)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Lokasi berhasil diperbarui');
      } else {
        const { error } = await supabase
          .from('asset_locations')
          .insert([dataToSubmit]);
        if (error) throw error;
        toast.success('Lokasi berhasil ditambahkan');
      }

      setShowModal(false);
      setEditingId(null);
      setForm({
        location_code: '',
        location_name: '',
        location_type: '',
        parent_location_id: '',
        address: '',
        responsible_user_id: '',
        description: '',
        is_active: true
      });
      fetchLocations();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleEdit = (location) => {
    setEditingId(location.id);
    setForm({
      location_code: location.location_code,
      location_name: location.location_name,
      location_type: location.location_type || '',
      parent_location_id: location.parent_location_id || '',
      address: location.address || '',
      responsible_user_id: location.responsible_user_id || '',
      description: location.description || '',
      is_active: location.is_active
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Yakin ingin menghapus lokasi ini?')) return;
    try {
      const { error } = await supabase
        .from('asset_locations')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Lokasi berhasil dihapus');
      fetchLocations();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const parentOptions = locations.filter(l => !l.parent_location_id);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Master Lokasi Aset</h1>
          <p className="text-sm text-ink-400 mt-1">Kelola daftar lokasi penempatan aset</p>
        </div>
        <button onClick={fetchLocations} className="btn-secondary text-sm" disabled={loading}>
          <RefreshCw size={14} className={`${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="card">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Cari kode atau nama lokasi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button onClick={() => { setEditingId(null); setForm({ location_code: '', location_name: '', location_type: '', parent_location_id: '', address: '', responsible_user_id: '', description: '', is_active: true }); setShowModal(true); }} className="btn-primary text-sm whitespace-nowrap">
            <Plus size={14} />
            Tambah Lokasi
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
        ) : locations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><MapPin size={48} /></div>
            <h3 className="empty-state-title">Tidak ada data lokasi</h3>
            <p className="empty-state-text">Tambahkan lokasi baru untuk mulai mencatat penempatan aset</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th>Tipe</th>
                  <th>Parent</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr key={loc.id}>
                    <td className="font-mono text-[13px] text-white">{loc.location_code}</td>
                    <td className="font-medium text-white">{loc.location_name}</td>
                    <td className="text-ink-400">{loc.location_type || '-'}</td>
                    <td className="text-ink-400">{loc.parent?.location_name || '-'}</td>
                    <td>
                      <span className={loc.is_active ? 'badge-green' : 'badge-gray'}>
                        {loc.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleEdit(loc)} className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded-md transition-all" title="Edit">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDelete(loc.id)} className="p-1.5 text-danger-400 hover:bg-danger-500/10 rounded-md transition-all" title="Hapus">
                          <Trash2 size={14} />
                        </button>
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
          <div className="modal-content max-w-md">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
                  <MapPin size={18} className="text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">{editingId ? 'Edit Lokasi' : 'Tambah Lokasi'}</h3>
              </div>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Kode Lokasi <span className="text-danger-400">*</span></label>
                <input type="text" className="input" value={form.location_code} onChange={(e) => setForm({...form, location_code: e.target.value})} required />
              </div>
              <div>
                <label className="label">Nama Lokasi <span className="text-danger-400">*</span></label>
                <input type="text" className="input" value={form.location_name} onChange={(e) => setForm({...form, location_name: e.target.value})} required />
              </div>
              <div>
                <label className="label">Jenis Lokasi</label>
                <select className="input" value={form.location_type} onChange={(e) => setForm({...form, location_type: e.target.value})}>
                  <option value="">Pilih jenis...</option>
                  <option value="Kantor">Kantor</option>
                  <option value="Pabrik">Pabrik</option>
                  <option value="Gudang">Gudang</option>
                  <option value="Ruangan">Ruangan</option>
                  <option value="Area Produksi">Area Produksi</option>
                  <option value="Kendaraan">Kendaraan</option>
                  <option value="Lokasi Vendor">Lokasi Vendor</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div>
                <label className="label">Parent Lokasi</label>
                <select className="input" value={form.parent_location_id} onChange={(e) => setForm({...form, parent_location_id: e.target.value})}>
                  <option value="">Tidak ada (Lokasi Utama)</option>
                  {parentOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.location_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Alamat</label>
                <textarea className="input" rows="2" value={form.address} onChange={(e) => setForm({...form, address: e.target.value})}></textarea>
              </div>
              <div>
                <label className="label">Deskripsi</label>
                <textarea className="input" rows="2" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})}></textarea>
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
