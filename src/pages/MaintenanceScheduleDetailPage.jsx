import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Edit, X, RefreshCw, Calendar, Package, User, FileText, AlertCircle, Shield, Gauge } from 'lucide-react';
import {
  getScheduleStatus,
  getOdometerScheduleStatus,
  getCombinedScheduleStatus,
  formatDateID,
  formatDateLongID,
  formatInterval,
  formatOdometerInterval,
  SCHEDULE_STATUS,
  SCHEDULE_STATUS_LABELS,
  INTERVAL_UNIT_LABELS,
  INTERVAL_TYPE,
  INTERVAL_TYPE_LABELS
} from '../lib/maintenance-helpers';

export default function MaintenanceScheduleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usersMap, setUsersMap] = useState({});
  const [assetCurrentOdometer, setAssetCurrentOdometer] = useState(null);

  const canWrite = role && ['super_admin', 'hrd'].includes(role.role_name);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .select(`
          *,
          asset:assets!inner(id, asset_code, asset_name, category_id, is_active, current_odometer),
          maintenance_type:maintenance_types!inner(id, maintenance_code, maintenance_name, description)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      setSchedule(data);

      // Get current odometer from asset
      if (data.asset?.current_odometer) {
        setAssetCurrentOdometer(data.asset.current_odometer);
      }

      // Fetch responsible user
      if (data.responsible_user_id) {
        const { data: user } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('id', data.responsible_user_id)
          .single();
        if (user) {
          setUsersMap({ [data.responsible_user_id]: user.full_name });
        }
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
      toast.error('Gagal memuat data jadwal');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleToggleActive = async () => {
    if (!schedule) return;

    const reason = schedule.is_active
      ? prompt('Alasan penonaktifkan:\n1. Aset tidak digunakan\n2. Jadwal tidak relevan\n3. Lainnya\n\nMasukkan alasan:')
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
      fetchSchedule();
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle size={48} className="text-ink-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white">Jadwal tidak ditemukan</h3>
        </div>
      </div>
    );
  }

  // Calculate time-based status
  const timeStatus = getScheduleStatus(
    schedule.next_maintenance_date,
    schedule.reminder_days_before,
    schedule.is_active
  );

  // Calculate odometer-based status (if applicable)
  const odometerStatus = (schedule.interval_type === INTERVAL_TYPE.ODOMETER || schedule.interval_type === INTERVAL_TYPE.BOTH) && schedule.next_odometer_due
    ? getOdometerScheduleStatus(
        assetCurrentOdometer,
        schedule.next_odometer_due,
        schedule.odometer_reminder_km || 0
      )
    : null;

  // Combined status (for BOTH type)
  const combinedStatus = odometerStatus
    ? getCombinedScheduleStatus(timeStatus, odometerStatus)
    : timeStatus;

  const statusBadgeClass =
    combinedStatus.color === 'green' ? 'badge-green' :
    combinedStatus.color === 'yellow' ? 'badge-yellow' :
    combinedStatus.color === 'blue' ? 'badge-blue' :
    combinedStatus.color === 'red' ? 'badge-red' :
    'badge-gray';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/maintenance/schedules')}
            className="p-2 text-ink-300 hover:bg-white/5 rounded-xl transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">Detail Jadwal Pemeliharaan</h1>
            <p className="text-sm text-ink-400 mt-1">Informasi lengkap jadwal pemeliharaan</p>
          </div>
        </div>
        {canWrite && (
          <button
            onClick={() => navigate(`/maintenance/schedules/${schedule.id}/edit`)}
            className="btn-primary text-sm"
          >
            <Edit size={16} />
            Edit
          </button>
        )}
      </div>

      {/* Info Card */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Kolom Kiri */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-ink-400 uppercase">Kode Aset</label>
              <p className="text-sm font-medium text-white mt-1 font-mono">{schedule.asset?.asset_code || '-'}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-400 uppercase">Nama Aset</label>
              <p className="text-sm font-medium text-white mt-1">{schedule.asset?.asset_name || '-'}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-400 uppercase">Jenis Pemeliharaan</label>
              <p className="text-sm font-medium text-white mt-1">
                {schedule.maintenance_type?.maintenance_name || '-'}
              </p>
              <p className="text-xs text-ink-400 mt-1 font-mono">
                {schedule.maintenance_type?.maintenance_code || '-'}
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-400 uppercase">Tipe Penjadwalan</label>
              <p className="text-sm font-medium text-white mt-1">
                {INTERVAL_TYPE_LABELS[schedule.interval_type] || 'Berdasarkan Waktu'}
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-400 uppercase">Tanggal Terakhir</label>
              <p className="text-sm font-medium text-white mt-1">{formatDateID(schedule.last_maintenance_date)}</p>
            </div>
            {(schedule.interval_type === INTERVAL_TYPE.TIME || schedule.interval_type === INTERVAL_TYPE.BOTH) && (
              <>
                <div>
                  <label className="text-xs font-semibold text-ink-400 uppercase">Interval Waktu</label>
                  <p className="text-sm font-medium text-white mt-1">
                    {formatInterval(schedule.interval_value, schedule.interval_unit)}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-400 uppercase">Tanggal Berikutnya</label>
                  <p className="text-sm font-medium text-white mt-1">{formatDateID(schedule.next_maintenance_date)}</p>
                  <p className="text-xs text-ink-400 mt-1">{formatDateLongID(schedule.next_maintenance_date)}</p>
                </div>
              </>
            )}
            {(schedule.interval_type === INTERVAL_TYPE.ODOMETER || schedule.interval_type === INTERVAL_TYPE.BOTH) && (
              <>
                <div>
                  <label className="text-xs font-semibold text-ink-400 uppercase">Kilometer Terakhir</label>
                  <p className="text-sm font-medium text-white mt-1 font-mono">
                    {schedule.last_odometer ? Number(schedule.last_odometer).toLocaleString('id-ID') + ' km' : '-'}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-400 uppercase">Interval Kilometer</label>
                  <p className="text-sm font-medium text-white mt-1">
                    {formatOdometerInterval(schedule.odometer_interval_value)}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-400 uppercase">Kilometer Berikutnya</label>
                  <p className="text-sm font-medium text-white mt-1 font-mono">
                    {schedule.next_odometer_due ? Number(schedule.next_odometer_due).toLocaleString('id-ID') + ' km' : '-'}
                  </p>
                </div>
                {assetCurrentOdometer && (
                  <div>
                    <label className="text-xs font-semibold text-ink-400 uppercase">Kilometer Saat Ini</label>
                    <p className="text-sm font-medium text-white mt-1 font-mono">
                      {Number(assetCurrentOdometer).toLocaleString('id-ID')} km
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Kolom Kanan */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-ink-400 uppercase">Penanggung Jawawab</label>
              <p className="text-sm font-medium text-white mt-1">
                {usersMap[schedule.responsible_user_id] || '-'}
              </p>
            </div>
            {(schedule.interval_type === INTERVAL_TYPE.TIME || schedule.interval_type === INTERVAL_TYPE.BOTH) && (
              <div>
                <label className="text-xs font-semibold text-ink-400 uppercase">Pengingat (Hari)</label>
                <p className="text-sm font-medium text-white mt-1">{schedule.reminder_days_before} hari sebelumnya</p>
              </div>
            )}
            {(schedule.interval_type === INTERVAL_TYPE.ODOMETER || schedule.interval_type === INTERVAL_TYPE.BOTH) && (
              <div>
                <label className="text-xs font-semibold text-ink-400 uppercase">Pengingat (Km)</label>
                <p className="text-sm font-medium text-white mt-1">
                  {schedule.odometer_reminder_km ? Number(schedule.odometer_reminder_km).toLocaleString('id-ID') + ' km sebelumnya' : '-'}
                </p>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-ink-400 uppercase">Status</label>
              <div className="mt-1">
                <span className={`badge ${statusBadgeClass}`}>
                  {combinedStatus.label}
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-400 uppercase">
                {combinedStatus.status === SCHEDULE_STATUS.OVERDUE ? 'Keterlambatan' : 'Sisa'}
              </label>
              <p className={`text-sm font-medium mt-1 ${
                combinedStatus.status === SCHEDULE_STATUS.OVERDUE ? 'text-danger-400' :
                combinedStatus.status === SCHEDULE_STATUS.DUE ? 'text-primary-400' :
                'text-white'
              }`}>
                {combinedStatus.status === SCHEDULE_STATUS.OVERDUE
                  ? (combinedStatus.kmRemaining !== undefined
                    ? `${Math.abs(combinedStatus.kmRemaining).toLocaleString('id-ID')} km terlambat`
                    : `${Math.abs(combinedStatus.daysRemaining)} hari terlambat`)
                  : combinedStatus.status === SCHEDULE_STATUS.DUE
                  ? 'Hari ini / Sekarang'
                  : (combinedStatus.kmRemaining !== undefined
                    ? `${combinedStatus.kmRemaining.toLocaleString('id-ID')} km`
                    : `${combinedStatus.daysRemaining} hari`)}
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-400 uppercase">Status Aktif</label>
              <p className="text-sm font-medium text-white mt-1">
                {schedule.is_active ? 'Aktif' : 'Nonaktif'}
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-400 uppercase">Catatan</label>
              <p className="text-sm text-ink-300 mt-1">{schedule.notes || '-'}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 mt-6 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-ink-400">
          <div>
            <span className="font-medium">Dibuat:</span> {formatDateID(schedule.created_at)}
          </div>
          <div>
            <span className="font-medium">Diperbarui:</span> {formatDateID(schedule.updated_at)}
          </div>
          {schedule.deactivated_at && (
            <>
              <div>
                <span className="font-medium">Dinonaktifkan:</span> {formatDateID(schedule.deactivated_at)}
              </div>
              <div>
                <span className="font-medium">Alasan:</span> {schedule.deactivation_reason || '-'}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {canWrite && (
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/maintenance/schedules/${schedule.id}/edit`)}
            className="btn-secondary text-sm"
          >
            <Edit size={16} />
            Edit Jadwal
          </button>
          <button
            onClick={handleToggleActive}
            className={`btn ${
              schedule.is_active
                ? 'btn-warning text-white'
                : 'btn-success text-white'
            }`}
          >
            {schedule.is_active ? <X size={16} /> : <RefreshCw size={16} />}
            {schedule.is_active ? 'Nonaktifkan' : 'Aktifkan'}
          </button>
        </div>
      )}
    </div>
  );
}
