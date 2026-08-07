import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../lib/constants';
import {
  FileText, Save, ArrowLeft, X, Calendar,
  User, Building2, FileSignature, AlertCircle
} from 'lucide-react';
import {
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  formatDateID
} from '../../lib/contract-helpers';
import toast from 'react-hot-toast';

export default function ContractFormPage() {
  const { id } = useParams();
  const { profile, role } = useAuth();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contractTypes, setContractTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);

  const [form, setForm] = useState({
    contract_type_id: '',
    title: '',
    description: '',
    employee_id: '',
    vendor_id: '',
    department_id: '',
    start_date: '',
    end_date: '',
    signed_date: '',
    renewal_date: '',
    contract_value: '',
    currency: 'IDR',
    document_url: '',
    document_name: '',
    reminder_days_before: 7,
    contract_status: 'DRAFT',
    responsible_user_id: '',
    notes: ''
  });

  const canManage = role && ['super_admin', 'hrd'].includes(role.role_name);

  useEffect(() => {
    if (!canManage) {
      navigate('/contracts');
      return;
    }
    loadFormData();
  }, []);

  const loadFormData = async () => {
    setLoading(true);
    try {
      // Load contract types
      const { data: types } = await supabase
        .from('contract_types')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('type_name', { ascending: true });
      setContractTypes(types || []);

      // Load employees from employees table (all active)
      const { data: emp } = await supabase
        .from('employees')
        .select('id, employee_code, full_name, employee_type, department_id, position, linked_user_id')
        .eq('employment_status', 'ACTIVE')
        .order('full_name');
      // Map to match expected format: id (employee_id), full_name, department, linked_user_id
      setEmployees((emp || []).map(e => ({
        id: e.id,
        linked_user_id: e.linked_user_id,
        full_name: `${e.full_name}${e.employee_type ? ` (${e.employee_type})` : ''}`,
        email: e.employee_code,
        department: e.position || ''
      })));

      // Load vendors
      const { data: vnd } = await supabase
        .from('vendors')
        .select('id, vendor_code, vendor_name')
        .eq('is_active', true)
        .order('vendor_name');
      setVendors(vnd || []);

      // Load departments
      const { data: dept } = await supabase
        .from('departments')
        .select('id, department_code, department_name')
        .eq('is_active', true)
        .order('department_name');
      setDepartments(dept || []);

      // Load all active users for responsible person
      const { data: usr } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .eq('account_status', 'ACTIVE')
        .order('full_name');
      setUsers(usr || []);

      // If editing, load contract data
      if (isEdit) {
        const { data: contract, error } = await supabase
          .from('contracts')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (contract) {
          setForm({
            contract_type_id: contract.contract_type_id || '',
            title: contract.title || '',
            description: contract.description || '',
            employee_id: contract.employee_ref_id || '', // Use employee_ref_id for dropdown
            vendor_id: contract.vendor_id || '',
            department_id: contract.department_id || '',
            start_date: contract.start_date || '',
            end_date: contract.end_date || '',
            signed_date: contract.signed_date || '',
            renewal_date: contract.renewal_date || '',
            contract_value: contract.contract_value ? String(contract.contract_value) : '',
            currency: contract.currency || 'IDR',
            document_url: contract.document_url || '',
            document_name: contract.document_name || '',
            reminder_days_before: contract.reminder_days_before || 7,
            contract_status: contract.contract_status || 'DRAFT',
            responsible_user_id: contract.responsible_user_id || '',
            notes: contract.notes || ''
          });
        }
      }
    } catch (error) {
      console.error('Error loading form data:', error);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) return;

    // Validasi
    if (!form.contract_type_id) {
      toast.error('Pilih jenis kontrak');
      return;
    }
    if (!form.title.trim()) {
      toast.error('Judul kontrak harus diisi');
      return;
    }
    if (!form.start_date) {
      toast.error('Tanggal mulai harus diisi');
      return;
    }
    if (!form.end_date) {
      toast.error('Tanggal berakhir harus diisi');
      return;
    }
    if (new Date(form.end_date) < new Date(form.start_date)) {
      toast.error('Tanggal berakhir harus setelah tanggal mulai');
      return;
    }

    setSaving(true);
    try {
      const selectedEmployee = employees.find(e => e.id === form.employee_id);
      
      const contractData = {
        contract_type_id: form.contract_type_id,
        title: form.title.trim(),
        description: form.description || null,
        employee_id: selectedEmployee?.linked_user_id || null,
        employee_ref_id: form.employee_id || null,
        vendor_id: form.vendor_id || null,
        department_id: form.department_id || null,
        start_date: form.start_date,
        end_date: form.end_date,
        signed_date: form.signed_date || null,
        renewal_date: form.renewal_date || null,
        contract_value: form.contract_value ? parseFloat(form.contract_value) : null,
        currency: form.currency,
        document_url: form.document_url || null,
        document_name: form.document_name || null,
        reminder_days_before: parseInt(form.reminder_days_before) || 7,
        contract_status: form.contract_status,
        responsible_user_id: form.responsible_user_id || null,
        notes: form.notes || null
      };

      if (isEdit) {
        // Update existing contract
        const { error } = await supabase
          .from('contracts')
          .update(contractData)
          .eq('id', id);

        if (error) throw error;
        toast.success('Kontrak berhasil diperbarui');
        navigate(`/contracts/${id}`);
      } else {
        // Generate contract number
        const selectedType = contractTypes.find(t => t.id === form.contract_type_id);
        const category = selectedType?.category || 'OTHER';
        const year = new Date().getFullYear();
        
        const { data: numData, error: numError } = await supabase
          .rpc('generate_contract_number', { category, year_val: year });

        if (numError) throw numError;

        contractData.contract_number = numData;
        contractData.created_by = profile.id;

        const { data: newContract, error } = await supabase
          .from('contracts')
          .insert(contractData)
          .select()
          .single();

        if (error) throw error;
        toast.success('Kontrak berhasil dibuat');
        navigate(`/contracts/${newContract.id}`);
      }
    } catch (error) {
      console.error('Error saving contract:', error);
      toast.error('Gagal menyimpan kontrak');
    } finally {
      setSaving(false);
    }
  };

  const getSelectedCategory = () => {
    const selected = contractTypes.find(t => t.id === form.contract_type_id);
    return selected?.category || '';
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/contracts')}
            className="p-2 text-ink-400 hover:text-white hover:bg-white/5 rounded-md transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {isEdit ? 'Edit Kontrak' : 'Tambah Kontrak Baru'}
            </h1>
            <p className="text-ink-400 text-sm mt-1">
              {isEdit ? 'Perbarui informasi kontrak' : 'Buat kontrak baru untuk karyawan atau vendor'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informasi Dasar */}
        <div className="card p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileText size={18} className="text-primary-400" />
            Informasi Kontrak
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-ink-300 mb-1.5">
                Judul Kontrak <span className="text-danger-400">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Contoh: Kontrak Kerja Ananda, Maintenance Mesin CNC"
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-ink-500 focus:outline-none focus:border-primary-500/50 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">
                Jenis Kontrak <span className="text-danger-400">*</span>
              </label>
              <select
                value={form.contract_type_id}
                onChange={(e) => handleChange('contract_type_id', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer"
                required
              >
                <option value="" className="bg-ink-900">Pilih jenis kontrak</option>
                {['EMPLOYEE', 'VENDOR', 'OTHER'].map(cat => {
                  const catLabel = cat === 'EMPLOYEE' ? 'Karyawan' : cat === 'VENDOR' ? 'Vendor' : 'Lainnya';
                  const filtered = contractTypes.filter(t => t.category === cat);
                  if (filtered.length === 0) return null;
                  return (
                    <optgroup key={cat} label={catLabel} className="bg-ink-900">
                      {filtered.map(t => (
                        <option key={t.id} value={t.id} className="bg-ink-900">{t.type_name}</option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">Status Kontrak</label>
              <select
                value={form.contract_status}
                onChange={(e) => handleChange('contract_status', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer"
              >
                {Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value} className="bg-ink-900">{label}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-ink-300 mb-1.5">Deskripsi</label>
              <textarea
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={2}
                placeholder="Deskripsi kontrak..."
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-ink-500 focus:outline-none focus:border-primary-500/50 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-all resize-none"
              />
            </div>
          </div>
        </div>

        {/* Pihak Terkait */}
        <div className="card p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <User size={18} className="text-primary-400" />
            Pihak Terkait
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">Karyawan</label>
              <select
                value={form.employee_id}
                onChange={(e) => {
                  handleChange('employee_id', e.target.value);
                  if (e.target.value) handleChange('vendor_id', '');
                }}
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer"
              >
                <option value="" className="bg-ink-900">Pilih karyawan (opsional)</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id} className="bg-ink-900">
                    {emp.full_name} {emp.department ? `- ${emp.department}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">Vendor</label>
              <select
                value={form.vendor_id}
                onChange={(e) => {
                  handleChange('vendor_id', e.target.value);
                  if (e.target.value) handleChange('employee_id', '');
                }}
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer"
              >
                <option value="" className="bg-ink-900">Pilih vendor (opsional)</option>
                {vendors.map(vnd => (
                  <option key={vnd.id} value={vnd.id} className="bg-ink-900">
                    {vnd.vendor_name} ({vnd.vendor_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">Departemen</label>
              <select
                value={form.department_id}
                onChange={(e) => handleChange('department_id', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer"
              >
                <option value="" className="bg-ink-900">Pilih departemen (opsional)</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id} className="bg-ink-900">
                    {dept.department_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">Penanggung Jawab</label>
              <select
                value={form.responsible_user_id}
                onChange={(e) => handleChange('responsible_user_id', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer"
              >
                <option value="" className="bg-ink-900">Pilih penanggung jawab (opsional)</option>
                {users.map(u => (
                  <option key={u.id} value={u.id} className="bg-ink-900">{u.full_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Periode & Nilai */}
        <div className="card p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Calendar size={18} className="text-primary-400" />
            Periode & Nilai Kontrak
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">
                Tanggal Mulai <span className="text-danger-400">*</span>
              </label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => handleChange('start_date', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">
                Tanggal Berakhir <span className="text-danger-400">*</span>
              </label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => handleChange('end_date', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">Tanggal Ditandatangani</label>
              <input
                type="date"
                value={form.signed_date}
                onChange={(e) => handleChange('signed_date', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">Tanggal Perpanjangan</label>
              <input
                type="date"
                value={form.renewal_date}
                onChange={(e) => handleChange('renewal_date', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">Nilai Kontrak</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm">Rp</span>
                <input
                  type="number"
                  value={form.contract_value}
                  onChange={(e) => handleChange('contract_value', e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full pl-10 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-ink-500 focus:outline-none focus:border-primary-500/50 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">Pengingat (hari sebelum)</label>
              <input
                type="number"
                value={form.reminder_days_before}
                onChange={(e) => handleChange('reminder_days_before', e.target.value)}
                min="1"
                max="90"
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-all"
              />
              <p className="text-xs text-ink-500 mt-1">Notifikasi akan dikirim H-{form.reminder_days_before || 7}</p>
            </div>
          </div>
        </div>

        {/* Dokumen */}
        <div className="card p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileSignature size={18} className="text-primary-400" />
            Dokumen
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">Nama Dokumen</label>
              <input
                type="text"
                value={form.document_name}
                onChange={(e) => handleChange('document_name', e.target.value)}
                placeholder="Contoh: Scan Kontrak.pdf"
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-ink-500 focus:outline-none focus:border-primary-500/50 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">URL Dokumen</label>
              <input
                type="url"
                value={form.document_url}
                onChange={(e) => handleChange('document_url', e.target.value)}
                placeholder="https://storage.example.com/contract.pdf"
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-ink-500 focus:outline-none focus:border-primary-500/50 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-all"
              />
            </div>
          </div>
        </div>

        {/* Catatan */}
        <div className="card p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <AlertCircle size={18} className="text-primary-400" />
            Catatan
          </h2>

          <div>
            <textarea
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
              placeholder="Catatan tambahan tentang kontrak..."
              className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-ink-500 focus:outline-none focus:border-primary-500/50 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-all resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/contracts')}
            className="px-4 py-2 text-sm text-ink-300 hover:text-white hover:bg-white/5 rounded-md transition-all"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary inline-flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Menyimpan...
              </>
            ) : (
              <>
                <Save size={16} />
                {isEdit ? 'Simpan Perubahan' : 'Buat Kontrak'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}