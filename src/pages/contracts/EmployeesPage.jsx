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
  Hash, Sparkles, TrendingUp, Camera
} from 'lucide-react';

const EMPLOYEE_TYPES = ['Karyawan Tetap', 'Karyawan Kontrak', 'Outsourcing', 'Magang', 'Harian Lepas', 'Direksi'];

export default function EmployeesPage() {
  const { profile, role } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [subDepartmentPositions, setSubDepartmentPositions] = useState([]);
  const [workSections, setWorkSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [minimumSalary, setMinimumSalary] = useState('');
  const [maximumSalary, setMaximumSalary] = useState('');
  const [minimumTenureYears, setMinimumTenureYears] = useState('');
  const [maximumTenureYears, setMaximumTenureYears] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [subDepartmentFilter, setSubDepartmentFilter] = useState('');
  const [workSectionFilter, setWorkSectionFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [joinDateFrom, setJoinDateFrom] = useState('');
  const [joinDateTo, setJoinDateTo] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: '', direction: '' });
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [importText, setImportText] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [generatingNIK, setGeneratingNIK] = useState(false);
  const [generatedNIK, setGeneratedNIK] = useState('');
  const [salaryHistory, setSalaryHistory] = useState({});
  const [salaryEmployee, setSalaryEmployee] = useState(null);
  const [showSalaryHistoryForm, setShowSalaryHistoryForm] = useState(false);
  const [salaryHistorySaving, setSalaryHistorySaving] = useState(false);
  const [salaryHistoryForm, setSalaryHistoryForm] = useState({ amount: '', effective_date: '', notes: '' });
  const [editingSalaryHistoryId, setEditingSalaryHistoryId] = useState(null);
  const [employeePhotoFile, setEmployeePhotoFile] = useState(null);
  const [employeePhotoPreview, setEmployeePhotoPreview] = useState('');
  const [uploadingEmployeePhoto, setUploadingEmployeePhoto] = useState(false);
  const [selectedEmployeePhoto, setSelectedEmployeePhoto] = useState(null);
  const fileInputRef = useRef(null);
  const employeePhotoInputRef = useRef(null);

  const canManage = role && ['super_admin', 'hrd'].includes(role.role_name);

  const [form, setForm] = useState({
    employee_code: '',
    full_name: '',
    nik: '',
    employee_type: 'Karyawan Kontrak',
    division_id: '',
    department_id: '',
    sub_department_id: '',
    work_section_id: '',
    position: '',
    join_date: '',
    contract_start_date: '',
    contract_end_date: '',
    phone_number: '',
    email: '',
    employment_status: 'ACTIVE'
    ,salary: ''
  });

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('employees')
        .select('*')
        .order('full_name', { ascending: true });

      if (search) {
        const [{ data: matchingSubDepartments }, { data: matchingWorkSections }] = await Promise.all([
          supabase.from('sub_departments').select('id').ilike('sub_department_name', `%${search}%`),
          supabase.from('employee_work_sections').select('id').ilike('section_name', `%${search}%`)
        ]);
        const searchFilters = [
          `full_name.ilike.%${search}%`,
          `employee_code.ilike.%${search}%`,
          `nik.ilike.%${search}%`,
          `position.ilike.%${search}%`
        ];
        const subDepartmentIds = (matchingSubDepartments || []).map(item => item.id);
        if (subDepartmentIds.length > 0) searchFilters.push(`sub_department_id.in.(${subDepartmentIds.join(',')})`);
        const workSectionIds = (matchingWorkSections || []).map(item => item.id);
        if (workSectionIds.length > 0) searchFilters.push(`work_section_id.in.(${workSectionIds.join(',')})`);
        query = query.or(searchFilters.join(','));
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
      if (canManage) {
        const { data: salaryRows, error: salaryError } = await supabase
          .from('employee_salary_history')
          .select('*')
          .order('effective_date', { ascending: true })
          .order('created_at', { ascending: true });
        if (salaryError) throw salaryError;
        const historyMap = {};
        (salaryRows || []).forEach((row) => {
          if (!historyMap[row.employee_id]) historyMap[row.employee_id] = [];
          historyMap[row.employee_id].push(row);
        });
        setSalaryHistory(historyMap);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Gagal memuat data karyawan');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, statusFilter, canManage]);

  const fetchOrganization = async () => {
    try {
      const [divRes, deptRes, subRes, positionRes, sectionRes] = await Promise.all([
        supabase.from('divisions').select('*').eq('is_active', true).order('division_name'),
        supabase.from('departments').select('*').eq('is_active', true).order('department_name'),
        supabase.from('sub_departments').select('*').order('sub_department_name'),
        supabase.from('employee_position_options').select('*').eq('is_active', true).order('position_name'),
        supabase.from('employee_work_sections').select('*').eq('is_active', true).order('section_name')
      ]);

      setDivisions(divRes.data || []);
      setDepartments(deptRes.data || []);
      setSubDepartments(subRes.data || []);
      setSubDepartmentPositions(positionRes.data || []);
      setWorkSections(sectionRes.data || []);
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
    setEmployeePhotoFile(null);
    setEmployeePhotoPreview('');
    setForm({
      employee_code: '',
      full_name: '',
      nik: '',
      employee_type: 'Karyawan Kontrak',
      division_id: '',
      department_id: '',
      sub_department_id: '',
      work_section_id: '',
      position: '',
      join_date: new Date().toISOString().split('T')[0],
      contract_start_date: '',
      contract_end_date: '',
      phone_number: '',
      email: '',
      employment_status: 'ACTIVE'
      ,salary: ''
    });
    setShowModal(true);
  };

  const openEdit = (emp) => {
    setEditingId(emp.id);
    setGeneratedNIK(emp.nik || '');
    setEmployeePhotoFile(null);
    setEmployeePhotoPreview(emp.photo_url || '');
    setForm({
      employee_code: emp.employee_code,
      full_name: emp.full_name,
      nik: emp.nik || '',
      employee_type: emp.employee_type || 'Karyawan Kontrak',
      division_id: emp.division_id || '',
      department_id: emp.department_id || '',
      sub_department_id: emp.sub_department_id || '',
      work_section_id: emp.work_section_id || '',
      position: emp.position || '',
      join_date: emp.join_date || '',
      contract_start_date: emp.contract_start_date || '',
      contract_end_date: emp.contract_end_date || '',
      phone_number: emp.phone_number || '',
      email: emp.email || '',
      employment_status: emp.employment_status || 'ACTIVE'
      ,salary: salaryHistory[emp.id]?.at(-1)?.amount ? String(salaryHistory[emp.id].at(-1).amount) : ''
    });
    setShowModal(true);
  };

  const handleFormChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Reset dependent fields
    if (field === 'division_id') {
      setForm(prev => ({ ...prev, division_id: value, department_id: '', sub_department_id: '', work_section_id: '', position: '' }));
    }
    if (field === 'department_id') {
      setForm(prev => ({ ...prev, department_id: value, sub_department_id: '', work_section_id: '', position: '' }));
    }
    if (field === 'sub_department_id') {
      setForm(prev => ({ ...prev, sub_department_id: value, work_section_id: '', position: '' }));
    }
  };

  const handleEmployeePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Foto harus berformat JPG, PNG, atau WebP');
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran foto maksimal 5 MB');
      event.target.value = '';
      return;
    }
    setEmployeePhotoFile(file);
    setEmployeePhotoPreview(URL.createObjectURL(file));
  };

  const uploadEmployeePhoto = async (employeeId) => {
    if (!employeePhotoFile) return;
    setUploadingEmployeePhoto(true);
    try {
      const extension = employeePhotoFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `${employeeId}/profile-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('employee-photos')
        .upload(filePath, employeePhotoFile, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from('employee-photos').getPublicUrl(filePath);
      const photoUrl = publicData.publicUrl;
      const { data: previousEmployee, error: employeeError } = await supabase.from('employees')
        .select('photo_url').eq('id', employeeId).single();
      if (employeeError) throw employeeError;
      const { error: updateError } = await supabase.from('employees').update({ photo_url: photoUrl }).eq('id', employeeId);
      if (updateError) throw updateError;
      const publicMarker = '/storage/v1/object/public/employee-photos/';
      if (previousEmployee?.photo_url?.includes(publicMarker)) {
        const oldPath = decodeURIComponent(previousEmployee.photo_url.split(publicMarker)[1]);
        await supabase.storage.from('employee-photos').remove([oldPath]);
      }
      setEmployeePhotoPreview(photoUrl);
      setEmployeePhotoFile(null);
    } finally {
      setUploadingEmployeePhoto(false);
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
        work_section_id: form.work_section_id || null,
        position: form.position.trim() || null,
        join_date: form.join_date || null,
        contract_start_date: form.contract_start_date || null,
        contract_end_date: form.contract_end_date || null,
        phone_number: form.phone_number.trim() || null,
        email: form.email.trim() || null,
        employment_status: form.employment_status
      };

      let savedEmployeeId = editingId;
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
        let { data: insertedEmployee, error } = await supabase.from('employees').insert(data).select('id').single();
        // Retry without division_id and sub_department_id if columns don't exist
        if (error && (error.message?.includes('division_id') || error.message?.includes('sub_department_id') || error.code === 'PGRST204')) {
          const { division_id, sub_department_id, ...dataWithoutOrg } = data;
          const { data: fallbackEmployee, error: error2 } = await supabase.from('employees').insert(dataWithoutOrg).select('id').single();
          insertedEmployee = fallbackEmployee;
          error = error2;
        }
        if (error) throw error;
        savedEmployeeId = insertedEmployee.id;
        toast.success('Karyawan berhasil ditambahkan');
      }
      if (employeePhotoFile) await uploadEmployeePhoto(savedEmployeeId);
      if (form.salary !== '') {
        const { error: salaryError } = await supabase.rpc('set_employee_salary', {
          p_employee_id: savedEmployeeId,
          p_amount: Number(form.salary),
          p_effective_date: editingId ? new Date().toISOString().split('T')[0] : form.join_date || new Date().toISOString().split('T')[0],
          p_notes: editingId ? 'Perubahan manual dari Data Karyawan' : 'Gaji awal karyawan'
        });
        if (salaryError) throw salaryError;
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

  const getAvailablePositions = () => {
    if (!form.department_id) return [];
    const scope = form.sub_department_id ? 'SUB_DEPARTMENT' : 'DEPARTMENT';
    return subDepartmentPositions.filter(item => item.position_scope === scope);
  };

  const getWorkSectionsBySubDepartment = (subDepartmentId) => {
    if (!subDepartmentId) return [];
    return workSections.filter(item => item.sub_department_id === subDepartmentId);
  };

  const handleAddWorkSection = async () => {
    if (!form.sub_department_id) {
      toast.error('Pilih subdepartemen terlebih dahulu');
      return;
    }
    const sectionName = window.prompt('Nama bagian baru:')?.trim();
    if (!sectionName) return;
    const { data, error } = await supabase
      .from('employee_work_sections')
      .insert({ sub_department_id: form.sub_department_id, section_name: sectionName, created_by: profile.id })
      .select()
      .single();
    if (error) {
      toast.error(error.code === '23505' ? 'Bagian tersebut sudah tersedia' : error.message);
      return;
    }
    setWorkSections(prev => [...prev, data].sort((a, b) => a.section_name.localeCompare(b.section_name)));
    setForm(prev => ({ ...prev, work_section_id: data.id }));
    toast.success('Bagian berhasil ditambahkan');
  };

  const handleAddPosition = async () => {
    if (!form.department_id) {
      toast.error('Pilih departemen terlebih dahulu');
      return;
    }
    const positionScope = form.sub_department_id ? 'SUB_DEPARTMENT' : 'DEPARTMENT';
    const positionName = window.prompt('Nama jabatan baru:')?.trim();
    if (!positionName) return;
    const { data, error } = await supabase
      .from('employee_position_options')
      .insert({ position_scope: positionScope, position_name: positionName, created_by: profile.id })
      .select()
      .single();
    if (error) {
      toast.error(error.code === '23505' ? 'Jabatan tersebut sudah tersedia' : error.message);
      return;
    }
    setSubDepartmentPositions(prev => [...prev, data].sort((a, b) => a.position_name.localeCompare(b.position_name)));
    setForm(prev => ({ ...prev, position: data.position_name }));
    toast.success('Pilihan jabatan berhasil ditambahkan');
  };
  const formatSalary = (value) => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0
  }).format(Number(value || 0));

  const getContextualPositionLabel = (position, departmentId) => {
    if (!position) return '-';
    const departmentCode = departments.find(item => item.id === departmentId)?.department_code;
    const productionUnit = departmentCode === 'PRJ-PROD'
      ? 'Produksi Project'
      : departmentCode === 'STK-PROD'
        ? 'Produksi Stok'
        : null;
    if (!productionUnit) return position;
    if (position === 'Kepala') return `Kepala ${productionUnit}`;
    if (position === 'Asisten Kepala') return `Asisten Kepala ${productionUnit}`;
    return position;
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

  const getMissingEmployeeFields = (employee) => {
    const missing = [];
    if (!employee.nik) missing.push('NIK');
    if (!employee.division_id) missing.push('divisi');
    if (!employee.department_id) missing.push('departemen');
    if (!employee.position) missing.push('jabatan');
    if (!employee.join_date) missing.push('tanggal masuk');
    if (!salaryHistory[employee.id]?.length) missing.push('gaji');
    const positionOption = subDepartmentPositions.find(item => item.position_name === employee.position);
    if (positionOption?.position_scope === 'SUB_DEPARTMENT' && !employee.sub_department_id) missing.push('subdepartemen');
    const subDepartmentHasSections = workSections.some(section => section.sub_department_id === employee.sub_department_id);
    if (employee.position === 'Operator' && subDepartmentHasSections && !employee.work_section_id) missing.push('bagian');
    return missing;
  };
  const incompleteEmployees = canManage
    ? employees.filter(employee => getMissingEmployeeFields(employee).length > 0)
    : [];

  const displayedEmployees = employees.filter(employee => {
    if (divisionFilter && employee.division_id !== divisionFilter) return false;
    if (departmentFilter && employee.department_id !== departmentFilter) return false;
    if (subDepartmentFilter && employee.sub_department_id !== subDepartmentFilter) return false;
    if (workSectionFilter && employee.work_section_id !== workSectionFilter) return false;
    if (positionFilter && employee.position !== positionFilter) return false;
    if (joinDateFrom && (!employee.join_date || employee.join_date < joinDateFrom)) return false;
    if (joinDateTo && (!employee.join_date || employee.join_date > joinDateTo)) return false;
    if (minimumTenureYears !== '') {
      if (!employee.join_date) return false;
      const start = new Date(`${employee.join_date}T00:00:00`);
      const today = new Date();
      let completedMonths = (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth();
      if (today.getDate() < start.getDate()) completedMonths -= 1;
      if (completedMonths <= Number(minimumTenureYears) * 12) return false;
    }
    if (maximumTenureYears !== '') {
      if (!employee.join_date) return false;
      const start = new Date(`${employee.join_date}T00:00:00`);
      const today = new Date();
      let completedMonths = (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth();
      if (today.getDate() < start.getDate()) completedMonths -= 1;
      if (completedMonths > Number(maximumTenureYears) * 12) return false;
    }
    if (canManage && (minimumSalary !== '' || maximumSalary !== '')) {
      const currentSalary = salaryHistory[employee.id]?.at(-1)?.amount;
      if (currentSalary === undefined || currentSalary === null) return false;
      const salary = Number(currentSalary);
      if (minimumSalary !== '' && salary < Number(minimumSalary)) return false;
      if (maximumSalary !== '' && salary > Number(maximumSalary)) return false;
    }
    return true;
  });

  const activeFilterCount = [
    typeFilter !== 'all' ? typeFilter : '', statusFilter !== 'all' ? statusFilter : '',
    divisionFilter, departmentFilter, subDepartmentFilter, workSectionFilter, positionFilter,
    joinDateFrom, joinDateTo, minimumTenureYears, maximumTenureYears,
    canManage ? minimumSalary : '', canManage ? maximumSalary : ''
  ].filter(Boolean).length;

  const resetAllFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setStatusFilter('all');
    setDivisionFilter('');
    setDepartmentFilter('');
    setSubDepartmentFilter('');
    setWorkSectionFilter('');
    setPositionFilter('');
    setJoinDateFrom('');
    setJoinDateTo('');
    setMinimumTenureYears('');
    setMaximumTenureYears('');
    setMinimumSalary('');
    setMaximumSalary('');
  };

  const handleSort = (key, defaultDirection) => {
    setSortConfig(current => current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: defaultDirection });
  };

  const handleAddSalaryHistory = async (event) => {
    event.preventDefault();
    if (!salaryEmployee || !salaryHistoryForm.amount || !salaryHistoryForm.effective_date) {
      toast.error('Nominal dan tanggal efektif wajib diisi');
      return;
    }
    setSalaryHistorySaving(true);
    try {
      const { error } = editingSalaryHistoryId
        ? await supabase.rpc('update_employee_salary_history', {
          p_history_id: editingSalaryHistoryId,
          p_amount: Number(salaryHistoryForm.amount),
          p_effective_date: salaryHistoryForm.effective_date,
          p_notes: salaryHistoryForm.notes.trim() || null
        })
        : await supabase.rpc('add_employee_salary_history', {
          p_employee_id: salaryEmployee.id,
          p_amount: Number(salaryHistoryForm.amount),
          p_effective_date: salaryHistoryForm.effective_date,
          p_notes: salaryHistoryForm.notes.trim() || null
        });
      if (error) throw error;
      await fetchEmployees();
      setSalaryHistoryForm({ amount: '', effective_date: '', notes: '' });
      setEditingSalaryHistoryId(null);
      setShowSalaryHistoryForm(false);
      toast.success(editingSalaryHistoryId ? 'Riwayat gaji berhasil diperbarui' : 'Riwayat gaji berhasil ditambahkan');
    } catch (error) {
      console.error('Error adding salary history:', error);
      toast.error(error.message || 'Gagal menambahkan riwayat gaji');
    } finally {
      setSalaryHistorySaving(false);
    }
  };

  const sortedEmployees = [...displayedEmployees].sort((first, second) => {
    if (!sortConfig.key) return 0;
    const getSortValue = (employee) => {
      if (sortConfig.key === 'full_name') return employee.full_name?.toLocaleLowerCase('id-ID') || null;
      if (sortConfig.key === 'join_date') return employee.join_date ? new Date(`${employee.join_date}T00:00:00`).getTime() : null;
      if (sortConfig.key === 'tenure') return employee.join_date ? Date.now() - new Date(`${employee.join_date}T00:00:00`).getTime() : null;
      if (sortConfig.key === 'salary') {
        const amount = salaryHistory[employee.id]?.at(-1)?.amount;
        return amount === undefined || amount === null ? null : Number(amount);
      }
      return null;
    };
    const firstValue = getSortValue(first);
    const secondValue = getSortValue(second);
    if (firstValue === null && secondValue === null) return 0;
    if (firstValue === null) return 1;
    if (secondValue === null) return -1;
    const comparison = typeof firstValue === 'string'
      ? firstValue.localeCompare(secondValue, 'id-ID')
      : firstValue - secondValue;
    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  const SortableHeader = ({ label, sortKey, defaultDirection = 'asc' }) => {
    const active = sortConfig.key === sortKey;
    return (
      <th className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">
        <button type="button" onClick={() => handleSort(sortKey, defaultDirection)}
          className="group inline-flex items-center gap-1.5 whitespace-nowrap hover:text-primary-300 transition-colors"
          title={`Urutkan berdasarkan ${label}`}>
          {label}
          <span className={`text-[9px] tracking-normal ${active ? 'text-primary-300' : 'text-ink-600 group-hover:text-primary-400'}`}>
            {active ? sortConfig.direction.toUpperCase() : 'URUT'}
          </span>
        </button>
      </th>
    );
  };

  const formatJoinDate = (date) => date
    ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T00:00:00`))
    : '-';

  const getEmploymentPeriod = (joinDate) => {
    if (!joinDate) return '-';
    const start = new Date(`${joinDate}T00:00:00`);
    const today = new Date();
    if (start > today) return '-';
    let totalMonths = (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth();
    if (today.getDate() < start.getDate()) totalMonths -= 1;
    if (totalMonths < 1) return '< 1 bln';
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    return [years ? `${years} th` : '', months ? `${months} bln` : ''].filter(Boolean).join(' ');
  };

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

      {canManage && incompleteEmployees.length > 0 && (
        <div className="card border-warning-500/25 bg-warning-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="mt-0.5 flex-shrink-0 text-warning-300" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-warning-200">{incompleteEmployees.length} data karyawan perlu dilengkapi</p>
              <p className="mt-1 text-xs text-ink-400">Periksa badge pada daftar untuk melihat informasi yang masih kosong.</p>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(280px,1fr)_180px_160px_auto]">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input type="text" placeholder="Cari nama, NIK, kode, posisi..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-ink-500 focus:outline-none focus:border-primary-500/50 transition-all" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-white"><X size={14} /></button>}
          </div>
          <div className="relative">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="appearance-none w-full px-3 py-2 pr-8 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer">
              <option value="all" className="bg-ink-900">Semua Tipe</option>
              {EMPLOYEE_TYPES.map(t => <option key={t} value={t} className="bg-ink-900">{t}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="appearance-none w-full px-3 py-2 pr-8 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer">
              <option value="all" className="bg-ink-900">Semua Status</option>
              <option value="ACTIVE" className="bg-ink-900">Aktif</option>
              <option value="RESIGNED" className="bg-ink-900">Resign</option>
              <option value="TERMINATED" className="bg-ink-900">Dipecat</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          </div>
          <button type="button" onClick={() => setShowAdvancedFilters(value => !value)}
            className={`btn-secondary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm whitespace-nowrap ${showAdvancedFilters ? 'border-primary-500/40 text-primary-300' : ''}`}>
            Filter Lanjutan
            {activeFilterCount > 0 && <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary-500/15 px-1.5 py-0.5 text-[10px] font-bold text-primary-300">{activeFilterCount}</span>}
            <ChevronDown size={14} className={`transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {showAdvancedFilters && <div className="space-y-4 border-t border-white/5 pt-4">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Struktur Organisasi</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <select value={divisionFilter} onChange={(event) => {
                setDivisionFilter(event.target.value); setDepartmentFilter(''); setSubDepartmentFilter(''); setWorkSectionFilter('');
              }} className="input cursor-pointer">
                <option value="">Semua Divisi</option>
                {divisions.map(item => <option key={item.id} value={item.id}>{item.division_name}</option>)}
              </select>
              <select value={departmentFilter} disabled={!divisionFilter} onChange={(event) => {
                setDepartmentFilter(event.target.value); setSubDepartmentFilter(''); setWorkSectionFilter('');
              }} className="input cursor-pointer disabled:opacity-50">
                <option value="">Semua Departemen</option>
                {getDepartmentsByDivision(divisionFilter).map(item => <option key={item.id} value={item.id}>{item.department_name}</option>)}
              </select>
              <select value={subDepartmentFilter} disabled={!departmentFilter} onChange={(event) => {
                setSubDepartmentFilter(event.target.value); setWorkSectionFilter('');
              }} className="input cursor-pointer disabled:opacity-50">
                <option value="">Semua Subdepartemen</option>
                {getSubDepartmentsByDept(departmentFilter).map(item => <option key={item.id} value={item.id}>{item.sub_department_name}</option>)}
              </select>
              <select value={workSectionFilter} disabled={!subDepartmentFilter} onChange={(event) => setWorkSectionFilter(event.target.value)} className="input cursor-pointer disabled:opacity-50">
                <option value="">Semua Bagian</option>
                {getWorkSectionsBySubDepartment(subDepartmentFilter).map(item => <option key={item.id} value={item.id}>{item.section_name}</option>)}
              </select>
              <select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)} className="input cursor-pointer">
                <option value="">Semua Jabatan</option>
                {[...new Set(subDepartmentPositions.map(item => item.position_name))].sort().map(position => <option key={position} value={position}>{position}</option>)}
              </select>
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Periode & Kompensasi</p>
            <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${canManage ? 'xl:grid-cols-6' : 'xl:grid-cols-4'}`}>
              <div><label className="block text-[11px] text-ink-500 mb-1">Masuk Mulai</label><input type="date" value={joinDateFrom} onChange={(event) => setJoinDateFrom(event.target.value)} className="input" /></div>
              <div><label className="block text-[11px] text-ink-500 mb-1">Masuk Sampai</label><input type="date" value={joinDateTo} onChange={(event) => setJoinDateTo(event.target.value)} className="input" /></div>
              <div><label className="block text-[11px] text-ink-500 mb-1">Masa Kerja &gt;</label><div className="relative"><input type="number" min="0" step="1" value={minimumTenureYears} onChange={(event) => setMinimumTenureYears(event.target.value)} placeholder="0" className="input pr-12" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-500">th</span></div></div>
              <div><label className="block text-[11px] text-ink-500 mb-1">Masa Kerja &le;</label><div className="relative"><input type="number" min="0" step="1" value={maximumTenureYears} onChange={(event) => setMaximumTenureYears(event.target.value)} placeholder="Tanpa batas" className="input pr-12" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-500">th</span></div></div>
              {canManage && <>
            <div>
              <label className="block text-[11px] text-ink-500 mb-1">Gaji Minimum</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-500">Rp</span>
                <input type="number" min="0" step="1" value={minimumSalary} onChange={(event) => setMinimumSalary(event.target.value)} placeholder="Tanpa batas minimum"
                  className="input pl-10" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-ink-500 mb-1">Gaji Maksimum</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-500">Rp</span>
                <input type="number" min="0" step="1" value={maximumSalary} onChange={(event) => setMaximumSalary(event.target.value)} placeholder="Contoh: 1600000"
                  className="input pl-10" />
              </div>
            </div>
              </>}
            </div>
          </div>
        </div>}
        {(search || activeFilterCount > 0) && <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3">
          <p className="text-xs text-ink-500">Menampilkan <span className="font-semibold text-ink-300">{displayedEmployees.length}</span> dari {employees.length} karyawan</p>
          <button type="button" onClick={resetAllFilters} className="btn-ghost px-3 py-1.5 text-xs text-danger-300">Reset Semua Filter</button>
        </div>}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <SortableHeader label="Karyawan" sortKey="full_name" />
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">NIK</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Posisi/Jabatan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Sub-Departemen / Bagian</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Departemen</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Tipe</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Kontrak</th>
                <SortableHeader label="Tanggal Masuk" sortKey="join_date" defaultDirection="desc" />
                <SortableHeader label="Masa Kerja" sortKey="tenure" defaultDirection="desc" />
                {canManage && <SortableHeader label="Gaji" sortKey="salary" defaultDirection="desc" />}
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={canManage ? 12 : 11} className="px-4 py-12 text-center text-ink-400">Memuat...</td></tr>
              ) : displayedEmployees.length === 0 ? (
                <tr><td colSpan={canManage ? 12 : 11} className="px-4 py-12 text-center">
                  <Users size={40} className="mx-auto text-ink-700 mb-3" />
                  <p className="text-ink-400 text-sm">Tidak ada karyawan yang sesuai dengan filter</p>
                </td></tr>
              ) : sortedEmployees.map(emp => {
                const contractInfo = getContractInfo(emp);
                return (
                  <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {emp.photo_url ? (
                          <button type="button" onClick={() => setSelectedEmployeePhoto({ url: emp.photo_url, name: emp.full_name })}
                            className="group relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                            title={`Perbesar foto ${emp.full_name}`} aria-label={`Perbesar foto ${emp.full_name}`}>
                            <img src={emp.photo_url} alt={emp.full_name} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
                            <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[9px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">Lihat</span>
                          </button>
                        ) : (
                          <div className="h-16 w-16 flex-shrink-0 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-base font-semibold text-white">
                            {emp.full_name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-white">{emp.full_name}</p>
                          <p className="text-xs text-ink-400 font-mono">{emp.employee_code}</p>
                          {canManage && getMissingEmployeeFields(emp).length > 0 && (
                            <button type="button" onClick={() => openEdit(emp)} title={`Belum lengkap: ${getMissingEmployeeFields(emp).join(', ')}`}
                              className="mt-1 inline-flex items-center gap-1 rounded border border-warning-500/20 bg-warning-500/10 px-1.5 py-0.5 text-[10px] font-medium text-warning-300">
                              <AlertCircle size={10} /> Data belum lengkap
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-ink-200">{emp.nik ? formatNIK(emp.nik) : '-'}</td>
                    <td className="px-4 py-3 text-sm text-ink-200">{getContextualPositionLabel(emp.position, emp.department_id)}</td>
                    <td className="px-4 py-3 text-sm text-ink-200">
                      <span>{subDepartments.find(s => s.id === emp.sub_department_id)?.sub_department_name || '-'}</span>
                      {emp.work_section_id && <span className="block text-xs text-primary-300">{workSections.find(item => item.id === emp.work_section_id)?.section_name || '-'}</span>}
                    </td>
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
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-ink-300">{formatJoinDate(emp.join_date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">{getEmploymentPeriod(emp.join_date)}</td>
                    {canManage && <td className="px-4 py-3">
                      <button onClick={() => setSalaryEmployee(emp)} className="text-left group">
                        <span className="text-sm font-medium text-white group-hover:text-primary-300">{salaryHistory[emp.id]?.length ? formatSalary(salaryHistory[emp.id].at(-1).amount) : '-'}</span>
                        <span className="block text-[11px] text-ink-500">Lihat history</span>
                      </button>
                    </td>}
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
        <div className="px-4 py-3 border-t border-white/5 text-xs text-ink-500">Menampilkan {displayedEmployees.length} dari {employees.length} karyawan</div>
      </div>

      {selectedEmployeePhoto && (
        <div className="modal-overlay" onClick={() => setSelectedEmployeePhoto(null)}>
          <div className="relative max-w-3xl p-3" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setSelectedEmployeePhoto(null)}
              className="absolute right-5 top-5 z-10 rounded-full border border-white/15 bg-black/65 p-2 text-white backdrop-blur hover:bg-black/80"
              aria-label="Tutup foto"><X size={20} /></button>
            <img src={selectedEmployeePhoto.url} alt={selectedEmployeePhoto.name}
              className="max-h-[80vh] max-w-[90vw] rounded-xl border border-white/10 bg-black/30 object-contain shadow-2xl" />
            <p className="mt-3 text-center text-sm font-medium text-white">{selectedEmployeePhoto.name}</p>
          </div>
        </div>
      )}

      {/* Modal Form */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">{editingId ? 'Edit Karyawan' : 'Tambah Karyawan'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-ink-400 hover:text-white hover:bg-white/5 rounded-md"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center">
                {employeePhotoPreview ? (
                  <img src={employeePhotoPreview} alt="Preview foto karyawan" className="h-20 w-20 flex-shrink-0 rounded-full border-2 border-primary-500/30 object-cover" />
                ) : (
                  <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full border-2 border-dashed border-white/15 bg-white/5">
                    <Camera size={26} className="text-ink-500" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Foto Karyawan</p>
                  <p className="mt-0.5 text-xs text-ink-500">JPG, PNG, atau WebP. Maksimal 5 MB.</p>
                  <input ref={employeePhotoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleEmployeePhotoChange} className="hidden" />
                  <button type="button" onClick={() => employeePhotoInputRef.current?.click()} className="btn-secondary mt-3 inline-flex items-center gap-2 px-3 py-2 text-xs">
                    <Upload size={14} /> {employeePhotoPreview ? 'Ganti Foto' : 'Pilih Foto'}
                  </button>
                </div>
              </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-primary-500/10">
                  <div>
                    <label className="block text-xs font-medium text-ink-400 mb-1">Bagian</label>
                    <div className="flex gap-2">
                      <select value={form.work_section_id} onChange={(e) => handleFormChange('work_section_id', e.target.value)} disabled={!form.sub_department_id}
                        className="min-w-0 flex-1 px-2 py-1.5 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer disabled:opacity-50">
                        <option value="" className="bg-ink-900">{form.sub_department_id ? 'Pilih bagian (opsional)' : 'Pilih subdepartemen dulu'}</option>
                        {getWorkSectionsBySubDepartment(form.sub_department_id).map(item => <option key={item.id} value={item.id} className="bg-ink-900">{item.section_name}</option>)}
                      </select>
                      <button type="button" onClick={handleAddWorkSection} disabled={!form.sub_department_id}
                        className="btn-secondary inline-flex items-center gap-1.5 px-3 text-xs disabled:opacity-50" title="Tambah bagian">
                        <Plus size={14} /> Bagian
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-400 mb-1">Posisi / Jabatan</label>
                    <div className="flex gap-2">
                      <select value={form.position} onChange={(e) => handleFormChange('position', e.target.value)} disabled={!form.department_id}
                        className="min-w-0 flex-1 px-2 py-1.5 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer disabled:opacity-50">
                        <option value="" className="bg-ink-900">{form.department_id ? 'Pilih jabatan' : 'Pilih departemen dulu'}</option>
                        {form.position && !getAvailablePositions().some(item => item.position_name === form.position) && <option value={form.position} className="bg-ink-900">{getContextualPositionLabel(form.position, form.department_id)}</option>}
                        {getAvailablePositions().map(item => <option key={item.id} value={item.position_name} className="bg-ink-900">{getContextualPositionLabel(item.position_name, form.department_id)}</option>)}
                      </select>
                      <button type="button" onClick={handleAddPosition} disabled={!form.department_id}
                        className="btn-secondary inline-flex items-center gap-1.5 px-3 text-xs disabled:opacity-50" title="Tambah pilihan jabatan">
                        <Plus size={14} /> Jabatan
                      </button>
                    </div>
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
                  <label className="block text-sm font-medium text-ink-300 mb-1.5">Nominal Gaji</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">Rp</span>
                    <input type="number" min="0" step="1" value={form.salary} onChange={(e) => handleFormChange('salary', e.target.value)} placeholder="0"
                      className="w-full pl-10 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-ink-500 focus:outline-none focus:border-primary-500/50 transition-all" />
                  </div>
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
                <button type="submit" disabled={uploadingEmployeePhoto} className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  <Save size={16} /> {uploadingEmployeePhoto ? 'Mengunggah Foto...' : editingId ? 'Simpan' : 'Tambah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {salaryEmployee && (() => {
        const history = salaryHistory[salaryEmployee.id] || [];
        const values = history.map(row => Number(row.amount));
        const minimumValue = values.length ? Math.min(...values) : 0;
        const maximumValue = values.length ? Math.max(...values) : 0;
        const valuePadding = Math.max((maximumValue - minimumValue) * 0.3, maximumValue * 0.035, 50000);
        const chartMinimum = Math.max(0, minimumValue - valuePadding);
        const chartMaximum = maximumValue + valuePadding;
        const chartRange = chartMaximum - chartMinimum || 1;
        const chartPoints = history.map((row, index) => ({
          x: history.length === 1 ? 370 : 70 + (index / (history.length - 1)) * 610,
          y: 190 - ((Number(row.amount) - chartMinimum) / chartRange) * 140
        }));
        const points = chartPoints.map(point => `${point.x},${point.y}`).join(' ');
        const areaPoints = chartPoints.length ? `70,205 ${points} 680,205` : '';
        const initialSalary = values[0] || 0;
        const currentSalary = values.at(-1) || 0;
        const totalChange = currentSalary - initialSalary;
        const totalChangePercentage = initialSalary ? (totalChange / initialSalary) * 100 : 0;
        const formatCompactSalary = (amount) => `Rp ${(Number(amount) / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt`;
        return <div className="modal-overlay">
          <div className="modal-content max-w-3xl w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <div><h2 className="text-lg font-semibold text-white">History & Tren Gaji</h2><p className="text-sm text-ink-400">{salaryEmployee.full_name}</p></div>
              <button onClick={() => { setSalaryEmployee(null); setShowSalaryHistoryForm(false); setEditingSalaryHistoryId(null); }} className="p-1.5 text-ink-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="mb-4 rounded-xl border border-primary-500/20 bg-primary-500/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{editingSalaryHistoryId ? 'Koreksi riwayat gaji' : 'Lengkapi perjalanan gaji'}</p>
                  <p className="text-xs text-ink-400">Tambahkan nominal lama berdasarkan tanggal mulai berlakunya.</p>
                </div>
                <button type="button" onClick={() => {
                  setShowSalaryHistoryForm(value => !value);
                  setEditingSalaryHistoryId(null);
                  if (!showSalaryHistoryForm) {
                    setSalaryHistoryForm({ amount: '', effective_date: salaryEmployee.join_date || '', notes: '' });
                  }
                }} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs">
                  <Plus size={14} /> {showSalaryHistoryForm ? 'Tutup Form' : 'Tambah Riwayat Gaji'}
                </button>
              </div>
              {showSalaryHistoryForm && (
                <form onSubmit={handleAddSalaryHistory} className="mt-4 grid grid-cols-1 gap-3 border-t border-white/10 pt-4 md:grid-cols-2">
                  <div>
                    <label className="label text-xs">Nominal Gaji</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-500">Rp</span>
                      <input type="number" min="0" step="1" value={salaryHistoryForm.amount}
                        onChange={(event) => setSalaryHistoryForm(current => ({ ...current, amount: event.target.value }))}
                        className="input pl-10" placeholder="Contoh: 1500000" required />
                    </div>
                  </div>
                  <div>
                    <label className="label text-xs">Tanggal Efektif</label>
                    <input type="date" min={salaryEmployee.join_date || undefined} value={salaryHistoryForm.effective_date}
                      onChange={(event) => setSalaryHistoryForm(current => ({ ...current, effective_date: event.target.value }))}
                      className="input" required />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label text-xs">Catatan</label>
                    <input type="text" value={salaryHistoryForm.notes}
                      onChange={(event) => setSalaryHistoryForm(current => ({ ...current, notes: event.target.value }))}
                      className="input" placeholder="Contoh: Gaji awal saat mulai bekerja" />
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <button type="submit" disabled={salaryHistorySaving} className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50">
                      <Save size={15} /> {salaryHistorySaving ? 'Menyimpan...' : editingSalaryHistoryId ? 'Simpan Perubahan' : 'Simpan Riwayat'}
                    </button>
                  </div>
                </form>
              )}
            </div>
            {history.length === 0 ? <p className="py-10 text-center text-sm text-ink-400">Belum ada history gaji.</p> : <>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Gaji Awal</p>
                  <p className="mt-1 text-lg font-bold text-white">{formatSalary(initialSalary)}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{new Date(history[0].effective_date).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}</p>
                </div>
                <div className="rounded-xl border border-primary-500/25 bg-primary-500/10 p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-300">Gaji Saat Ini</p>
                  <p className="mt-1 text-lg font-bold text-white">{formatSalary(currentSalary)}</p>
                  <p className="mt-0.5 text-xs text-ink-400">Efektif {new Date(history.at(-1).effective_date).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}</p>
                </div>
                <div className={`rounded-xl border p-3.5 ${totalChange >= 0 ? 'border-success-500/20 bg-success-500/5' : 'border-danger-500/20 bg-danger-500/5'}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Perubahan Total</p>
                  <p className={`mt-1 text-lg font-bold ${totalChange >= 0 ? 'text-success-300' : 'text-danger-300'}`}>{totalChange > 0 ? '+' : ''}{formatSalary(totalChange)}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{totalChangePercentage > 0 ? '+' : ''}{totalChangePercentage.toLocaleString('id-ID', { maximumFractionDigits: 1 })}% sejak awal</p>
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
                  <div className="flex items-center gap-2"><TrendingUp size={16} className="text-primary-400"/><span className="text-sm font-semibold text-white">Perjalanan Gaji</span></div>
                  <span className="text-xs text-ink-500">{history.length} periode perubahan</span>
                </div>
                <div className="overflow-x-auto px-2 pb-2 pt-3 sm:px-4">
                  <svg viewBox="0 0 740 245" className="h-auto min-w-[560px] w-full" role="img" aria-label={`Grafik tren gaji ${salaryEmployee.full_name}`}>
                    <defs>
                      <linearGradient id={`salary-area-${salaryEmployee.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(59,130,246)" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="rgb(59,130,246)" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                    {[0, 0.5, 1].map(level => {
                      const y = 190 - level * 140;
                      const amount = chartMinimum + level * chartRange;
                      return <g key={level}>
                        <line x1="70" y1={y} x2="680" y2={y} className="stroke-white/10" strokeDasharray="4 5" />
                        <text x="60" y={y + 4} textAnchor="end" className="fill-ink-500 text-[10px]">{formatCompactSalary(amount)}</text>
                      </g>;
                    })}
                    <polygon points={areaPoints} fill={`url(#salary-area-${salaryEmployee.id})`} />
                    <polyline points={points} fill="none" stroke="rgb(59,130,246)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    {history.map((row, index) => {
                      const point = chartPoints[index];
                      return <g key={row.id}>
                        <circle cx={point.x} cy={point.y} r="8" fill="rgb(59,130,246)" fillOpacity="0.15" />
                        <circle cx={point.x} cy={point.y} r="4" fill="rgb(59,130,246)" stroke="white" strokeWidth="2" />
                        <text x={point.x} y={Math.max(18, point.y - 14)} textAnchor="middle" className="fill-ink-200 text-[11px] font-semibold">{formatCompactSalary(row.amount)}</text>
                        <text x={point.x} y="225" textAnchor="middle" className="fill-ink-500 text-[10px]">{new Date(row.effective_date).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })}</text>
                      </g>;
                    })}
                  </svg>
                </div>
              </div>
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Riwayat Perubahan</p><p className="text-xs text-ink-500">Terbaru di atas</p></div>
                <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
                {[...history].reverse().map((row) => {
                  const change = row.previous_amount == null ? null : Number(row.amount) - Number(row.previous_amount);
                  return <div key={row.id} className="flex items-center justify-between gap-4 py-3">
                    <div><p className="text-sm font-medium text-white">{formatSalary(row.amount)}</p><p className="text-xs text-ink-500">Efektif {new Date(row.effective_date).toLocaleDateString('id-ID')} · {row.source_type === 'CONTRACT' ? 'Kontrak' : row.source_type === 'INITIAL' ? 'Gaji awal' : 'Perubahan manual'}</p></div>
                    <div className="flex items-center gap-3">
                      {change !== null && <span className={`text-xs font-medium ${change > 0 ? 'text-success-300' : change < 0 ? 'text-danger-300' : 'text-ink-400'}`}>{change > 0 ? '+' : ''}{formatSalary(change)}</span>}
                      {row.source_type !== 'CONTRACT' && <button type="button" onClick={() => {
                        setEditingSalaryHistoryId(row.id);
                        setSalaryHistoryForm({ amount: String(row.amount), effective_date: row.effective_date, notes: row.notes || '' });
                        setShowSalaryHistoryForm(true);
                      }} className="btn-ghost px-2 py-1 text-xs">Edit</button>}
                    </div>
                  </div>;
                })}
                </div>
              </div>
            </>}
          </div>
        </div>;
      })()}

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
