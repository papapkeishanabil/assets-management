import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Edit, X, RefreshCw, Calendar, Package, User, FileText, AlertCircle, Shield, Gauge, CheckCircle2, History, ClipboardCheck } from 'lucide-react';
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
import MaintenanceExecutionForm from '../components/MaintenanceExecutionForm';
import { formatCurrency } from '../lib/constants';

export default function MaintenanceScheduleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usersMap, setUsersMap] = useState({});
  const [assetCurrentOdometer, setAssetCurrentOdometer] = useState(null);
  const [showExecutionForm, setShowExecutionForm] = useState(false);
  const [executions, setExecutions] = useState([]);
  const [executionsLoading, setExecutionsLoading] = useState(false);
  const [assessDraft, setAssessDraft] = useState(null);
  const [assessmentResult, setAssessmentResult] = useState('');
  const [assessmentNotes, setAssessmentNotes] = useState('');
  const [assessing, setAssessing] = useState(false);

  const canWrite = role && ['super_admin', 'hrd'].includes(role.role_name);
  const canExecute = role && ['super_admin', 'hrd', 'pelaksana'].includes(role.role_name);

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

  const fetchExecutions = useCallback(async () => {
    if (!id) return;
    setExecutionsLoading(true);
    try {
      const { data, error } = await supabase
        .from('maintenance_executions')
        .select(`
          *,
          performer:performed_by (id, full_name)
        `)
        .eq('schedule_id', id)
        .order('execution_date', { ascending: false });
      if (error) throw error;
      setExecutions(data || []);
    } catch (error) {
      console.error('Error fetching executions:', error);
    } finally {
      setExecutionsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  useEffect(() => {
    if (id) fetchExecutions();
  }, [id, fetchExecutions]);

  const handleExecutionSaved = () => {
    setShowExecutionForm(false);
    fetchExecutions();
    fetchSchedule();
  };

  const handleAssessDraft = async (e) => {
    e.preventDefault();
    if (!assessDraft) return;
    if (!assessmentResult) {
      toast.error('Hasil penilaian wajib dipilih');
      return;
    }

    setAssessing(true);
    try {
      const { error } = await supabase
        .from('maintenance_executions')
        .update({
          assessment_result: assessmentResult,
          assessment_notes: assessmentNotes || null,
          assessed_by: profile?.id || null,
          assessed_at: new Date().toISOString()
        })
        .eq('id', assessDraft.id);

      if (error) throw error;
      toast.success('Penilaian draft berhasil disimpan');
      setAssessDraft(null);
      setAssessmentResult('');
      setAssessmentNotes('');
      fetchExecutions();
    } catch (error) {
      console.error('Error assessing draft:', error);
      toast.error('Gagal menyimpan penilaian: ' + (error.message || 'Unknown error'));
    } finally {
      setAssessing(false);
    }
  };

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
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
              Detail Jadwal Pemeliharaan
            </h1>
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
              <label className="text-xs font-semibold text-ink-400 uppercase">Penanggung Jawab</label>
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
      <div className="flex flex-wrap gap-3">
        {canExecute && schedule.is_active && (
          <button
            onClick={() => setShowExecutionForm(true)}
            className="btn-primary text-sm"
          >
            <CheckCircle2 size={16} />
            Catat Pelaksanaan
          </button>
        )}
        {canWrite && (
          <>
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
          </>
        )}
      </div>

      {/* Riwayat Pelaksanaan */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-500/10 border border-primary-500/20">
              <History size={18} className="text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Riwayat Pelaksanaan</h2>
              <p className="text-xs text-ink-400">Catatan setiap pelaksanaan kegiatan dari jadwal rutin ini</p>
            </div>
          </div>
          {executions.length > 0 && (
            <span className="badge badge-blue">{executions.length} pelaksanaan</span>
          )}
        </div>

        {executionsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-16 bg-white/5 rounded-md animate-pulse"></div>
            ))}
          </div>
        ) : executions.length === 0 ? (
          <div className="empty-state py-8">
            <div className="empty-state-icon"><History size={40} /></div>
            <h3 className="empty-state-title">Belum ada pelaksanaan</h3>
            <p className="empty-state-text">
              Klik tombol "Catat Pelaksanaan" untuk mencatat kegiatan yang sudah dilakukan
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {executions.map((execution) => {
              const photos = Array.isArray(execution.photos) ? execution.photos : [];
              const isDraft = execution.is_draft;
              return (
                <div key={execution.id} className={`border rounded-xl p-4 hover:bg-white/[0.02] transition-all ${
                  isDraft ? 'border-warning-500/30 bg-warning-500/5' : 'border-white/5'
                }`}>
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isDraft ? (
                          <span className="badge badge-yellow">
                            <FileText size={12} className="mr-1" />
                            Draft
                          </span>
                        ) : (
                          <span className="badge badge-green">
                            <CheckCircle2 size={12} className="mr-1" />
                            Selesai
                          </span>
                        )}
                        <span className="text-sm font-medium text-white">
                          {formatDateLongID(execution.execution_date)}
                        </span>
                        {execution.odometer_at_execution && (
                          <span className="text-xs text-ink-400 font-mono">
                            {Number(execution.odometer_at_execution).toLocaleString('id-ID')} km
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-ink-200 mt-2">{execution.result || '-'}</p>
                      <div className="flex flex-wrap gap-4 mt-2 text-xs text-ink-400">
                        {execution.cost != null && (
                          <span>Biaya: <span className="text-white font-medium">{formatCurrency(execution.cost)}</span></span>
                        )}
                        {execution.performer?.full_name && (
                          <span>Pelaksana: <span className="text-white font-medium">{execution.performer.full_name}</span></span>
                        )}
                        {execution.notes && (
                          <span>Catatan: <span className="text-white font-medium">{execution.notes}</span></span>
                        )}
                        {isDraft && (
                          <span className="text-warning-300">Menunggu penilaian dan persetujuan</span>
                        )}
                        {isDraft && execution.assessment_result && (
                          <span className="text-success-300">
                            Hasil: {execution.assessment_result === 'normal' && 'Normal'}
                            {execution.assessment_result === 'perlu_perbaikan' && 'Perlu Perbaikan'}
                            {execution.assessment_result === 'perlu_penggantian' && 'Perlu Penggantian'}
                            {execution.assessment_result === 'perlu_monitoring' && 'Perlu Monitoring'}
                            {execution.assessment_result === 'lainnya' && 'Lainnya'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {isDraft && canWrite && !execution.assessment_result && (
                        <button
                          onClick={() => {
                            setAssessDraft(execution);
                            setAssessmentResult('');
                            setAssessmentNotes('');
                          }}
                          className="btn-warning text-white text-xs px-3 py-1.5"
                        >
                          <ClipboardCheck size={14} />
                          Beri Penilaian
                        </button>
                      )}
                      {isDraft && execution.assessment_result && (
                        <span className="badge badge-green">
                          <CheckCircle2 size={12} className="mr-1" />
                          Sudah Dinilai
                        </span>
                      )}
                    </div>
                    {photos.length > 0 && (
                      <div className="flex gap-2 flex-shrink-0">
                        {photos.map((url, idx) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-16 h-16 rounded-lg overflow-hidden border border-white/10 hover:border-primary-500/40 transition-all"
                            title={`Foto ${idx + 1}`}
                          >
                            <img src={url} alt={`Foto pelaksanaan ${idx + 1}`} className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Catat Pelaksanaan */}
      {showExecutionForm && schedule && (
        <MaintenanceExecutionForm
          schedule={schedule}
          onClose={() => setShowExecutionForm(false)}
          onSaved={handleExecutionSaved}
        />
      )}

      {/* Modal Penilaian Draft */}
      {assessDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setAssessDraft(null)} />
          <div className="relative w-full max-w-lg card animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-warning-500/10 border border-warning-500/20">
                  <ClipboardCheck size={18} className="text-warning-300" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Penilaian Draft</h3>
                  <p className="text-xs text-ink-400">
                    {schedule?.asset?.asset_name} — {schedule?.maintenance_type?.maintenance_name}
                  </p>
                </div>
              </div>
              <button onClick={() => setAssessDraft(null)} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssessDraft} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-ink-400 uppercase">Hasil Pemeriksaan Surveyor</label>
                <p className="text-sm text-ink-200 mt-1 whitespace-pre-wrap bg-white/5 border border-white/10 rounded-lg p-3">
                  {assessDraft.result || '-'}
                </p>
              </div>

              {assessDraft.notes && (
                <div>
                  <label className="text-xs font-semibold text-ink-400 uppercase">Catatan Surveyor</label>
                  <p className="text-sm text-ink-200 mt-1 whitespace-pre-wrap bg-white/5 border border-white/10 rounded-lg p-3">
                    {assessDraft.notes}
                  </p>
                </div>
              )}

              {assessDraft.photos && assessDraft.photos.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-ink-400 uppercase">Foto Bukti</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                    {assessDraft.photos.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full h-20 rounded-lg overflow-hidden border border-white/10 hover:border-primary-500/40 transition-all"
                      >
                        <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="label">Hasil Penilaian <span className="text-danger-400">*</span></label>
                <select
                  className="input"
                  value={assessmentResult}
                  onChange={(e) => setAssessmentResult(e.target.value)}
                  required
                >
                  <option value="">Pilih hasil penilaian...</option>
                  <option value="normal">Normal - Mesin dalam kondisi baik</option>
                  <option value="perlu_perbaikan">Perlu Perbaikan</option>
                  <option value="perlu_penggantian">Perlu Penggantian</option>
                  <option value="perlu_monitoring">Perlu Monitoring</option>
                  <option value="lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="label">Catatan Penilaian</label>
                <textarea
                  className="input"
                  rows="3"
                  value={assessmentNotes}
                  onChange={(e) => setAssessmentNotes(e.target.value)}
                  placeholder="Catatan dari HRD dan tim teknis: misal jarum sering patah, perlu ganti bagian X, dll..."
                />
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-white/5">
                <button type="button" onClick={() => setAssessDraft(null)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" className="btn-primary" disabled={assessing}>
                  {assessing ? 'Menyimpan...' : <><CheckCircle2 size={16} /> Simpan Penilaian</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
