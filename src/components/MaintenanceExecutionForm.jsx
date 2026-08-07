import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { X, Calendar, Gauge, FileText, User, Camera, Trash2, Save, CheckCircle2, Shield } from 'lucide-react';
import { INTERVAL_TYPE, calculateNextScheduleAfterExecution } from '../lib/maintenance-helpers';
import { NOTIFICATION_TYPES, buildNotificationMessage, buildNotificationTitle } from '../lib/notification-helpers';

export default function MaintenanceExecutionForm({ schedule, onClose, onSaved }) {
  const { profile } = useAuth();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [users, setUsers] = useState([]);
  const [isDraft, setIsDraft] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState('');
  const [assessmentNotes, setAssessmentNotes] = useState('');
  const [form, setForm] = useState({
    execution_date: new Date().toISOString().split('T')[0],
    odometer_at_execution: schedule.last_odometer || '',
    result: '',
    cost: '',
    performed_by: profile?.id || '',
    notes: '',
    kerja_bakti_area: '',
    peserta_count: ''
  });

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .eq('account_status', 'ACTIVE')
        .order('full_name');
      if (data) setUsers(data);
    };
    fetchUsers();
  }, []);

  const hasOdometer = schedule && (schedule.interval_type === INTERVAL_TYPE.ODOMETER || schedule.interval_type === INTERVAL_TYPE.BOTH);
  const isVendorVisit = schedule?.maintenance_type?.maintenance_code === 'VISIT';
  const isKerjaBakti = schedule?.maintenance_type?.maintenance_code === 'KERJA-BAKTI';

  const VISIT_CONDITIONS = [
    { value: 'Baik', label: 'Baik' },
    { value: 'Perlu Perhatian', label: 'Perlu Perhatian' },
    { value: 'Rusak Ringan', label: 'Rusak Ringan' },
    { value: 'Rusak Berat', label: 'Rusak Berat' }
  ];

  const VISIT_RECOMMENDATIONS = [
    { value: 'Kembalikan ke pabrik', label: 'Kembalikan ke pabrik' },
    { value: 'Perbaiki di vendor', label: 'Perbaiki di vendor' },
    { value: 'Pantau', label: 'Pantau' },
    { value: 'Lainnya', label: 'Lainnya' }
  ];

  const KERJA_BAKTI_AREAS = [
    { value: 'KANTOR', label: 'Kantor' },
    { value: 'PABRIK', label: 'Pabrik' },
    { value: 'GUDANG', label: 'Gudang' },
    { value: 'AREA-PRODUKSI', label: 'Area Produksi' },
    { value: 'PARKIR', label: 'Area Parkir' },
    { value: 'TAMAN', label: 'Taman/Pekarangan' },
    { value: 'LAINNYA', label: 'Lainnya' }
  ];

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran foto maksimal 5MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `execution-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('maintenance-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('maintenance-photos')
        .getPublicUrl(filePath);

      setPhotos(prev => [...prev, publicUrl]);
      toast.success('Foto berhasil diupload');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Gagal upload foto: ' + error.message);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.execution_date) {
      toast.error('Tanggal pelaksanaan wajib diisi');
      return;
    }
    if (!form.result) {
      toast.error('Hasil pelaksanaan wajib diisi');
      return;
    }
    if (isVendorVisit) {
      if (!form.visit_condition) {
        toast.error('Kondisi mesin wajib dipilih');
        return;
      }
      if (!form.recommendation) {
        toast.error('Rekomendasi wajib dipilih');
        return;
      }
    }

    setLoading(true);
    try {
      // 1. Simpan riwayat pelaksanaan
      const executionPayload = {
        schedule_id: schedule.id,
        execution_date: form.execution_date,
        odometer_at_execution: form.odometer_at_execution ? parseFloat(form.odometer_at_execution) : null,
        result: form.result,
        cost: form.cost ? parseFloat(form.cost) : null,
        photos: photos,
        performed_by: form.performed_by || null,
        notes: form.notes || null,
        is_draft: isDraft
      };

      // Tambahkan field khusus site visit jika ini kunjungan vendor
      if (isVendorVisit) {
        executionPayload.visit_condition = form.visit_condition || null;
        executionPayload.recommendation = form.recommendation || null;
        executionPayload.vendor_contact_name = form.vendor_contact_name || null;
      }

      // Tambahkan field khusus kerja bakti
      if (isKerjaBakti) {
        executionPayload.work_area = form.kerja_bakti_area || null;
        executionPayload.participant_count = form.peserta_count ? parseInt(form.peserta_count) : null;
      }

      // Tambahkan data assessment jika draft
      if (isDraft) {
        executionPayload.assessment_result = assessmentResult || null;
        executionPayload.assessment_notes = assessmentNotes || null;
        executionPayload.assessed_by = profile?.id || null;
        executionPayload.assessed_at = new Date().toISOString();
      }

      const { data: executionData, error: execError } = await supabase
        .from('maintenance_executions')
        .insert([executionPayload])
        .select()
        .single();
      if (execError) throw execError;

      // 2. Buat notifikasi ke HRD/Super Admin jika ini draft
      if (isDraft) {
        try {
          // Ambil semua user dengan role super_admin dan hrd
          const { data: allowedRoles, error: rolesError } = await supabase
            .from('roles')
            .select('id, role_name')
            .in('role_name', ['super_admin', 'hrd']);

          if (!rolesError && allowedRoles) {
            const allowedRoleIds = allowedRoles.map(r => r.id);

            const { data: users, error: userError } = await supabase
              .from('user_profiles')
              .select('id')
              .eq('account_status', 'ACTIVE')
              .in('role_id', allowedRoleIds);

            if (!userError && users && users.length > 0) {
              const title = buildNotificationTitle(NOTIFICATION_TYPES.DRAFT_SUBMITTED);
              const message = buildNotificationMessage(
                schedule.maintenance_type?.maintenance_name || '-',
                schedule.asset?.asset_code || '-',
                schedule.asset?.asset_name || '-',
                NOTIFICATION_TYPES.DRAFT_SUBMITTED
              );

              const notificationsToCreate = users.map(u => ({
                user_id: u.id,
                maintenance_schedule_id: schedule.id,
                notification_type: NOTIFICATION_TYPES.DRAFT_SUBMITTED,
                title,
                message,
                notification_date: new Date().toISOString().split('T')[0],
                reference_url: '/maintenance/drafts'
              }));

              const { error: notifError } = await supabase
                .from('notifications')
                .insert(notificationsToCreate);

              if (notifError) {
                console.error('Error creating draft notifications:', notifError);
              }
            }
          }
        } catch (notifErr) {
          console.error('Error creating draft notifications:', notifErr);
        }
      }

      // 3. Update jadwal otomatis hanya jika bukan draft
      if (!isDraft) {
        const scheduleUpdates = calculateNextScheduleAfterExecution(schedule, {
          execution_date: form.execution_date,
          odometer_at_execution: form.odometer_at_execution
        });

        if (Object.keys(scheduleUpdates).length > 0) {
          const { error: schedError } = await supabase
            .from('maintenance_schedules')
            .update(scheduleUpdates)
            .eq('id', schedule.id);
          if (schedError) throw schedError;
        }
      }

      toast.success(isDraft ? 'Draft pelaksanaan berhasil disimpan.' : 'Pelaksanaan berhasil dicatat. Jadwal berikutnya otomatis diperbarui.');
      onSaved();
    } catch (error) {
      console.error('Error saving execution:', error);
      toast.error('Gagal menyimpan: ' + (error.message || error.code || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto card animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
              <CheckCircle2 size={18} className="text-primary-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Catat Pelaksanaan</h3>
              <p className="text-xs text-ink-400">
                {schedule?.asset?.asset_name} — {schedule?.maintenance_type?.maintenance_name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Tanggal Pelaksanaan <span className="text-danger-400">*</span></label>
              <div className="relative group">
                <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
                <input
                  type="date"
                  className="input pl-10"
                  value={form.execution_date}
                  onChange={(e) => setForm({...form, execution_date: e.target.value})}
                  required
                />
              </div>
            </div>
            {hasOdometer && (
              <div>
                <label className="label">Odometer Saat Pelaksanaan</label>
                <div className="relative group">
                  <Gauge size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
                  <input
                    type="number"
                    className="input pl-10"
                    value={form.odometer_at_execution}
                    onChange={(e) => setForm({...form, odometer_at_execution: e.target.value})}
                    placeholder="Contoh: 45000"
                  />
                </div>
              </div>
            )}
          </div>

          {isKerjaBakti ? (
            <>
              <div>
                <label className="label">Area Lokasi <span className="text-danger-400">*</span></label>
                <select
                  className="input"
                  value={form.kerja_bakti_area}
                  onChange={(e) => setForm({...form, kerja_bakti_area: e.target.value})}
                  required
                >
                  <option value="">Pilih area...</option>
                  {KERJA_BAKTI_AREAS.map(area => (
                    <option key={area.value} value={area.value}>{area.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Jumlah Peserta</label>
                <input
                  type="number"
                  className="input"
                  value={form.peserta_count}
                  onChange={(e) => setForm({...form, peserta_count: e.target.value})}
                  placeholder="Contoh: 10"
                  min="1"
                />
              </div>
              <div>
                <label className="label">Hasil Pekerjaan <span className="text-danger-400">*</span></label>
                <textarea
                  className="input"
                  rows="3"
                  value={form.result}
                  onChange={(e) => setForm({...form, result: e.target.value})}
                  placeholder="Contoh: Area produksi A dan B sudah dibersihkan, sampah dikumpulkan dan dibuang ke TPA..."
                  required
                />
              </div>
            </>
          ) : isVendorVisit ? (
            <>
              <div>
                <label className="label">Kondisi Mesin <span className="text-danger-400">*</span></label>
                <select
                  className="input"
                  value={form.visit_condition}
                  onChange={(e) => setForm({...form, visit_condition: e.target.value})}
                  required
                >
                  <option value="">Pilih kondisi...</option>
                  {VISIT_CONDITIONS.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Rekomendasi <span className="text-danger-400">*</span></label>
                <select
                  className="input"
                  value={form.recommendation}
                  onChange={(e) => setForm({...form, recommendation: e.target.value})}
                  required
                >
                  <option value="">Pilih rekomendasi...</option>
                  {VISIT_RECOMMENDATIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Nama Kontak di Vendor</label>
                <input
                  type="text"
                  className="input"
                  value={form.vendor_contact_name}
                  onChange={(e) => setForm({...form, vendor_contact_name: e.target.value})}
                  placeholder="Nama orang yang ditemui di vendor"
                />
              </div>
              <div>
                <label className="label">Catatan / Temuan <span className="text-danger-400">*</span></label>
                <textarea
                  className="input"
                  rows="3"
                  value={form.result}
                  onChange={(e) => setForm({...form, result: e.target.value})}
                  placeholder="Deskripsikan temuan kondisi mesin, apakah ada yang perlu diperbaiki..."
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="label">Hasil Pelaksanaan <span className="text-danger-400">*</span></label>
                <textarea
                  className="input"
                  rows="3"
                  value={form.result}
                  onChange={(e) => setForm({...form, result: e.target.value})}
                  placeholder="Contoh: Oli mesin diganti dengan oli SAE 40, filter oli baru"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Biaya (Rp)</label>
                  <input
                    type="number"
                    className="input"
                    value={form.cost}
                    onChange={(e) => setForm({...form, cost: e.target.value})}
                    placeholder="Contoh: 150000"
                    min="0"
                  />
                </div>
                <div>
                  <label className="label">Pelaksana</label>
                  <div className="relative group">
                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
                    <select
                      className="input pl-10"
                      value={form.performed_by}
                      onChange={(e) => setForm({...form, performed_by: e.target.value})}
                    >
                      <option value="">Pilih pelaksana...</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="label">Catatan</label>
            <div className="relative group">
              <FileText size={18} className="absolute left-3 top-3 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
              <textarea
                className="input pl-10"
                rows="2"
                value={form.notes}
                onChange={(e) => setForm({...form, notes: e.target.value})}
                placeholder="Catatan tambahan..."
              />
            </div>
          </div>

          {/* Upload Foto */}
          <div>
            <label className="label">Foto Bukti Pelaksanaan</label>
            <input
              ref={fileInputRef}
              type="file"
              id="execution-photo-upload"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
              disabled={uploadingPhoto}
            />
            <label htmlFor="execution-photo-upload" className="cursor-pointer">
              <div className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-white/10 rounded-xl hover:border-primary-500/40 hover:bg-primary-500/[0.03] transition-all">
                <Camera size={24} className="text-ink-500" />
                <p className="text-sm font-medium text-white">
                  {uploadingPhoto ? 'Mengupload...' : 'Klik untuk upload foto'}
                </p>
                <p className="text-xs text-ink-400">PNG, JPG, WEBP — maks 5MB</p>
              </div>
            </label>

            {photos.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                {photos.map((url, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden">
                    <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-24 object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 right-1 p-1.5 bg-danger-500/90 text-white rounded-md hover:bg-danger-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assessment Section - only shown when editing draft */}
          {isDraft && (
            <div className="p-4 rounded-lg bg-primary-500/5 border border-primary-500/20 space-y-4">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-primary-400" />
                <p className="text-sm font-semibold text-primary-300">Penilaian & Persetujuan</p>
              </div>
              <p className="text-xs text-ink-400">
                Draft akan menunggu penilaian dari HRD dan pihak yang berkompeten sebelum dijadwalkan
              </p>
              <div>
                <label className="label">Hasil Penilaian</label>
                <select
                  className="input"
                  value={assessmentResult}
                  onChange={(e) => setAssessmentResult(e.target.value)}
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
            </div>
          )}

          {/* Draft Toggle */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning-500/5 border border-warning-500/20">
            <input
              type="checkbox"
              id="is_draft"
              checked={isDraft}
              onChange={(e) => setIsDraft(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 text-warning-400 focus:ring-warning-500/30"
            />
            <label htmlFor="is_draft" className="text-sm text-ink-200 cursor-pointer">
              Simpan sebagai <span className="text-warning-300 font-medium">Draft</span>
            </label>
            <p className="text-xs text-ink-400 ml-6">
              Draft bisa diselesaikan nanti sebelum dijadwalkan
            </p>
          </div>

          {/* Submit */}
          <div className="flex gap-3 justify-end pt-2 border-t border-white/5">
            <button type="button" onClick={onClose} className="btn-secondary">
              Batal
            </button>
            <button 
              type="submit" 
              className={isDraft ? "btn-warning text-white" : "btn-primary"} 
              disabled={loading || uploadingPhoto}
            >
              {loading ? 'Menyimpan...' : <><Save size={16} /> {isDraft ? 'Simpan Draft' : 'Simpan Pelaksanaan'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}