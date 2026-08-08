import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { ArrowLeft, ClipboardList, CheckCircle, XCircle, ClipboardCheck } from 'lucide-react';
import { formatDate, formatCurrency, formatDateTime, WO_STATUS_LABELS, PRIORITY_LABELS } from '../lib/constants';

export default function WorkOrderDetailPage() {
  const { id } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [wo, setWo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [inspectionLoading, setInspectionLoading] = useState(false);

  useEffect(() => { fetchWO(); }, [id]);

  const fetchWO = async () => {
    try {
      const { data } = await supabase
        .from('work_orders')
        .select(`*, assets:asset_id (*, categories:category_id (category_name), locations:location_id (location_name)), maintenance_types:maintenance_type_id (*), assigned_user:assigned_user_id (full_name), responsible_user:responsible_user_id (full_name), vendor:vendor_id (vendor_name), maintenance_records (*)`)
        .eq('id', id)
        .single();
      setWo(data);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat work order');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus) => {
    if (!confirm(`Ubah status menjadi ${WO_STATUS_LABELS[newStatus]}?`)) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from('work_orders').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      toast.success('Status berhasil diperbarui');
      fetchWO();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openInspection = async () => {
    if (!wo) return;
    setInspectionLoading(true);
    try {
      const existing = wo.maintenance_records?.[0];
      if (existing) {
        navigate(`/inspections/${existing.id}`);
        return;
      }
      const { data, error } = await supabase
        .from('maintenance_records')
        .insert([{
          work_order_id: wo.id,
          asset_id: wo.asset_id,
          maintenance_date: new Date().toISOString().slice(0, 10),
          work_description: wo.description || wo.maintenance_types?.maintenance_name || 'Pemeriksaan',
          performed_by: wo.assigned_user_id || profile?.id,
          inspection_status: 'draft',
          inspection_photos: [],
          verification_status: 'menunggu'
        }])
        .select('id')
        .single();
      if (error) throw error;
      navigate(`/inspections/${data.id}`);
    } catch (error) {
      console.error('openInspection error:', error);
      toast.error(error.message || 'Gagal membuat pemeriksaan');
    } finally {
      setInspectionLoading(false);
    }
  };


  if (loading) return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-5 w-5 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
      </div>
    </div>
  );

  if (!wo) return (
    <div className="space-y-6 animate-fade-in">
      <div className="empty-state">
        <div className="empty-state-icon"><ClipboardList size={48} /></div>
        <h3 className="empty-state-title">Work Order tidak ditemukan</h3>
        <p className="empty-state-text">Work order yang Anda cari tidak tersedia</p>
        <Link to="/work-orders" className="btn-primary mt-4">Kembali</Link>
      </div>
    </div>
  );

  const canUpdate = profile?.role !== 'pelaksana' || wo.assigned_user_id === profile.id;

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/work-orders" className="text-sm text-ink-400 hover:text-ink-200 flex items-center gap-1 transition-colors">
        <ArrowLeft size={16} /> Kembali ke Work Order
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-white font-mono">{wo.work_order_number}</h1>
                <p className="text-sm text-ink-400">Dibuat {formatDateTime(wo.created_at)}</p>
              </div>
              <span className={wo.priority === 'tinggi' || wo.priority === 'mendesak' ? 'badge-red' : wo.priority === 'normal' ? 'badge-blue' : 'badge-gray'}>
                {PRIORITY_LABELS[wo.priority]}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {[
                ['Status', <span key="s" className={wo.status === 'selesai' ? 'badge-green' : wo.status === 'draft' ? 'badge-gray' : wo.status === 'ditugaskan' ? 'badge-blue' : 'badge-yellow'}>{WO_STATUS_LABELS[wo.status]}</span>],
                ['Aset', wo.assets?.asset_name],
                ['Kode Aset', wo.assets?.asset_code],
                ['Kategori', wo.assets?.categories?.category_name],
                ['Lokasi', wo.assets?.locations?.location_name],
                ['Tipe Pemeliharaan', wo.maintenance_types?.maintenance_name || '-'],
                ['Tanggal Rencana', formatDate(wo.planned_date)],
                ['Pelaksana', wo.assigned_user?.full_name || '-'],
                ['Penanggung Jawab', wo.responsible_user?.full_name || '-'],
                ['Estimasi Biaya', formatCurrency(wo.estimated_cost)],
                ['Biaya Aktual', formatCurrency(wo.actual_cost)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-ink-400">{label}</p>
                  <p className="text-sm font-medium text-white">{value}</p>
                </div>
              ))}
            </div>

            {wo.description && (
              <div className="p-4 bg-white/[0.03] rounded-lg border border-white/5">
                <p className="text-xs text-ink-400 mb-1">Deskripsi Pekerjaan</p>
                <p className="text-sm text-ink-200">{wo.description}</p>
              </div>
            )}
          </div>

          {wo.maintenance_records?.length > 0 && (
            <div className="card">
              <h3 className="section-title mb-4">Data Pemeliharaan</h3>
              {wo.maintenance_records.map(mr => (
                <div key={mr.id} className="p-3 bg-white/[0.03] rounded-lg border border-white/5 mb-2">
                  <p className="text-sm font-medium text-white">Tanggal: {formatDate(mr.maintenance_date)}</p>
                  <p className="text-sm text-ink-300">{mr.work_description}</p>
                  {mr.technician_notes && <p className="text-xs text-ink-400 mt-1">Catatan: {mr.technician_notes}</p>}
                  <div className="flex gap-4 mt-2 text-xs text-ink-400">
                    <span>Biaya: {formatCurrency(mr.total_cost)}</span>
                    {mr.condition_before && <span>Sebelum: {mr.condition_before}</span>}
                    {mr.condition_after && <span>Sesudah: {mr.condition_after}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="section-title mb-4">Aksi</h3>
            <div className="space-y-2">
              {wo.status === 'draft' && canUpdate && (
                <button onClick={() => updateStatus('ditugaskan')} className="btn-primary w-full" disabled={actionLoading}>
                  <CheckCircle size={16} /> Tugaskan
                </button>
              )}
              {wo.status === 'ditugaskan' && (
                <>
                  <button onClick={() => updateStatus('diterima')} className="btn-success w-full" disabled={actionLoading}>Terima Tugas</button>
                  <button onClick={() => updateStatus('ditolak')} className="btn-danger w-full" disabled={actionLoading}>Tolak</button>
                </>
              )}
              {wo.status === 'diterima' && (
                <button onClick={() => updateStatus('sedang_dikerjakan')} className="btn-primary w-full" disabled={actionLoading}>Mulai Bekerja</button>
              )}
              {wo.status === 'sedang_dikerjakan' && (
                <button onClick={() => updateStatus('menunggu_verifikasi')} className="btn-warning w-full" disabled={actionLoading}>Selesai & Minta Verifikasi</button>
              )}
              {wo.status === 'menunggu_verifikasi' && profile?.role !== 'pelaksana' && (
                <>
                  <button onClick={() => updateStatus('selesai')} className="btn-success w-full" disabled={actionLoading}>Setujui</button>
                  <button onClick={() => updateStatus('ditugaskan')} className="btn-warning w-full" disabled={actionLoading}>Minta Revisi</button>
                </>
              )}
              {wo.status !== 'selesai' && wo.status !== 'dibatalkan' && wo.status !== 'ditolak' && canUpdate && (
                <button onClick={() => updateStatus('dibatalkan')} className="btn-danger w-full" disabled={actionLoading}>Batalkan WO</button>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="section-title mb-3">Pemeriksaan Lapangan</h3>
            <p className="text-sm text-ink-400 mb-3">
              Surveyor mengumpulkan foto & informasi kondisi aset di lapangan (draft), lalu HRD/Teknisi menilai hasilnya.
            </p>
            <button
              onClick={openInspection}
              disabled={inspectionLoading}
              className="btn-primary w-full"
            >
              <ClipboardCheck size={16} />
              {inspectionLoading
                ? 'Memproses...'
                : (wo.maintenance_records?.length > 0 ? 'Buka Pemeriksaan' : 'Mulai Pemeriksaan')}
            </button>
          </div>


          <div className="card">
            <h3 className="section-title mb-4">Informasi</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-400">Status</span>
                <span className={getStatusBadgeClass(wo.status, 'wo')}>{WO_STATUS_LABELS[wo.status]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-400">Dibuat Oleh</span>
                <span className="font-medium text-white">{wo.responsible_user?.full_name || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-400">Tipe WO</span>
                <span className="font-medium text-white">{wo.work_order_type || 'Terjadwal'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatusBadgeClass(status) {
  const map = {
    selesai: 'badge-green', draft: 'badge-gray', ditugaskan: 'badge-blue',
    diterima: 'badge-blue', sedang_dikerjakan: 'badge-blue', tertunda: 'badge-yellow',
    menunggu_verifikasi: 'badge-yellow', ditolak: 'badge-red', dibatalkan: 'badge-gray'
  };
  return map[status] || 'badge-gray';
}
