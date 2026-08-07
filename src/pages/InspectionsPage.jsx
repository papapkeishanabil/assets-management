import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardList, Camera, MessageCircle } from 'lucide-react';
import { formatDate, INSPECTION_STATUS, INSPECTION_STATUS_LABELS } from '../lib/constants';

const COLOR_CLASSES = {
  gray: 'badge-gray', yellow: 'badge-yellow', green: 'badge-green', red: 'badge-red', blue: 'badge-blue'
};

export default function InspectionsPage() {
  const { profile, role } = useAuth();
  const isReviewer = role && ['super_admin', 'hrd', 'direksi'].includes(role.role_name);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(
    isReviewer ? INSPECTION_STATUS.MENUNGGU_PENILAIAN : INSPECTION_STATUS.DRAFT
  );

  const filters = [
    { value: '', label: 'Semua' },
    { value: INSPECTION_STATUS.DRAFT, label: 'Draft' },
    { value: INSPECTION_STATUS.MENUNGGU_PENILAIAN, label: 'Menunggu Penilaian' },
    { value: INSPECTION_STATUS.SELESAI, label: 'Selesai Dinilai' }
  ];

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('maintenance_records')
        .select(`
          *,
          assets:asset_id (asset_code, asset_name),
          work_orders:work_order_id (id, work_order_number, assigned_user_id, responsible_user_id, vendor_id),
          performed_user:performed_by (full_name)
        `)
        .order('created_at', { ascending: false });

      // Hanya catatan yang memang lewat alur pemeriksaan (inspection_status tidak NULL)
      if (!statusFilter) query = query.not('inspection_status', 'is', null);
      if (statusFilter) query = query.eq('inspection_status', statusFilter);
      // Surveyor hanya melihat draft miliknya
      if (!isReviewer && profile?.id) query = query.eq('performed_by', profile.id);

      const { data, error } = await query;
      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching inspections:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, isReviewer, profile?.id]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const statusBadge = (status) => {
    let color = 'gray';
    if (status === INSPECTION_STATUS.DRAFT) color = 'gray';
    else if (status === INSPECTION_STATUS.MENUNGGU_PENILAIAN) color = 'yellow';
    else if (status === INSPECTION_STATUS.SELESAI) color = 'green';
    return <span className={`badge ${COLOR_CLASSES[color]}`}>{INSPECTION_STATUS_LABELS[status] || status}</span>;
  };

  return (
    <div className="page-container">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title mb-1">Pemeriksaan Lapangan</h1>
          <p className="text-sm text-ink-400">
            {isReviewer
              ? 'Antrean hasil pemeriksaan surveyor yang perlu dinilai (HRD / Teknisi)'
              : 'Draft hasil pemeriksaan yang Anda kumpulkan di lapangan'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {filters.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
              statusFilter === f.value
                ? 'bg-primary-500/15 text-primary-300 border-primary-500/40'
                : 'bg-white/5 text-ink-300 border-white/10 hover:bg-white/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="card p-0">
        {loading ? (
          <div className="flex items-center justify-center py-14">
            <svg className="animate-spin h-8 w-8 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state py-14">
            <div className="empty-state-icon"><ClipboardList size={48} /></div>
            <p className="empty-state-text">Tidak ada pemeriksaan pada status ini</p>
          </div>
        ) : (
          <div className="table-container border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Aset</th>
                  <th>WO</th>
                  <th>Surveyor</th>
                  <th>Tanggal</th>
                  <th>Bukti</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div className="font-medium text-white">{r.assets?.asset_name || '-'}</div>
                      <div className="text-xs text-ink-500 font-mono">{r.assets?.asset_code || ''}</div>
                    </td>
                    <td className="font-mono text-[12px]">{r.work_orders?.work_order_number || '-'}</td>
                    <td>{r.performed_user?.full_name || '-'}</td>
                    <td>{formatDate(r.maintenance_date || r.created_at)}</td>
                    <td>
                      <div className="flex items-center gap-3 text-ink-400 text-xs">
                        <span className="flex items-center gap-1">
                          <Camera size={14} />{(r.inspection_photos || []).length || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle size={14} />
                          {r.inspection_notes ? 'ada' : '-'}
                        </span>
                      </div>
                    </td>
                    <td>{statusBadge(r.inspection_status)}</td>
                    <td className="text-right">
                      <Link
                        to={`/inspections/${r.id}`}
                        className="btn-primary px-3 py-1.5 rounded-lg text-sm font-medium"
                      >
                        {r.inspection_status === INSPECTION_STATUS.SELESAI ? 'Lihat' : 'Buka'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
