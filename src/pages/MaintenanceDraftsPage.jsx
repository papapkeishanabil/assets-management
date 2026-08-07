import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FileText, Clock, User, Calendar, Search, Filter, Eye, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatDateID, formatDateLongID } from '../lib/maintenance-helpers';

export default function MaintenanceDraftsPage() {
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, pending_assessment, assessed
  const [selectedDraft, setSelectedDraft] = useState(null);

  const canAssess = role && ['super_admin', 'hrd'].includes(role.role_name);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('maintenance_executions')
        .select(`
          *,
          schedule:maintenance_schedules(
            *,
            asset:assets(asset_code, asset_name),
            maintenance_type:maintenance_types(maintenance_code, maintenance_name)
          ),
          performer:performed_by(full_name)
        `)
        .eq('is_draft', true)
        .order('execution_date', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setDrafts(data || []);
    } catch (error) {
      console.error('Error fetching drafts:', error);
      toast.error('Gagal memuat data draft');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const filteredDrafts = drafts.filter(draft => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      draft.schedule?.asset?.asset_name?.toLowerCase().includes(searchLower) ||
      draft.schedule?.asset?.asset_code?.toLowerCase().includes(searchLower) ||
      draft.schedule?.maintenance_type?.maintenance_name?.toLowerCase().includes(searchLower) ||
      draft.result?.toLowerCase().includes(searchLower);

    const matchesFilter = filterStatus === 'all' ||
      (filterStatus === 'pending_assessment' && !draft.assessment_result) ||
      (filterStatus === 'assessed' && draft.assessment_result);

    return matchesSearch && matchesFilter;
  });

  const getAssessmentBadge = (draft) => {
    if (!draft.assessment_result) {
      return (
        <span className="badge badge-yellow">
          <Clock size={12} className="mr-1" />
          Menunggu Penilaian
        </span>
      );
    }
    const resultLabels = {
      'normal': 'Normal',
      'perlu_perbaikan': 'Perlu Perbaikan',
      'perlu_penggantian': 'Perlu Penggantian',
      'perlu_monitoring': 'Perlu Monitoring',
      'lainnya': 'Lainnya'
    };
    return (
      <span className="badge badge-green">
        <CheckCircle2 size={12} className="mr-1" />
        {resultLabels[draft.assessment_result] || draft.assessment_result}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">
            Draft Pemeliharaan
          </h1>
          <p className="text-sm text-ink-400 mt-1">
            Daftar hasil pemeriksaan yang menunggu persetujuan
          </p>
        </div>
        <button onClick={fetchDrafts} className="btn-secondary text-sm">
          <Filter size={14} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning-500/10 border border-warning-500/20">
              <FileText size={18} className="text-warning-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{drafts.length}</p>
              <p className="text-xs text-ink-400">Total Draft</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-500/10 border border-primary-500/20">
              <Clock size={18} className="text-primary-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {drafts.filter(d => !d.assessment_result).length}
              </p>
              <p className="text-xs text-ink-400">Menunggu Penilaian</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success-500/10 border border-success-500/20">
              <CheckCircle2 size={18} className="text-success-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {drafts.filter(d => d.assessment_result).length}
              </p>
              <p className="text-xs text-ink-400">Sudah Dinilai</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative group">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama aset, kode, atau jenis pemeliharaan..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-ink-500 focus:outline-none focus:bg-white/[0.08] focus:border-primary-500/50 transition-all"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer"
          >
            <option value="all" className="bg-ink-900">Semua</option>
            <option value="pending_assessment" className="bg-ink-900">Menunggu Penilaian</option>
            <option value="assessed" className="bg-ink-900">Sudah Dinilai</option>
          </select>
        </div>
      </div>

      {/* Drafts List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-white/5 rounded-md animate-pulse"></div>
            ))}
          </div>
        ) : filteredDrafts.length === 0 ? (
          <div className="empty-state py-12">
            <div className="empty-state-icon">
              <FileText size={48} />
            </div>
            <h3 className="empty-state-title">Tidak ada draft</h3>
            <p className="empty-state-text">
              {searchQuery || filterStatus !== 'all'
                ? 'Tidak ada draft yang sesuai dengan filter'
                : 'Belum ada draft pemeliharaan yang disimpan'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Aset</th>
                  <th>Jenis Pemeliharaan</th>
                  <th>Pelaksana</th>
                  <th>Status Penilaian</th>
                  <th>Hasil</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrafts.map((draft) => (
                  <tr key={draft.id} className="hover-card">
                    <td className="text-sm text-ink-300 whitespace-nowrap">
                      {formatDateID(draft.execution_date)}
                    </td>
                    <td>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {draft.schedule?.asset?.asset_name || '-'}
                        </p>
                        <p className="text-xs text-ink-400 font-mono">
                          {draft.schedule?.asset?.asset_code || '-'}
                        </p>
                      </div>
                    </td>
                    <td className="text-sm text-ink-300">
                      {draft.schedule?.maintenance_type?.maintenance_name || '-'}
                    </td>
                    <td className="text-sm text-ink-300">
                      {draft.performer?.full_name || '-'}
                    </td>
                    <td>
                      {getAssessmentBadge(draft)}
                    </td>
                    <td className="text-sm text-ink-300">
                      {draft.assessment_result ? (
                        <span className="text-primary-300">
                          {draft.assessment_result === 'normal' && 'Normal'}
                          {draft.assessment_result === 'perlu_perbaikan' && 'Perlu Perbaikan'}
                          {draft.assessment_result === 'perlu_penggantian' && 'Perlu Penggantian'}
                          {draft.assessment_result === 'perlu_monitoring' && 'Perlu Monitoring'}
                          {draft.assessment_result === 'lainnya' && 'Lainnya'}
                        </span>
                      ) : (
                        <span className="text-ink-500">-</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedDraft(draft)}
                          className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded-md transition-all"
                          title="Lihat Detail"
                        >
                          <Eye size={14} />
                        </button>
                        {canAssess && !draft.assessment_result && (
                          <button
                            onClick={() => navigate(`/maintenance/schedules/${draft.schedule_id}`)}
                            className="p-1.5 text-success-400 hover:bg-success-500/10 rounded-md transition-all"
                            title="Beri Penilaian"
                          >
                            <CheckCircle2 size={14} />
                          </button>
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

      {/* Detail Modal */}
      {selectedDraft && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedDraft(null)}>
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto card animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-warning-500/10 border border-warning-500/20">
                  <FileText size={18} className="text-warning-300" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Detail Draft</h3>
                  <p className="text-xs text-ink-400">
                    {selectedDraft.schedule?.asset?.asset_name} — {selectedDraft.schedule?.maintenance_type?.maintenance_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDraft(null)}
                className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all"
              >
                <AlertCircle size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-ink-400 uppercase">Tanggal Pelaksanaan</label>
                  <p className="text-sm font-medium text-white mt-1">
                    {formatDateLongID(selectedDraft.execution_date)}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-400 uppercase">Pelaksana</label>
                  <p className="text-sm font-medium text-white mt-1">
                    {selectedDraft.performer?.full_name || '-'}
                  </p>
                </div>
              </div>

              {/* Result */}
              <div>
                <label className="text-xs font-semibold text-ink-400 uppercase">Hasil Pemeriksaan</label>
                <p className="text-sm text-ink-200 mt-1 whitespace-pre-wrap">
                  {selectedDraft.result || '-'}
                </p>
              </div>

              {/* Notes */}
              {selectedDraft.notes && (
                <div>
                  <label className="text-xs font-semibold text-ink-400 uppercase">Catatan</label>
                  <p className="text-sm text-ink-200 mt-1 whitespace-pre-wrap">
                    {selectedDraft.notes}
                  </p>
                </div>
              )}

              {/* Assessment Info */}
              {selectedDraft.assessment_result && (
                <div className="p-4 rounded-lg bg-primary-500/5 border border-primary-500/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-primary-400" />
                    <p className="text-sm font-semibold text-primary-300">Hasil Penilaian</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-ink-400 uppercase">Status</label>
                      <p className="text-sm font-medium text-white mt-1">
                        {selectedDraft.assessment_result === 'normal' && 'Normal'}
                        {selectedDraft.assessment_result === 'perlu_perbaikan' && 'Perlu Perbaikan'}
                        {selectedDraft.assessment_result === 'perlu_penggantian' && 'Perlu Penggantian'}
                        {selectedDraft.assessment_result === 'perlu_monitoring' && 'Perlu Monitoring'}
                        {selectedDraft.assessment_result === 'lainnya' && 'Lainnya'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-ink-400 uppercase">Dinilai Oleh</label>
                      <p className="text-sm font-medium text-white mt-1">
                        {selectedDraft.assessor?.full_name || '-'}
                      </p>
                    </div>
                  </div>
                  {selectedDraft.assessment_notes && (
                    <div>
                      <label className="text-xs font-semibold text-ink-400 uppercase">Catatan Penilaian</label>
                      <p className="text-sm text-ink-200 mt-1 whitespace-pre-wrap">
                        {selectedDraft.assessment_notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Photos */}
              {selectedDraft.photos && selectedDraft.photos.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-ink-400 uppercase">Foto Bukti</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                    {selectedDraft.photos.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full h-24 rounded-lg overflow-hidden border border-white/10 hover:border-primary-500/40 transition-all"
                      >
                        <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                <button
                  onClick={() => {
                    setSelectedDraft(null);
                    navigate(`/maintenance/schedules/${selectedDraft.schedule_id}`);
                  }}
                  className="btn-primary text-sm"
                >
                  <Eye size={14} />
                  Lihat Jadwal
                </button>
                {canAssess && !selectedDraft.assessment_result && (
                  <button
                    onClick={() => {
                      setSelectedDraft(null);
                      navigate(`/maintenance/schedules/${selectedDraft.schedule_id}`);
                    }}
                    className="btn-success text-white text-sm"
                  >
                    <CheckCircle2 size={14} />
                    Beri Penilaian
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}