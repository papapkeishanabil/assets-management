import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Camera, ClipboardList, Save, Send, CheckCircle2,
  Trash2, ShieldCheck, FileText, Wrench
} from 'lucide-react';
import {
  formatDate, formatDateTime,
  INSPECTION_STATUS, INSPECTION_STATUS_LABELS,
  INSPECTION_REVIEW_RESULTS, INSPECTION_REVIEW_RESULT_LABELS
} from '../lib/constants';
import { submitInspectionForReview, completeInspectionReview } from '../lib/inspection-helpers';

const PHOTO_BUCKET = 'inspection-photos';

export default function InspectionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const fileInputRef = useRef(null);

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Surve yor form state
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState([]); // [{ url, name }]
  const [uploading, setUploading] = useState(false);

  // Reviewer form state
  const [reviewResult, setReviewResult] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');

  const isReviewer = role && ['super_admin', 'hrd', 'direksi'].includes(role.role_name);

  const fetchRecord = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('maintenance_records')
        .select(`
          *,
          assets:asset_id (asset_code, asset_name),
          work_orders:work_order_id (id, work_order_number, assigned_user_id, responsible_user_id,
            assigned_user:assigned_user_id (full_name),
            responsible_user:responsible_user_id (full_name),
            vendor:vendor_id (vendor_name)),
          performed_user:performed_by (full_name),
          reviewer:reviewed_by (full_name)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      setRecord(data);
      setNotes(data.inspection_notes || '');
      setPhotos(Array.isArray(data.inspection_photos) ? data.inspection_photos : []);
      setReviewResult('');
      setReviewNotes(data.review_notes || '');
    } catch (error) {
      console.error('Error fetching inspection:', error);
      toast.error('Gagal memuat data pemeriksaan');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchRecord(); }, [fetchRecord]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-center h-64">
          <svg className="animate-spin h-6 w-6 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="empty-state">
          <div className="empty-state-icon"><ClipboardList size={48} /></div>
          <h3 className="empty-state-title">Pemeriksaan tidak ditemukan</h3>
          <Link to="/inspections" className="btn-primary mt-4">Kembali</Link>
        </div>
      </div>
    );
  }

  const isSurveyor = profile?.id === record.performed_by;
  const canEditSurveyor = record.inspection_status === INSPECTION_STATUS.DRAFT && isSurveyor;
  const canAssess = record.inspection_status === INSPECTION_STATUS.MENUNGGU_PENILAIAN && isReviewer && !isSurveyor;

  const statusColor =
    record.inspection_status === INSPECTION_STATUS.DRAFT ? 'badge-gray' :
    record.inspection_status === INSPECTION_STATUS.MENUNGGU_PENILAIAN ? 'badge-yellow' : 'badge-green';

  const statusLabel = INSPECTION_STATUS_LABELS[record.inspection_status] || record.inspection_status;

  const handleFileSelect = async (e) => {
    const files = [...(e.target.files || [])];
    if (files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const path = `${record.id}/inspection-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
          cacheControl: '3600', upsert: false
        });
        if (error) throw error;
        const { data: pub } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
        uploaded.push({ url: pub.publicUrl, name: file.name });
      }
      setPhotos(prev => [...prev, ...uploaded]);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Gagal mengunggah foto');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const persistDraft = async ({ submit }) => {
    if (!canEditSurveyor) return;
    setSaving(true);
    try {
      const updates = { inspection_notes: notes, inspection_photos: photos };
      if (submit) {
        Object.assign(updates, {
          inspection_status: INSPECTION_STATUS.MENUNGGU_PENILAIAN,
          submitted_by: profile.id,
          submitted_at: new Date().toISOString()
        });
      }
      const { error } = await supabase.from('maintenance_records').update(updates).eq('id', record.id);
      if (error) throw error;

      if (submit) {
        const assetLabel = `${record.assets?.asset_code || ''} - ${record.assets?.asset_name || ''}`;
        await submitInspectionForReview(supabase, {
          recordId: record.id,
          koordinatorId: record.work_orders?.responsible_user_id,
          assetLabel,
          maintenanceLabel: record.work_description || 'Pemeriksaan',
          submitterName: record.performed_user?.full_name,
          submitterId: profile.id
        });
        toast.success('Pemeriksaan dikirim untuk penilaian');
      } else {
        toast.success('Draft berhasil disimpan');
      }
      fetchRecord();
      if (submit) navigate('/inspections');
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleAssess = async () => {
    if (!canAssess) return;
    if (!reviewResult) {
      toast.error('Pilih hasil penilaian terlebih dahulu');
      return;
    }
    setSaving(true);
    try {
      const needsRepair = reviewResult === INSPECTION_REVIEW_RESULTS.PERLU_PERBAIKAN;
      const conditionAssessment =
        reviewResult === INSPECTION_REVIEW_RESULTS.LANJUTKAN ? 'Baik' :
        reviewResult === INSPECTION_REVIEW_RESULTS.PERLU_PERHATIAN ? 'Perlu Perhatian' : 'Rusak';

      const { error } = await supabase
        .from('maintenance_records')
        .update({
          inspection_status: INSPECTION_STATUS.SELESAI,
          condition_assessment: conditionAssessment,
          needs_repair: needsRepair,
          review_notes: reviewNotes,
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', record.id);
      if (error) throw error;

      await completeInspectionReview(supabase, {
        recordId: record.id,
        surveyorId: record.performed_by,
        assetLabel: `${record.assets?.asset_code || ''} - ${record.assets?.asset_name || ''}`,
        maintenanceLabel: record.work_description || 'pemeriksaan',
        needsRepair
      });

      toast.success(`Penilaian disimpan${needsRepair ? ' (perlu perbaikan)' : ''}`);
      fetchRecord();
    } catch (error) {
      console.error('Assess error:', error);
      toast.error(error.message || 'Gagal menyimpan penilaian');
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link to="/inspections" className="text-sm text-ink-400 hover:text-ink-200 flex items-center gap-1 transition-colors">
          <ArrowLeft size={16} /> Kembali ke Pemeriksaan
        </Link>
        <span className={`badge ${statusColor}`}>{statusLabel}</span>
      </div>

      {/* Info header */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-lg bg-primary-500/10 border border-primary-500/20">
            <ClipboardList size={18} className="text-primary-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              {record.assets?.asset_name || 'Aset'} <span className="text-ink-500 font-mono">({record.assets?.asset_code || ''})</span>
            </h3>
            <p className="text-xs text-ink-400">
              {record.work_orders?.work_order_number || '-'} · {record.work_description || 'Pemeriksaan'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-ink-400 uppercase mb-1">Surveyor</p>
            <p className="text-white">{record.performed_user?.full_name || '-'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-400 uppercase mb-1">Lokasi / Vendor</p>
            <p className="text-white">{record.work_orders?.vendor?.vendor_name || 'Lokasi internal'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-400 uppercase mb-1">Tanggal</p>
            <p className="text-white">{formatDate(record.maintenance_date || record.created_at)}</p>
          </div>
        </div>
      </div>


      {/* Bukti foto */}
      <div className="card">
        <h3 className="section-title mb-4 flex items-center gap-2">
          <Camera size={16} /> Bukti Foto ({photos.length})
        </h3>

        {canEditSurveyor && (
          <div className="mb-4">
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-secondary text-sm"
            >
              {uploading ? 'Mengunggah...' : 'Tambah Foto'}
            </button>
            <p className="text-xs text-ink-500 mt-2">Foto kondisi mesin/aset di lokasi (maks 5 MB per gambar).</p>
          </div>
        )}

        {photos.length === 0 ? (
          <div className="flex items-center gap-2 text-ink-500 text-sm py-4">
            <Camera size={16} /> Belum ada foto
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((p, i) => (
              <div key={i} className="group relative rounded-lg overflow-hidden border border-white/10 bg-white/5">
                <img src={p.url} alt={p.name || `foto-${i + 1}`} className="w-full h-32 object-cover" />
                {canEditSurveyor && (
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 p-1 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Hapus foto"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>


      {/* Form Surveyor (draft) */}
      {canEditSurveyor && (
        <div className="card">
          <h3 className="section-title mb-4">Form Pemeriksaan Surveyor</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Catatan / Informasi di Lapangan</label>
              <textarea
                className="input min-h-[120px]"
                rows="4"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Contoh: vendor mengeluhkan jarum sering patah, mesin bergetar saat kecepatan tinggi..."
              />
            </div>
            <p className="text-sm text-ink-400">
              Simpan <b>Draft</b> untuk melanjutkan pengumpulan data. Kirim untuk penilaian setelah data & foto lengkap —
              HRD/Teknisi akan segera menerima notifikasi dan melakukan penilaian kondisi.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button type="button" onClick={() => persistDraft({ submit: false })} disabled={saving}
                className="btn-secondary">
                <Save size={16} /> Simpan Draft
              </button>
              <button type="button" onClick={() => persistDraft({ submit: true })} disabled={saving}
                className="btn-primary">
                <Send size={16} /> {saving ? 'Menyimpan...' : 'Kirim untuk Penilaian'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Penilaian HRD / Teknisi */}
      {canAssess && (
        <div className="card border-warning-500/30">
          <h3 className="section-title mb-4 flex items-center gap-2">
            <ShieldCheck size={16} className="text-warning-400" /> Penilaian Kondisi (HRD / Teknisi)
          </h3>
          <div className="space-y-4">
            <div>
              <label className="label">Hasil Penilaian</label>
              <select className="input" value={reviewResult} onChange={e => setReviewResult(e.target.value)}>
                <option value="">Pilih hasil penilaian</option>
                {Object.entries(INSPECTION_REVIEW_RESULTS).map(([k, v]) => (
                  <option key={k} value={v}>{INSPECTION_REVIEW_RESULT_LABELS[v]}</option>
                ))}
              </select>
              {reviewResult === INSPECTION_REVIEW_RESULTS.PERLU_PERBAIKAN && (
                <p className="text-xs text-danger-300 mt-2 flex items-center gap-1">
                  <Wrench size={13} /> Aset akan ditandai perlu perbaikan.
                </p>
              )}
            </div>
            <div>
              <label className="label">Catatan Penilaian</label>
              <textarea className="input min-h-[100px]" rows="3" value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                placeholder="Catatan penilaian berdasarkan foto & informasi surveyor..." />
            </div>
            <button type="button" onClick={handleAssess} disabled={saving} className="btn-success">
              <CheckCircle2 size={16} /> {saving ? 'Menyimpan...' : 'Simpan Penilaian & Selesaikan'}
            </button>
          </div>
        </div>
      )}


      {/* Catatan surveyor (tampil untuk non-editor / sudah dikirim) */}
      {!canEditSurveyor && (
        <div className="card">
          <h3 className="section-title mb-3 flex items-center gap-2">
            <FileText size={16} /> Informasi di Lapangan
          </h3>
          <p className="text-sm text-ink-200 whitespace-pre-wrap">{notes || '-'}</p>
        </div>
      )}

      {/* Hasil penilaian (setelah dinilai) */}
      {record.inspection_status === INSPECTION_STATUS.SELESAI && (
        <div className="card border-emerald-500/30">
          <h3 className="section-title mb-4 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" /> Hasil Penilaian
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-ink-400 uppercase mb-1">Kondisi</p>
              <span className={`badge ${record.needs_repair ? 'badge-red' : 'badge-green'}`}>
                {record.condition_assessment || 'Belum diisi'}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-400 uppercase mb-1">Status</p>
              <span className={`badge ${record.needs_repair ? 'badge-red' : 'badge-green'}`}>
                {record.needs_repair ? 'Perlu Perbaikan' : 'Lanjut Dipakai'}
              </span>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs font-semibold text-ink-400 uppercase mb-1">Catatan Penilaian</p>
              <p className="text-ink-200 whitespace-pre-wrap">{record.review_notes || '-'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-400 uppercase mb-1">Dinilai Oleh</p>
              <p className="text-white">{record.reviewer?.full_name || '-'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-400 uppercase mb-1">Waktu</p>
              <p className="text-white">{formatDateTime(record.reviewed_at)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

