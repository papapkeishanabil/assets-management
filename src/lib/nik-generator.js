// NIK Generator - Format: [DIVISI_2DIGIT][DEPT_2DIGIT][SUBDEPT_2DIGIT][TAHUN_4DIGIT][URUTAN_4DIGIT]
// Total: 14 digit (SEMUA ANGKA)

/**
 * Generate NIK otomatis berdasarkan struktur organisasi
 * @param {number} divisionNum - Nomor divisi (1-99)
 * @param {number} departmentNum - Nomor departemen (1-99)
 * @param {number} subDepartmentNum - Nomor sub departemen (0-99, 0 jika tidak ada)
 * @param {string} year - Tahun masuk (4 digit)
 * @param {number} sequence - Nomor urut (1-9999)
 * @returns {string} NIK 14 digit semua angka
 */
export function generateNIK(divisionNum, departmentNum, subDepartmentNum, year, sequence) {
  const div = String(divisionNum).padStart(2, '0').slice(-2);
  const dept = String(departmentNum).padStart(2, '0').slice(-2);
  const sub = String(subDepartmentNum || 0).padStart(2, '0').slice(-2);
  const yr = String(year).slice(-4);
  const seq = String(sequence).padStart(4, '0').slice(-4);
  
  return `${div}${dept}${sub}${yr}${seq}`;
}

/**
 * Format NIK untuk tampilan (dengan separator)
 * @param {string} nik - NIK 14 digit
 * @returns {string} NIK dengan format XX-XX-XX-XXXX-XXXX
 */
export function formatNIK(nik) {
  if (!nik || nik.length !== 14) return nik;
  return `${nik.slice(0, 2)}-${nik.slice(2, 4)}-${nik.slice(4, 6)}-${nik.slice(6, 10)}-${nik.slice(10, 14)}`;
}

/**
 * Parse NIK untuk mendapatkan komponen
 * @param {string} nik - NIK 14 digit
 * @returns {object} Komponen NIK
 */
export function parseNIK(nik) {
  if (!nik || nik.length !== 14) return null;
  
  return {
    divisionNum: parseInt(nik.slice(0, 2)),
    departmentNum: parseInt(nik.slice(2, 4)),
    subDepartmentNum: parseInt(nik.slice(4, 6)),
    year: nik.slice(6, 10),
    sequence: parseInt(nik.slice(10, 14))
  };
}

/**
 * Generate NIK otomatis dari database
 * Menggunakan urutan divisi/departemen/sub-departemen sebagai kode angka
 * @param {object} supabase - Supabase client
 * @param {string} divisionId - UUID divisi
 * @param {string} departmentId - UUID departemen
 * @param {string} subDepartmentId - UUID sub departemen (bisa null)
 * @param {string} year - Tahun masuk
 * @returns {Promise<string>} NIK yang di-generate (14 digit angka)
 */
export async function generateNIKFromDB(supabase, divisionId, departmentId, subDepartmentId, year) {
  try {
    // 1. Ambil semua divisi yang aktif, urutkan by created_at
    const { data: allDivisions } = await supabase
      .from('divisions')
      .select('id')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    
    // Cari index divisi yang dipilih
    const divIndex = allDivisions?.findIndex(d => d.id === divisionId);
    if (divIndex === -1 || divIndex === undefined) throw new Error('Divisi tidak ditemukan');
    const divisionNum = divIndex + 1; // mulai dari 1
    
    // 2. Ambil semua departemen yang aktif, urutkan by created_at
    const { data: allDepartments } = await supabase
      .from('departments')
      .select('id')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    
    // Cari index departemen yang dipilih
    const deptIndex = allDepartments?.findIndex(d => d.id === departmentId);
    if (deptIndex === -1 || deptIndex === undefined) throw new Error('Departemen tidak ditemukan');
    const departmentNum = deptIndex + 1; // mulai dari 1
    
    // 3. Ambil sub departemen (jika ada)
    let subDepartmentNum = 0; // Default 0 jika tidak ada sub dept
    if (subDepartmentId) {
      const { data: allSubDepts } = await supabase
        .from('sub_departments')
        .select('id')
        .order('created_at', { ascending: true });
      
      const subIndex = allSubDepts?.findIndex(s => s.id === subDepartmentId);
      if (subIndex !== -1 && subIndex !== undefined) {
        subDepartmentNum = subIndex + 1; // mulai dari 1
      }
    }
    
    // 4. Ambil nomor urut berdasarkan jumlah keseluruhan karyawan
    // Nomor urut adalah global (tidak per divisi/dept/tahun)
    // sehingga setiap karyawan memiliki nomor urut unik
    const { count } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true });
    
    let sequence = (count || 0) + 1;
    
    // Pastikan tidak ada NIK dengan nomor urut yang sama
    // Cari nomor urut terbesar dari semua NIK yang ada
    const { data: allEmployees } = await supabase
      .from('employees')
      .select('nik')
      .not('nik', 'is', null)
      .order('nik', { ascending: false })
      .limit(100);
    
    if (allEmployees && allEmployees.length > 0) {
      const maxSeq = allEmployees.reduce((max, emp) => {
        if (emp.nik && emp.nik.length === 14) {
          const seq = parseInt(emp.nik.slice(-4));
          return Math.max(max, seq);
        }
        return max;
      }, 0);
      sequence = Math.max(sequence, maxSeq + 1);
    }
    
    return generateNIK(divisionNum, departmentNum, subDepartmentNum, year, sequence);
  } catch (error) {
    console.error('Error generating NIK:', error);
    throw error;
  }
}