import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Search, Filter, Eye, Edit, X, RefreshCw, Calendar, Power, BellRing, Gauge } from 'lucide-react';
import {
  getScheduleStatus,
  getOdometerScheduleStatus,
  getCombinedScheduleStatus,
  formatDateID,
  formatInterval,
  formatOdometerInterval,
  SCHEDULE_STATUS,
  INTERVAL_TYPE
} from '../lib/maintenance-helpers';

export default function MaintenanceSchedulesPage() {
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    category_id: '',
    maintenance_type_id: '',
    status: '',
    is_active: ''
  });
  const [sortField, setSortField] = useState('next_maintenance_date');
  const [sortOrder, setSortOrder] = useState('asc');
  const [categories, setCategories] = useState([]);
  const [maintenanceTypes, setMaintenanceTypes] = useState([]);
  const [usersMap, setUsersMap] = useState({});

  const canWrite = role && ['super_admin', 'hrd'].includes(role.role_name);
  const [searchParams] = useSearchParams();
  const [notificationBanner, setNotificationBanner] = useState(searchParams.get('notification_test') === 'success');

  useEffect(() => {
    if (notificationBanner) {
      const timer = setTimeout(() => setNotificationBanner(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [notificationBanner]);

  const fetchMasterData = useCallback(async () => {
    const [catRes, typeRes] = await Promise.all([
      supabase.from('asset_categories').select('*').eq('is_active', true).order('category_name'),
      supabase.from('maintenance_types').select('*').eq('is_active', true).order('maintenance_name')
    ]);
    if (catRes.data) setCategories(catRes.data);
    if (typeRes.data) setMaintenanceTypes(typeRes.data);
  }, []);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('maintenance_schedules')
        .select(`
          *,
          asset:assets!inner(id, asset_code, asset_name, category_id, is_active, current_odometer),
          maintenance_type:maintenance_types!inner(id, maintenance_code, maintenance_name)
        `)
        .order(sortField, { ascending: sortOrder === 'asc' });

      if (search) {
        query = query.or(`asset.asset_code.ilike.%${search}%,asset.asset_name.ilike.%${search}%`);
      }

      if (filters.category_id) {
        query = query.eq('asset.category_id', filters.category_id);
      }
      if (filters.maintenance_type_id) {
        query = query.eq('maintenance_type_id', filters.maintenance_type_id);
      }
      if (filters.is_active !== '') {
        query = query.eq('is_active', filters.is_active === 'true');
      }

      const { data, error } = await query;
      if (error) throw error;

      const userIds = [...new Set(data?.filter(s => s.responsible_user_id).map(s => s.responsible_user_id) || [])];
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .in('id', userIds);
        const userMap = {};
        if (users) {
          users.forEach(u => { userMap[u.id] = u.full_name; });
        }
        setUsersMap(userMap);
      }

      setSchedules(data || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      toast.error('Gagal memuat data jadwal pemeliharaan');
    } finally {
      setLoading(false);
    }
  }, [search, filters, sortField, sortOrder]);

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleToggleActive = async (schedule) => {
    const reason = schedule.is_active
      ? prompt('Alasan penonaktifan:\n1. Aset tidak digunakan\n2. Jadwal tidak relevan\n3. Lainnya\n\nMasukkan alasan:')
      : null;

    if (schedule.is_active && !reason) return;

    try {
      const updates = schedule.is_active
        ? {
            is_active: false,
            deactivation_reason: reason,
            deactivated_at: new Date().toISOString(),
            deactivated_by: profile?.id
          }
        : {
            is_active: true,
            deactivation_reason: null,
            deactivated_at: null,
            deactivated_by: null
          };

      const { error } = await supabase
        .from('maintenance_schedules')
        .update(updates)
        .eq('id', schedule.id);

      if (error) throw error;
      toast.success(`Jadwal ${schedule.is_active ? 'dinonaktifkan' : 'diaktifkan'}`);
      fetchSchedules();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const resetFilters = () => {
    setFilters({
      category_id: '',
      maintenance_type_id: '',
      status: '',
      is_active: ''
    });
    setSearch('');
  };

  const getFilteredSchedules = () => {
    let result = [...schedules];
    if (filters.status) {
      result = result.filter(s => {
        const timeStatus = getScheduleStatus(s.next_maintenance_date, s.reminder_days_before, s.is_active);
        let odometerStatus = null;
        if ((s.interval_type === INTERVAL_TYPE.ODOMETER || s.interval_type === INTERVAL_TYPE.BOTH) && s.next_odometer_due) {
          odometerStatus = getOdometerScheduleStatus(s.asset?.current_odometer, s.next_odometer_due, s.odometer_reminder_km || 0);
        }
        const combined = odometerStatus ? getCombinedScheduleStatus(timeStatus, odometerStatus) : timeStatus;
        return combined.status === filters.status;
      });
    }
    return result;
  };

  const filteredSchedules = getFilteredSchedules();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Jadwal Pemeliharaan</h1>
          <p className="text-sm text-ink-400 mt-1">Kelola jadwal pemeliharaan berdasarkan waktu & kilometer</p>
        </div>
      {/* Banner navigasi dari notifikasi */}
      {notificationBanner && (
        <div className="flex items-center gap-3 p-4 bg-primary-500/10 border border-primary-500/20 rounded-xl animate-fade-in">
          <BellRing size={20} className="text-primary-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Navigasi dari notifikasi sistem berhasil.</p>
            <p className="text-xs text-ink-400 mt-0.5">Anda diarahkan ke halaman jadwal pemeliharaan dari notifikasi sistem.</p>
          </div>
          <button onClick={() => setNotificationBanner(false)} className="p-1 text-ink-400 hover:text-white hover:bg-white/5 rounded transition-all">
            <X size={16} />
          </button>
        </div>
      )}

        <div className="flex gap-2">
          <button onClick={fetchSchedules} className="btn-secondary text-sm" disabled={loading}>
            <RefreshCw size={14} className={`${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {canWrite && (
            <button
              onClick={() => navigate('/maintenance/schedules/new')}
              className="btn-primary text-sm"
            >
              <Plus size={14} />
              Tambah Jadwal
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Cari kode atau nama aset..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary text-sm ${showFilters ? '!bg-primary-500/10 !text-primary-300 !border-primary-500/20' : ''}`}
            >
              <Filter size={14} />
              Filter
            </button>
            {showFilters && (
              <button onClick={resetFilters} className="btn-secondary text-sm" title="Reset filter">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-white/5 animate-fade-in">
            <div>
              <label className="label">Kategori Aset</label>
              <select
                className="input"
                value={filters.category_id}
                onChange={(e) => setFilters({...filters, category_id: e.target.value})}
              >
                <option value="">Semua</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Jenis Pemeliharaan</label>
              <select
                className="input"
                value={filters.maintenance_type_id}
                onChange={(e) => setFilters({...filters, maintenance_type_id: e.target.value})}
              >
                <option value="">Semua</option>
                {maintenanceTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.maintenance_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
              >
                <option value="">Semua</option>
                <option value={SCHEDULE_STATUS.SAFE}>Aman</option>
                <option value={SCHEDULE_STATUS.APPROACHING}>Mendekati Jadwal</option>
                <option value={SCHEDULE_STATUS.DUE}>Jatuh Tempo</option>
                <option value={SCHEDULE_STATUS.OVERDUE}>Terlambat</option>
                <option value={SCHEDULE_STATUS.INACTIVE}>Nonaktif</option>
              </select>
            </div>
            <div>
              <label className="label">Status Aktif</label>
              <select
                className="input"
                value={filters.is_active}
                onChange={(e) => setFilters({...filters, is_active: e.target.value})}
              >
                <option value="">Semua</option>
                <option value="true">Aktif</option>
                <option value="false">Nonaktif</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-400">Menampilkan <span className="text-white font-medium font-mono">{filteredSchedules.length}</span> jadwal</span>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-white/5 rounded-md animate-pulse"></div>
            ))}
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Calendar size={48} /></div>
            <h3 className="empty-state-title">Tidak ada data jadwal pemeliharaan</h3>
            <p className="empty-state-text">Coba sesuaikan pencarian atau filter Anda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Kode Aset</th>
                  <th>Nama Aset</th>
                  <th>Jenis Pemeliharaan</th>
                  <th>Tgl Terakhir</th>
                  <th>Interval</th>
                  <th>Tgl Berikutnya</th>
                  <th>Km Terakhir</th>
                  <th>Km Berikutnya</th>
                  <th>Penanggung Jawab</th>
                  <th>Status</th>
                  <th>Sisa</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredSchedules.map((schedule) => {
                  const timeStatus = getScheduleStatus(
                    schedule.next_maintenance_date,
                    schedule.reminder_days_before,
                    schedule.is_active
                  );

                  let odometerStatus = null;
                  if ((schedule.interval_type === INTERVAL_TYPE.ODOMETER || schedule.interval_type === INTERVAL_TYPE.BOTH) && schedule.next_odometer_due) {
                    odometerStatus = getOdometerScheduleStatus(
                      schedule.asset?.current_odometer,
                      schedule.next_odometer_due,
                      schedule.odometer_reminder_km || 0
                    );
                  }

                  const combinedStatus = odometerStatus
                    ? getCombinedScheduleStatus(timeStatus, odometerStatus)
                    : timeStatus;

                  const isOverdue = combinedStatus.status === SCHEDULE_STATUS.OVERDUE;
                  const isDue = combinedStatus.status === SCHEDULE_STATUS.DUE;

                  const hasOdometer = schedule.interval_type === INTERVAL_TYPE.ODOMETER || schedule.interval_type === INTERVAL_TYPE.BOTH;

                  return (
                    <tr key={schedule.id} className="hover-card">
                      <td className="font-mono text-[12px] text-ink-300">{schedule.asset?.asset_code || '-'}</td>
                      <td className="font-medium text-white">{schedule.asset?.asset_name || '-'}</td>
                      <td className="text-ink-300">{schedule.maintenance_type?.maintenance_name || '-'}</td>
                      <td className="text-ink-400 font-mono text-[12px]">{formatDateID(schedule.last_maintenance_date)}</td>
                      <td className="text-ink-300">
                        {schedule.interval_type === INTERVAL_TYPE.ODOMETER ? formatOdometerInterval(schedule.odometer_interval_value) : formatInterval(schedule.interval_value, schedule.interval_unit)}
                      </td>
                      <td className="text-ink-300 font-mono text-[12px]">
                        {schedule.next_maintenance_date ? formatDateID(schedule.next_maintenance_date) : '-'}
                      </td>
                      <td className="text-ink-300 font-mono text-[12px]">
                        {hasOdometer && schedule.last_odometer ? Number(schedule.last_odometer).toLocaleString('id-ID') + ' km' : '-'}
                      </td>
                      <td className="text-ink-300 font-mono text-[12px]">
                        {hasOdometer && schedule.next_odometer_due ? Number(schedule.next_odometer_due).toLocaleString('id-ID') + ' km' : '-'}
                      </td>
                      <td className="text-ink-300">{usersMap[schedule.responsible_user_id] || '-'}</td>
                      <td>
                        <span className={`badge ${
                          combinedStatus.color === 'green' ? 'badge-green' :
                          combinedStatus.color === 'yellow' ? 'badge-yellow' :
                          combinedStatus.color === 'blue' ? 'badge-blue' :
                          combinedStatus.color === 'red' ? 'badge-red' :
                          'badge-gray'
                        }`}>
                          {combinedStatus.label}
                        </span>
                      </td>
                      <td>
                        {isOverdue ? (
                          <span className="text-danger-400 font-medium font-mono text-[12px]">
                            {combinedStatus.kmRemaining !== undefined
                              ? `${Math.abs(combinedStatus.kmRemaining).toLocaleString('id-ID')} km terlambat`
                              : `${Math.abs(combinedStatus.daysRemaining)} hari terlambat`}
                          </span>
                        ) : isDue ? (
                          <span className="text-primary-400 font-medium font-mono text-[12px]">
                            {combinedStatus.kmRemaining !== undefined ? 'Sekarang' : 'Hari ini'}
                          </span>
                        ) : (
                          <span className="text-ink-400 font-mono text-[12px]">
                            {combinedStatus.kmRemaining !== undefined
                              ? `${combinedStatus.kmRemaining.toLocaleString('id-ID')} km`
                              : `${combinedStatus.daysRemaining} hari`}
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/maintenance/schedules/${schedule.id}`)}
                            className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded-md transition-all"
                            title="Detail"
                          >
                            <Eye size={14} />
                          </button>
                          {canWrite && (
                            <button
                              onClick={() => navigate(`/maintenance/schedules/${schedule.id}/edit`)}
                              className="p-1.5 text-success-400 hover:bg-success-500/10 rounded-md transition-all"
                              title="Edit"
                            >
                              <Edit size={14} />
                            </button>
                          )}
                          {canWrite && (
                            <button
                              onClick={() => handleToggleActive(schedule)}
                              className={`p-1.5 rounded-md transition-all ${
                                schedule.is_active
                                  ? 'text-orange-400 hover:bg-orange-500/10'
                                  : 'text-success-400 hover:bg-success-500/10'
                              }`}
                              title={schedule.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            >
                              <Power size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
