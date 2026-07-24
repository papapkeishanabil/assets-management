import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { ArrowLeft, Edit, Upload, FileText, Trash2, Wrench, X, Save, Package } from 'lucide-react';

export default function AssetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [responsibleAssignments, setResponsibleAssignments] = useState([]);
  const [activeTab, setActiveTab] = useState('info');
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    description: '',
    service_date: new Date().toISOString().split('T')[0],
    cost: '',
    vendor_id: '',
    vendor_name: '',
    vendor_mode: 'master',
    notes: ''
  });
  const [savingService, setSavingService] = useState(false);

  const canEdit = role && ['super_admin', 'hrd'].includes(role.role_name);

  useEffect(() => {
    fetchAsset();
    fetchPhotos();
    fetchDocuments();
    fetchLogs();
    fetchVendors();
    fetchResponsibleAssignments();
  }, [id]);

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
        data.location_id ? supabase.from('asset_locations').select('location_name').eq('id', data.location_id).single() : null,
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

  const fetchVendors = async () => {
    const { data } = await supabase
      .from('vendors')
      .select('id, vendor_name, vendor_code, vendor_type, service_type')
      .eq('is_active', true)
      .order('vendor_name', { ascending: true });
    setVendors(data || []);
  };

  const fetchResponsibleAssignments = async () => {
    const { data } = await supabase
      .from('asset_responsible_assignments')
      .select('id, responsibility_type, is_primary, responsible:asset_responsibles(id, responsible_name, role_title, responsible_code)')
      .eq('asset_id', id)
      .order('is_primary', { ascending: false });
    setResponsibleAssignments(data || []);
  };

  const handleServiceSubmit = async (e) => {
    e.preventDefault();
    if (!serviceForm.description) {
      toast.error('Deskripsi service wajib diisi');
      return;
    }

    setSavingService(true);
    try {
      const logDescription = `Perbaikan/Service: ${serviceForm.description}` +
        (serviceForm.vendor_name ? ` (${serviceForm.vendor_name})` : '') +
        (serviceForm.cost ? ` - Biaya: Rp ${parseInt(serviceForm.cost).toLocaleString('id-ID')}` : '');

      const { error } = await supabase.from('asset_activity_logs').insert([{
        asset_id: id,
        user_id: profile?.id,
        action_type: 'SERVICE',
        description: logDescription,
        reason: serviceForm.notes || null,
        new_data: {
          service_date: serviceForm.service_date,
          cost: serviceForm.cost ? parseInt(serviceForm.cost) : null,
          vendor_id: serviceForm.vendor_id || null,
          vendor_name: serviceForm.vendor_name || null
        }
      }]);

      if (error) throw error;

      toast.success('Service berhasil dicatat');
      setShowServiceModal(false);
      setServiceForm({
        description: '',
        service_date: new Date().toISOString().split('T')[0],
        cost: '',
        vendor_id: '',
        vendor_name: '',
        vendor_mode: 'master',
        notes: ''
      });
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

  const tabs = [
    { id: 'info', label: 'Informasi Umum' },
    { id: 'technical', label: 'Data Teknis' },
    { id: 'purchase', label: 'Pembelian & Garansi' },
    { id: 'photos', label: `Foto (${photos.length})` },
    { id: 'documents', label: `Dokumen (${documents.length})` },
    { id: 'activity', label: `Riwayat (${logs.length})` }
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <button onClick={() => navigate('/assets')} className="p-2 hover:bg-white/5 rounded-md transition-all flex-shrink-0">
            <ArrowLeft size={18} className="text-ink-300" />
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-white tracking-tight truncate">{asset.asset_name}</h1>
            <p className="text-sm text-ink-400 font-mono">{asset.asset_code}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {canEdit && (
            <>
              <button onClick={() => setShowServiceModal(true)} className="btn-secondary text-sm">
                <Wrench size={14} />
                Catat Service
              </button>
              <button onClick={() => navigate(`/assets/${id}/edit`)} className="btn-primary text-sm">
                <Edit size={14} />
                Edit
              </button>
            </>
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
              <Field label="Kode Aset" value={asset.asset_code} />
              <Field label="Merek" value={asset.brand} />
              <Field label="Model" value={asset.model} />
              <Field label="Nomor Seri" value={asset.serial_number} />
              <Field label="Tahun Produksi" value={asset.manufacture_year} />
              <Field label="Departemen" value={asset.department?.department_name} />
              <Field label="Penanggung Jawab" value={responsibleNames || asset.responsible?.full_name} />
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
                {photos.map(photo => (
                  <div key={photo.id} className="relative group rounded-lg overflow-hidden">
                    <img src={photo.photo_url} alt={photo.caption || 'Foto aset'} className="w-full h-40 object-cover" />
                    {photo.is_primary && (
                      <span className="absolute top-2 left-2 badge badge-yellow text-[10px]">Utama</span>
                    )}
                    {canEdit && (
                      <button onClick={() => handleDeletePhoto(photo.id)} className="absolute top-2 right-2 p-1.5 bg-danger-500/90 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={12} />
                      </button>
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

        {activeTab === 'activity' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="section-title">
                <Wrench size={16} className="text-primary-400" />
                Riwayat Aktivitas
              </h3>
              {canEdit && (
                <button onClick={() => setShowServiceModal(true)} className="btn-secondary text-sm">
                  <Wrench size={14} />
                  Catat Service
                </button>
              )}
            </div>
            {logs.length === 0 ? (
              <div className="empty-state py-8">
                <div className="empty-state-icon"><FileText size={32} /></div>
                <p className="empty-state-text">Belum ada aktivitas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className={`flex gap-3 p-3 rounded-lg border ${
                    log.action_type === 'SERVICE' ? 'bg-warning-500/[0.05] border-warning-500/15' : 'bg-white/[0.03] border-white/5'
                  }`}>
                    <div className={`p-2 rounded-md flex-shrink-0 ${
                      log.action_type === 'SERVICE' ? 'bg-warning-500/10 border border-warning-500/20' : 'bg-white/5 border border-white/10'
                    }`}>
                      {log.action_type === 'SERVICE' ? (
                        <Wrench size={14} className="text-warning-400" />
                      ) : (
                        <FileText size={14} className="text-ink-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{log.description}</p>
                      <div className="flex items-center flex-wrap gap-2 mt-1.5">
                        {log.action_type === 'SERVICE' && log.new_data && (
                          <>
                            {log.new_data.service_date && (
                              <span className="text-[10px] font-mono bg-warning-500/10 text-warning-300 px-1.5 py-0.5 rounded border border-warning-500/20">
                                {log.new_data.service_date}
                              </span>
                            )}
                            {log.new_data.cost && (
                              <span className="text-[10px] font-mono bg-primary-500/10 text-primary-300 px-1.5 py-0.5 rounded border border-primary-500/20">
                                Rp {log.new_data.cost.toLocaleString('id-ID')}
                              </span>
                            )}
                          </>
                        )}
                        <span className="text-[11px] text-ink-500 font-mono">
                          {log.user?.full_name || 'System'} • {new Date(log.created_at).toLocaleString('id-ID')}
                        </span>
                      </div>
                      {log.reason && <p className="text-xs text-ink-400 mt-1.5">Catatan: {log.reason}</p>}
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
                <h3 className="text-lg font-semibold text-white">Catat Perbaikan/Service</h3>
              </div>
              <button onClick={() => setShowServiceModal(false)} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleServiceSubmit} className="space-y-4">
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
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowServiceModal(false)} className="btn-secondary">Batal</button>
                <button type="submit" className="btn-primary" disabled={savingService}>
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
                      Simpan
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
