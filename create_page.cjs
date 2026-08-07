const fs = require('fs');

const content = `import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Save, X, Calendar, Trash2, Plus } from 'lucide-react';
import { PPM_MEETING_STATUS, PPM_FILE_SIZE_LIMIT, PPM_ALLOWED_EXTENSIONS } from '../lib/constants';
import { generateMeetingCode, uploadPPMDocument } from '../lib/ppm-helpers';

export default function PPMCreateMeetingPage() {
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    title: '',
    meeting_date: '',
    meeting_time: '',
    moderator_id: '',
    notes: ''
  });
  const [poItems, setPoItems] = useState([
    { id: 1, po_number: '', customer_name: '', project_name: '', description: '', deadline: '', document: null, documentPreview: null, uploading: false }
  ]);

  const canCreate = role && ['super_admin', 'hrd', 'direksi'].includes(role.role_name);
  const fileInputRef = useRef(null);

  useEffect(() => {
    supabase.from('user_profiles').select('id, full_name').eq('account_status', 'ACTIVE').order('full_name').then(({ data }) => { if (data) setUsers(data); });
  }, []);

  const addPOItem = () => {
    setPoItems([...poItems, { id: Date.now(), po_number: '', customer_name: '', project_name: '', description: '', deadline: '', document: null, documentPreview: null, uploading: false }]);
  };

  const removePOItem = (id) => {
    if (poItems.length === 1) { toast.error('Minimal satu PO harus ditambahkan'); return; }
    setPoItems(poItems.filter(item => item.id !== id));
  };

  const updatePOItem = (id, field, value) => {
    setPoItems(poItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleDocumentChange = async (e, poId) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!PPM_ALLOWED_EXTENSIONS.includes(ext)) { toast.error('Dokumen harus JPG, PNG, atau PDF'); return; }
    if (file.size > PPM_FILE_SIZE_LIMIT) { toast.error('Ukuran file maksimal 5MB'); return; }
    setPoItems(poItems.map(item => item.id === poId ? { ...item, uploading: true } : item));
    try {
      const uploadResult = await uploadPPMDocument(file);
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      setPoItems(poItems.map(item => item.id === poId ? { ...item, document: uploadResult, documentPreview: preview } : item));
      toast.success('Dokumen berhasil diupload');
    } catch (error) {
      toast.error('Gagal upload: ' + error.message);
    } finally {
      setPoItems(poItems.map(item => item.id === poId ? { ...item, uploading: false } : item));
    }
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const validateForm = () => {
    if (!form.title.trim()) { toast.error('Judul meeting wajib diisi'); return false; }
    if (!form.meeting_date) { toast.error('Tanggal meeting wajib diisi'); return false; }
    for (const item of poItems) {
      if (!item.po_number.trim()) { toast.error('Nomor PO wajib diisi'); return false; }
      if (!item.customer_name.trim()) { toast.error('Nama customer wajib diisi'); return false; }
      if (!item.document) { toast.error('Dokumen PO harus diupload'); return false; }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const meetingCode = await generateMeetingCode(new Date(form.meeting_date).getFullYear());
      const { data: meetingData, error: meetingError } = await supabase.from('ppm_meetings').insert([{
        meeting_code: meetingCode,
        title: form.title,
        meeting_date: form.meeting_date,
        meeting_time: form.meeting_time || null,
        moderator_id: form.moderator_id || null,
        notes: form.notes || null,
        status: PPM_MEETING_STATUS.SCHEDULED,
        created_by: profile?.id
      }]).select('id').single();
      if (meetingError) throw meetingError;
      const meetingId = meetingData.id;
      const poInserts = poItems.map((item, index) => ({
        meeting_id: meetingId,
        po_number: item.po_number,
        customer_name: item.customer_name,
        project_name: item.project_name || null,
        description: item.description || null,
        deadline: item.deadline || null,
        document_url: item.document.url,
        document_type: item.document.type,
        document_name: item.document.name,
        status: 'NOT_STARTED',
        sort_order: index
      }));
      const { error: poError } = await supabase.from('ppm_meeting_pos').insert(poInserts);
      if (poError) throw poError;
      toast.success('Meeting berhasil dibuat');
      navigate('/ppm/' + meetingId);
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast.error('Gagal membuat meeting. Silakan coba kembali.');
    } finally {
      setSaving(false);
    }
  };

  if (!canCreate) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="empty-state-icon"><Calendar size={48} /></div>
          <h3 className="empty-state-title">Akses Ditolak</h3>
          <p className="empty-state-text">Anda tidak memiliki permission untuk membuat meeting PPM.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/ppm')} className="btn-ghost btn-sm"><X size={16} /></button>
            <div>
              <h1 className="page-title mb-1">Buat Meeting Baru</h1>
              <p className="text-sm text-ink-400">Isi formulir di bawah untuk membuat meeting Production Order baru.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="card">
          <div className="card-header"><h2 className="card-title">Informasi Meeting</h2></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Judul Meeting *</label>
              <input type="text" name="title" value={form.title} onChange={handleChange} className="input" disabled={saving} />
            </div>
            <div>
              <label className="label">Tanggal *</label>
              <input type="date" name="meeting_date" value={form.meeting_date} onChange={handleChange} className="input" disabled={saving} />
            </div>
            <div>
              <label className="label">Waktu</label>
              <input type="time" name="meeting_time" value={form.meeting_time} onChange={handleChange} className="input" disabled={saving} />
            </div>
            <div>
              <label className="label">Moderator</label>
              <select name="moderator_id" value={form.moderator_id} onChange={handleChange} className="input" disabled={saving}>
                <option value="">Pilih moderator</option>
                {users.map(u => (<option key={u.id} value={u.id}>{u.full_name}</option>))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Catatan</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} className="input" rows={3} disabled={saving} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2 className="card-title">Production Order</h2></div>
          <div className="space-y-4">
            {poItems.map((item, index) => (
              <div key={item.id} className="border border-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-white">PO #{index + 1}</h3>
                  {poItems.length > 1 && (
                    <button onClick={() => removePOItem(item.id)} className="text-ink-400 hover:text-red-400" disabled={saving}><Trash2 size={16} /></button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Nomor PO *</label>
                    <input type="text" value={item.po_number} onChange={(e) => updatePOItem(item.id, 'po_number', e.target.value)} className="input" disabled={saving} />
                  </div>
                  <div>
                    <label className="label">Nama Customer / Client *</label>
                    <input type="text" value={item.customer_name} onChange={(e) => updatePOItem(item.id, 'customer_name', e.target.value)} className="input" disabled={saving} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Nama Project</label>
                    <input type="text" value={item.project_name} onChange={(e) => updatePOItem(item.id, 'project_name', e.target.value)} className="input" disabled={saving} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Description</label>
                    <textarea value={item.description} onChange={(e) => updatePOItem(item.id, 'description', e.target.value)} className="input" rows={2} disabled={saving} />
                  </div>
                  <div>
                    <label className="label">Deadline</label>
                    <input type="date" value={item.deadline} onChange={(e) => updatePOItem(item.id, 'deadline', e.target.value)} className="input" disabled={saving} />
                  </div>
                  <div>
                    <label className="label">Dokumen PO *</label>
                    <input ref={fileInputRef} type="file" onChange={(e) => handleDocumentChange(e, item.id)} accept=".jpg,.jpeg,.png,.pdf" className="hidden" disabled={saving} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary w-full" disabled={saving || item.uploading}>
                      {item.uploading ? 'Mengupload...' : (item.document ? 'Ganti Dokumen' : 'Upload Dokumen')}
                    </button>
                    {item.documentPreview && (
                      <div className="mt-2">
                        <img src={item.documentPreview} alt="Preview" className="max-h-20 rounded border border-white/10 object-contain" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <button onClick={addPOItem} className="btn-secondary" disabled={saving}><Plus size={16} />+ Tambah PO</button>
          </div>
          <p className="text-xs text-ink-400 mt-3">Format dokumen yang didukung: JPG, PNG, PDF (maksimal 5MB)</p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4">
        <button onClick={() => navigate('/ppm')} className="btn-secondary" disabled={saving}><X size={16} />Batal</button>
        <button onClick={handleSubmit} className="btn-primary" disabled={saving}>
          {saving ? 'Menyimpan...' : (<><Save size={16} />Simpan Meeting</>)}
        </button>
      </div>
    </div>
  );
}
`;

fs.writeFileSync('E:\\PROJECT AI\\Harmas Assets Management\\src\\pages\\PPMCreateMeetingPage.jsx', content);
console.log('File created successfully');
