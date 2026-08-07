import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../lib/constants';
import { generateNIKFromDB, formatNIK } from '../../lib/nik-generator';
import toast from 'react-hot-toast';
import {
  Plus, Edit, Trash2, Search, X, Save,
  Users, Upload, Download, ChevronDown,
  FileSpreadsheet, Filter, AlertCircle, RefreshCw,
  Hash, Sparkles
} from 'lucide-react';

const EMPLOYEE_TYPES = ['Karyawan Tetap', 'Karyawan Kontrak', 'Outsourcing', 'Magang', 'Harian Lepas', 'Direksi'];

export default function EmployeesPage() {
  const { profile, role } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [importText, setImportText] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [generatingNIK, setGeneratingNIK] = useState(false);
  const [generatedNIK, setGeneratedNIK] = useState('');
  const fileInputRef = useRef(null);

  const canManage = role && ['super_admin', 'hrd'].includes(role.role_name);

  const [form, setForm] = useState({
    employee_code: '',
    full_name: '',
    nik: '',
    employee_type: 'Karyawan Kontrak',
    division_id: '',
    department_id: '',
    sub_department_id: '',
    position: '',
    join_date: '',
    contract_start_date: '',
    contract_end_date: '',
    phone_number: '',
    email: '',
    employment_status: 'ACTIVE'
  });

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('employees')
        .select('*')
        .order('full_name', { ascending: true });

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,employee_code.ilike.%${search}%,nik.ilike.%${search}%,position.ilike.%${search}%`);
      }
      if (typeFilter !== 'all') {
        query = query.eq('employee_type', typeFilter);
      }
      if (statusFilter !== 'all') {
        query = query.eq('employment_status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Gagal memuat data karyawan');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, statusFilter]);

  const fetchOrganization = async () => {
    try {
      const [divRes, deptRes, subRes] = await Promise.all([
        supabase.from('divisions').select('*').eq('is_active', true).order('division_name'),
        supabase.from('departments').select('*').eq('is_active', true).order('department_name'),
        supabase.from('sub_departments').select('*').order('sub_department_name')
      ]);

      setDivisions(divRes.data || []);
      setDepartments(deptRes.data || []);
      setSubDepartments(subRes.data || []);
    } catch (error) {
      console.error('Error fetching organization:', error);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchOrganization();
  }, [fetchEmployees]);

  // Filter departments by division
  const getDepartmentsByDivision = (divisionId) => {
    if (!divisionId) return departments;
    return departments.filter(d => d.division_id === divisionId);
  };

  // Filter sub-departments by department
  const getSubDepartmentsByDept = (departmentId) => {
    if (!departmentId) return [];
    return subDepartments.filter(s => s.department_id === departmentId);
  };

  // Generate NIK
  const handleGenerateNIK = async () => {
    if (!form.division_id || !form.department_id || !form.join_date) {
      toast.error('Pilih divisi, departemen, dan tanggal masuk dulu');
      return;
    }

    setGeneratingNIK(true);
    try {
      const year = new Date(form.join_date).getFullYear();
      const nik = await generateNIKFromDB(supabase, form.division_id, form.department_id, form.sub_department_id || null, year);
      setGeneratedNIK(nik);
      setForm(prev => ({ ...prev, nik }));
      toast.success(`NIK berhasil di-generate: ${formatNIK(nik)}`);
    } catch (error) {
      console.error('Error generating NIK:', error);
      toast.error('Gagal generate NIK: ' + error.message);
    } finally {
      setGeneratingNIK(false);
    }
  };

  // Auto-generate NIK when division, dept, sub-dept, or join_date changes
  useEffect(() => {
    if (form.division_id && form.department_id && form.join_date && !editingId) {
      handleGenerateNIK();
    }
  }, [form.division_id, form.department_id, form.sub_department_id, form.join_date]);

  const openAdd = () => {
    setEditingId(null);
    setGeneratedNIK('');
    setForm({
      employee_code: '',
      full_name: '',
      nik: '',
      employee_type: 'Karyawan Kontrak',
      division_id: '',
      department_id: '',
      sub_department_id: '',
      position: '',
      join_date: new Date().toISOString().split('T')[0],
      contract_start_date: '',
      contract_end_date: '',
      phone_number: '',
      email: '',
      employment_status: 'ACTIVE'
    });
    setShowModal(true);
  };

  const openEdit = (emp) => {
    setEditingId(emp.id);
    setGeneratedNIK(emp.nik || '');
    setForm({
      employee_code: emp.employee_code,
      full_name: emp.full_name,
      nik: emp.nik || '',
      employee_type: emp.employee_type || 'Karyawan Kontrak',
      division_id: emp.division_id || '',
      department_id: emp.department_id || '',
      sub_department_id: emp.sub_department_id || '',
      position: emp.position || '',
      join_date: emp.join_date || '',
      contract_start_date: emp.contract_start_date || '',
      contract_end_date: emp.contract_end_date || '',
      phone_number: emp.phone_number || '',
      email: emp.email || '',
      employment_status: emp.employment_status || 'ACTIVE'
    });
    setShowModal(true);
  };

  const handleFormChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Reset dependent fields
    if (field === 'division_id') {
      setForm(prev => ({ ...prev, division_id: value, department_id: '', sub_department_id: '' }));
    }
    if (field === 'department_id') {
      setForm(prev => ({ ...prev, department_id: value, sub_department_id: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    if (!form.full_name.trim()) {
      toast.error('Nama karyawan harus diisi');
      return;
    }

    try {
      const data = {
        full_name: form.full_name.trim(),
        nik: form.nik.trim() || null,
        employee_type: form.employee_type,
        division_id: form.division_id || null,
        department_id: form.department_id || null,
        sub_department_id: form.sub_department_id || null,
        position: form.position.trim() || null,
        join_date: form.join_date || null,
        contract_start_date: form.contract_start_date || null,
        contract_end_date: form.contract_end_date || null,
        phone_number: form.phone_number.trim() || null,
        email: form.email.trim() || null,
        employment_status: form.employment_status
      };

      if (editingId) {
        let { error } = await supabase.from('employees').update(data).eq('id', editingId);
        // Retry without division_id and sub_department_id if columns don't exist
        if (error && (error.message?.includes('division_id') || error.message?.includes('sub_department_id') || error.code === 'PGRST204')) {
          const { division_id, sub_department_id, ...dataWithoutOrg } = data;
          const { error: error2 } = await supabase.from('employees').update(dataWithoutOrg).eq('id', editingId);
          error = error2;
        }
        if (error) throw error;
        toast.success('Data karyawan berhasil diperbarui');
      } else {
        const { data: codeData, error: codeError } = await supabase.rpc('generate_employee_code');
        if (codeError) throw codeError;
        data.employee_code = codeData;
        data.created_by = profile.id;
        let { error } = await supabase.from('employees').insert(data);
        // Retry without division_id and sub_department_id if columns don't exist
        if (error && (error.message?.includes('division_id') || error.message?.includes('sub_department_id') || error.code === 'PGRST204')) {
          const { division_id, sub_department_id, ...dataWithoutOrg } = data;
          const { error: error2 } = await supabase.from('employees').insert(dataWithoutOrg);
          error = error2;
        }
        if (error) throw error;
        toast.success('Karyawan berhasil ditambahkan');
      }
      setShowModal(false);
      fetchEmployees();
    } catch (error) {
      console.error('Error saving employee:', error);
      toast.error('Gagal menyimpan data karyawan');
    }
  };

  const handleDelete = async (emp) => {
    if (!window.confirm(`Hapus data karyawan "${emp.full_name}"?`)) return;
    try {
      const { error } = await supabase.from('employees').delete().eq('id', emp.id);
      if (error) {
        if (error.code === '23503') { toast.error('Tidak dapat menghapus: karyawan masih terikat kontrak'); return; }
        throw error;
      }
      toast.success('Karyawan berhasil dihapus');
      // Hapus dari state lokal langsung agar UI update tanpa nunggu fetch
      setEmployees(prev => prev.filter(e => e.id !== emp.id));
      // Refresh dari server di background
      fetchEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('Gagal menghapus karyawan');
    }
  };

  // ---- DOWNLOAD TEMPLATE ----
  const downloadTemplate = () => {
    const headers = 'Nama,Divisi,Departemen,Sub Departemen,Tipe,Posisi,Tanggal Masuk,Mulai Kontrak,Akhir Kontrak,No HP,Email';
    const sampleData = [
      'Ahmad Fauzi,FIN,Finance & Accounting,Accounting,Karyawan Kontrak,Staff Accounting,2026-01-01,2026-01-01,2026-12-31,08123456789,ahmad@email.com',
      'Siti Rahmawati,PROD,HRGA,Recruitment,Karyawan Tetap,HRD Staff,2025-06-01,,,,08139876543,siti@email.com',
      'Budi Santoso,PROD,PRJ-PROD,Sewing,Outsourcing,Operator,2026-03-01,2026-03-01,2026-09-01,08781234567,budi@email.com'
    ];
    const csvContent = [headers, ...sampleData].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `template-import-karyawan-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Template CSV berhasil di-download');
  };

  // ---- IMPORT EXCEL ----
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { setImportText(event.target.result); toast.success('File berhasil dibaca'); };
    reader.onerror = () => { toast.error('Gagal membaca file'); };
    reader.readAsText(file);
  };

  const parseImportData = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) { toast.error('Data minimal harus berisi header + 1 baris data'); return []; }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const fieldMap = {
      'nama': 'full_name', 'nama lengkap': 'full_name',
      'tipe': 'employee_type', 'tipe karyawan': 'employee_type', 'jenis': 'employee_type',
      'divisi': 'division_name', 'division': 'division_name',
      'departemen': 'department_name', 'department': 'department_name',
      'sub departemen': 'sub_department_name', 'sub_department': 'sub_department_name', 'subdept': 'sub_department_name',
      'posisi': 'position', 'jabatan': 'position',
      'no hp': 'phone_number', 'telepon': 'phone_number', 'phone': 'phone_number',
      'email': 'email',
      'tanggal masuk': 'join_date', 'join_date': 'join_date',
      'mulai kontrak': 'contract_start_date', 'contract_start': 'contract_start_date',
      'akhir kontrak': 'contract_end_date', 'contract_end': 'contract_end_date',
    };
    const results = [];
    const errors = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const rowData = {};
      headers.forEach((h, idx) => { const field = fieldMap[h] || h; rowData[field] = values[idx] || ''; });
      if (!rowData.full_name) { errors.push(`Baris ${i + 1}: Nama kosong`); continue; }
      // Map division name to id
      if (rowData.division_name) {
        const div = divisions.find(d => d.division_name.toLowerCase() === rowData.division_name.toLowerCase() || d.division_code.toLowerCase() === rowData.division_name.toLowerCase());
        rowData.division_id = div?.id || null;
      }
      // Map department name to id
      if (rowData.department_name) {
        const dept = departments.find(d => d.department_name.toLowerCase() === rowData.department_name.toLowerCase() || d.department_code.toLowerCase() === rowData.department_name.toLowerCase());
        rowData.department_id = dept?.id || null;
      }
      // Map sub-department name to id
      if (rowData.sub_department_name) {
        const sub = subDepartments.find(s => s.sub_department_name.toLowerCase() === rowData.sub_department_name.toLowerCase() || s.sub_department_code.toLowerCase() === rowData.sub_department_name.toLowerCase());
        rowData.sub_department_id = sub?.id || null;
      }
      if (!rowData.employee_type) rowData.employee_type = 'Karyawan Kontrak';
      results.push(rowData);
    }
    return { results, errors };
  };

  const handleImport = async () => {
    if (!importText.trim()) { toast.error('Tempel data terlebih dahulu'); return; }
    setImportLoading(true);
    try {
      const { results, errors } = parseImportData(importText);
      if (errors.length > 0) { toast.error(`Terdapat ${errors.length} error:\n${errors.slice(0, 3).join('\n')}`); return; }
      if (results.length === 0) { toast.error('Tidak ada data valid untuk diimport'); return; }
      let success = 0, failed = 0;
      for (const row of results) {
        try {
          const { data: codeData, error: codeError } = await supabase.rpc('generate_employee_code');
          if (codeError) throw codeError;
          // Generate NIK if division and department are provided
          let nik = null;
          if (row.division_id && row.department_id && row.join_date) {
            try {
              const year = new Date(row.join_date).getFullYear();
              nik = await generateNIKFromDB(supabase, row.division_id, row.department_id, row.sub_department_id || null, year);
            } catch (e) { console.warn('NIK generation failed for row:', e); }
          }
          const { error } = await supabase.from('employees').insert({
            employee_code: codeData, full_name: row.full_name, nik: nik,
            employee_type: row.employee_type || 'Karyawan Kontrak',
            division_id: row.division_id || null, department_id: row.department_id || null,
            sub_department_id: row.sub_department_id || null,
            position: row.position || null, join_date: row.join_date || null,
            contract_start_date: row.contract_start_date || null, contract_end_date: row.contract_end_date || null,
            phone_number: row.phone_number || null, email: row.email || null, created_by: profile.id
          });
          if (error) throw error;
          success++;
        } catch (err) { console.error('Import row error:', err); failed++; }
      }
      toast.success(`${success} data berhasil diimport${failed > 0 ? `, ${failed} gagal` : ''}`);
      setShowImport(false); setImportText(''); fetchEmployees();
    } catch (error) { console.error('Import error:', error); toast.error('Gagal mengimport data'); }
    finally { setImportLoading(false); }
  };

  const getTypeBadge = (type) => {
    const colorMap = {
      'Karyawan Tetap': 'bg-green-500/10 text-green-300 border-green-500/20',
      'Karyawan Kontrak': 'bg-blue-500/10 text-blue-300 border-blue-500/20',
      'Outsourcing': 'bg-purple-500/10 text-purple-300 border-purple-500/20',
      'Magang': 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
      'Harian Lepas': 'bg-orange-500/10 text-orange-300 border-orange-500/20',
      'Direksi': 'bg-red-500/10 text-red-300 border-red-500/20'
    };
    return colorMap[type] || 'bg-ink-500/10 text-ink-300 border-ink-500/20';
  };

  const getStatusBadge = (status) => {
    const colorMap = {
      ACTIVE: 'bg-success-500/10 text-success-300 border-success-500/20',
      INACTIVE: 'bg-ink-500/10 text-ink-300 border-ink-500/20',
      RESIGNED: 'bg-warning-500/10 text-warning-300 border-warning-500/20',
      TERMINATED: 'bg-danger-500/10 text-danger-300 border-danger-500/20',
      RETIRED: 'bg-primary-500/10 text-primary-300 border-primary-500/20'
    };
    return colorMap[status] || 'bg-ink-500/10 text-ink-300 border-ink-500/20';
  };

  const getContractInfo = (emp) => {
    if (!emp.contract_end_date) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end = new Date(emp.contract_end_date); end.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: `Kontrak habis ${Math.abs(diffDays)} hr`, color: 'text-danger-300' };
    if (diffDays === 0) return { label: 'Kontrak habis hari ini', color: 'text-warning-300' };
    if (diffDays <= 30) return { label: `Sisa ${diffDays} hr`, color: 'text-orange-300' };
    return null;
  };

  const totalCount = employees.length;
  const activeCount = employees.filter(e => e.employment_status === 'ACTIVE').length;
  const contractCount = employees.filter(e => e.employee_type === 'Karyawan Kontrak' || e.employee_type === 'Outsourcing').length;
  const expiringCount = employees.filter(e => {
    if (!e.contract_end_date || e.employment_status !== 'ACTIVE') return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end = new Date(e.contract_end_date); end.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Data Karyawan</h1>
          <p className="text-ink-400 text-sm mt-1">Master data karyawan dengan NIK otomatis</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canManage && (
            <>
              <button onClick={() => setShowImport(true)} className="btn-secondary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
                <Upload size={16} /> Import Excel
              </button>
              <button onClick={downloadTemplate} className="btn-ghost inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
                <Download size={16} /> Template CSV
              </button>
              <button onClick={openAdd} className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
                <Plus size={16} /> Tambah Karyawan
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-2xl font-bold text-white">{totalCount}</p><p className="text-xs text-ink-400">Total Karyawan</p></div>
        <div className="card p-4"><p className="text-2xl font-bold text-success-300">{activeCount}</p><p className="text-xs text-ink-400">Aktif</p></div>
        <div className="card p-4"><p className="text-2xl font-bold text-blue-300">{contractCount}</p><p className="text-xs text-ink-400">Kontrak/Outsourcing</p></div>
        <div className="card p-4"><p className="text-2xl font-bold text-warning-300">{expiringCount}</p><p className="text-xs text-ink-400">Kontrak Akan Habis</p></div>
      </div>

      {/* Search & Filter */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input type="text" placeholder="Cari nama, NIK, kode, posisi..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-ink-500 focus:outline-none focus:border-primary-500/50 transition-all" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-white"><X size={14} /></button>}
          </div>
          <div className="relative">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="appearance-none w-full sm:w-44 px-3 py-2 pr-8 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer">
              <option value="all" className="bg-ink-900">Semua Tipe</option>
              {EMPLOYEE_TYPES.map(t => <option key={t} value={t} className="bg-ink-900">{t}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="appearance-none w-full sm:w-40 px-3 py-2 pr-8 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer">
              <option value="all" className="bg-ink-900">Semua Status</option>
              <option value="ACTIVE" className="bg-ink-900">Aktif</option>
              <option value="RESIGNED" className="bg-ink-900">Resign</option>
              <option value="TERMINATED" className="bg-ink-900">Dipecat</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Karyawan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">NIK</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Posisi/Jabatan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Divisi</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Departemen</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Tipe</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Kontrak</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-ink-400">Memuat...</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center">
                  <Users size={40} className="mx-auto text-ink-700 mb-3" />
                  <p className="text-ink-400 text-sm">Belum ada data karyawan</p>
                </td></tr>
              ) : employees.map(emp => {
                const contractInfo = getContractInfo(emp);
                return (
                  <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-xs font-semibold text-white">
                          {emp.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{emp.full_name}</p>
                          <p className="text-xs text-ink-400 font-mono">{emp.employee_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-ink-200">{emp.nik ? formatNIK(emp.nik) : '-'}</td>
                    <td className="px-4 py-3 text-sm text-ink-200">{emp.position || '-'}</td>
                    <td className="px-4 py-3 text-sm text-ink-200">{divisions.find(d => d.id === emp.division_id)?.division_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-ink-200">{departments.find(d => d.id === emp.department_id)?.department_name || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${getTypeBadge(emp.employee_type)}`}>{emp.employee_type || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {emp.contract_end_date ? (
                        <div className="text-sm">
                          <span className="text-ink-300 font-mono text-xs">{emp.contract_end_date}</span>
                          {contractInfo && <p className={`text-xs mt-0.5 font-medium ${contractInfo.color}`}>{contractInfo.label}</p>}
                        </div>
                      ) : <span className="text-xs text-ink-500">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${getStatusBadge(emp.employment_status)}`}>
                        {emp.employment_status === 'ACTIVE' ? 'Aktif' : emp.employment_status === 'RESIGNED' ? 'Resign' : emp.employment_status === 'TERMINATED' ? 'Dipecat' : emp.employment_status === 'RETIRED' ? 'Pensiun' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManage && (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(emp)} className="p-1.5 text-ink-400 hover:text-primary-300 hover:bg-primary-500/10 rounded-md" title="Edit"><Edit size={14} /></button>
                          <button onClick={() => handleDelete(emp)} className="p-1.5 text-ink-400 hover:text-danger-300 hover:bg-danger-500/10 rounded-md" title="Hapus"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-white/5 text-xs text-ink-500">Total {employees.length} karyawan</div>
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">{editingId ? 'Edit Karyawan' : 'Tambah Karyawan'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-ink-400 hover:text-white hover:bg-white/5 rounded-md"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* NIK Generator */}
              <div className="p-4 rounded-lg bg-primary-500/5 border border-primary-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <Hash size={16} className="text-primary-400" />
                  <p className="text-sm font-medium text-primary-300">NIK Generator Otomatis</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink-400 mb-1">Divisi</label>
                    <select value={form.division_id} onChange={(e) => handleFormChange('division_id', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer">
                      <option value="" className="bg-ink-900">Pilih Divisi</option>
                      {divisions.map(d => <option key={d.id} value={d.id} className="bg-ink-900">{d.division_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-400 mb-1">Departemen</label>
                    <select value={form.department_id} onChange={(e) => handleFormChange('department_id', e.target.value)} disabled={!form.division_id}
                      className="w-full px-2 py-1.5 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer disabled:opacity-50">
                      <option value="" className="bg-ink-900">Pilih Departemen</option>
                      {getDepartmentsByDivision(form.division_id).map(d => <option key={d.id} value={d.id} className="bg-ink-900">{d.department_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-400 mb-1">Sub Departemen</label>
                    <select value={form.sub_department_id} onChange={(e) => handleFormChange('sub_department_id', e.target.value)} disabled={!form.department_id}
                      className="w-full px-2 py-1.5 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer disabled:opacity-50">
                      <option value="" className="bg-ink-900">Pilih Sub (opsional)</option>
                      {getSubDepartmentsByDept(form.department_id).map(s => <option key={s.id} value={s.id} className="bg-ink-900">{s.sub_department_name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-white/5 border border-primary-500/30 rounded-md">
                    <p className="text-xs text-ink-500">NIK:</p>
                    <p className="text-sm font-mono font-bold text-primary-300">{form.nik ? formatNIK(form.nik) : 'Belum di-generate'}</p>
                  </div>
                  <button type="button" onClick={handleGenerateNIK} disabled={generatingNIK || !form.division_id || !form.department_id || !form.join_date}
                    className="btn-primary inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium disabled:opacity-50">
                    {generatingNIK ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Sparkles size={14} />}
                    Generate
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-ink-300 mb-1.5">Nama Lengkap <span className="text-danger-400">*</span></label>
                  <input type="text" value={form.full_name} onChange={(e) => handleFormChange('full_name', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 transition-all" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-1.5">Tipe Karyawan</label>
                  <select value={form.employee_type} onChange={(e) => handleFormChange('employee_type', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer">
                    {EMPLOYEE_TYPES.map(t => <option key={t} value={t} className="bg-ink-900">{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-1.5">Posisi / Jabatan</label>
                  <input type="text" value={form.position} onChange={(e) => handleFormChange('position', e.target.value)} placeholder="Contoh: Staff IT"
                    className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-ink-500 focus:outline-none focus:border-primary-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-1.5">Status</label>
                  <select value={form.employment_status} onChange={(e) => handleFormChange('employment_status', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer">
                    <option value="ACTIVE" className="bg-ink-900">Aktif</option>
                    <option value="INACTIVE" className="bg-ink-900">Nonaktif</option>
                    <option value="RESIGNED" className="bg-ink-900">Resign</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-1.5">Tanggal Masuk</label>
                  <input type="date" value={form.join_date} onChange={(e) => handleFormChange('join_date', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 transition-all" />
                </div>
                <div className="md:col-span-2 border-t border-white/5 pt-3">
                  <p className="text-sm font-medium text-ink-300 mb-3">Informasi Kontrak</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-1.5">Tanggal Mulai Kontrak</label>
                  <input type="date" value={form.contract_start_date} onChange={(e) => handleFormChange('contract_start_date', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-1.5">Tanggal Berakhir Kontrak</label>
                  <input type="date" value={form.contract_end_date} onChange={(e) => handleFormChange('contract_end_date', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-1.5">No. Telepon</label>
                  <input type="text" value={form.phone_number} onChange={(e) => handleFormChange('phone_number', e.target.value)} placeholder="0812xxxx"
                    className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-ink-500 focus:outline-none focus:border-primary-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={(e) => handleFormChange('email', e.target.value)} placeholder="email@example.com"
                    className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-ink-500 focus:outline-none focus:border-primary-500/50 transition-all" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-ink-300 hover:text-white hover:bg-white/5 rounded-md">Batal</button>
                <button type="submit" className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
                  <Save size={16} /> {editingId ? 'Simpan' : 'Tambah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="modal-overlay">
          <div className="modal-content max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-white">Import Data Karyawan</h2>
                <p className="text-xs text-ink-400 mt-1">NIK akan di-generate otomatis berdasarkan divisi & departemen</p>
              </div>
              <button onClick={() => setShowImport(false)} className="p-1.5 text-ink-400 hover:text-white hover:bg-white/5 rounded-md"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-primary-500/5 border border-primary-500/20 text-xs text-ink-300">
                <p className="font-medium text-primary-300 mb-1">Format CSV (header wajib):</p>
                <code className="text-ink-400">Nama, Divisi, Departemen, Sub Departemen, Tipe, Posisi, Tanggal Masuk, Mulai Kontrak, Akhir Kontrak, No HP, Email</code>
                <div className="mt-2 text-ink-500">
                  <p>Contoh:</p>
                  <code className="text-ink-400">Ahmad Fauzi, FIN, Finance & Accounting, Accounting, Karyawan Kontrak, Staff, 2026-01-01, 2026-01-01, 2026-12-31, 08123456789, ahmad@email.com</code>
                </div>
              </div>
              <div>
                <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="w-full p-4 border-2 border-dashed border-white/10 rounded-lg text-sm text-ink-400 hover:border-primary-500/30 hover:text-primary-300 transition-all">
                  <Upload size={24} className="mx-auto mb-2" /> Klik untuk upload file CSV
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                <div className="relative flex justify-center text-xs text-ink-500"><span className="px-2 bg-ink-950">Atau tempel data di sini</span></div>
              </div>
              <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={8}
                placeholder={`Nama,Divisi,Departemen,Sub Departemen,Tipe,Posisi,Tanggal Masuk,Mulai Kontrak,Akhir Kontrak,No HP,Email\nAhmad Fauzi,FIN,Finance & Accounting,Accounting,Karyawan Kontrak,Staff,2026-01-01,2026-01-01,2026-12-31,08123456789,ahmad@email.com`}
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-ink-600 focus:outline-none focus:border-primary-500/50 transition-all font-mono" />
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => { setShowImport(false); setImportText(''); }} className="px-4 py-2 text-sm text-ink-300 hover:text-white hover:bg-white/5 rounded-md">Batal</button>
                <button onClick={handleImport} disabled={importLoading || !importText.trim()} className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {importLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Mengimport...</> : <><Upload size={16} /> Import Data</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}