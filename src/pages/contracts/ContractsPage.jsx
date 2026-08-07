import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../lib/constants';
import {
  FileText, Plus, Search, Filter, X,
  Calendar, User, Building2, AlertTriangle,
  ChevronDown, MoreHorizontal, Edit, Trash2,
  Eye, Clock, CheckCircle, XCircle, FileSignature
} from 'lucide-react';
import {
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
  CONTRACT_CATEGORIES,
  CONTRACT_CATEGORY_LABELS,
  formatDateID,
  formatRelativeDate,
  formatCurrency
} from '../../lib/contract-helpers';
import toast from 'react-hot-toast';

const STATUS_FILTERS = [
  { value: 'all', label: 'Semua Status' },
  { value: 'ACTIVE', label: 'Aktif' },
  { value: 'EXPIRED', label: 'Berakhir' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'TERMINATED', label: 'Dihentikan' },
  { value: 'RENEWED', label: 'Diperpanjang' },
  { value: 'CANCELLED', label: 'Dibatalkan' }
];

const CATEGORY_FILTERS = [
  { value: 'all', label: 'Semua Kategori' },
  { value: 'EMPLOYEE', label: 'Karyawan' },
  { value: 'VENDOR', label: 'Vendor' },
  { value: 'OTHER', label: 'Lainnya' }
];

