import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../lib/constants';
import {
  FileText, ArrowLeft, Edit, Trash2, Calendar,
  User, Building2, FileSignature, AlertCircle,
  Clock, CheckCircle, XCircle, ExternalLink,
  Download, Printer, MoreHorizontal
} from 'lucide-react';
import {
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  CONTRACT_CATEGORIES,
  CONTRACT_CATEGORY_LABELS,
  formatDateID,
  formatDateLongID,
  formatRelativeDate,
  formatCurrency
} from '../../lib/contract-helpers';
import toast from 'react-hot-toast';

export default function ContractDetailPage() {
  const { id } = useParams();
  const { profile, role } = useAuth();
  const navigate = useNavigate();

  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionMenu, setActionMenu] = useState(false);

  const canManage = role && ['super_admin', 'hrd'].includes(role.role_name);

  useEffect(() => {
    if (id) fetchContract();
  }, [id]);

  const fetchContract = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          contract_type:contract_types(id, type_code, type_name, category),
          employee:user_profiles!employee_id(id, full_name, email, phone, department, position),
          vendor:vendors!left(id, vendor_code, vendor_name, contact_person, email, phone_number, whatsapp_number),
          department:departments!left(id, department_code, department_name),
          responsible_user:user_profiles!contracts_responsible_user_id_fkey(id, full_name, email),
          creator:user_profiles!contracts_created_by_fkey(id, full_name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setContract(data);
    } catch (error) {
      console.error('Error fetching contract:', error);
      toast.error('Gagal memuat detail kontrak');
      navigate('/contracts');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Hapus kontrak "${contract.contract_number} - ${contract.title}"?`)) return;
    try {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Kontrak berhasil dihapus');
      navigate('/contracts');
    } catch (error) {
      console.error('Error deleting contract:', error);
      toast.error('Gagal menghapus kontrak');
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      const updateData = { contract_status: newStatus };
      if (newStatus === 'TERMINATED') {
        updateData.terminated_at = new Date().toISOString();
        updateData.terminated_by = profile.id;
      }
      if (newStatus === 'EXPIRED') {
        updateData.is_active = false;
      }

      const { error } = await supabase
        .from('contracts')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      toast.success(`Status kontrak diubah ke ${CONTRACT_STATUS_LABELS[newStatus]}`);
      fetchContract();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Gagal mengubah status kontrak');
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

  const getExpiryInfo = (endDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: `Berakhir ${Math.abs(diffDays)} hari yang lalu`, color: 'text-danger-300', icon: XCircle };
    }
    if (diffDays === 0) {
      return { label: 'Berakhir hari ini', color: 'text-warning-300', icon: AlertCircle };
    }
    return { label: `${diffDays} hari lagi`, color: 'text-success-300', icon: Clock };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-ink-400">
          <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          Memuat data...
        </div>
      </div>
    );
  }

  if (!contract) return null;

  const expiryInfo = getExpiryInfo(contract.end_date);
  const ExpiryIcon = expiryInfo.icon;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/contracts')}
            className="p-2 text-ink-400 hover:text-white hover:bg-white/5 rounded-md transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{contract.title}</h1>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium border ${getStatusBadge(contract.contract_status)}`}>
                {CONTRACT_STATUS_LABELS[contract.contract_status] || contract.contract_status}
              </span>
            </div>
            <p className="text-ink-400 text-sm mt-1 font-mono">{contract.contract_number}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canManage && contract.contract_status === 'ACTIVE' && (
            <>
              <button
                onClick={() => handleStatusChange('EXPIRED')}
                className="px-3 py-1.5 text-xs font-medium text-danger-300 hover:bg-danger-500/10 border border-danger-500/20 rounded-md transition-all"
              >
                Tandai Berakhir
              </button>
              <button
                onClick={() => handleStatusChange('TERMINATED')}
                className="px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 rounded-md transition-all"
              >
                Hentikan
              </button>
            </>
          )}
          {canManage && (
            <div className="relative">
              <button
                onClick={() => setActionMenu(!actionMenu)}
                className="p-2 text-ink-400 hover:text-white hover:bg-white/5 rounded-md transition-all"
              >
                <MoreHorizontal size={18} />
              </button>
              {actionMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setActionMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 card p-1 z-50 animate-scale-in">
                    <Link
                      to={`/contracts/${id}/edit`}
                      onClick={() => setActionMenu(false)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ink-200 hover:bg-white/5 rounded-md transition-colors"
                    >
                      <Edit size={14} />
                      Edit Kontrak
                    </Link>
                    <button
                      onClick={() => {
                        setActionMenu(false);
                        handleDelete();
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger-300 hover:bg-danger-500/10 rounded-md transition-colors"
                    >
                      <Trash2 size={14} />
                      Hapus Kontrak
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expiry Alert */}
      {contract.contract_status === 'ACTIVE' && (
        <div className={`card p-4 border-l-4 ${
          expiryInfo.label.includes('hari yang lalu') ? 'border-danger-500 bg-danger-500/5' :
          expiryInfo.label.includes('hari ini') ? 'border-warning-500 bg-warning-500/5' :
          'border-success-500 bg-success-500/5'
        }`}>
          <div className="flex items-center gap-3">
            <ExpiryIcon size={20} className={expiryInfo.color} />
            <div>
              <p className={`text-sm font-medium ${expiryInfo.color}`}>
                Kontrak {expiryInfo.label}
              </p>
              <p className="text-xs text-ink-400 mt-0.5">
                Periode: {formatDateLongID(contract.start_date)} - {formatDateLongID(contract.end_date)}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informasi Kontrak */}
          <div className="card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileText size={18} className="text-primary-400" />
              Informasi Kontrak
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-ink-500 font-medium uppercase tracking-wider">Jenis Kontrak</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${getCategoryBadge(contract.contract_type?.category)}`}>
                    {contract.contract_type?.type_name || '-'}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs text-ink-500 font-medium uppercase tracking-wider">Kategori</p>
                <p className="text-sm text-white mt-1">
                  {CONTRACT_CATEGORY_LABELS[contract.contract_type?.category] || '-'}
                </p>
              </div>

              {contract.description && (
                <div className="md:col-span-2">
                  <p className="text-xs text-ink-500 font-medium uppercase tracking-wider">Deskripsi</p>
                  <p className="text-sm text-ink-200 mt-1">{contract.description}</p>
                </div>
              )}

              {contract.notes && (
                <div className="md:col-span-2">
                  <p className="text-xs text-ink-500 font-medium uppercase tracking-wider">Catatan</p>
                  <p className="text-sm text-ink-200 mt-1 whitespace-pre-wrap">{contract.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Pihak Terkait */}
          <div className="card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <User size={18} className="text-primary-400" />
              Pihak Terkait
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contract.employee && (
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-xs text-ink-500 font-medium uppercase tracking-wider mb-2">Karyawan</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-sm font-semibold text-white">
                      {contract.employee.full_name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{contract.employee.full_name}</p>
                      <p className="text-xs text-ink-400">{contract.employee.email}</p>
                      {contract.employee.position && (
                        <p className="text-xs text-ink-500 mt-0.5">{contract.employee.position}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {contract.vendor && (
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-xs text-ink-500 font-medium uppercase tracking-wider mb-2">Vendor</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-sm font-semibold text-white">
                      <Building2 size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{contract.vendor.vendor_name}</p>
                      <p className="text-xs text-ink-400 font-mono">{contract.vendor.vendor_code}</p>
                      {contract.vendor.contact_person && (
                        <p className="text-xs text-ink-500 mt-0.5">Kontak: {contract.vendor.contact_person}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {contract.department && (
                <div>
                  <p className="text-xs text-ink-500 font-medium uppercase tracking-wider">Departemen</p>
                  <p className="text-sm text-white mt-1">{contract.department.department_name}</p>
                </div>
              )}

              {contract.responsible_user && (
                <div>
                  <p className="text-xs text-ink-500 font-medium uppercase tracking-wider">Penanggung Jawab</p>
                  <p className="text-sm text-white mt-1">{contract.responsible_user.full_name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Dokumen */}
          {contract.document_url && (
            <div className="card p-6 space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileSignature size={18} className="text-primary-400" />
                Dokumen
              </h2>

              <a
                href={contract.document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
              >
                <div className="p-2 rounded-md bg-primary-500/10 border border-primary-500/20">
                  <FileText size={16} className="text-primary-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {contract.document_name || 'Dokumen Kontrak'}
                  </p>
                  <p className="text-xs text-ink-400">Klik untuk membuka</p>
                </div>
                <ExternalLink size={16} className="text-ink-400 group-hover:text-white transition-colors" />
              </a>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Periode */}
          <div className="card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Calendar size={18} className="text-primary-400" />
              Periode
            </h2>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-ink-500 font-medium uppercase tracking-wider">Tanggal Mulai</p>
                <p className="text-sm text-white mt-1">{formatDateLongID(contract.start_date)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500 font-medium uppercase tracking-wider">Tanggal Berakhir</p>
                <p className="text-sm text-white mt-1">{formatDateLongID(contract.end_date)}</p>
              </div>
              {contract.signed_date && (
                <div>
                  <p className="text-xs text-ink-500 font-medium uppercase tracking-wider">Ditandatangani</p>
                  <p className="text-sm text-white mt-1">{formatDateLongID(contract.signed_date)}</p>
                </div>
              )}
              {contract.renewal_date && (
                <div>
                  <p className="text-xs text-ink-500 font-medium uppercase tracking-wider">Perpanjangan</p>
                  <p className="text-sm text-white mt-1">{formatDateLongID(contract.renewal_date)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Nilai Kontrak */}
          {contract.contract_value && (
            <div className="card p-6 space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileText size={18} className="text-primary-400" />
                Nilai Kontrak
              </h2>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(contract.contract_value)}
              </p>
              <p className="text-xs text-ink-400">{contract.currency}</p>
            </div>
          )}

          {/* Pengingat */}
          <div className="card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock size={18} className="text-primary-400" />
              Pengingat
            </h2>
            <div>
              <p className="text-xs text-ink-500 font-medium uppercase tracking-wider">Pengingat Otomatis</p>
              <p className="text-sm text-white mt-1">
                H-{contract.reminder_days_before || 7} sebelum berakhir
              </p>
            </div>
          </div>

          {/* Info Sistem */}
          <div className="card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <AlertCircle size={18} className="text-primary-400" />
              Info Sistem
            </h2>
            <div className="space-y-3">
              {contract.creator && (
                <div>
                  <p className="text-xs text-ink-500 font-medium uppercase tracking-wider">Dibuat Oleh</p>
                  <p className="text-sm text-white mt-1">{contract.creator.full_name}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-ink-500 font-medium uppercase tracking-wider">Dibuat Pada</p>
                <p className="text-sm text-white mt-1">{formatDateLongID(contract.created_at)}</p>
              </div>
              {contract.updated_at && (
                <div>
                  <p className="text-xs text-ink-500 font-medium uppercase tracking-wider">Diperbarui</p>
                  <p className="text-sm text-white mt-1">{formatDateLongID(contract.updated_at)}</p>
                </div>
              )}
              {contract.terminated_at && (
                <div>
                  <p className="text-xs text-ink-500 font-medium uppercase tracking-wider">Dihentikan Pada</p>
                  <p className="text-sm text-danger-300 mt-1">{formatDateLongID(contract.terminated_at)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}