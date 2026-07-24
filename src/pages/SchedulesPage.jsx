import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  CalendarClock, Plus, Search, Filter, Edit, Trash2, X,
  Clock, Gauge, Calendar
} from 'lucide-react';
import {
  formatDate, SCHEDULE_STATUS_LABELS, SCHEDULE_METHOD_LABELS,
  SCHEDULE_METHOD, getStatusBadgeClass
} from '../lib/constants';

export default function SchedulesPage() {
  const { profile } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [assets, setAssets] = useState([]);
  const [maintenanceTypes, setMaintenanceTypes] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    asset_id: '',
    maintenance_type_id: '',
    schedule_method: 'TIME',
    last_maintenance_date: '',
    interval_value: '',
    interval_unit: 'bulan',
    next_maintenance_date: '',
    last_maintenance_odometer: '',
    odometer_interval: '',
    next_maintenance_odometer: '',
    max_time_interval: '',
    max_time_unit: 'bulan',
    advance_notice_days: 7,
    advance_notice_odometer: 500,
    working_day_adjustment: 'mundur',
    responsible_user_id: '',
    assigned_user_id: ''
  });

  useEffect(() => {
    fetchSchedules();
    fetchAssets();
    fetchMaintenanceTypes();
    fetchUsers();
  }, []);

  const fetchSchedules = async () => {
    try {
      let query = supabase
        .from('maintenance_schedules')
        .select(`
          *,
          assets:asset_id (asset_code, asset_name, category_id, current_odometer),
          maintenance_types:maintenance_type_id (maintenance_name),
          responsible_user:responsible_user_id (full_name),
          assigned_user:assigned_user_id (full_name)
        `)
        .eq('is_active', true)
        .order('next_maintenance_date', { ascending: true, nullsLast: true });

      if (statusFilter) query = query.eq('schedule_status', statusFilter);
      if (search) query = query.or(`assets.asset_name.ilike.%${search}%,assets.asset_code.ilike.%${search}%`);

      const { data, error } = await query;
      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Gagal memuat jadwal');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssets = async () => {
    const { data } = await supabase.from('assets').select('id, asset_code, asset_name').eq('is_active', true).order('asset_name');
    setAssets(data || []);
  };

  const fetchMaintenanceTypes = async () => {
    const { data } = await supabase.from('maintenance_types').select('*').eq('is_active', true).order('maintenance_name');
    setMaintenanceTypes(data || []);
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('user_profiles').select('id, full_name').eq('account_status', 'aktif').order('full_name');
    setUsers(data || []);
  };

  const calculateNextDate = () => {
    if (!form.last_maintenance_date || !form.interval_value) return '';
    const lastDate = new Date(form.last_maintenance_date);
    const interval = parseInt(form.interval_value);
    let nextDate = new Date(lastDate);

    switch (form.interval_unit) {
      case 'hari': nextDate.setDate(nextDate.getDate() + interval); break;
      case 'minggu': nextDate.setDate(nextDate.getDate() + (interval * 7)); break;
      case 'bulan': nextDate.setMonth(nextDate.getMonth() + interval); break;
      case 'tahun': nextDate.setFullYear(nextDate.getFullYear() + interval); break;
    }

    return nextDate.toISOString().split('T')[0];
  };

  const calculateNextOdometer = () => {
    if (!form.last_maintenance_odometer || !form.odometer_interval) return '';
    return (parseFloat(form.last_maintenance_odometer) + parseFloat(form.odometer_interval)).toString();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.asset_id || !form.maintenance_type_id) {
      toast.error('Aset dan tipe pemeliharaan wajib diisi');
      return;
    }

    const payload = {
      ...form,
      interval_value: form.interval_value ? parseInt(form.interval_value) : null,
      odometer_interval: form.odometer_interval ? parseFloat(form.odometer_interval) : null,
      last_maintenance_odometer: form.last_maintenance_odometer ? parseFloat(form.last_maintenance_odometer) : null,
      next_maintenance_odometer: form.next_maintenance_odometer ? parseFloat(form.next_maintenance_odometer) : null,
      max_time_interval: form.max_time_interval ? parseInt(form.max_time_interval) : null,
      advance_notice_days: parseInt(form.advance_notice_days) || 7,
      advance_notice_odometer: parseFloat(form.advance_notice_odometer) || 500,
    };

    try {
      if (editing) {
        const { error } = await supabase.from('maintenance_schedules').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Jadwal diperbarui');
      } else {
        const { error } = await supabase.from('maintenance_schedules').insert([payload]);
        if (error) throw error;
        toast.success('Jadwal ditambahkan');
      }
      setShowForm(false);
      setEditing(null);
      resetForm();
      fetchSchedules();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleEdit = (s) => {
    setEditing(s);
    setForm({
      asset_id: s.asset_id || '',
      maintenance_type_id: s.maintenance_type_id || '',
      schedule_method: s.schedule_method || 'TIME',
      last_maintenance_date: s.last_maintenance_date || '',
      interval_value: s.interval_value?.toString() || '',
      interval_unit: s.interval_unit || 'bulan',
      next_maintenance_date: s.next_maintenance_date || '',
      last_maintenance_odometer: s.last_maintenance_odometer?.toString() || '',
      odometer_interval: s.odometer_interval?.toString() || '',
      next_maintenance_odometer: s.next_maintenance_odometer?.toString() || '',
      max_time_interval: s.max_time_interval?.toString() || '',
      max_time_unit: s.max_time_unit || 'bulan',
      advance_notice_days: s.advance_notice_days || 7,
      advance_notice_odometer: s.advance_notice_odometer || 500,
      working_day_adjustment: s.working_day_adjustment || 'mundur',
      responsible_user_id: s.responsible_user_id || '',
      assigned_user_id: s.assigned_user_id || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (s) => {
    if (!confirm('Hapus jadwal ini?')) return;
    const { error } = await supabase.from('maintenance_schedules').update({ is_active: false }).eq('id', s.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Jadwal dihapus');
    fetchSchedules();
  };

  const resetForm = () => {
    setForm({
      asset_id: '', maintenance_type_id: '', schedule_method: 'TIME',
      last_maintenance_date: '', interval_value: '', interval_unit: 'bulan',
      next_maintenance_date: '', last_maintenance_odometer: '', odometer_interval: '',
      next_maintenance_odometer: '', max_time_interval: '', max_time_unit: 'bulan',
      advance_notice_days: 7, advance_notice_odometer: 500, working_day_adjustment: 'mundur',
      responsible_user_id: '', assigned_user_id: ''
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Jadwal Pemeliharaan</h1>
          <p className="text-sm text-ink-400 mt-1">Kelola jadwal pemeliharaan aset</p>
        </div>
        {profile?.role !== 'pelaksana' && profile?.role !== 'direksi' && (
          <button onClick={() => { setShowForm(true); setEditing(null); resetForm(); }} className="btn-primary">
            <Plus size={18} /> Tambah Jadwal
          </button>
        )}
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
            <input type="text" className="input pl-9" placeholder="Cari aset..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input sm:w-48" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Semua Status</option>
            {Object.entries(SCHEDULE_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button onClick={fetchSchedules} className="btn-secondary"><Filter size={18} /> Filter</button>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin h-5 w-5 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          </div>
        ) : schedules.length === 0 ? (
          <div className="card">
            <div className="empty-state py-8">
              <div className="empty-state-icon"><CalendarClock size={48} /></div>
              <p className="empty-state-text">Belum ada jadwal pemeliharaan</p>
            </div>
          </div>
        ) : (
          schedules.map(s => (
            <div key={s.id} className="card p-4 hover-card">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Link to={`/assets/${s.asset_id}`} className="text-sm font-semibold text-primary-400 hover:underline">
                      {s.assets?.asset_name}
                    </Link>
                    <span className="text-xs text-ink-500 font-mono">({s.assets?.asset_code})</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {s.maintenance_types?.maintenance_name}</span>
                    <span>{SCHEDULE_METHOD_LABELS[s.schedule_method]}</span>
                    {s.next_maintenance_date && (
                      <span className="flex items-center gap-1"><Clock size={12} /> Berikutnya: {formatDate(s.next_maintenance_date)}</span>
                    )}
                    {s.next_maintenance_odometer > 0 && (
                      <span className="flex items-center gap-1"><Gauge size={12} /> {Number(s.next_maintenance_odometer).toLocaleString()} km</span>
                    )}
                    <span>PJ: {s.responsible_user?.full_name || '-'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={getStatusBadgeClass(s.schedule_status)}>
                    {SCHEDULE_STATUS_LABELS[s.schedule_status]}
                  </span>
                  {profile?.role !== 'pelaksana' && (
                    <>
                      <button onClick={() => handleEdit(s)} className="btn-secondary btn-sm"><Edit size={14} /></button>
                      <button onClick={() => handleDelete(s)} className="btn-danger btn-sm"><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
                  <CalendarClock size={18} className="text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">{editing ? 'Edit Jadwal' : 'Tambah Jadwal'}</h3>
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
                  <label className="label">Tipe Pemeliharaan <span className="text-danger-400">*</span></label>
                  <select className="input" value={form.maintenance_type_id} onChange={e => setForm({...form, maintenance_type_id: e.target.value})} required>
                    <option value="">Pilih Tipe</option>
                    {maintenanceTypes.map(m => <option key={m.id} value={m.id}>{m.maintenance_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Metode</label>
                  <select className="input" value={form.schedule_method} onChange={e => setForm({...form, schedule_method: e.target.value})}>
                    {Object.entries(SCHEDULE_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                {(form.schedule_method === 'TIME' || form.schedule_method === 'TIME_OR_ODOMETER') && (
                  <>
                    <div>
                      <label className="label">Tanggal Terakhir</label>
                      <input type="date" className="input" value={form.last_maintenance_date} onChange={e => {
                        setForm({...form, last_maintenance_date: e.target.value, next_maintenance_date: ''});
                      }} />
                    </div>
                    <div>
                      <label className="label">Interval</label>
                      <div className="flex gap-2">
                        <input type="number" className="input" placeholder="Nilai" value={form.interval_value} onChange={e => setForm({...form, interval_value: e.target.value})} min="1" />
                        <select className="input w-32" value={form.interval_unit} onChange={e => setForm({...form, interval_unit: e.target.value})}>
                          <option value="hari">Hari</option>
                          <option value="minggu">Minggu</option>
                          <option value="bulan">Bulan</option>
                          <option value="tahun">Tahun</option>
                        </select>
                      </div>
                      {form.last_maintenance_date && form.interval_value && (
                        <p className="text-xs text-ink-400 mt-1">
                          Berikutnya: {formatDate(calculateNextDate())}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {(form.schedule_method === 'ODOMETER' || form.schedule_method === 'TIME_OR_ODOMETER') && (
                  <>
                    <div>
                      <label className="label">Kilometer Terakhir</label>
                      <input type="number" className="input" value={form.last_maintenance_odometer} onChange={e => setForm({...form, last_maintenance_odometer: e.target.value})} />
                    </div>
                    <div>
                      <label className="label">Interval Kilometer</label>
                      <input type="number" className="input" value={form.odometer_interval} onChange={e => setForm({...form, odometer_interval: e.target.value})} placeholder="Contoh: 5000" />
                      {form.last_maintenance_odometer && form.odometer_interval && (
                        <p className="text-xs text-ink-400 mt-1">
                          Berikutnya: {Number(calculateNextOdometer()).toLocaleString()} km
                        </p>
                      )}
                    </div>
                  </>
                )}

                {form.schedule_method === 'TIME_OR_ODOMETER' && (
                  <div className="md:col-span-2">
                    <label className="label">Batas Waktu Maksimal</label>
                    <div className="flex gap-2">
                      <input type="number" className="input" placeholder="Nilai" value={form.max_time_interval} onChange={e => setForm({...form, max_time_interval: e.target.value})} />
                      <select className="input w-32" value={form.max_time_unit} onChange={e => setForm({...form, max_time_unit: e.target.value})}>
                        <option value="hari">Hari</option>
                        <option value="minggu">Minggu</option>
                        <option value="bulan">Bulan</option>
                        <option value="tahun">Tahun</option>
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="label">Penyesuaian Hari Kerja</label>
                  <select className="input" value={form.working_day_adjustment} onChange={e => setForm({...form, working_day_adjustment: e.target.value})}>
                    <option value="mundur">Mundur ke hari kerja berikutnya</option>
                    <option value="maju">Maju ke hari kerja sebelumnya</option>
                  </select>
                </div>
                <div>
                  <label className="label">Pengingat (hari)</label>
                  <input type="number" className="input" value={form.advance_notice_days} onChange={e => setForm({...form, advance_notice_days: e.target.value})} />
                </div>
                <div>
                  <label className="label">Penanggung Jawab</label>
                  <select className="input" value={form.responsible_user_id} onChange={e => setForm({...form, responsible_user_id: e.target.value})}>
                    <option value="">Pilih</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Pelaksana Default</label>
                  <select className="input" value={form.assigned_user_id} onChange={e => setForm({...form, assigned_user_id: e.target.value})}>
                    <option value="">Pilih</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Batal</button>
                <button type="submit" className="btn-primary">{editing ? 'Simpan' : 'Tambah Jadwal'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