export default function ContractsPage() {
  const { profile, role } = useAuth();
  const navigate = useNavigate();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [actionMenu, setActionMenu] = useState(null);

  const canManage = role && ['super_admin', 'hrd'].includes(role.role_name);

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          contract_type:contract_types(id, type_code, type_name, category),
          employee:user_profiles!employee_id(id, full_name),
          vendor:vendors!left(id, vendor_name),
          department:departments!left(id, department_name)
        `)
        .order('end_date', { ascending: true });

      if (error) throw error;
      setContracts(data || []);
    } catch (error) {
      console.error('Error fetching contracts:', error);
      toast.error('Gagal memuat data kontrak');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (contract) => {
    if (!window.confirm(`Hapus kontrak "${contract.contract_number} - ${contract.title}"?`)) return;
    try {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', contract.id);

      if (error) throw error;
      toast.success('Kontrak berhasil dihapus');
      fetchContracts();
    } catch (error) {
      console.error('Error deleting contract:', error);
      toast.error('Gagal menghapus kontrak');
    }
  };

  const getStatusBadge = (status) => {
    const colorMap = {
      [CONTRACT_STATUSES.DRAFT]: 'bg-gray-500/10 text-gray-300 border-gray-500/20',
      [CONTRACT_STATUSES.ACTIVE]: 'bg-success-500/10 text-success-300 border-success-500/20',
      [CONTRACT_STATUSES.EXPIRED]: 'bg-danger-500/10 text-danger-300 border-danger-500/20',
      [CONTRACT_STATUSES.TERMINATED]: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
      [CONTRACT_STATUSES.RENEWED]: 'bg-primary-500/10 text-primary-300 border-primary-500/20',
      [CONTRACT_STATUSES.CANCELLED]: 'bg-ink-500/10 text-ink-300 border-ink-500/20'
    };
    return colorMap[status] || 'bg-ink-500/10 text-ink-300 border-ink-500/20';
  };

  const getCategoryBadge = (category) => {
    const colorMap = {
      [CONTRACT_CATEGORIES.EMPLOYEE]: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
      [CONTRACT_CATEGORIES.VENDOR]: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
      [CONTRACT_CATEGORIES.OTHER]: 'bg-teal-500/10 text-teal-300 border-teal-500/20'
    };
    return colorMap[category] || 'bg-ink-500/10 text-ink-300 border-ink-500/20';
  };

  const getExpiryBadge = (endDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: `Terlambat ${Math.abs(diffDays)} hari`, color: 'text-danger-300 bg-danger-500/10 border-danger-500/20' };
    }
    if (diffDays === 0) {
      return { label: 'Berakhir hari ini', color: 'text-warning-300 bg-warning-500/10 border-warning-500/20' };
    }
    if (diffDays <= 7) {
      return { label: `${diffDays} hari lagi`, color: 'text-orange-300 bg-orange-500/10 border-orange-500/20' };
    }
    if (diffDays <= 30) {
      return { label: `${diffDays} hari lagi`, color: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20' };
    }
    return null;
  };

  // Filter contracts
  const filteredContracts = contracts.filter(c => {
    const matchSearch = !search || 
      c.contract_number?.toLowerCase().includes(search.toLowerCase()) ||
      c.title?.toLowerCase().includes(search.toLowerCase()) ||
      c.employee?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.vendor?.vendor_name?.toLowerCase().includes(search.toLowerCase());
    
    const matchStatus = statusFilter === 'all' || c.contract_status === statusFilter;
    const matchCategory = categoryFilter === 'all' || c.contract_type?.category === categoryFilter;

    return matchSearch && matchStatus && matchCategory;
  });

  // Stats
  const activeCount = contracts.filter(c => c.contract_status === 'ACTIVE').length;
  const expiringSoonCount = contracts.filter(c => {
    if (c.contract_status !== 'ACTIVE') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(c.end_date);
    end.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  }).length;
  const expiredCount = contracts.filter(c => c.contract_status === 'EXPIRED').length;
  const totalCount = contracts.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Manajemen Kontrak</h1>
          <p className="text-ink-400 text-sm mt-1">Kelola kontrak karyawan, vendor, dan perjanjian lainnya</p>
        </div>
        {canManage && (
          <Link
            to="/contracts/new"
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus size={16} />
            Tambah Kontrak
          </Link>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-500/10 border border-primary-500/20">
              <FileText size={18} className="text-primary-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalCount}</p>
              <p className="text-xs text-ink-400">Total Kontrak</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success-500/10 border border-success-500/20">
              <CheckCircle size={18} className="text-success-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{activeCount}</p>
              <p className="text-xs text-ink-400">Aktif</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning-500/10 border border-warning-500/20">
              <AlertTriangle size={18} className="text-warning-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-warning-300">{expiringSoonCount}</p>
              <p className="text-xs text-ink-400">Akan Berakhir</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-danger-500/10 border border-danger-500/20">
              <XCircle size={18} className="text-danger-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-danger-300">{expiredCount}</p>
              <p className="text-xs text-ink-400">Berakhir</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="card p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="text"
              placeholder="Cari nomor kontrak, judul, atau pihak terkait..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-ink-500 focus:outline-none focus:border-primary-500/50 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md border transition-all ${
              showFilters || statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'bg-primary-500/10 border-primary-500/30 text-primary-300'
                : 'bg-white/5 border-white/10 text-ink-300 hover:bg-white/10'
            }`}
          >
            <Filter size={14} />
            Filter
            {(statusFilter !== 'all' || categoryFilter !== 'all') && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary-400"></span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-white/5">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none w-full sm:w-44 px-3 py-2 pr-8 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer"
              >
                {STATUS_FILTERS.map(f => (
                  <option key={f.value} value={f.value} className="bg-ink-900">{f.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="appearance-none w-full sm:w-44 px-3 py-2 pr-8 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer"
              >
                {CATEGORY_FILTERS.map(f => (
                  <option key={f.value} value={f.value} className="bg-ink-900">{f.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Kontrak</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Pihak Terkait</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Kategori</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Periode</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Sisa Waktu</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-ink-400">
                      <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                      Memuat data...
                    </div>
                  </td>
                </tr>
              ) : filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <FileText size={40} className="mx-auto text-ink-700 mb-3" />
                    <p className="text-ink-400 text-sm">Belum ada kontrak</p>
                    {canManage && (
                      <Link to="/contracts/new" className="text-primary-400 hover:text-primary-300 text-sm font-medium mt-2 inline-block">
                        Tambah kontrak baru
                      </Link>
                    )}
                  </td>
                </tr>
              ) : filteredContracts.map((contract) => {
                const expiryBadge = getExpiryBadge(contract.end_date);
                return (
                  <tr
                    key={contract.id}
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => navigate(`/contracts/${contract.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-md bg-primary-500/10 border border-primary-500/20">
                          <FileText size={14} className="text-primary-300" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{contract.title}</p>
                          <p className="text-xs text-ink-400 font-mono">{contract.contract_number}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {contract.employee ? (
                          <>
                            <User size={14} className="text-ink-400" />
                            <span className="text-sm text-ink-200">{contract.employee.full_name}</span>
                          </>
                        ) : contract.vendor ? (
                          <>
                            <Building2 size={14} className="text-ink-400" />
                            <span className="text-sm text-ink-200">{contract.vendor.vendor_name}</span>
                          </>
                        ) : (
                          <span className="text-sm text-ink-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${getCategoryBadge(contract.contract_type?.category)}`}>
                        {contract.contract_type?.type_name || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-ink-300">
                        <Calendar size={12} className="text-ink-500" />
                        <span>{formatDateID(contract.start_date)} - {formatDateID(contract.end_date)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${getStatusBadge(contract.contract_status)}`}>
                        {CONTRACT_STATUS_LABELS[contract.contract_status] || contract.contract_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {expiryBadge ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${expiryBadge.color}`}>
                          <Clock size={10} />
                          {expiryBadge.label}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenu(actionMenu === contract.id ? null : contract.id);
                          }}
                          className="p-1.5 text-ink-400 hover:text-white hover:bg-white/5 rounded-md transition-all"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                        {actionMenu === contract.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setActionMenu(null)} />
                            <div className="absolute right-0 top-full mt-1 w-48 card p-1 z-50 animate-scale-in">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActionMenu(null);
                                  navigate(`/contracts/${contract.id}`);
                                }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ink-200 hover:bg-white/5 rounded-md transition-colors"
                              >
                                <Eye size={14} />
                                Detail
                              </button>
                              {canManage && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActionMenu(null);
                                      navigate(`/contracts/${contract.id}/edit`);
                                    }}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ink-200 hover:bg-white/5 rounded-md transition-colors"
                                  >
                                    <Edit size={14} />
                                    Edit
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActionMenu(null);
                                      handleDelete(contract);
                                    }}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger-300 hover:bg-danger-500/10 rounded-md transition-colors"
                                  >
                                    <Trash2 size={14} />
                                    Hapus
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-white/5 text-xs text-ink-500">
          Menampilkan {filteredContracts.length} dari {contracts.length} kontrak
        </div>
      </div>
    </div>
  );
}