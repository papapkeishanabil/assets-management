// Role definitions
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  DIREKSI: 'direksi',
  HRD: 'hrd',
  PELAKSANA: 'pelaksana'
};

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.DIREKSI]: 'Direksi',
  [ROLES.HRD]: 'HRD / Admin Asset',
  [ROLES.PELAKSANA]: 'Pelaksana / Teknisi'
};

export const ROLE_OPTIONS = [
  { value: ROLES.SUPER_ADMIN, label: ROLE_LABELS[ROLES.SUPER_ADMIN] },
  { value: ROLES.DIREKSI, label: ROLE_LABELS[ROLES.DIREKSI] },
  { value: ROLES.HRD, label: ROLE_LABELS[ROLES.HRD] },
  { value: ROLES.PELAKSANA, label: ROLE_LABELS[ROLES.PELAKSANA] }
];

// Account status
export const ACCOUNT_STATUS = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
  DISABLED: 'DISABLED'
};

export const ACCOUNT_STATUS_LABELS = {
  [ACCOUNT_STATUS.PENDING]: 'Menunggu Persetujuan',
  [ACCOUNT_STATUS.ACTIVE]: 'Aktif',
  [ACCOUNT_STATUS.REJECTED]: 'Ditolak',
  [ACCOUNT_STATUS.DISABLED]: 'Dinonaktifkan'
};

export const ACCOUNT_STATUS_COLORS = {
  [ACCOUNT_STATUS.PENDING]: 'yellow',
  [ACCOUNT_STATUS.ACTIVE]: 'green',
  [ACCOUNT_STATUS.REJECTED]: 'red',
  [ACCOUNT_STATUS.DISABLED]: 'gray'
};

// Asset conditions
export const ASSET_CONDITIONS = {
  SANGAT_BAIK: 'Sangat Baik',
  BAIK: 'Baik',
  PERLU_PERHATIAN: 'Perlu Perhatian',
  RUSAK_RINGAN: 'Rusak Ringan',
  RUSAK_BERAT: 'Rusak Berat'
};

// Inspection lifecycle (pemeriksaan surveyor -> penilaian HRD/Teknisi)
export const INSPECTION_STATUS = {
  DRAFT: 'draft',
  MENUNGGU_PENILAIAN: 'menunggu_penilaian',
  SELESAI: 'selesai'
};

export const INSPECTION_STATUS_LABELS = {
  [INSPECTION_STATUS.DRAFT]: 'Draft',
  [INSPECTION_STATUS.MENUNGGU_PENILAIAN]: 'Menunggu Penilaian',
  [INSPECTION_STATUS.SELESAI]: 'Selesai Dinilai'
};

export const INSPECTION_STATUS_COLORS = {
  [INSPECTION_STATUS.DRAFT]: 'gray',
  [INSPECTION_STATUS.MENUNGGU_PENILAIAN]: 'yellow',
  [INSPECTION_STATUS.SELESAI]: 'green'
};

// Hasil penilaian kondisi oleh HRD/Teknisi (nilai simpan di DB)
export const INSPECTION_REVIEW_RESULTS = {
  LANJUTKAN: 'lanjut_pakai',
  PERLU_PERHATIAN: 'perlu_perhatian',
  PERLU_PERBAIKAN: 'perlu_perbaikan'
};

export const INSPECTION_REVIEW_RESULT_LABELS = {
  [INSPECTION_REVIEW_RESULTS.LANJUTKAN]: 'Baik, lanjut dipakai',
  [INSPECTION_REVIEW_RESULTS.PERLU_PERHATIAN]: 'Perlu perhatian',
  [INSPECTION_REVIEW_RESULTS.PERLU_PERBAIKAN]: 'Perlu segera diperbaiki'
};

export const ASSET_CONDITION_COLORS = {
  [ASSET_CONDITIONS.SANGAT_BAIK]: 'green',
  [ASSET_CONDITIONS.BAIK]: 'blue',
  [ASSET_CONDITIONS.PERLU_PERHATIAN]: 'yellow',
  [ASSET_CONDITIONS.RUSAK_RINGAN]: 'orange',
  [ASSET_CONDITIONS.RUSAK_BERAT]: 'red'
};

// Asset statuses
export const ASSET_STATUSES = {
  AKTIF: 'Aktif',
  DALAM_PEMELIHARAAN: 'Dalam Pemeliharaan',
  RUSAK: 'Rusak',
  TIDAK_DIGUNAKAN: 'Tidak Digunakan',
  DIPINJAMKAN: 'Dipinjamkan',
  BERADA_DI_VENDOR: 'Berada di Vendor',
  DIJUAL: 'Dijual',
  DIHAPUSKAN: 'Dihapuskan',
  HILANG: 'Hilang'
};

export const ASSET_STATUS_COLORS = {
  [ASSET_STATUSES.AKTIF]: 'green',
  [ASSET_STATUSES.DALAM_PEMELIHARAAN]: 'blue',
  [ASSET_STATUSES.RUSAK]: 'red',
  [ASSET_STATUSES.TIDAK_DIGUNAKAN]: 'gray',
  [ASSET_STATUSES.DIPINJAMKAN]: 'purple',
  [ASSET_STATUSES.BERADA_DI_VENDOR]: 'orange',
  [ASSET_STATUSES.DIJUAL]: 'teal',
  [ASSET_STATUSES.DIHAPUSKAN]: 'gray',
  [ASSET_STATUSES.HILANG]: 'red'
};

