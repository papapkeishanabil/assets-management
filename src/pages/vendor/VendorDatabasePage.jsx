import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Search, RefreshCw, Eye, Edit, Users, Settings2, Trash2, X, Archive, RotateCcw } from 'lucide-react';
import {
  PROCESS_STAGE_LABELS, PROCESS_STAGE_BADGES,
  QUALIFICATION_LABELS, QUALIFICATION_BADGES,
  VENDOR_WRITE_ROLES
} from '../../lib/vendor-constants';
import { canArchiveCandidate, fetchVendorCandidates } from '../../lib/vendor-helpers';
import { formatDateID } from '../../lib/maintenance-helpers';
import VendorFormModal from '../../components/vendor/VendorFormModal';
import CandidateArchiveModal from '../../components/vendor/CandidateArchiveModal';

// Database Calon Vendor — pipeline kualifikasi (terpisah dari Master Vendor aktif).
export default function VendorDatabasePage() {
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const canWrite = role && VENDOR_WRITE_ROLES.includes(role.role_name);
  const canManageMaster = role && ['hrd', 'super_admin'].includes(role.role_name);

  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterQualification, setFilterQualification] = useState('');
  const [scope, setScope] = useState('prospects'), [archiveTarget, setArchiveTarget] = useState(null);

  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  // Master modal (kategori & spesialisasi)
  const [showMaster, setShowMaster] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [specialtyDraft, setSpecialtyDraft] = useState({ categoryId: '', name: '' });

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchVendorCandidates({
        search,
        categoryId: filterCategory,
        stage: filterStage,
        qualification: filterQualification,
        scope
      });
      setCandidates(data);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      toast.error('Gagal memuat data calon vendor');
    } finally {
      setLoading(false);
    }
  }, [search, filterCategory, filterStage, filterQualification, scope]);

  const loadMaster = useCallback(async () => {
    const [{ data: cats, error }, { data: usrs }] = await Promise.all([
      supabase.from('vendor_categories').select('*, specialties:vendor_specialties(*)').order('display_order'),
      supabase.from('user_profiles').select('id, full_name').eq('account_status', 'ACTIVE').order('full_name')
    ]);
    if (error) {
      toast.error('Gagal memuat master kategori');
      return;
    }
    setCategories(cats || []);
    setUsers(usrs || []);
  }, []);

  useEffect(() => { loadCandidates(); }, [loadCandidates]);
  useEffect(() => { loadMaster(); }, [loadMaster]);

  // Debounce search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const addCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;
    const { error } = await supabase.from('vendor_categories').insert([{ name }]);
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Kategori sudah ada' : 'Gagal menambah kategori');
      return;
    }
    toast.success('Kategori ditambahkan');
    setNewCategory('');
    loadMaster();
  };

  const toggleCategoryActive = async (cat) => {
    const { error } = await supabase.from('vendor_categories').update({ is_active: !cat.is_active }).eq('id', cat.id);
    if (error) { toast.error('Gagal mengubah kategori'); return; }
    loadMaster();
  };

  const addSpecialty = async () => {
    const { categoryId, name } = specialtyDraft;
    if (!categoryId || !name.trim()) {
      toast.error('Pilih kategori dan isi nama spesialisasi');
      return;
    }
    const { error } = await supabase.from('vendor_specialties').insert([{ category_id: categoryId, name: name.trim() }]);
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Spesialisasi sudah ada di kategori ini' : 'Gagal menambah spesialisasi');
      return;
    }
    toast.success('Spesialisasi ditambahkan');
    setSpecialtyDraft({ categoryId: '', name: '' });
    loadMaster();
  };

  const deleteSpecialty = async (id) => {
    if (!confirm('Hapus spesialisasi ini? Kandidat yang memakainya akan kehilangan relasi.')) return;
    const { error } = await supabase.from('vendor_specialties').delete().eq('id', id);
    if (error) { toast.error('Gagal menghapus spesialisasi'); return; }
    loadMaster();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-primary-400 font-semibold tracking-wide uppercase">Manajemen Vendor</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight mt-1">Database Calon Vendor</h1>
          <p className="text-sm text-ink-400 mt-1">
            Calon vendor baru dipisahkan dari profil vendor aktif terhubung. Kandidat yang dihapus dari daftar tetap tersedia di Arsip.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadCandidates} className="btn-secondary text-sm" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          {canManageMaster && (
            <button onClick={() => setShowMaster(true)} className="btn-secondary text-sm">
              <Settings2 size={14} /> Kelola Master
            </button>
          )}
          {canWrite && (
            <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary text-sm whitespace-nowrap">
              <Plus size={14} /> Tambah Calon Vendor
            </button>
          )}
        </div>
      </div>

      <div className="card p-4">
        <div className="mb-3 max-w-sm"><label className="label" htmlFor="candidate-list-scope">Tampilkan data</label><select id="candidate-list-scope" className="input" value={scope} onChange={(e) => setScope(e.target.value)}><option value="prospects">Calon vendor</option><option value="linked">Vendor aktif terhubung</option><option value="archives">Arsip calon vendor</option></select></div>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Cari nama atau kode calon vendor..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <select className="input md:w-48" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">Semua kategori</option>
            {categories.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input md:w-48" value={filterStage} onChange={(e) => setFilterStage(e.target.value)}>
            <option value="">Semua tahap</option>
            {Object.entries(PROCESS_STAGE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="input md:w-44" value={filterQualification} onChange={(e) => setFilterQualification(e.target.value)}>
            <option value="">Semua kelayakan</option>
            {Object.entries(QUALIFICATION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-white/5 rounded-md animate-pulse"></div>
            ))}
          </div>
        ) : candidates.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Users size={48} /></div>
            <h3 className="empty-state-title">Belum ada calon vendor</h3>
            <p className="empty-state-text">
              {canWrite ? 'Tambahkan calon vendor pertama untuk memulai pipeline kualifikasi' : 'Belum ada data untuk filter ini'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Kode & Nama</th>
                    <th>Kategori</th>
                    <th>PIC Harmas</th>
                    <th>Tahap Proses</th>
                    <th>Kelayakan</th>
                    <th>Operasional</th>
                    <th>Dibuat</th>
                    <th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => (
                    <tr key={c.id} className="cursor-pointer hover:bg-white/[0.03]" onClick={() => navigate(`/vendor/database/${c.id}`)}>
                      <td>
                        <span className="font-mono text-[12px] text-ink-400">{c.candidate_code}</span>
                        <div className="font-medium text-white">{c.business_name}</div>
                      </td>
                      <td className="text-ink-400">{c.category?.name || '-'}</td>
                      <td className="text-ink-400">{c.internal_pic?.full_name || <span className="text-ink-500">Belum ditugaskan</span>}</td>
                      <td><span className={PROCESS_STAGE_BADGES[c.process_stage] || 'badge-gray'}>{PROCESS_STAGE_LABELS[c.process_stage] || c.process_stage}</span></td>
                      <td><span className={QUALIFICATION_BADGES[c.qualification_status] || 'badge-gray'}>{QUALIFICATION_LABELS[c.qualification_status] || c.qualification_status}</span></td>
                      <td>
                        <span className={
                          c.operational_status === 'ACTIVE' ? 'badge-green'
                          : c.operational_status === 'SUSPENDED' ? 'badge-orange'
                          : 'badge-gray'
                        }>
                          {c.operational_status === 'ACTIVE' ? 'Aktif' : c.operational_status === 'SUSPENDED' ? 'Ditangguhkan' : 'Belum Aktif'}
                        </span>
                      </td>
                      <td className="text-ink-400 text-[12px]">{formatDateID(c.created_at?.slice(0, 10))}</td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => navigate(`/vendor/database/${c.id}`)} className="p-1.5 text-ink-400 hover:text-primary-400 hover:bg-primary-500/10 rounded-md transition-all" title="Detail">
                            <Eye size={15} />
                          </button>
                          {canWrite && !c.archived_at && (
                            <button
                              onClick={() => { setEditing(c); setShowForm(true); }}
                              className="p-1.5 text-ink-400 hover:text-primary-400 hover:bg-primary-500/10 rounded-md transition-all"
                              title="Edit"
                            >
                              <Edit size={15} />
                            </button>
                          )}
                          {canWrite && canArchiveCandidate(c) && <button type="button" onClick={() => setArchiveTarget(c)} className="p-1.5 text-ink-400 hover:text-danger-400 hover:bg-danger-500/10 rounded-md transition-all" aria-label={`${c.archived_at ? 'Pulihkan' : 'Hapus dari daftar'} ${c.business_name}`} title={c.archived_at ? 'Pulihkan kandidat' : 'Hapus dari daftar (arsip)'}>{c.archived_at ? <RotateCcw size={15} /> : <Archive size={15} />}</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-white/5 text-xs text-ink-500">
              Menampilkan {candidates.length} {scope === 'linked' ? 'profil vendor terhubung' : scope === 'archives' ? 'kandidat dalam arsip' : 'calon vendor'}
            </div>
          </>
        )}
      </div>

      <VendorFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); loadCandidates(); }}
        editing={editing}
        categories={categories}
        users={users}
        currentUserId={profile?.id}
      />
      {archiveTarget && <CandidateArchiveModal candidate={archiveTarget} onClose={() => setArchiveTarget(null)} onSaved={() => { setArchiveTarget(null); loadCandidates(); }} />}

      {showMaster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setShowMaster(false)}>
          <div className="card w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div>
                <h2 className="text-lg font-semibold text-white">Kelola Master Kategori & Spesialisasi</h2>
                <p className="text-xs text-ink-400 mt-1">Daftar dikendalikan administrator (spec §3)</p>
              </div>
              <button onClick={() => setShowMaster(false)} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-6">
              <div>
                <label className="label">Tambah Kategori</label>
                <div className="flex gap-2">
                  <input className="input" placeholder="cth. Washing" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
                  <button onClick={addCategory} className="btn-primary text-sm whitespace-nowrap"><Plus size={14} /> Tambah</button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => toggleCategoryActive(c)}
                      title={c.is_active ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        c.is_active
                          ? 'bg-primary-500/20 border-primary-500/50 text-primary-300'
                          : 'border-white/10 text-ink-500 line-through'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t border-white/5 pt-5">
                <label className="label">Tambah Spesialisasi</label>
                <div className="flex gap-2">
                  <select className="input w-48" value={specialtyDraft.categoryId} onChange={(e) => setSpecialtyDraft((s) => ({ ...s, categoryId: e.target.value }))}>
                    <option value="">Pilih kategori…</option>
                    {categories.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input className="input" placeholder="cth. Kemeja Kantor" value={specialtyDraft.name} onChange={(e) => setSpecialtyDraft((s) => ({ ...s, name: e.target.value }))} />
                  <button onClick={addSpecialty} className="btn-primary text-sm whitespace-nowrap"><Plus size={14} /> Tambah</button>
                </div>
                <div className="mt-4 space-y-3 max-h-72 overflow-y-auto">
                  {categories.map((c) => (
                    <div key={c.id} className={c.is_active ? '' : 'opacity-40'}>
                      <p className="text-xs font-semibold text-ink-300 mb-1.5">{c.name}</p>
                      <div className="flex flex-wrap gap-2">
                        {(c.specialties || []).map((s) => (
                          <span key={s.id} className={`px-2.5 py-1 rounded-full text-[11px] border flex items-center gap-1.5 ${s.is_active ? 'border-white/10 text-ink-300' : 'border-white/5 text-ink-500 line-through'}`}>
                            {s.name}
                            <button onClick={() => deleteSpecialty(s.id)} className="text-ink-500 hover:text-danger-400" title="Hapus">
                              <Trash2 size={11} />
                            </button>
                          </span>
                        ))}
                        {(c.specialties || []).length === 0 && <span className="text-[11px] text-ink-500">Belum ada spesialisasi</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
