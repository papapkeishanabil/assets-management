import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { ClipboardList, Plus, Search, Filter, X } from 'lucide-react';
import { formatDate, formatCurrency, WO_STATUS_LABELS, PRIORITY_LABELS, getStatusBadgeClass } from '../lib/constants';

export default function WorkOrdersPage() {
  const { profile } = useAuth();
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [assets, setAssets] = useState([]);
  const [maintenanceTypes, setMaintenanceTypes] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    asset_id: '',
    maintenance_type_id: '',
    priority: 'normal',
    planned_date: '',
    assigned_user_id: '',
    description: '',
    estimated_cost: ''
  });

  useEffect(() => {
    fetchData();
    fetchAssets();
    fetchMaintenanceTypes();
    fetchUsers();
  }, []);

  const fetchData = async () => {
    try {
      let query = supabase
        .from('work_orders')
        .select(`
          *,
          assets:asset_id (asset_code, asset_name),
          maintenance_types:maintenance_type_id (maintenance_name),
          assigned_user:assigned_user_id (full_name),
          responsible_user:responsible_user_id (full_name)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter) query = query.eq('status', statusFilter);
      if (search) query = query.or(`work_order_number.ilike.%${search}%,assets.asset_name.ilike.%${search}%`);

      const { data } = await query;
      setWorkOrders(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssets = async () => {
    const { data } = await supabase.from('assets').select('id, asset_code, asset_name').eq('is_active', true);
    setAssets(data || []);
  };

  const fetchMaintenanceTypes = async () => {
    const { data } = await supabase.from('maintenance_types').select('*').eq('is_active', true);
    setMaintenanceTypes(data || []);
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('user_profiles').select('id, full_name').eq('account_status', 'aktif');
    setUsers(data || []);
  };

  const generateWONumber = async () => {
    const now = new Date();
    const ymd = now.getFullYear().toString().slice(-2) +
                String(now.getMonth() + 1).padStart(2, '0') +
                String(now.getDate()).padStart(2, '0');
    const { count } = await supabase.from('work_orders').select('*', { count: 'exact', head: true });
    return `WO-${ymd}-${String((count || 0) + 1).padStart(4, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.asset_id) {
      toast.error('Pilih aset terlebih dahulu');
      return;
    }
    try {
      const woNumber = await generateWONumber();
      const { error } = await supabase.from('work_orders').insert([{
        work_order_number: woNumber,
        ...form,
        estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : null,
        status: 'draft',
        created_by: profile.id
      }]);
      if (error) throw error;
      toast.success(`Work Order ${woNumber} berhasil dibuat`);
      setShowForm(false);
      setForm({ asset_id: '', maintenance_type_id: '', priority: 'normal', planned_date: '', assigned_user_id: '', description: '', estimated_cost: '' });
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight mb-1">Work Order</h1>
          <p className="text-sm text-ink-400">Kelola work order pemeliharaan</p>
        </div>
        {profile?.role !== 'pelaksana' && (
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={18} /> Buat Work Order
          </button>
        )}
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
            <input type="text" className="input pl-9" placeholder="Cari WO, aset..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input sm:w-48" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Semua Status</option>
            {Object.entries(WO_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={fetchData} className="btn-secondary"><Filter size={18} /> Filter</button>
        </div>
      </div>

      <div className="card p-0">
        {loading ? (
          <div className="space-y-3 p-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-white/5 rounded-md animate-pulse"></div>)}
          </div>
        ) : workOrders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><ClipboardList size={48} /></div>
            <h3 className="empty-state-title">Belum ada work order</h3>
            <p className="empty-state-text">Work order yang dibuat akan tampil di sini</p>
          </div>
        ) : (
          <div className="table-container border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>No. WO</th>
                  <th>Aset</th>
                  <th>Tipe</th>
                  <th>Prioritas</th>
                  <th>Pelaksana</th>
                  <th>Tanggal</th>
                  <th>Biaya</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map(wo => (
                  <tr key={wo.id}>
                    <td className="font-mono text-[12px] text-white">{wo.work_order_number}</td>
                    <td>{wo.assets?.asset_name || '-'}</td>
                    <td>{wo.maintenance_types?.maintenance_name || '-'}</td>
                    <td>
                      <span className={`badge ${wo.priority === 'tinggi' || wo.priority === 'mendesak' ? 'badge-red' : wo.priority === 'normal' ? 'badge-blue' : 'badge-gray'}`}>
                        {PRIORITY_LABELS[wo.priority] || wo.priority}
                      </span>
                    </td>
                    <td>{wo.assigned_user?.full_name || '-'}</td>
                    <td>{formatDate(wo.planned_date)}</td>
                    <td>{formatCurrency(wo.estimated_cost)}</td>
                    <td><span className={getStatusBadgeClass(wo.status, 'wo')}>{WO_STATUS_LABELS[wo.status] || wo.status}</span></td>
                    <td>
                      <Link to={`/work-orders/${wo.id}`} className="btn-secondary btn-sm">Detail</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
                  <ClipboardList size={18} className="text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Buat Work Order Baru</h3>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="label">Aset <span className="text-danger-400">*</span></label>
                  <select className="input" value={form.asset_id} onChange={e => setForm({...form, asset_id: e.target.value})} required>
                    <option value="">Pilih Aset</option>
                    {assets.map(a => <option key={a.id} value={a.id}>{a.asset_code} - {a.asset_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Tipe Pemeliharaan</label>
                  <select className="input" value={form.maintenance_type_id} onChange={e => setForm({...form, maintenance_type_id: e.target.value})}>
                    <option value="">Pilih</option>
                    {maintenanceTypes.map(m => <option key={m.id} value={m.id}>{m.maintenance_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Prioritas</label>
                  <select className="input" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                    {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Tanggal Rencana</label>
                  <input type="date" className="input" value={form.planned_date} onChange={e => setForm({...form, planned_date: e.target.value})} />
                </div>
                <div>
                  <label className="label">Pelaksana</label>
                  <select className="input" value={form.assigned_user_id} onChange={e => setForm({...form, assigned_user_id: e.target.value})}>
                    <option value="">Pilih</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Estimasi Biaya</label>
                  <input type="number" className="input" value={form.estimated_cost} onChange={e => setForm({...form, estimated_cost: e.target.value})} placeholder="Rp" />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Deskripsi Pekerjaan</label>
                  <textarea className="input" rows="3" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Deskripsi pekerjaan"></textarea>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Batal</button>
                <button type="submit" className="btn-primary">Buat WO</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
