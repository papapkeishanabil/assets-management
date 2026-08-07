import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { History, Search, CheckCircle2, FileText, Clock, Eye, RefreshCw, Package, Wrench, Calendar, X } from 'lucide-react';
import { formatDateID } from '../lib/maintenance-helpers';
import { formatCurrency } from '../lib/constants';

export default function MaintenanceExecutionsPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [selectedExecution, setSelectedExecution] = useState(null);

  const canAssess = role && ['super_admin', 'hrd'].includes(role.role_name);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: '01', label: 'Januari' }, { value: '02', label: 'Februari' },
    { value: '03', label: 'Maret' }, { value: '04', label: 'April' },
    { value: '05', label: 'Mei' }, { value: '06', label: 'Juni' },
    { value: '07', label: 'Juli' }, { value: '08', label: 'Agustus' },
    { value: '09', label: 'September' }, { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' }, { value: '12', label: 'Desember' }
  ];

  const fetchExecutions = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('maintenance_executions')
        .select(`
          *,
          schedule:maintenance_schedules(
            id,
            asset:assets(asset_code, asset_name),
            maintenance_type:maintenance_types(maintenance_code, maintenance_name)
          ),
          performer:performed_by (id, full_name),
          assessor:assessed_by (id, full_name)
        `)
        .order('execution_date', { ascending: false })
        .limit(200);

      if (filterMonth && filterYear) {
        const startDate = `${filterYear}-${filterMonth}-01`;
        const endDate = filterMonth === '12'
          ? `${Number(filterYear) + 1}-01-01`
          : `${filterYear}-${String(Number(filterMonth) + 1).padStart(2, '0')}-01`;
        query = query.gte('execution_date', startDate).lt('execution_date', endDate);
      } else if (filterYear) {
        query = query.gte('execution_date', `${filterYear}-01-01`).lt('execution_date', `${Number(filterYear) + 1}-01-01`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setExecutions(data || []);
    } catch (error) {
      console.error('Error fetching executions:', error);
      toast.error('Gagal memuat data pelaksanaan');
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterYear]);

  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  const filteredExecutions = executions.filter(exec => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
      exec.schedule?.asset?.asset_name?.toLowerCase().includes(searchLower) ||
      exec.schedule?.asset?.asset_code?.toLowerCase().includes(searchLower) ||
      exec.schedule?.maintenance_type?.maintenance_name?.toLowerCase().includes(searchLower) ||
      exec.result?.toLowerCase().includes(searchLower);

    const matchesFilter = filterStatus === 'all' ||
      (filterStatus === 'completed' && !exec.is_draft) ||
      (filterStatus === 'draft' && exec.is_draft) ||
      (filterStatus === 'assessed' && exec.assessment_result);

    return matchesSearch && matchesFilter;
  });

  const totalCount = executions.length;
  const completedCount = executions.filter(e => !e.is_draft).length;
  const draftCount = executions.filter(e => e.is_draft).length;
  const assessedCount = executions.filter(e => e.assessment_result).length;
  const pendingAssessmentCount = executions.filter(e => e.is_draft && !e.assessment_result).length;

  const getStatusBadge = (exec) => {
    if (exec.is_draft) {
      if (exec.assessment_result) {
        return <span className="badge badge-blue"><CheckCircle2 size={12} className="mr-1" />Draft Dinilai</span>;
      }
      return <span className="badge badge-yellow"><Clock size={12} className="mr-1" />Draft Menunggu Penilaian</span>;
    }
    return <span className="badge badge-green"><CheckCircle2 size={12} className="mr-1" />Selesai</span>;
  };

  const isVendorVisitExecution = (exec) => exec.schedule?.maintenance_type?.maintenance_code === 'VISIT';
  const isKerjaBaktiExecution = (exec) => exec.schedule?.maintenance_type?.maintenance_code === 'KERJA-BAKTI';

  const getAssessmentLabel = (value) => {
    const labels = {
      normal: 'Normal', perlu_perbaikan: 'Perlu Perbaikan',
      perlu_penggantian: 'Perlu Penggantian', perlu_monitoring: 'Perlu Monitoring',
      lainnya: 'Lainnya'
    };
    return labels[value] || value || '-';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Pelaksanaan Pemeliharaan</h1>
          <p className="text-sm text-ink-400 mt-1">Daftar seluruh pelaksanaan jadwal pemeliharaan dan statusnya</p>
        </div>
        <button onClick={fetchExecutions} className="btn-secondary text-sm"><RefreshCw size={14} />Refresh</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-500/10 border border-primary-500/20"><History size={18} className="text-primary-300" /></div>
            <div><p className="text-2xl font-bold text-white">{totalCount}</p><p className="text-xs text-ink-400">Total</p></div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success-500/10 border border-success-500/20"><CheckCircle2 size={18} className="text-success-300" /></div>
            <div><p className="text-2xl font-bold text-white">{completedCount}</p><p className="text-xs text-ink-400">Selesai</p></div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning-500/10 border border-warning-500/20"><FileText size={18} className="text-warning-300" /></div>
            <div><p className="text-2xl font-bold text-white">{draftCount}</p><p className="text-xs text-ink-400">Draft</p></div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20"><Clock size={18} className="text-blue-300" /></div>
            <div><p className="text-2xl font-bold text-white">{pendingAssessmentCount}</p><p className="text-xs text-ink-400">Menunggu Penilaian</p></div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20"><CheckCircle2 size={18} className="text-indigo-300" /></div>
            <div><p className="text-2xl font-bold text-white">{assessedCount}</p><p className="text-xs text-ink-400">Sudah Dinilai</p></div>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative group">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama aset, kode, atau jenis pemeliharaan..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-ink-500 focus:outline-none focus:bg-white/[0.08] focus:border-primary-500/50 transition-all" />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer">
            <option value="all" className="bg-ink-900">Semua Status</option>
            <option value="completed" className="bg-ink-900">Selesai</option>
            <option value="draft" className="bg-ink-900">Draft</option>
            <option value="assessed" className="bg-ink-900">Sudah Dinilai</option>
          </select>
          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
            className="px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer">
            <option value="" className="bg-ink-900">Semua Bulan</option>
            {months.map(m => <option key={m.value} value={m.value} className="bg-ink-900">{m.label}</option>)}
          </select>
          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
            className="px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer">
            <option value="" className="bg-ink-900">Semua Tahun</option>
            {years.map(y => <option key={y} value={y} className="bg-ink-900">{y}</option>)}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-white/5 rounded-md animate-pulse"></div>)}
          </div>
        ) : filteredExecutions.length === 0 ? (
          <div className="empty-state py-12">
            <div className="empty-state-icon"><History size={48} /></div>
            <h3 className="empty-state-title">Tidak ada data pelaksanaan</h3>
            <p className="empty-state-text">
              {searchQuery || filterStatus !== 'all' || filterMonth || filterYear
                ? 'Tidak ada pelaksanaan yang sesuai dengan filter'
                : 'Belum ada pelaksanaan pemeliharaan yang dicatat'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal</th><th>Aset</th><th>Jenis</th><th>Pelaksana</th><th>Status</th><th>Penilaian</th><th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredExecutions.map((exec) => (
                  <tr key={exec.id} className="hover-card">
                    <td className="text-sm text-ink-300 whitespace-nowrap">{formatDateID(exec.execution_date)}</td>
                    <td>
                      <div>
                        <p className="text-sm font-medium text-white">{exec.schedule?.asset?.asset_name || '-'}</p>
                        <p className="text-xs text-ink-400 font-mono">{exec.schedule?.asset?.asset_code || '-'}</p>
                      </div>
                    </td>
                    <td className="text-sm text-ink-300">
                      <div className="flex items-center gap-1.5">
                        {exec.schedule?.maintenance_type?.maintenance_name || '-'}
                        {isVendorVisitExecution(exec) && <span className="badge badge-purple text-[10px]"><Package size={10} className="mr-1" />Vendor</span>}
                        {isKerjaBaktiExecution(exec) && <span className="badge badge-yellow text-[10px]"><Wrench size={10} className="mr-1" />Kerja Bakti</span>}
                      </div>
                    </td>
                    <td className="text-sm text-ink-300">{exec.performer?.full_name || '-'}</td>
                    <td>{getStatusBadge(exec)}</td>
                    <td className="text-sm text-ink-300">
                      {exec.assessment_result
                        ? <span className="text-primary-300 font-medium">{getAssessmentLabel(exec.assessment_result)}</span>
                        : <span className="text-ink-500">-</span>}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setSelectedExecution(exec)} className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded-md transition-all" title="Lihat Detail"><Eye size={14} /></button>
                        {exec.schedule?.id && (
                          <button onClick={() => navigate(`/maintenance/schedules/${exec.schedule.id}`)} className="p-1.5 text-ink-400 hover:bg-white/5 rounded-md transition-all" title="Lihat Jadwal"><Calendar size={14} /></button>
                        )}
                        {canAssess && exec.is_draft && !exec.assessment_result && exec.schedule?.id && (
                          <button onClick={() => navigate(`/maintenance/schedules/${exec.schedule.id}`)} className="p-1.5 text-success-400 hover:bg-success-500/10 rounded-md transition-all" title="Beri Penilaian"><CheckCircle2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedExecution && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedExecution(null)} />
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto card animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-ink-950/95 backdrop-blur-xl z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20"><CheckCircle2 size={18} className="text-primary-400" /></div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Detail Pelaksanaan</h3>
                  <p className="text-xs text-ink-400">{selectedExecution.schedule?.maintenance_type?.maintenance_name || 'Pemeliharaan'} — {formatDateID(selectedExecution.execution_date)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedExecution(null)} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all"><X size={18} /></button>
            </div>

            <div className="p-5 space-y-5">
              <div className="flex items-center gap-2 flex-wrap">
                {getStatusBadge(selectedExecution)}
                {isVendorVisitExecution(selectedExecution) && <span className="badge badge-purple text-[10px]"><Package size={10} className="mr-1" />Kunjungan Vendor</span>}
                {isKerjaBaktiExecution(selectedExecution) && <span className="badge badge-yellow text-[10px]"><Wrench size={10} className="mr-1" />Kerja Bakti</span>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Jenis Pemeliharaan</p>
                  <p className="text-sm text-white font-medium">{selectedExecution.schedule?.maintenance_type?.maintenance_name || '-'}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Tanggal Pelaksanaan</p>
                  <p className="text-sm text-white font-medium">{formatDateID(selectedExecution.execution_date)}</p>
                </div>
                {selectedExecution.odometer_at_execution && (
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Odometer</p>
                    <p className="text-sm text-white font-medium">{Number(selectedExecution.odometer_at_execution).toLocaleString('id-ID')} km</p>
                  </div>
                )}
                {selectedExecution.cost != null && (
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Biaya</p>
                    <p className="text-sm text-white font-medium">{formatCurrency(selectedExecution.cost)}</p>
                  </div>
                )}
                {selectedExecution.performer?.full_name && (
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Pelaksana</p>
                    <p className="text-sm text-white font-medium">{selectedExecution.performer.full_name}</p>
                  </div>
                )}
                {selectedExecution.assessor?.full_name && (
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Dinilai Oleh</p>
                    <p className="text-sm text-white font-medium">{selectedExecution.assessor.full_name}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-ink-400 uppercase">Hasil Pelaksanaan</label>
                <p className="text-sm text-ink-200 mt-1 whitespace-pre-wrap bg-white/[0.03] border border-white/5 rounded-lg p-3">{selectedExecution.result || '-'}</p>
              </div>

              {selectedExecution.notes && (
                <div>
                  <label className="text-xs font-semibold text-ink-400 uppercase">Catatan</label>
                  <p className="text-sm text-ink-200 mt-1 whitespace-pre-wrap bg-white/[0.03] border border-white/5 rounded-lg p-3">{selectedExecution.notes}</p>
                </div>
              )}

              {isVendorVisitExecution(selectedExecution) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {selectedExecution.visit_condition && (
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                      <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Kondisi Mesin</p>
                      <p className="text-sm text-white font-medium">{selectedExecution.visit_condition}</p>
                    </div>
                  )}
                  {selectedExecution.recommendation && (
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                      <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Rekomendasi</p>
                      <p className="text-sm text-white font-medium">{selectedExecution.recommendation}</p>
                    </div>
                  )}
                  {selectedExecution.vendor_contact_name && (
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                      <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Kontak Vendor</p>
                      <p className="text-sm text-white font-medium">{selectedExecution.vendor_contact_name}</p>
                    </div>
                  )}
                </div>
              )}

              {isKerjaBaktiExecution(selectedExecution) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedExecution.work_area && (
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                      <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Area Lokasi</p>
                      <p className="text-sm text-white font-medium">{selectedExecution.work_area}</p>
                    </div>
                  )}
                  {selectedExecution.participant_count && (
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                      <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Jumlah Peserta</p>
                      <p className="text-sm text-white font-medium">{selectedExecution.participant_count} orang</p>
                    </div>
                  )}
                </div>
              )}

              {selectedExecution.assessment_result && (
                <div className="p-4 rounded-lg bg-primary-500/5 border border-primary-500/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-primary-400" />
                    <p className="text-sm font-semibold text-primary-300">Hasil Penilaian HRD / Teknisi</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge badge-blue">{getAssessmentLabel(selectedExecution.assessment_result)}</span>
                    {selectedExecution.assessor?.full_name && (
                      <span className="text-xs text-ink-400">oleh <span className="text-white font-medium">{selectedExecution.assessor.full_name}</span></span>
                    )}
                  </div>
                  {selectedExecution.assessment_notes && (
                    <p className="text-sm text-ink-200 whitespace-pre-wrap bg-white/[0.03] border border-white/5 rounded-lg p-3">{selectedExecution.assessment_notes}</p>
                  )}
                </div>
              )}

              {selectedExecution.photos && selectedExecution.photos.length > 0 ? (
                <div>
                  <label className="text-xs font-semibold text-ink-400 uppercase">Foto Bukti Pelaksanaan ({selectedExecution.photos.length})</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                    {selectedExecution.photos.map((url, idx) => (
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block w-full h-32 rounded-lg overflow-hidden border border-white/10 hover:border-primary-500/40 transition-all">
                        <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-ink-400 uppercase">Foto Bukti Pelaksanaan</label>
                  <p className="text-sm text-ink-500 mt-1">Tidak ada foto</p>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                {selectedExecution.schedule?.id && (
                  <button onClick={() => { const id = selectedExecution.schedule.id; setSelectedExecution(null); navigate(`/maintenance/schedules/${id}`); }} className="btn-primary text-sm">Lihat Jadwal</button>
                )}
                <button onClick={() => setSelectedExecution(null)} className="btn-secondary text-sm">Tutup</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}