// Location types
export const LOCATION_TYPES = {
  KANTOR: 'Kantor',
  PABRIK: 'Pabrik',
  GUDANG: 'Gudang',
  RUANGAN: 'Ruangan',
  AREA_PRODUKSI: 'Area Produksi',
  KENDARAAN: 'Kendaraan',
  LOKASI_VENDOR: 'Lokasi Vendor',
  LOKASI_LAINNYA: 'Lokasi Lainnya'
};

// Vendor types
export const VENDOR_TYPES = {
  SUPPLIER_MESIN: 'Supplier Mesin',
  SUPPLIER_SPARE_PART: 'Supplier Spare Part',
  BENGKEL_MOBIL: 'Bengkel Mobil',
  BENGKEL_MOTOR: 'Bengkel Motor',
  TEKNISI_MESIN: 'Teknisi Mesin',
  TEKNISI_LISTRIK: 'Teknisi Listrik',
  TEKNISI_KOMPUTER: 'Teknisi Komputer',
  VENDOR_MAINTENANCE: 'Vendor Maintenance',
  SUPPLIER_UMUM: 'Supplier Umum',
  LAINNYA: 'Lainnya'
};

// Deactivation reasons
export const DEACTIVATION_REASONS = {
  DIJUAL: 'Dijual',
  DIHAPUSKAN: 'Dihapuskan',
  RUSAK_BERAT: 'Rusak Berat',
  HILANG: 'Hilang',
  TIDAK_DIGUNAKAN: 'Tidak Digunakan',
  DATA_DUPLIKAT: 'Data Duplikat',
  LAINNYA: 'Alasan Lainnya'
};

// Document types
export const DOCUMENT_TYPES = {
  INVOICE: 'Invoice',
  MANUAL: 'Manual Mesin',
  KARTU_GARANSI: 'Kartu Garansi',
  STNK: 'STNK',
  BPKB: 'BPKB',
  FAKTUR_KENDARAAN: 'Faktur Kendaraan',
  DOKUMEN_SERVIS: 'Dokumen Servis',
  LAINNYA: 'Dokumen Lainnya'
};

// Helper functions
export function formatDate(date) {
  if (!date) return '-';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export function formatDateTime(date) {
  if (!date) return '-';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year} ${hours}:${minutes}`;
}

export function formatCurrency(value) {
  if (!value && value !== 0) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
        maximumFractionDigits: 0
  }).format(value);
}

// ============================================================
// PPM (Pre-Production Meeting) Constants
// ============================================================

// Meeting statuses
export const PPM_MEETING_STATUS = {
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

export const PPM_MEETING_STATUS_LABELS = {
  [PPM_MEETING_STATUS.SCHEDULED]: 'Terjadwal',
  [PPM_MEETING_STATUS.IN_PROGRESS]: 'Sedang Berlangsung',
  [PPM_MEETING_STATUS.COMPLETED]: 'Selesai',
  [PPM_MEETING_STATUS.CANCELLED]: 'Dibatalkan'
};

export const PPM_MEETING_STATUS_COLORS = {
  [PPM_MEETING_STATUS.SCHEDULED]: 'blue',
  [PPM_MEETING_STATUS.IN_PROGRESS]: 'yellow',
  [PPM_MEETING_STATUS.COMPLETED]: 'green',
  [PPM_MEETING_STATUS.CANCELLED]: 'gray'
};

// PO statuses
export const PPM_PO_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_REVIEW: 'IN_REVIEW',
  COMPLETED: 'COMPLETED'
};

export const PPM_PO_STATUS_LABELS = {
  [PPM_PO_STATUS.NOT_STARTED]: 'Belum Dibahas',
  [PPM_PO_STATUS.IN_REVIEW]: 'Sedang Dibahas',
  [PPM_PO_STATUS.COMPLETED]: 'Selesai'
};

export const PPM_PO_STATUS_COLORS = {
  [PPM_PO_STATUS.NOT_STARTED]: 'gray',
  [PPM_PO_STATUS.IN_REVIEW]: 'yellow',
  [PPM_PO_STATUS.COMPLETED]: 'green'
};

// Badge color class mapping
export const BADGE_COLOR_CLASSES = {
  gray: 'badge-gray',
  yellow: 'badge-yellow',
  green: 'badge-green',
  red: 'badge-red',
  blue: 'badge-blue',
  orange: 'badge-orange',
  indigo: 'badge-indigo'
};

// Allowed document file types
export const PPM_DOCUMENT_TYPES = {
  IMAGE: ['image/jpeg', 'image/jpg', 'image/png'],
  PDF: ['application/pdf']
};

export const PPM_ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf'];
export const PPM_FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB
export const PPM_STORAGE_BUCKET = 'ppm-documents';

// Re-export formatDateLongID from helpers for convenience
export { formatDateLongID, isImageDocument, isPdfDocument } from './ppm-helpers';