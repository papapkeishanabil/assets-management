import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, X, Upload, Check } from 'lucide-react';

export default function AssetFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isEdit = !!id;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [users, setUsers] = useState([]);
  const [previewCode, setPreviewCode] = useState('');
  const [photos, setPhotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [form, setForm] = useState({
    asset_code: '',
    asset_name: '',
    category_id: '',
    brand: '',
    model: '',
    serial_number: '',
    manufacture_year: '',
    purchase_date: '',
    purchase_price: '',
    vendor_id: '',
    invoice_number: '',
    warranty_start_date: '',
    warranty_end_date: '',
    location_id: '',
    department_id: '',
    responsible_user_id: '',
    condition_id: '',
    status_id: '',
    vehicle_registration_number: '',
    engine_number: '',
    chassis_number: '',
    current_odometer: '',
    current_operating_hours: '',
    technical_specification: '',
    notes: '',
    is_active: true,
    is_draft: false
  });

  const isVehicle = form.category_id && (categories.find(c => c.id === form.category_id)?.category_code === 'MBL' || categories.find(c => c.id === form.category_id)?.category_code === 'MTR');

  useEffect(() => {
    fetchMasterData();
    if (isEdit) {
      fetchAsset();
    }
  }, [id]);

  useEffect(() => {
    if (form.category_id && form.asset_code === '') {
      generateAssetCode();
    }
  }, [form.category_id]);

  const fetchMasterData = async () => {
    const [catRes, locRes, deptRes, venRes, condRes, statRes, userRes] = await Promise.all([
      supabase.from('asset_categories').select('*').eq('is_active', true).order('display_order'),
      supabase.from('asset_locations').select('*').eq('is_active', true).order('location_name'),
      supabase.from('departments').select('*').eq('is_active', true).order('department_name'),
      supabase.from('vendors').select('*').eq('is_active', true).order('vendor_name'),
      supabase.from('asset_conditions').select('*').eq('is_active', true).order('display_order'),
      supabase.from('asset_statuses').select('*').eq('is_active', true).order('display_order'),
      supabase.from('user_profiles').select('id, full_name').eq('account_status', 'ACTIVE').order('full_name')
    ]);

    if (catRes.data) setCategories(catRes.data);
    if (locRes.data) setLocations(locRes.data);
    if (deptRes.data) setDepartments(deptRes.data);
    if (venRes.data) setVendors(venRes.data);
    if (condRes.data) setConditions(condRes.data);
    if (statRes.data) setStatuses(statRes.data);
    if (userRes.data) setUsers(userRes.data);
  };

  const fetchAsset = async () => {
    try {
      const { data, error } = await supabase.from('assets').select('*').eq('id', id).single();
      if (error) throw error;
      setForm({
        asset_code: data.asset_code || '',
        asset_name: data.asset_name || '',
        category_id: data.category_id || '',
        brand: data.brand || '',
        model: data.model || '',
        serial_number: data.serial_number || '',
        manufacture_year: data.manufacture_year || '',
        purchase_date: data.purchase_date || '',
        purchase_price: data.purchase_price || '',
        vendor_id: data.vendor_id || '',
        invoice_number: data.invoice_number || '',
        warranty_start_date: data.warranty_start_date || '',
        warranty_end_date: data.warranty_end_date || '',
        location_id: data.location_id || '',
        department_id: data.department_id || '',
        responsible_user_id: data.responsible_user_id || '',
        condition_id: data.condition_id || '',
        status_id: data.status_id || '',
        vehicle_registration_number: data.vehicle_registration_number || '',
        engine_number: data.engine_number || '',
        chassis_number: data.chassis_number || '',
        current_odometer: data.current_odometer || '',
        current_operating_hours: data.current_operating_hours || '',
        technical_specification: data.technical_specification || '',
        notes: data.notes || '',
        is_active: data.is_active,
        is_draft: data.is_draft
      });

      const { data: photosData } = await supabase
        .from('asset_photos')
        .select('*')
        .eq('asset_id', id)
        .order('created_at');
      if (photosData) setPhotos(photosData);
    } catch (error) {
      toast.error('Gagal memuat data aset');
      navigate('/assets');
    }
  };

  const generateAssetCode = async () => {
    const category = categories.find(c => c.id === form.category_id);
    if (!category) return;

    const year = new Date().getFullYear();
    const { data } = await supabase.rpc('generate_asset_code', {
      cat_code: category.category_code,
      year_val: year
    });
    if (data) {
      setPreviewCode(data);
      if (!isEdit) {
        setForm(prev => ({ ...prev, asset_code: data }));
      }
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `asset-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('assets')
        .getPublicUrl(filePath);

      if (isEdit) {
        const { error: dbError } = await supabase
          .from('asset_photos')
          .insert([{
            asset_id: id,
            photo_url: publicUrl,
            photo_type: 'foto',
            uploaded_by: profile?.id
          }]);

        if (dbError) throw dbError;

        const { data: photosData } = await supabase
          .from('asset_photos')
          .select('*')
          .eq('asset_id', id)
          .order('created_at');
        if (photosData) setPhotos(photosData);
      } else {
        setPhotos(prev => [...prev, {
          photo_url: publicUrl,
          photo_type: 'foto',
          is_primary: prev.length === 0
        }]);
      }

      toast.success('Foto berhasil diupload');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Gagal upload foto: ' + error.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!confirm('Yakin ingin menghapus foto ini?')) return;

    try {
      if (photoId) {
        const { error } = await supabase
          .from('asset_photos')
          .delete()
          .eq('id', photoId);
        if (error) throw error;
      }
      setPhotos(prev => prev.filter(p => p.id !== photoId));
      toast.success('Foto berhasil dihapus');
    } catch (error) {
      toast.error('Gagal menghapus foto');
    }
  };

  const handleSubmit = async (e, asDraft = false) => {
    e.preventDefault();
    if (!form.asset_name || !form.category_id) {
      toast.error('Nama aset dan kategori wajib diisi');
      return;
    }

    setLoading(true);
    try {
      const nullFields = ['category_id', 'vendor_id', 'location_id', 'department_id', 'responsible_user_id', 'condition_id', 'status_id', 'purchase_date', 'warranty_start_date', 'warranty_end_date', 'current_odometer', 'current_operating_hours'];
      const cleanedForm = { ...form };
      nullFields.forEach(field => {
        if (cleanedForm[field] === '') {
          cleanedForm[field] = null;
        }
      });

      const dataToSubmit = {
        ...cleanedForm,
        manufacture_year: form.manufacture_year ? parseInt(form.manufacture_year) : null,
        purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
        current_odometer: form.current_odometer ? parseFloat(form.current_odometer) : null,
        current_operating_hours: form.current_operating_hours ? parseFloat(form.current_operating_hours) : null,
        is_draft: asDraft,
        created_by: profile?.id
      };

      let assetId = id;

      if (isEdit) {
        const { error } = await supabase.from('assets').update(dataToSubmit).eq('id', id);
        if (error) throw error;
        toast.success(asDraft ? 'Draft berhasil disimpan' : 'Aset berhasil diperbarui');
      } else {
        const { data, error } = await supabase.from('assets').insert([dataToSubmit]).select('id').single();
        if (error) throw error;
        assetId = data.id;

        if (photos.length > 0) {
          const photoInserts = photos.map(photo => ({
            asset_id: assetId,
            photo_url: photo.photo_url,
            photo_type: photo.photo_type || 'foto',
            uploaded_by: profile?.id
          }));

          const { error: photoError } = await supabase
            .from('asset_photos')
            .insert(photoInserts);

          if (photoError) throw photoError;
        }

        toast.success(asDraft ? 'Draft berhasil disimpan' : 'Aset berhasil ditambahkan');
      }

      navigate('/assets');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const steps = ['Identitas', 'Pembelian', 'Penempatan', 'Teknis', 'Foto', 'Review'];

  const ReviewField = ({ label, value }) => (
    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
      <p className="text-[11px] font-mono uppercase tracking-wider text-ink-500 mb-1">{label}</p>
      <p className="font-medium text-white text-sm">{value || '-'}</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/assets')} className="p-2 hover:bg-white/5 rounded-md transition-all">
          <ArrowLeft size={18} className="text-ink-300" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">{isEdit ? 'Edit Aset' : 'Tambah Aset Baru'}</h1>
          <p className="text-sm text-ink-400">Lengkapi data aset per step</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="card">
        <div className="flex items-center justify-between overflow-x-auto">
          {steps.map((label, idx) => (
            <div key={idx} className="flex items-center gap-2 flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                step > idx + 1
                  ? 'bg-success-500 text-white shadow-glow-emerald'
                  : step === idx + 1
                    ? 'bg-gradient-to-br from-primary-500 to-indigo-600 text-white shadow-glow-blue'
                    : 'bg-white/5 border border-white/10 text-ink-500'
              }`}>
                {step > idx + 1 ? <Check size={14} /> : idx + 1}
              </div>
              <span className={`text-xs hidden md:block ${step >= idx + 1 ? 'text-white font-medium' : 'text-ink-500'}`}>{label}</span>
              {idx < steps.length - 1 && (
                <div className={`w-6 md:w-12 h-px ${step > idx + 1 ? 'bg-success-500/40' : 'bg-white/10'} hidden md:block`}></div>
              )}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)}>
        <div className="card space-y-5">
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="section-title text-base">Identitas Aset</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Nama Aset <span className="text-danger-400">*</span></label>
                  <input type="text" name="asset_name" className="input" value={form.asset_name} onChange={handleChange} required />
                </div>
                <div>
                  <label className="label">Kode Aset</label>
                  <input type="text" name="asset_code" className="input font-mono" value={form.asset_code} onChange={handleChange} readOnly={!isEdit} />
                  {previewCode && <p className="text-xs text-ink-500 mt-1.5 font-mono">Preview: <span className="text-primary-300">{previewCode}</span></p>}
                </div>
                <div>
                  <label className="label">Kategori <span className="text-danger-400">*</span></label>
                  <select name="category_id" className="input" value={form.category_id} onChange={handleChange} required>
                    <option value="">Pilih kategori...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.category_name} ({cat.category_code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Merek</label>
                  <input type="text" name="brand" className="input" value={form.brand} onChange={handleChange} />
                </div>
                <div>
                  <label className="label">Model</label>
                  <input type="text" name="model" className="input" value={form.model} onChange={handleChange} />
                </div>
                <div>
                  <label className="label">Nomor Seri</label>
                  <input type="text" name="serial_number" className="input font-mono" value={form.serial_number} onChange={handleChange} />
                </div>
                <div>
                  <label className="label">Tahun Produksi</label>
                  <input type="number" name="manufacture_year" className="input" value={form.manufacture_year} onChange={handleChange} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="section-title text-base">Pembelian & Garansi</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Tanggal Pembelian</label>
                  <input type="date" name="purchase_date" className="input" value={form.purchase_date} onChange={handleChange} />
                </div>
                <div>
                  <label className="label">Harga Pembelian</label>
                  <input type="number" name="purchase_price" className="input" value={form.purchase_price} onChange={handleChange} />
                </div>
                <div>
                  <label className="label">Vendor</label>
                  <select name="vendor_id" className="input" value={form.vendor_id} onChange={handleChange}>
                    <option value="">Pilih vendor...</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.vendor_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Nomor Invoice</label>
                  <input type="text" name="invoice_number" className="input font-mono" value={form.invoice_number} onChange={handleChange} />
                </div>
                <div>
                  <label className="label">Awal Garansi</label>
                  <input type="date" name="warranty_start_date" className="input" value={form.warranty_start_date} onChange={handleChange} />
                </div>
                <div>
                  <label className="label">Akhir Garansi</label>
                  <input type="date" name="warranty_end_date" className="input" value={form.warranty_end_date} onChange={handleChange} />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="section-title text-base">Penempatan</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Lokasi</label>
                  <select name="location_id" className="input" value={form.location_id} onChange={handleChange}>
                    <option value="">Pilih lokasi...</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.location_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Departemen</label>
                  <select name="department_id" className="input" value={form.department_id} onChange={handleChange}>
                    <option value="">Pilih departemen...</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.department_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Penanggung Jawab</label>
                  <select name="responsible_user_id" className="input" value={form.responsible_user_id} onChange={handleChange}>
                    <option value="">Pilih penanggung jawab...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Kondisi</label>
                  <select name="condition_id" className="input" value={form.condition_id} onChange={handleChange}>
                    <option value="">Pilih kondisi...</option>
                    {conditions.map(c => (
                      <option key={c.id} value={c.id}>{c.condition_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select name="status_id" className="input" value={form.status_id} onChange={handleChange}>
                    <option value="">Pilih status...</option>
                    {statuses.map(s => (
                      <option key={s.id} value={s.id}>{s.status_name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="section-title text-base">Data Teknis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isVehicle && (
                  <>
                    <div>
                      <label className="label">Nomor Polisi</label>
                      <input type="text" name="vehicle_registration_number" className="input font-mono" value={form.vehicle_registration_number} onChange={handleChange} />
                    </div>
                    <div>
                      <label className="label">Nomor Mesin</label>
                      <input type="text" name="engine_number" className="input font-mono" value={form.engine_number} onChange={handleChange} />
                    </div>
                    <div>
                      <label className="label">Nomor Rangka</label>
                      <input type="text" name="chassis_number" className="input font-mono" value={form.chassis_number} onChange={handleChange} />
                    </div>
                    <div>
                      <label className="label">Kilometer Saat Ini</label>
                      <input type="number" name="current_odometer" className="input" value={form.current_odometer} onChange={handleChange} />
                    </div>
                  </>
                )}
                <div className="md:col-span-2">
                  <label className="label">Spesifikasi Teknis</label>
                  <textarea name="technical_specification" className="input" rows="4" value={form.technical_specification} onChange={handleChange}></textarea>
                </div>
                <div className="md:col-span-2">
                  <label className="label">Catatan</label>
                  <textarea name="notes" className="input" rows="3" value={form.notes} onChange={handleChange}></textarea>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="section-title text-base">Foto Aset</h3>

              <div className="border-2 border-dashed border-white/10 rounded-lg p-6 text-center hover:border-primary-500/50 hover:bg-primary-500/[0.03] transition-all">
                <input
                  type="file"
                  id="photo-upload"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={uploadingPhoto}
                />
                <label htmlFor="photo-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 rounded-full bg-primary-500/10 border border-primary-500/20">
                      <Upload size={20} className="text-primary-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {uploadingPhoto ? 'Mengupload...' : 'Klik untuk upload foto'}
                      </p>
                      <p className="text-xs text-ink-500 mt-1 font-mono">PNG, JPG, JPEG · MAX 5MB</p>
                    </div>
                  </div>
                </label>
              </div>

              {photos.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {photos.map((photo, idx) => (
                    <div key={photo.id || idx} className="relative group rounded-lg overflow-hidden">
                      <img
                        src={photo.photo_url}
                        alt={`Foto aset ${idx + 1}`}
                        className="w-full h-40 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(photo.id)}
                          className="p-2 bg-danger-500/90 text-white rounded-md hover:bg-danger-500"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      {photo.is_primary && (
                        <span className="absolute top-2 left-2 badge badge-yellow text-[10px]">Utama</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="section-title text-base">Review Data</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ReviewField label="Nama Aset" value={form.asset_name} />
                <ReviewField label="Kode Aset" value={form.asset_code} />
                <ReviewField label="Kategori" value={categories.find(c => c.id === form.category_id)?.category_name} />
                <ReviewField label="Merek" value={form.brand} />
                <ReviewField label="Lokasi" value={locations.find(l => l.id === form.location_id)?.location_name} />
                <ReviewField label="Departemen" value={departments.find(d => d.id === form.department_id)?.department_name} />
                <ReviewField label="Kondisi" value={conditions.find(c => c.id === form.condition_id)?.condition_name} />
                <ReviewField label="Status" value={statuses.find(s => s.id === form.status_id)?.status_name} />
                <ReviewField label="Foto" value={`${photos.length} foto`} />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <div>
              {step > 1 && (
                <button type="button" onClick={() => setStep(step - 1)} className="btn-secondary">
                  Kembali
                </button>
              )}
            </div>
            <div className="flex gap-3">
              {step < 6 ? (
                <button type="button" onClick={() => setStep(step + 1)} className="btn-primary">
                  Lanjut
                </button>
              ) : (
                <>
                  <button type="button" onClick={(e) => handleSubmit(e, true)} className="btn-secondary" disabled={loading}>
                    Simpan Draft
                  </button>
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? (
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
                        Simpan Aset
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
