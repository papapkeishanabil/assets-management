import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { ArrowLeft, Edit, Upload, FileText, Trash2, Wrench, X, Save, Package, ChevronLeft, ChevronRight, ZoomIn, CheckCircle2, History, Camera, QrCode } from 'lucide-react';
import { formatCurrency, ROLES, formatDate, VENDOR_TYPES } from '../lib/constants';
import { permanentDeleteAsset } from '../lib/asset-helpers';
import { formatDateID, WORK_CATEGORY, WORK_CATEGORY_LABELS, WORK_CATEGORY_BADGES, getWorkCategoryFromLog, SERVICE_PHOTO_LABELS, groupServicePhotos, normalizeServicePhotos, servicePhotoGroupTitle, parseServiceDescription } from '../lib/maintenance-helpers';

const SERVICE_VENDOR_TYPES = new Set([
  VENDOR_TYPES.BENGKEL_MOBIL,
  VENDOR_TYPES.BENGKEL_MOTOR,
  VENDOR_TYPES.TEKNISI_MESIN,
  VENDOR_TYPES.TEKNISI_LISTRIK,
  VENDOR_TYPES.TEKNISI_KOMPUTER,
  VENDOR_TYPES.VENDOR_MAINTENANCE
]);

export default function AssetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, role } = useAuth();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [maintenanceExecutions, setMaintenanceExecutions] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [responsibleAssignments, setResponsibleAssignments] = useState([]);
  const [activeTab, setActiveTab] = useState('info');
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    work_category: WORK_CATEGORY.REPAIR,
    description: '',
    service_date: new Date().toISOString().split('T')[0],
    cost: '',
    vendor_id: '',
    vendor_name: '',
    vendor_mode: 'master',
    notes: '',
    photos: []
  });
  const [savingService, setSavingService] = useState(false);
  const [editingLogId, setEditingLogId] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const canEdit = role && ['super_admin', 'hrd'].includes(role.role_name);
  const canDelete = role?.role_name === ROLES.SUPER_ADMIN;

  useEffect(() => {
    fetchAsset();
    fetchPhotos();
    fetchDocuments();
    fetchLogs();
    fetchMaintenanceExecutions();
    fetchMaintenance();
    fetchVendors();
    fetchResponsibleAssignments();
  }, [id]);

  useEffect(() => {
    if (searchParams.get('service') === '1') setShowServiceModal(true);
  }, [searchParams]);

  // Navigasi lightbox foto via keyboard (Esc / panah kiri-kanan)
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      else if (e.key === 'ArrowLeft' && photos.length > 1) setLightboxIndex(i => (i - 1 + photos.length) % photos.length);
      else if (e.key === 'ArrowRight' && photos.length > 1) setLightboxIndex(i => (i + 1) % photos.length);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, photos.length]);

  const fetchAsset = async () => {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      const [catRes, locRes, deptRes, condRes, statRes, vendorRes, userRes] = await Promise.all([
        data.category_id ? supabase.from('asset_categories').select('category_name').eq('id', data.category_id).single() : null,
        data.location_id ? supabase.from('asset_locations').select('location_name, location_type').eq('id', data.location_id).single() : null,
        data.department_id ? supabase.from('departments').select('department_name').eq('id', data.department_id).single() : null,
        data.condition_id ? supabase.from('asset_conditions').select('condition_name').eq('id', data.condition_id).single() : null,
        data.status_id ? supabase.from('asset_statuses').select('status_name').eq('id', data.status_id).single() : null,
        data.vendor_id ? supabase.from('vendors').select('vendor_name').eq('id', data.vendor_id).single() : null,
        data.responsible_user_id ? supabase.from('user_profiles').select('full_name').eq('id', data.responsible_user_id).single() : null
      ]);

      data.category = catRes?.data || null;
      data.location = locRes?.data || null;
      data.department = deptRes?.data || null;
      data.condition = condRes?.data || null;
      data.status = statRes?.data || null;
      data.vendor = vendorRes?.data || null;
      data.responsible = userRes?.data || null;

      setAsset(data);
    } catch (error) {
      toast.error('Gagal memuat data aset');
      navigate('/assets');
    } finally {
      setLoading(false);
    }
  };

  const fetchPhotos = async () => {
    const { data } = await supabase.from('asset_photos').select('*').eq('asset_id', id).order('is_primary', { ascending: false });
    setPhotos(data || []);
  };

  const fetchDocuments = async () => {
    const { data } = await supabase.from('asset_documents').select('*').eq('asset_id', id).order('created_at', { ascending: false });
    setDocuments(data || []);
  };

  const fetchLogs = async () => {
    const { data } = await supabase.from('asset_activity_logs').select('*').eq('asset_id', id).order('created_at', { ascending: false }).limit(50);
    if (data && data.length > 0) {
      const userIds = [...new Set(data.filter(l => l.user_id).map(l => l.user_id))];
      if (userIds.length > 0) {
        const { data: users } = await supabase.from('user_profiles').select('id, full_name').in('id', userIds);
        if (users) {
          data.forEach(log => {
            if (log.user_id) {
              log.user = users.find(u => u.id === log.user_id) || null;
            }
          });
        }
      }
    }
    setLogs(data || []);
  };

  const fetchMaintenanceExecutions = async () => {
    const { data } = await supabase
      .from('maintenance_executions')
      .select(`
        *,
        schedule:maintenance_schedules!inner(id, maintenance_type:maintenance_types!inner(maintenance_name, maintenance_code)),
        performer:performed_by (id, full_name),
        assessor:assessed_by (id, full_name)
      `)
      .eq('schedule.asset_id', id)
      .eq('is_draft', false)
      .order('execution_date', { ascending: false })
      .limit(50);
    setMaintenanceExecutions(data || []);
  };

  const fetchMaintenance = async () => {
    try {
      const { data, error } = await supabase
        .from('maintenance_records')
        .select('*, performed_user:performed_by (full_name), work_orders:work_order_id (work_order_number)')
        .eq('asset_id', id)
        .order('maintenance_date', { ascending: false });
      if (error) throw error;
      setMaintenance(data || []);
    } catch (error) {
      console.error('Error fetching maintenance history:', error);
    }
  };

  const isVendorVisitExecution = (execution) =>
    execution.schedule?.maintenance_type?.maintenance_code === 'VISIT';
  const isKerjaBaktiExecution = (execution) =>
    execution.schedule?.maintenance_type?.maintenance_code === 'KERJA-BAKTI';

  const fetchVendors = async () => {
    const { data } = await supabase
      .from('vendors')
      .select('id, vendor_name, vendor_code, vendor_type, service_type')
      .eq('is_active', true)
      .order('vendor_name', { ascending: true });
    const serviceVendors = (data || []).filter((vendor) =>
      SERVICE_VENDOR_TYPES.has(vendor.vendor_type)
      || /(service|servis|maintenance|perbaikan|teknisi|bengkel)/i.test(vendor.service_type || '')
    );
    setVendors(serviceVendors);
  };

  const fetchResponsibleAssignments = async () => {
    const { data } = await supabase
      .from('asset_responsible_assignments')
      .select('id, responsibility_type, is_primary, responsible:asset_responsibles(id, responsible_name, role_title, responsible_code)')
      .eq('asset_id', id)
      .order('is_primary', { ascending: false });
    setResponsibleAssignments(data || []);
  };

  const resetServiceForm = () => {
    setServiceForm({
      work_category: WORK_CATEGORY.REPAIR,
      description: '',
      service_date: new Date().toISOString().split('T')[0],
      cost: '',
      vendor_id: '',
      vendor_name: '',
      vendor_mode: 'master',
      notes: '',
      photos: []
    });
  };

  const openAddServiceModal = () => {
    setEditingLogId(null);
    resetServiceForm();
    setShowServiceModal(true);
  };

  const openEditServiceModal = (log) => {
    setEditingLogId(log.id);
    const nd = log.new_data || {};
    const isMaster = nd.vendor_id && vendors.some(v => v.id === nd.vendor_id);
    setServiceForm({
      work_category: getWorkCategoryFromLog(log),
      description: parseServiceDescription(log),
      service_date: nd.service_date || (log.created_at || '').split('T')[0] || new Date().toISOString().split('T')[0],
      cost: nd.cost != null ? String(nd.cost) : '',
      vendor_id: isMaster ? nd.vendor_id : '',
      vendor_name: nd.vendor_name || '',
      vendor_mode: isMaster ? 'master' : (nd.vendor_name ? 'manual' : 'master'),
      notes: log.reason || '',
      photos: normalizeServicePhotos(nd.photos)
    });
    setShowServiceModal(true);
  };

  const closeServiceModal = () => {
    setShowServiceModal(false);
    setEditingLogId(null);
  };

  const handleServicePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran foto maksimal 5MB');
      e.target.value = '';
      return;
    }
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `service-photos/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { error } = await supabase.storage.from('maintenance-photos').upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('maintenance-photos').getPublicUrl(filePath);
      setServiceForm(prev => ({ ...prev, photos: [...prev.photos, { url: publicUrl, label: '', caption: '' }] }));
      toast.success('Foto berhasil diupload');
    } catch (error) {
      toast.error('Gagal upload foto: ' + error.message);
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const removeServicePhoto = (idx) => {
    setServiceForm(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== idx) }));
  };

  const updateServicePhoto = (idx, patch) => {
    setServiceForm(prev => ({ ...prev, photos: prev.photos.map((p, i) => i === idx ? { ...p, ...patch } : p) }));
  };

  const handleServiceSubmit = async (e) => {
    e.preventDefault();
    if (!serviceForm.description) {
      toast.error('Deskripsi service wajib diisi');
      return;
    }

    setSavingService(true);
    try {
      const categoryPrefix = serviceForm.work_category === WORK_CATEGORY.ROUTINE
        ? 'Pemeliharaan Rutin'
        : 'Perbaikan/Service';
      const logDescription = `${categoryPrefix}: ${serviceForm.description}` +
        (serviceForm.vendor_name ? ` (${serviceForm.vendor_name})` : '') +
        (serviceForm.cost ? ` - Biaya: Rp ${parseInt(serviceForm.cost).toLocaleString('id-ID')}` : '');

      const new_data = {
        work_category: serviceForm.work_category,
        service_date: serviceForm.service_date,
        cost: serviceForm.cost ? parseInt(serviceForm.cost) : null,
        vendor_id: serviceForm.vendor_id || null,
        vendor_name: serviceForm.vendor_name || null,
        description: serviceForm.description,
        photos: serviceForm.photos.filter(p => p.url)
      };


      if (editingLogId) {
        const prev = logs.find(l => l.id === editingLogId);
        const { data, error } = await supabase.from('asset_activity_logs')
          .update({
            description: logDescription,
            reason: serviceForm.notes || null,
            new_data,
            old_data: prev?.old_data || prev?.new_data || null
          })
          .eq('id', editingLogId)
          .select('id');

        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Tidak ada izin atau catatan tidak ditemukan');

        toast.success('Catatan service berhasil diperbarui');
      } else {
        const { error } = await supabase.from('asset_activity_logs').insert([{
          asset_id: id,
          user_id: profile?.id,
          action_type: 'SERVICE',
          description: logDescription,
          reason: serviceForm.notes || null,
          new_data
        }]);

        if (error) throw error;

        toast.success('Service berhasil dicatat');
      }

      closeServiceModal();
      resetServiceForm();
      fetchLogs();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingService(false);
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!confirm('Hapus foto ini?')) return;
    try {
      const { error } = await supabase.from('asset_photos').delete().eq('id', photoId);
      if (error) throw error;
      toast.success('Foto berhasil dihapus');
      fetchPhotos();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!confirm('Hapus dokumen ini?')) return;
    try {
      const { error } = await supabase.from('asset_documents').delete().eq('id', docId);
      if (error) throw error;
      toast.success('Dokumen berhasil dihapus');
      fetchDocuments();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handlePermanentDelete = async () => {
    if (!asset) return;
    const input = prompt(
      `HAPUS PERMANEN aset berikut?\n\n` +
      `Kode: ${asset.asset_code}\n` +
      `Nama: ${asset.asset_name}\n\n` +
      `Tindakan ini tidak dapat dibatalkan. Semua foto, dokumen, riwayat pemeliharaan, dan log aktivitas terkait akan ikut terhapus.\n\n` +
      `Ketik kode aset PERSIS (${asset.asset_code}) untuk konfirmasi:`
    );
    if (input === null) return;
    if (input.trim() !== asset.asset_code) {
      toast.error('Kode aset tidak cocok. Penghapusan dibatalkan.');
      return;
    }

    const toastId = toast.loading('Menghapus aset permanen...');
    try {
      await permanentDeleteAsset(asset.id);
      toast.success('Aset permanen dihapus', { id: toastId });
      navigate('/assets');
    } catch (error) {
      toast.error('Gagal hapus permanen: ' + error.message, { id: toastId });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="animate-spin h-6 w-6 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
      </div>
    );
  }

  if (!asset) {
    return <div className="empty-state"><div className="empty-state-icon"><Package size={48} /></div><h3 className="empty-state-title">Aset tidak ditemukan</h3></div>;
  }

  // Timeline terpadu: pelaksanaan jadwal (rutin) + log aktivitas (service/aktivitas lain)
  const mergedTimeline = [
    ...maintenanceExecutions.map(e => ({
      key: `exec-${e.id}`,
      kind: 'execution',
      category: WORK_CATEGORY.ROUTINE,
      sortTime: new Date(`${e.execution_date}T00:00:00`).getTime(),
      title: e.schedule?.maintenance_type?.maintenance_name || 'Pemeliharaan Rutin',
      cost: e.cost != null ? Number(e.cost) : null,
      person: e.performer?.full_name || '-',
      dateLabel: formatDateID(e.execution_date),
      raw: e
    })),
    ...logs.map(l => ({
      key: `log-${l.id}`,
      kind: 'log',
      category: getWorkCategoryFromLog(l),
      sortTime: new Date(l.created_at).getTime(),
      title: l.description,
      cost: l.action_type === 'SERVICE' && l.new_data?.cost ? Number(l.new_data.cost) : null,
      person: l.user?.full_name || 'System',
      dateLabel: new Date(l.created_at).toLocaleString('id-ID'),
      raw: l
    }))
  ].sort((a, b) => b.sortTime - a.sortTime);

  const categoryStats = mergedTimeline.reduce((acc, item) => {
    acc[item.category].count += 1;
    if (item.category !== WORK_CATEGORY.OTHER && item.cost) acc[item.category].totalCost += item.cost;
    return acc;
  }, {
    [WORK_CATEGORY.ROUTINE]: { count: 0, totalCost: 0 },
    [WORK_CATEGORY.REPAIR]: { count: 0, totalCost: 0 },
    [WORK_CATEGORY.OTHER]: { count: 0, totalCost: 0 }
  });

  const filteredTimeline = historyFilter === 'all'
    ? mergedTimeline
    : mergedTimeline.filter(item => item.category === historyFilter);

  const HISTORY_FILTERS = [
    { value: 'all', label: 'Semua' },
    { value: WORK_CATEGORY.ROUTINE, label: 'Rutin' },
    { value: WORK_CATEGORY.REPAIR, label: 'Perbaikan' },
    { value: WORK_CATEGORY.OTHER, label: 'Lainnya' }
  ];

  const tabs = [
    { id: 'info', label: 'Informasi Umum' },
    { id: 'technical', label: 'Data Teknis' },
    { id: 'purchase', label: 'Pembelian & Garansi' },
    { id: 'photos', label: `Foto (${photos.length})` },
    { id: 'documents', label: `Dokumen (${documents.length})` },
    { id: 'maintenance', label: `Pemeliharaan (${maintenance.filter(r => r.inspection_status == null || r.inspection_status === 'selesai').length})` },
    { id: 'activity', label: `Riwayat (${mergedTimeline.length})` }
  ];

  const Field = ({ label, value }) => (
    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
      <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">{label}</p>
      <p className="font-medium text-white text-sm">{value || '-'}</p>
    </div>
  );

  const responsibleNames = responsibleAssignments
    .map(item => item.responsible?.responsible_name)
    .filter(Boolean)
    .join(', ');
  const displayedResponsible = asset?.location?.location_type === 'Lokasi Vendor'
    ? asset?.vendor?.vendor_name
    : responsibleNames || asset?.responsible?.full_name;

  // Label Indonesia untuk key new_data/old_data agar tidak tampil "vendor name" mentah.
  const LOG_FIELD_LABELS = {
    cost: 'Biaya',
    service_date: 'Tanggal Service',
    work_category: 'Kategori Pekerjaan',
    vendor_name: 'Nama Vendor'
  };
  const formatLogLabel = (key) => LOG_FIELD_LABELS[key] || key.replace(/_/g, ' ');

  const formatLogValue = (key, value) => {
    if (value === null || value === undefined || value === '') return '-';
    if (key === 'cost') return `Rp ${Number(value).toLocaleString('id-ID')}`;
    if (key === 'work_category') return WORK_CATEGORY_LABELS[value] || String(value);
    if (key === 'service_date') return formatDateID(value);
    if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
    return String(value);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <button onClick={() => navigate('/assets')} className="p-2 hover:bg-white/5 rounded-md transition-all flex-shrink-0">
            <ArrowLeft size={18} className="text-ink-300" />
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-white tracking-tight truncate">{asset.asset_name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="asset-label-badge">
                {asset.label_number ? `ASET ${String(asset.label_number).padStart(4, '0')}` : '-'}
              </span>
              <span className="text-sm text-ink-400 font-mono">{asset.asset_code}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => navigate(`/assets/qr-labels?ids=${id}`)} className="btn-secondary text-sm">
            <QrCode size={14} />
            Label QR
          </button>
          {canEdit && (
            <>
              <button onClick={openAddServiceModal} className="btn-secondary text-sm">
                <Wrench size={14} />
                Catat Service
              </button>
              <button onClick={() => navigate(`/assets/${id}/edit`)} className="btn-primary text-sm">
                <Edit size={14} />
                Edit
              </button>
            </>
          )}
          {canDelete && asset && !asset.is_active && (
            <button onClick={handlePermanentDelete} className="btn-secondary text-sm !text-danger-400 !border-danger-500/30 hover:!bg-danger-500/10">
              <Trash2 size={14} />
              Hapus Permanen
            </button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Kategori</p>
          <p className="font-semibold text-white text-sm">{asset.category?.category_name || '-'}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Lokasi</p>
          <p className="font-semibold text-white text-sm">{asset.location?.location_name || '-'}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Kondisi</p>
          <p className="font-semibold text-white text-sm">{asset.condition?.condition_name || '-'}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Status</p>
          <p className="font-semibold text-white text-sm">{asset.status?.status_name || '-'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card">
        {activeTab === 'info' && (
          <div className="space-y-4">
            <h3 className="section-title">
              <Package size={16} className="text-primary-400" />
              Informasi Umum
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nama Aset" value={asset.asset_name} />
              <Field label="Nomor Aset" value={asset.label_number ? `ASET ${String(asset.label_number).padStart(4, '0')}` : '-'} />
              <Field label="Kode Aset" value={asset.asset_code} />
              <Field label="Merek" value={asset.brand} />
              <Field label="Model" value={asset.model} />
              <Field label="Nomor Seri" value={asset.serial_number} />
              <Field label="Tahun Produksi" value={asset.manufacture_year} />
              <Field label="Departemen" value={asset.department?.department_name} />
              <Field label="Penanggung Jawab" value={displayedResponsible} />
            </div>
            {responsibleAssignments.length > 0 && (
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-2">Daftar Penanggung Jawab</p>
                <div className="flex flex-wrap gap-2">
                  {responsibleAssignments.map(item => (
                    <span key={item.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-primary-500/10 border border-primary-500/20 text-primary-300">
                      {item.responsible?.responsible_name}
                      {item.responsible?.role_title && <span className="text-ink-400">({item.responsible.role_title})</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {asset.notes && (
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Catatan</p>
                <p className="text-sm text-ink-200 whitespace-pre-wrap">{asset.notes}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'technical' && (
          <div className="space-y-4">
            <h3 className="section-title">
              <Wrench size={16} className="text-primary-400" />
              Data Teknis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {asset.vehicle_registration_number && (
                <Field label="Plat Nomor" value={asset.vehicle_registration_number} />
              )}
              {asset.vehicle_owner_name && (
                <Field label="Nama Pemilik" value={asset.vehicle_owner_name} />
              )}
              {asset.chassis_number && (
                <Field label="Nomor Rangka" value={asset.chassis_number} />
              )}
              {asset.engine_number && (
                <Field label="Nomor Mesin" value={asset.engine_number} />
              )}
              {asset.vehicle_color && (
                <Field label="Warna" value={asset.vehicle_color} />
              )}
              {asset.fuel_type && (
                <Field label="Bahan Bakar / Sumber Energi" value={asset.fuel_type} />
              )}
              {asset.manufacture_year && (
                <Field label="Tahun Pembuatan" value={asset.manufacture_year} />
              )}
              {asset.current_odometer && (
                <Field label="Kilometer Saat Ini" value={`${asset.current_odometer} km`} />
              )}
              {asset.current_operating_hours && (
                <Field label="Jam Operasional" value={`${asset.current_operating_hours} jam`} />
              )}
            </div>
            {asset.technical_specification && (
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Spesifikasi Teknis</p>
                <p className="text-sm text-ink-200 whitespace-pre-wrap">{asset.technical_specification}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'purchase' && (
          <div className="space-y-4">
            <h3 className="section-title">
              <FileText size={16} className="text-primary-400" />
              Pembelian & Garansi
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Tanggal Pembelian" value={asset.purchase_date} />
              <Field label="Harga Pembelian" value={asset.purchase_price ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(asset.purchase_price) : '-'} />
              <Field label="Vendor" value={asset.vendor?.vendor_name} />
              <Field label="Nomor Invoice" value={asset.invoice_number} />
              <Field label="Awal Garansi" value={asset.warranty_start_date} />
              <Field label="Akhir Garansi" value={asset.warranty_end_date} />
            </div>
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="section-title">
                <Package size={16} className="text-primary-400" />
                Foto Aset
              </h3>
              {canEdit && (
                <button className="btn-secondary text-sm">
                  <Upload size={14} />
                  Upload Foto
                </button>
              )}
            </div>
            {photos.length === 0 ? (
              <div className="empty-state py-8">
                <div className="empty-state-icon"><Package size={32} /></div>
                <p className="empty-state-text">Belum ada foto</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {photos.map((photo, idx) => (
                  <div
                    key={photo.id}
                    onClick={() => setLightboxIndex(idx)}
                    className="relative group rounded-lg overflow-hidden cursor-zoom-in"
                  >
                    <img src={photo.photo_url} alt={photo.caption || 'Foto aset'} className="w-full h-40 object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center pointer-events-none">
                      <ZoomIn size={22} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>
                    {photo.is_primary && (
                      <span className="absolute top-2 left-2 badge badge-yellow text-[10px]">Utama</span>
                    )}
                    {canEdit && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id); }}
                        className="absolute top-2 right-2 p-1.5 bg-danger-500/90 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                    {photo.caption && (
                      <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                        <p className="text-xs text-white/90 truncate">{photo.caption}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="section-title">
                <FileText size={16} className="text-primary-400" />
                Dokumen Aset
              </h3>
              {canEdit && (
                <button className="btn-secondary text-sm">
                  <Upload size={14} />
                  Upload Dokumen
                </button>
              )}
            </div>
            {documents.length === 0 ? (
              <div className="empty-state py-8">
                <div className="empty-state-icon"><FileText size={32} /></div>
                <p className="empty-state-text">Belum ada dokumen</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/5 rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-md bg-primary-500/10 border border-primary-500/20 flex-shrink-0">
                        <FileText size={14} className="text-primary-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-white text-sm truncate">{doc.document_name}</p>
                        <p className="text-xs text-ink-500 font-mono">{doc.document_type} {doc.document_number && `• ${doc.document_number}`}</p>
                      </div>
                    </div>
                    {canEdit && (
                      <button onClick={() => handleDeleteDocument(doc.id)} className="p-1.5 text-danger-400 hover:bg-danger-500/10 rounded-md transition-all">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'maintenance' && (() => {
          const history = maintenance.filter(r => r.inspection_status == null || r.inspection_status === 'selesai');
          return (
            <div className="space-y-3">
              <h3 className="section-title">
                <Wrench size={16} className="text-primary-400" />
                <span className="ml-2">Riwayat Pemeliharaan</span>
              </h3>
              {history.length === 0 ? (
                <div className="empty-state py-8">
                  <div className="empty-state-icon"><History size={36} className="text-ink-400" /></div>
                  <p className="empty-state-text">Belum ada riwayat pemeliharaan aset ini</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map(r => (
                    <div key={r.id} className="p-3 bg-white/[0.03] rounded-lg border border-white/5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Wrench size={14} className="text-primary-400" />
                          <span className="text-sm font-medium text-white">{formatDate(r.maintenance_date)}</span>
                          {r.work_orders?.work_order_number && (
                            <span className="text-xs text-ink-400 font-mono">{r.work_orders.work_order_number}</span>
                          )}
                        </div>
                        {r.inspection_status === 'selesai' && (
                          <span className={`badge ${r.needs_repair ? 'badge-red' : 'badge-green'}`}>
                            {r.needs_repair ? 'Perlu Perbaikan' : 'Baik'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-ink-300 mt-1">{r.work_description || '-'}</p>
                      <div className="flex gap-4 mt-2 text-xs text-ink-400 flex-wrap">
                        <span>Pelaksana: {r.performed_user?.full_name || '-'}</span>
                        {r.cost && <span>Biaya: Rp {Number(r.cost).toLocaleString('id-ID')}</span>}
                        {r.needs_repair && <span className="text-danger-300 font-medium">Perlu perbaikan</span>}
                        {r.review_notes && <span>Review: {r.review_notes}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {activeTab === 'activity' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="section-title">
                <History size={16} className="text-primary-400" />
                Riwayat Aktivitas & Pemeliharaan
              </h3>
              {canEdit && (
                <button onClick={openAddServiceModal} className="btn-secondary text-sm">
                  <Wrench size={14} />
                  Catat Service
                </button>
              )}
            </div>

            {/* Ringkasan per kategori */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[WORK_CATEGORY.ROUTINE, WORK_CATEGORY.REPAIR, WORK_CATEGORY.OTHER].map(cat => (
                <div key={cat} className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <span className={`badge ${WORK_CATEGORY_BADGES[cat]} text-[10px] mb-2 inline-flex`}>
                    {WORK_CATEGORY_LABELS[cat]}
                  </span>
                  <p className="text-lg font-semibold text-white">
                    {categoryStats[cat].count} <span className="text-xs font-normal text-ink-400">kali</span>
                  </p>
                  {cat !== WORK_CATEGORY.OTHER && (
                    <p className="text-xs text-ink-400 mt-0.5">Total biaya: {formatCurrency(categoryStats[cat].totalCost)}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Filter kategori */}
            <div className="tabs flex-wrap">
              {HISTORY_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setHistoryFilter(f.value)}
                  className={`tab text-xs ${historyFilter === f.value ? 'tab-active' : ''}`}
                >
                  {f.label} ({f.value === 'all' ? mergedTimeline.length : categoryStats[f.value].count})
                </button>
              ))}
            </div>

            {filteredTimeline.length === 0 ? (
              <div className="empty-state py-8">
                <div className="empty-state-icon"><FileText size={32} /></div>
                <p className="empty-state-text">
                  {historyFilter !== 'all' ? 'Tidak ada riwayat yang sesuai filter' : 'Belum ada aktivitas'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTimeline.map(item => (
                  <div
                    key={item.key}
                    onClick={() => item.kind === 'execution' ? setSelectedExecution(item.raw) : setSelectedLog(item.raw)}
                    className={`flex gap-3 p-3 rounded-lg border cursor-pointer hover:bg-white/[0.06] transition-colors ${
                      item.category === WORK_CATEGORY.ROUTINE ? 'bg-success-500/[0.05] border-success-500/15'
                      : item.category === WORK_CATEGORY.REPAIR ? 'bg-warning-500/[0.05] border-warning-500/15'
                      : 'bg-white/[0.03] border-white/5'
                    }`}
                  >
                    <div className={`p-2 rounded-md flex-shrink-0 ${
                      item.category === WORK_CATEGORY.ROUTINE ? 'bg-success-500/10 border border-success-500/20'
                      : item.category === WORK_CATEGORY.REPAIR ? 'bg-warning-500/10 border border-warning-500/20'
                      : 'bg-white/5 border border-white/10'
                    }`}>
                      {item.kind === 'execution' ? (
                        <CheckCircle2 size={14} className="text-success-400" />
                      ) : item.category === WORK_CATEGORY.OTHER ? (
                        <FileText size={14} className="text-ink-400" />
                      ) : (
                        <Wrench size={14} className={item.category === WORK_CATEGORY.ROUTINE ? 'text-success-400' : 'text-warning-400'} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`badge ${WORK_CATEGORY_BADGES[item.category]} text-[10px]`}>
                          {item.kind === 'execution' ? 'Pemeliharaan Rutin (Jadwal)' : WORK_CATEGORY_LABELS[item.category]}
                        </span>
                        {item.kind === 'log' && item.raw.action_type === 'SERVICE' && item.raw.new_data?.service_date && (
                          <span className="text-[10px] font-mono bg-warning-500/10 text-warning-300 px-1.5 py-0.5 rounded border border-warning-500/20">
                            {item.raw.new_data.service_date}
                          </span>
                        )}
                        {item.kind === 'log' && item.raw.action_type === 'SERVICE' && Array.isArray(item.raw.new_data?.photos) && item.raw.new_data.photos.length > 0 && (
                          <span className="text-[10px] font-mono bg-primary-500/10 text-primary-300 px-1.5 py-0.5 rounded border border-primary-500/20 inline-flex items-center gap-1">
                            <Camera size={10} />
                            {item.raw.new_data.photos.length} foto
                          </span>
                        )}
                        {canEdit && item.kind === 'log' && item.raw.action_type === 'SERVICE' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditServiceModal(item.raw); }}
                            className="text-[10px] font-mono inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-white/10 text-ink-300 hover:text-white hover:border-warning-500/40 hover:bg-warning-500/10 transition-all"
                            title="Edit catatan service"
                          >
                            <Edit size={10} />
                            Edit
                          </button>
                        )}
                      </div>
                      <p className="text-sm font-medium text-white mt-1">{item.title}</p>
                      <div className="flex items-center flex-wrap gap-2 mt-1.5">
                        {item.cost != null && (
                          <span className="text-[10px] font-mono bg-primary-500/10 text-primary-300 px-1.5 py-0.5 rounded border border-primary-500/20">
                            Rp {item.cost.toLocaleString('id-ID')}
                          </span>
                        )}
                        <span className="text-[11px] text-ink-500 font-mono">
                          {item.person} • {item.dateLabel}
                        </span>
                      </div>
                      {item.kind === 'log' && item.raw.reason && (
                        <p className="text-xs text-ink-400 mt-1.5">Catatan: {item.raw.reason}</p>
                      )}
                      {item.kind === 'execution' && item.raw.notes && (
                        <p className="text-xs text-ink-400 mt-1.5">Catatan: {item.raw.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showServiceModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-lg">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-warning-500/10 border border-warning-500/20">
                  <Wrench size={18} className="text-warning-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">{editingLogId ? 'Edit Perbaikan/Service' : 'Catat Perbaikan/Service'}</h3>
              </div>
              <button onClick={closeServiceModal} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleServiceSubmit} className="space-y-4">
              <div>
                <label className="label">Jenis Pekerjaan</label>
                <select
                  className="input"
                  value={serviceForm.work_category}
                  onChange={(e) => setServiceForm({...serviceForm, work_category: e.target.value})}
                >
                  <option value={WORK_CATEGORY.REPAIR}>Perbaikan karena Kerusakan</option>
                  <option value={WORK_CATEGORY.ROUTINE}>Pemeliharaan Rutin</option>
                </select>
              </div>
              <div>
                <label className="label">Deskripsi Service <span className="text-danger-400">*</span></label>
                <textarea
                  className="input"
                  rows="3"
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm({...serviceForm, description: e.target.value})}
                  placeholder="Contoh: Ganti LCD, Bersihkan keyboard, Ganti thermal paste..."
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Tanggal Service</label>
                  <input
                    type="date"
                    className="input"
                    value={serviceForm.service_date}
                    onChange={(e) => setServiceForm({...serviceForm, service_date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="label">Biaya (Rp)</label>
                  <input
                    type="number"
                    className="input"
                    value={serviceForm.cost}
                    onChange={(e) => setServiceForm({...serviceForm, cost: e.target.value})}
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="label">Vendor/Tempat Service</label>
                <select
                  className="input"
                  value={serviceForm.vendor_mode === 'manual' ? '__manual' : serviceForm.vendor_id}
                  onChange={(e) => {
                    if (e.target.value === '__manual') {
                      setServiceForm({
                        ...serviceForm,
                        vendor_id: '',
                        vendor_name: '',
                        vendor_mode: 'manual'
                      });
                      return;
                    }

                    const selectedVendor = vendors.find((vendor) => vendor.id === e.target.value);
                    setServiceForm({
                      ...serviceForm,
                      vendor_id: selectedVendor?.id || '',
                      vendor_name: selectedVendor?.vendor_name || '',
                      vendor_mode: 'master'
                    });
                  }}
                >
                  <option value="">Pilih vendor/tempat service...</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.vendor_name}{vendor.vendor_code ? ` (${vendor.vendor_code})` : ''}
                    </option>
                  ))}
                  <option value="__manual">Input manual / belum terdaftar</option>
                </select>
                {serviceForm.vendor_mode === 'manual' && (
                  <input
                    type="text"
                    className="input mt-2"
                    value={serviceForm.vendor_name}
                    onChange={(e) => setServiceForm({...serviceForm, vendor_name: e.target.value})}
                    placeholder="Contoh: Escape Computer"
                  />
                )}
                {vendors.length === 0 && (
                  <p className="text-xs text-ink-500 mt-1">Belum ada vendor aktif. Daftarkan di menu Vendor atau gunakan input manual.</p>
                )}
              </div>
              <div>
                <label className="label">Catatan Tambahan</label>
                <textarea
                  className="input"
                  rows="2"
                  value={serviceForm.notes}
                  onChange={(e) => setServiceForm({...serviceForm, notes: e.target.value})}
                  placeholder="Catatan tambahan..."
                />
              </div>
              <div className="space-y-3">
                <label className="label">Foto Service (opsional)</label>
                <input
                  id="service-photo"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingPhoto}
                  onChange={handleServicePhotoUpload}
                />
                <label
                  htmlFor="service-photo"
                  className={`cursor-pointer flex items-center justify-center gap-2 p-3 border border-dashed rounded-lg transition-all text-xs text-ink-300 ${
                    uploadingPhoto
                      ? 'border-primary-500/40 bg-primary-500/[0.03] opacity-70 pointer-events-none'
                      : 'border-white/10 hover:border-primary-500/40 hover:bg-primary-500/[0.03]'
                  }`}
                >
                  <Camera size={14} />
                  {uploadingPhoto ? 'Mengupload...' : 'Tambah Foto'}
                </label>
                <p className="text-xs text-ink-500">
                  Tidak harus berpasangan — bisa sekadar foto perangkat/part yang rusak. Setiap foto bisa diberi label dan keterangan.
                </p>
                {serviceForm.photos.length > 0 && (
                  <div className="space-y-2">
                    {serviceForm.photos.map((photo, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 p-2 rounded-lg border border-white/10 bg-white/[0.02]">
                        <img
                          src={photo.url}
                          alt={photo.caption || `Foto ${idx + 1}`}
                          className="w-14 h-14 object-cover rounded-lg border border-white/10 shrink-0"
                        />
                        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-2">
                          <select
                            className="input"
                            value={photo.label}
                            onChange={(e) => updateServicePhoto(idx, { label: e.target.value })}
                            title="Label foto (opsional)"
                          >
                            <option value="">Tanpa Label</option>
                            {Object.entries(SERVICE_PHOTO_LABELS).map(([labelKey, labelText]) => (
                              <option key={labelKey} value={labelKey}>{labelText}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            className="input"
                            value={photo.caption}
                            onChange={(e) => updateServicePhoto(idx, { caption: e.target.value })}
                            placeholder="Keterangan foto (mis. motor driver rusak)"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeServicePhoto(idx)}
                          className="p-1.5 text-ink-400 hover:text-danger-400 hover:bg-white/5 rounded-md transition-all shrink-0"
                          title="Hapus foto"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={closeServiceModal} className="btn-secondary">Batal</button>
                <button type="submit" className="btn-primary" disabled={savingService || uploadingPhoto}>
                  {savingService ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      {editingLogId ? 'Simpan Perubahan' : 'Simpan'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox foto (klik untuk memperbesar) */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-all"
            aria-label="Tutup"
          >
            <X size={24} />
          </button>
          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => (i - 1 + photos.length) % photos.length); }}
                className="absolute left-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-all"
                aria-label="Sebelumnya"
              >
                <ChevronLeft size={28} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => (i + 1) % photos.length); }}
                className="absolute right-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-all"
                aria-label="Berikutnya"
              >
                <ChevronRight size={28} />
              </button>
            </>
          )}
          <div className="max-w-[90vw] max-h-[85vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <img
              src={photos[lightboxIndex].photo_url}
              alt={photos[lightboxIndex].caption || 'Foto aset'}
              className="max-w-full max-h-[78vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="text-center">
              {photos[lightboxIndex].caption && (
                <p className="text-sm text-white/90">{photos[lightboxIndex].caption}</p>
              )}
              {photos.length > 1 && (
                <p className="text-xs text-white/50 font-mono mt-1">{lightboxIndex + 1} / {photos.length}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail Riwayat Pemeliharaan (klik untuk melihat detail) */}
      {selectedExecution && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedExecution(null)} />
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto card animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-ink-950/95 backdrop-blur-xl z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
                  <CheckCircle2 size={18} className="text-primary-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Detail Pemeliharaan</h3>
                  <p className="text-xs text-ink-400">
                    {selectedExecution.schedule?.maintenance_type?.maintenance_name || 'Pemeliharaan'} — {formatDateID(selectedExecution.execution_date)}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedExecution(null)} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`badge ${selectedExecution.is_draft ? 'badge-yellow' : 'badge-green'}`}>
                  <CheckCircle2 size={12} className="mr-1" />
                  {selectedExecution.is_draft ? 'Draft' : 'Selesai'}
                </span>
                {isVendorVisitExecution(selectedExecution) && (
                  <span className="badge badge-purple text-[10px]">
                    <Package size={10} className="mr-1" />
                    Kunjungan Vendor
                  </span>
                )}
                {isKerjaBaktiExecution(selectedExecution) && (
                  <span className="badge badge-yellow text-[10px]">
                    <Package size={10} className="mr-1" />
                    Kerja Bakti
                  </span>
                )}
                {selectedExecution.assessment_result && (
                  <span className="badge badge-blue">
                    <CheckCircle2 size={12} className="mr-1" />
                    Sudah Dinilai
                  </span>
                )}
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Jenis Pemeliharaan</p>
                  <p className="text-sm text-white font-medium">
                    {selectedExecution.schedule?.maintenance_type?.maintenance_name || '-'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Tanggal Pelaksanaan</p>
                  <p className="text-sm text-white font-medium">{formatDateID(selectedExecution.execution_date)}</p>
                </div>
                {selectedExecution.odometer_at_execution && (
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Odometer</p>
                    <p className="text-sm text-white font-medium">
                      {Number(selectedExecution.odometer_at_execution).toLocaleString('id-ID')} km
                    </p>
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

              {/* Hasil Pelaksanaan */}
              <div>
                <label className="text-xs font-semibold text-ink-400 uppercase">Hasil Pelaksanaan</label>
                <p className="text-sm text-ink-200 mt-1 whitespace-pre-wrap bg-white/[0.03] border border-white/5 rounded-lg p-3">
                  {selectedExecution.result || '-'}
                </p>
              </div>

              {/* Catatan */}
              {selectedExecution.notes && (
                <div>
                  <label className="text-xs font-semibold text-ink-400 uppercase">Catatan</label>
                  <p className="text-sm text-ink-200 mt-1 whitespace-pre-wrap bg-white/[0.03] border border-white/5 rounded-lg p-3">
                    {selectedExecution.notes}
                  </p>
                </div>
              )}

              {/* Info Kunjungan Vendor */}
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

              {/* Info Kerja Bakti */}
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

              {/* Hasil Penilaian */}
              {selectedExecution.assessment_result && (
                <div className="p-4 rounded-lg bg-primary-500/5 border border-primary-500/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-primary-400" />
                    <p className="text-sm font-semibold text-primary-300">Hasil Penilaian HRD / Teknisi</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge badge-blue">
                      {selectedExecution.assessment_result === 'normal' && 'Normal'}
                      {selectedExecution.assessment_result === 'perlu_perbaikan' && 'Perlu Perbaikan'}
                      {selectedExecution.assessment_result === 'perlu_penggantian' && 'Perlu Penggantian'}
                      {selectedExecution.assessment_result === 'perlu_monitoring' && 'Perlu Monitoring'}
                      {selectedExecution.assessment_result === 'lainnya' && 'Lainnya'}
                    </span>
                    {selectedExecution.assessor?.full_name && (
                      <span className="text-xs text-ink-400">
                        oleh <span className="text-white font-medium">{selectedExecution.assessor.full_name}</span>
                      </span>
                    )}
                  </div>
                  {selectedExecution.assessment_notes && (
                    <p className="text-sm text-ink-200 whitespace-pre-wrap bg-white/[0.03] border border-white/5 rounded-lg p-3">
                      {selectedExecution.assessment_notes}
                    </p>
                  )}
                </div>
              )}

              {/* Foto Bukti */}
              {selectedExecution.photos && selectedExecution.photos.length > 0 ? (
                <div>
                  <label className="text-xs font-semibold text-ink-400 uppercase">Foto Bukti Pelaksanaan ({selectedExecution.photos.length})</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                    {selectedExecution.photos.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full h-32 rounded-lg overflow-hidden border border-white/10 hover:border-primary-500/40 transition-all"
                      >
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

              {/* Footer */}
              <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                <button onClick={() => setSelectedExecution(null)} className="btn-secondary text-sm">
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail riwayat (klik baris untuk melihat detail) */}
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${selectedLog.action_type === 'SERVICE' ? 'bg-warning-500/10 border-warning-500/20' : 'bg-primary-500/10 border-primary-500/20'}`}>
                  {selectedLog.action_type === 'SERVICE' ? <Wrench size={18} className="text-warning-400" /> : <FileText size={18} className="text-primary-400" />}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Detail Riwayat</h3>
                  <p className="text-xs text-ink-400 font-mono">{selectedLog.action_type}</p>
                </div>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Deskripsi</p>
                <p className="text-sm text-white whitespace-pre-wrap">{selectedLog.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Oleh</p>
                  <p className="text-sm text-white">{selectedLog.user?.full_name || 'System'}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Waktu</p>
                  <p className="text-sm text-white">{new Date(selectedLog.created_at).toLocaleString('id-ID')}</p>
                </div>
                {selectedLog.updated_at && new Date(selectedLog.updated_at) > new Date(selectedLog.created_at) && (
                  <div className="p-3 rounded-lg bg-warning-500/[0.05] border border-warning-500/15">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Terakhir Diubah</p>
                    <p className="text-sm text-white">{new Date(selectedLog.updated_at).toLocaleString('id-ID')}</p>
                  </div>
                )}
              </div>
              {selectedLog.reason && (
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">Catatan</p>
                  <p className="text-sm text-ink-200 whitespace-pre-wrap">{selectedLog.reason}</p>
                </div>
              )}
              {selectedLog.new_data && Object.keys(selectedLog.new_data).length > 0 && (
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-2">Detail Perubahan</p>
                  <div className="space-y-1.5">
                    {Object.entries(selectedLog.new_data).filter(([k]) => k !== 'photos' && k !== 'description' && k !== 'vendor_id').map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3 text-sm">
                        <span className="text-ink-400 capitalize">{formatLogLabel(k)}</span>
                        <span className="text-white text-right">{formatLogValue(k, v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(selectedLog.new_data?.photos) && selectedLog.new_data.photos.length > 0 && (() => {
                const grouped = groupServicePhotos(selectedLog.new_data.photos);
                return (
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-2">Foto Service ({selectedLog.new_data.photos.length})</p>
                    {Object.entries(grouped).map(([labelKey, items]) => items.length > 0 && (
                      <div key={labelKey} className="mb-3 last:mb-0">
                        {(labelKey || Object.keys(grouped).length > 1) && (
                          <p className="text-xs text-ink-400 mb-1.5">{servicePhotoGroupTitle(labelKey)} ({items.length})</p>
                        )}
                        <div className="space-y-2">
                          {items.map((item, idx) => (
                            <a
                              key={idx}
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 p-2 rounded-lg border border-white/10 hover:border-primary-500/40 transition-all"
                              title={item.caption || 'Buka foto di tab baru'}
                            >
                              <img
                                src={item.url}
                                alt={item.caption || `Foto ${idx + 1}`}
                                className="w-20 h-20 object-cover rounded-md shrink-0"
                              />
                              <span className="flex-1 min-w-0 text-sm text-ink-200 break-words">
                                {item.caption || <span className="italic text-ink-500">Tanpa keterangan</span>}
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {selectedLog.old_data && selectedLog.new_data && (() => {
                const changed = Object.entries(selectedLog.old_data)
                  .filter(([k, v]) => k !== 'photos' && k !== 'description' && k !== 'vendor_id')
                  .filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(selectedLog.new_data?.[k]));
                if (changed.length === 0) return null;
                return (
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500">Data Sebelum</p>
                    <p className="text-xs text-ink-500 mb-2">Nilai sebelum edit terakhir — hanya field yang berubah</p>
                    <div className="space-y-1.5">
                      {changed.map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-3 text-sm">
                          <span className="text-ink-400 capitalize">{formatLogLabel(k)}</span>
                          <span className="text-ink-300 text-right">{formatLogValue(k, v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {canEdit && selectedLog.action_type === 'SERVICE' && (
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    onClick={() => { setSelectedLog(null); openEditServiceModal(selectedLog); }}
                    className="btn-secondary text-sm"
                  >
                    <Edit size={14} />
                    Edit Catatan
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
