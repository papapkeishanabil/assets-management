import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Save, X, Calendar, Package, User, FileText, AlertCircle, Gauge } from 'lucide-react';
import {
  calculateNextMaintenanceDate,
  calculateNextOdometer,
  formatDateLongID,
  formatDateID,
  formatOdometerInterval,
  INTERVAL_UNITS,
  INTERVAL_UNIT_LABELS,
  INTERVAL_TYPE,
  INTERVAL_TYPE_LABELS,
  checkDuplicateSchedule
} from '../lib/maintenance-helpers';

export default function MaintenanceScheduleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const isEdit = !!id;

  const [assets, setAssets] = useState([]);
  const [maintenanceTypes, setMaintenanceTypes] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [previewNextDate, setPreviewNextDate] = useState(null);
  const [previewAdjusted, setPreviewAdjusted] = useState(false);
  const [previewNextOdometer, setPreviewNextOdometer] = useState(null);

  const [form, setForm] = useState({
    asset_id: '',
    maintenance_type_id: '',
    last_maintenance_date: '',
    last_odometer: '',
    interval_type: INTERVAL_TYPE.TIME,
    interval_value: 1,
    interval_unit: INTERVAL_UNITS.MONTH,
    odometer_interval_value: '',
    reminder_days_before: 7,
    odometer_reminder_km: 500,
    responsible_user_id: '',
    notes: '',
    is_active: true
  });

  const canWrite = role && ['super_admin', 'hrd'].includes(role.role_name);

  const selectedType = maintenanceTypes.find(t => t.id === form.maintenance_type_id);
  const isKerjaBakti = selectedType?.maintenance_code === 'KERJA-BAKTI';

  const fetchMasterData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [assetRes, typeRes, userRes] = await Promise.all([
        supabase.from('assets').select('id, asset_code, asset_name, is_active, current_odometer').eq('is_active', true).order('asset_name'),
        supabase.from('maintenance_types').select('*').eq('is_active', true).order('maintenance_name'),
        supabase.from('user_profiles').select('id, full_name, account_status').eq('account_status', 'ACTIVE').order('full_name')
      ]);
      if (assetRes.data) setAssets(assetRes.data);
      if (typeRes.data) setMaintenanceTypes(typeRes.data);
      if (userRes.data) setUsers(userRes.data);
    } catch (error) {
      console.error('Error fetching master data:', error);
      toast.error('Gagal memuat data');
    } finally {
      setLoadingData(false);
    }
  }, []);

  const fetchSchedule = useCallback(async () => {
    if (!id) return;
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;

      setForm({
        asset_id: data.asset_id,
        maintenance_type_id: data.maintenance_type_id,
        last_maintenance_date: data.last_maintenance_date,
        last_odometer: data.last_odometer || '',
        interval_type: data.interval_type || INTERVAL_TYPE.TIME,
        interval_value: data.interval_value,
        interval_unit: data.interval_unit,
        odometer_interval_value: data.odometer_interval_value || '',
        reminder_days_before: data.reminder_days_before,
        odometer_reminder_km: data.odometer_reminder_km || 500,
        responsible_user_id: data.responsible_user_id || '',
        notes: data.notes || '',
        is_active: data.is_active
      });

      // Calculate preview
      if (data.last_maintenance_date && data.interval_value > 0) {
        const { nextDate, adjusted } = calculateNextMaintenanceDate(
          data.last_maintenance_date,
          data.interval_value,
          data.interval_unit
        );
        setPreviewNextDate(nextDate);
        setPreviewAdjusted(adjusted);
      }

      if (data.last_odometer && data.odometer_interval_value) {
        const nextOdo = calculateNextOdometer(data.last_odometer, data.odometer_interval_value);
        setPreviewNextOdometer(nextOdo);
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
      toast.error('Gagal memuat data jadwal');
    } finally {
      setLoadingData(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMasterData();
    if (id) fetchSchedule();
  }, [fetchMasterData, fetchSchedule, id]);

  // Recalculate time-based preview
  useEffect(() => {
    if (form.last_maintenance_date && form.interval_value > 0 && (form.interval_type === INTERVAL_TYPE.TIME || form.interval_type === INTERVAL_TYPE.BOTH)) {
      const { nextDate, adjusted } = calculateNextMaintenanceDate(
        form.last_maintenance_date,
        form.interval_value,
        form.interval_unit
      );
      setPreviewNextDate(nextDate);
      setPreviewAdjusted(adjusted);
    } else {
      setPreviewNextDate(null);
      setPreviewAdjusted(false);
    }
  }, [form.last_maintenance_date, form.interval_value, form.interval_unit, form.interval_type]);

  // Recalculate odometer-based preview
  useEffect(() => {
    if (form.last_odometer && form.odometer_interval_value && (form.interval_type === INTERVAL_TYPE.ODOMETER || form.interval_type === INTERVAL_TYPE.BOTH)) {
      const nextOdo = calculateNextOdometer(form.last_odometer, form.odometer_interval_value);
      setPreviewNextOdometer(nextOdo);
    } else {
      setPreviewNextOdometer(null);
    }
  }, [form.last_odometer, form.odometer_interval_value, form.interval_type]);

  // Auto-fill last_odometer from asset when asset changes (for vehicle assets)
  useEffect(() => {
    if (form.asset_id && !form.last_odometer) {
      const selectedAsset = assets.find(a => a.id === form.asset_id);
      if (selectedAsset && selectedAsset.current_odometer) {
        setForm(prev => ({ ...prev, last_odometer: selectedAsset.current_odometer }));
      }
    }
  }, [form.asset_id, assets]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validasi
    const selectedType = maintenanceTypes.find(t => t.id === form.maintenance_type_id);
    const isKerjaBakti = selectedType?.maintenance_code === 'KERJA-BAKTI';
    
    if (!isKerjaBakti && !form.asset_id) {
      toast.error('Aset wajib dipilih');
      return;
    }
    if (!form.maintenance_type_id) {
      toast.error('Jenis pemeliharaan wajib dipilih');
      return;
    }
    if (!form.last_maintenance_date) {
      toast.error('Tanggal pemeliharaan terakhir wajib diisi');
      return;
    }
    if (!form.interval_type) {
      toast.error('Tipe interval wajib dipilih');
      return;
    }

    // Validasi time-based
    if (form.interval_type === INTERVAL_TYPE.TIME || form.interval_type === INTERVAL_TYPE.BOTH) {
      if (!form.interval_value || form.interval_value <= 0) {
        toast.error('Interval waktu harus lebih besar dari 0');
        return;
      }
      if (!form.interval_unit) {
        toast.error('Satuan interval waktu wajib dipilih');
        return;
      }
    }

    // Validasi odometer-based
    if (form.interval_type === INTERVAL_TYPE.ODOMETER || form.interval_type === INTERVAL_TYPE.BOTH) {
      if (!form.odometer_interval_value || form.odometer_interval_value <= 0) {
        toast.error('Interval kilometer harus lebih besar dari 0');
        return;
      }
    }

    if (form.reminder_days_before < 0) {
      toast.error('Pengingat tidak boleh negatif');
      return;
    }

    // Cek aset aktif (hanya jika ada aset yang dipilih)
    if (form.asset_id) {
      const selectedAsset = assets.find(a => a.id === form.asset_id);
      if (!selectedAsset || !selectedAsset.is_active) {
        toast.error('Jadwal tidak boleh dibuat untuk aset nonaktif');
        return;
      }
    }

    // Cek duplikat (hanya jika ada aset)
    if (form.asset_id) {
      const isDuplicate = await checkDuplicateSchedule(
        supabase,
        form.asset_id,
        form.maintenance_type_id,
        isEdit ? id : null
      );
      if (isDuplicate) {
        toast.error('Aset ini sudah memiliki jadwal aktif untuk jenis pemeliharaan yang sama.');
        return;
      }
    }

    setLoading(true);
    try {
      // Hitung tanggal berikutnya (time-based)
      let nextMaintenanceDate = null;
      if (form.interval_type === INTERVAL_TYPE.TIME || form.interval_type === INTERVAL_TYPE.BOTH) {
        const { nextDate } = calculateNextMaintenanceDate(
          form.last_maintenance_date,
          form.interval_value,
          form.interval_unit
        );
        nextMaintenanceDate = formatDateID(nextDate).split('-').reverse().join('-'); // YYYY-MM-DD
      }

      // Hitung kilometer berikutnya (odometer-based)
      let nextOdometerDue = null;
      if (form.interval_type === INTERVAL_TYPE.ODOMETER || form.interval_type === INTERVAL_TYPE.BOTH) {
        nextOdometerDue = calculateNextOdometer(form.last_odometer, form.odometer_interval_value);
      }

      const dataToSubmit = {
        asset_id: form.asset_id || null,
        maintenance_type_id: form.maintenance_type_id,
        last_maintenance_date: form.last_maintenance_date,
        last_odometer: form.last_odometer ? parseFloat(form.last_odometer) : null,
        interval_type: form.interval_type,
        interval_value: form.interval_value,
        interval_unit: form.interval_unit,
        odometer_interval_value: form.odometer_interval_value ? parseInt(form.odometer_interval_value) : null,
        next_maintenance_date: nextMaintenanceDate,
        next_odometer_due: nextOdometerDue,
        reminder_days_before: form.reminder_days_before,
        odometer_reminder_km: form.odometer_reminder_km ? parseInt(form.odometer_reminder_km) : 500,
        responsible_user_id: form.responsible_user_id || null,
        notes: form.notes || null,
        is_active: form.is_active
      };

      // Clean empty strings to null for UUID fields
      Object.keys(dataToSubmit).forEach(key => {
        if (dataToSubmit[key] === '' && ['asset_id', 'responsible_user_id'].includes(key)) {
          dataToSubmit[key] = null;
        }
      });

      if (isEdit) {
        const { error } = await supabase
          .from('maintenance_schedules')
          .update(dataToSubmit)
          .eq('id', id);
        if (error) throw error;
        toast.success('Jadwal pemeliharaan berhasil diperbarui.');
      } else {
        const { error } = await supabase
          .from('maintenance_schedules')
          .insert([dataToSubmit]);
        if (error) throw error;
        toast.success('Jadwal pemeliharaan berhasil ditambahkan.');
      }

      navigate('/maintenance/schedules');
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast.error(`Gagal menyimpan: ${error.message || error.code || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!canWrite) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle size={48} className="text-ink-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white">Akses Ditolak</h3>
          <p className="text-ink-400 mt-2">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
        </div>
      </div>
    );
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
            {isEdit ? 'Edit Jadwal Pemeliharaan' : 'Tambah Jadwal Pemeliharaan'}
          </h1>
          <p className="text-sm text-ink-400 mt-1">
            {isEdit ? 'Perbarui jadwal pemeliharaan' : 'Buat jadwal pemeliharaan baru'}
          </p>
        </div>
        <button onClick={() => navigate('/maintenance/schedules')} className="btn-secondary text-sm">
          <X size={16} />
          Batal
        </button>
      </div>

      {/* Form */}
      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Jenis Pemeliharaan */}
          <div>
            <label className="label">Jenis Pemeliharaan <span className="text-danger-400">*</span></label>
            <select
              className="input"
              value={form.maintenance_type_id}
              onChange={(e) => setForm({...form, maintenance_type_id: e.target.value})}
              required
            >
              <option value="">Pilih jenis pemeliharaan...</option>
              {maintenanceTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.maintenance_code} - {type.maintenance_name}
                </option>
              ))}
            </select>
          </div>

          {/* Aset */}
          <div>
            <label className="label">
              Aset {!isKerjaBakti && <span className="text-danger-400">*</span>}
            </label>
            {isKerjaBakti && (
              <p className="text-xs text-ink-400 mb-2">Opsional untuk jenis Kerja Bakti (pekerjaan umum)</p>
            )}
            <select
              className="input"
              value={form.asset_id}
              onChange={(e) => setForm({...form, asset_id: e.target.value})}
              required={!isKerjaBakti}
            >
              <option value="">Pilih aset...</option>
              {assets.map(asset => (
                <option key={asset.id} value={asset.id}>
                  {asset.asset_code} - {asset.asset_name}
                  {asset.current_odometer && ` (${Number(asset.current_odometer).toLocaleString()} km)`}
                </option>
              ))}
            </select>
          </div>

          {/* Tanggal & Kilometer Terakhir */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Tanggal Pemeliharaan Terakhir <span className="text-danger-400">*</span></label>
              <div className="relative group">
                <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
                <input
                  type="date"
                  className="input pl-10"
                  value={form.last_maintenance_date}
                  onChange={(e) => setForm({...form, last_maintenance_date: e.target.value})}
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Kilometer Terakhir</label>
              <div className="relative group">
                <Gauge size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
                <input
                  type="number"
                  className="input pl-10"
                  value={form.last_odometer}
                  onChange={(e) => setForm({...form, last_odometer: e.target.value})}
                  placeholder="Contoh: 45000"
                />
              </div>
              <p className="text-xs text-ink-400 mt-1">Kilometer saat oli diganti (untuk kendaraan)</p>
            </div>
          </div>

          {/* Tipe Interval */}
          <div>
            <label className="label">Tipe Penjadwalan <span className="text-danger-400">*</span></label>
            <select
              className="input"
              value={form.interval_type}
              onChange={(e) => setForm({...form, interval_type: e.target.value})}
              required
            >
              {Object.entries(INTERVAL_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Time-based Interval (visible when TIME or BOTH) */}
          {(form.interval_type === INTERVAL_TYPE.TIME || form.interval_type === INTERVAL_TYPE.BOTH) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Interval Waktu <span className="text-danger-400">*</span></label>
                <input
                  type="number"
                  className="input"
                  value={form.interval_value}
                  onChange={(e) => setForm({...form, interval_value: parseInt(e.target.value) || 0})}
                  min="1"
                  required
                />
              </div>
              <div>
                <label className="label">Satuan <span className="text-danger-400">*</span></label>
                <select
                  className="input"
                  value={form.interval_unit}
                  onChange={(e) => setForm({...form, interval_unit: e.target.value})}
                  required
                >
                  {Object.entries(INTERVAL_UNIT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Odometer-based Interval (visible when ODOMETER or BOTH) */}
          {(form.interval_type === INTERVAL_TYPE.ODOMETER || form.interval_type === INTERVAL_TYPE.BOTH) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Interval Kilometer <span className="text-danger-400">*</span></label>
                <div className="relative group">
                  <Gauge size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
                  <input
                    type="number"
                    className="input pl-10"
                    value={form.odometer_interval_value}
                    onChange={(e) => setForm({...form, odometer_interval_value: e.target.value})}
                    placeholder="Contoh: 5000"
                    min="1"
                    required
                  />
                </div>
                <p className="text-xs text-ink-400 mt-1">Ganti oli setiap berapa kilometer</p>
              </div>
              <div>
                <label className="label">Pengingat (km sebelumnya)</label>
                <input
                  type="number"
                  className="input"
                  value={form.odometer_reminder_km}
                  onChange={(e) => setForm({...form, odometer_reminder_km: e.target.value})}
                  placeholder="Contoh: 500"
                  min="0"
                />
                <p className="text-xs text-ink-400 mt-1">Beritahu sebelum berapa km ke batas</p>
              </div>
            </div>
          )}

          {/* Preview Tanggal Berikutnya (time-based) */}
          {previewNextDate && (form.interval_type === INTERVAL_TYPE.TIME || form.interval_type === INTERVAL_TYPE.BOTH) && (
            <div className="card bg-primary-500/[0.05] border-primary-500/20">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary-500/10 border border-primary-500/20">
                  <Calendar size={20} className="text-primary-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-primary-300">Jadwal Berikutnya (Waktu)</h3>
                  <p className="text-sm text-primary-300 mt-1">
                    <strong>{formatDateLongID(previewNextDate)}</strong>
                  </p>
                  {previewAdjusted && (
                    <p className="text-xs text-primary-400 mt-1 flex items-center gap-1">
                      <AlertCircle size={14} />
                      Tanggal disesuaikan ke hari kerja berikutnya.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Preview Kilometer Berikutnya (odometer-based) */}
          {previewNextOdometer && (form.interval_type === INTERVAL_TYPE.ODOMETER || form.interval_type === INTERVAL_TYPE.BOTH) && (
            <div className="card bg-success-500/[0.05] border-success-500/20">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-success-500/10 border border-success-500/20">
                  <Gauge size={20} className="text-success-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-success-300">Jadwal Berikutnya (Kilometer)</h3>
                  <p className="text-sm text-success-300 mt-1">
                    <strong>{Number(previewNextOdometer).toLocaleString('id-ID')} km</strong>
                  </p>
                  <p className="text-xs text-success-400 mt-1">
                    Ganti oli pada kilometer ini
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pengingat (hari) */}
          {(form.interval_type === INTERVAL_TYPE.TIME || form.interval_type === INTERVAL_TYPE.BOTH) && (
            <div>
              <label className="label">Pengingat (hari sebelumnya) <span className="text-danger-400">*</span></label>
              <input
                type="number"
                className="input"
                value={form.reminder_days_before}
                onChange={(e) => setForm({...form, reminder_days_before: parseInt(e.target.value) || 0})}
                min="0"
                required
              />
              <p className="text-xs text-ink-400 mt-1">Berapa hari sebelum jadwal untuk memberi notifikasi</p>
            </div>
          )}

          {/* Penanggung Jawab */}
          <div>
            <label className="label">Penanggung Jawab</label>
            <div className="relative group">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
              <select
                className="input pl-10"
                value={form.responsible_user_id}
                onChange={(e) => setForm({...form, responsible_user_id: e.target.value})}
              >
                <option value="">Pilih penanggung jawab...</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Catatan */}
          <div>
            <label className="label">Catatan</label>
            <div className="relative group">
              <FileText size={18} className="absolute left-3 top-3 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
              <textarea
                className="input pl-10"
                rows="3"
                value={form.notes}
                onChange={(e) => setForm({...form, notes: e.target.value})}
                placeholder="Catatan tambahan..."
              />
            </div>
          </div>

          {/* Status Aktif */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              className="w-4 h-4 rounded border-white/10 text-primary-400 focus:ring-primary-500"
              checked={form.is_active}
              onChange={(e) => setForm({...form, is_active: e.target.checked})}
            />
            <label htmlFor="is_active" className="text-sm text-ink-200">Jadwal aktif</label>
          </div>

          {/* Submit */}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => navigate('/maintenance/schedules')} className="btn-secondary">
              Batal
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Menyimpan...' : <><Save size={16} /> Simpan</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
