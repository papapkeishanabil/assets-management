// Helper functions untuk sistem notifikasi kontrak

// Tipe notifikasi kontrak
export const CONTRACT_NOTIFICATION_TYPES = {
  REMINDER_30_DAYS: 'CONTRACT_REMINDER_30_DAYS',
  REMINDER_14_DAYS: 'CONTRACT_REMINDER_14_DAYS',
  REMINDER_7_DAYS: 'CONTRACT_REMINDER_7_DAYS',
  REMINDER_3_DAYS: 'CONTRACT_REMINDER_3_DAYS',
  REMINDER_1_DAY: 'CONTRACT_REMINDER_1_DAY',
  DUE_TODAY: 'CONTRACT_DUE_TODAY',
  OVERDUE: 'CONTRACT_OVERDUE'
};

// Label untuk setiap tipe notifikasi kontrak
export const CONTRACT_NOTIFICATION_LABELS = {
  [CONTRACT_NOTIFICATION_TYPES.REMINDER_30_DAYS]: 'Pengingatan 30 Hari',
  [CONTRACT_NOTIFICATION_TYPES.REMINDER_14_DAYS]: 'Pengingatan 14 Hari',
  [CONTRACT_NOTIFICATION_TYPES.REMINDER_7_DAYS]: 'Pengingatan 7 Hari',
  [CONTRACT_NOTIFICATION_TYPES.REMINDER_3_DAYS]: 'Pengingatan 3 Hari',
  [CONTRACT_NOTIFICATION_TYPES.REMINDER_1_DAY]: 'Pengingatan 1 Hari',
  [CONTRACT_NOTIFICATION_TYPES.DUE_TODAY]: 'Kontrak Berakhir Hari Ini',
  [CONTRACT_NOTIFICATION_TYPES.OVERDUE]: 'Kontrak Terlambat'
};

// Warna badge untuk setiap tipe notifikasi kontrak
export const CONTRACT_NOTIFICATION_COLORS = {
  [CONTRACT_NOTIFICATION_TYPES.REMINDER_30_DAYS]: 'blue',
  [CONTRACT_NOTIFICATION_TYPES.REMINDER_14_DAYS]: 'blue',
  [CONTRACT_NOTIFICATION_TYPES.REMINDER_7_DAYS]: 'yellow',
  [CONTRACT_NOTIFICATION_TYPES.REMINDER_3_DAYS]: 'orange',
  [CONTRACT_NOTIFICATION_TYPES.REMINDER_1_DAY]: 'orange',
  [CONTRACT_NOTIFICATION_TYPES.DUE_TODAY]: 'red',
  [CONTRACT_NOTIFICATION_TYPES.OVERDUE]: 'red'
};

// Ikon untuk setiap tipe notifikasi kontrak
export const CONTRACT_NOTIFICATION_ICONS = {
  [CONTRACT_NOTIFICATION_TYPES.REMINDER_30_DAYS]: 'FileText',
  [CONTRACT_NOTIFICATION_TYPES.REMINDER_14_DAYS]: 'FileText',
  [CONTRACT_NOTIFICATION_TYPES.REMINDER_7_DAYS]: 'FileText',
  [CONTRACT_NOTIFICATION_TYPES.REMINDER_3_DAYS]: 'FileText',
  [CONTRACT_NOTIFICATION_TYPES.REMINDER_1_DAY]: 'FileText',
  [CONTRACT_NOTIFICATION_TYPES.DUE_TODAY]: 'AlertCircle',
  [CONTRACT_NOTIFICATION_TYPES.OVERDUE]: 'AlertTriangle'
};

// Status kontrak
export const CONTRACT_STATUSES = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  TERMINATED: 'TERMINATED',
  RENEWED: 'RENEWED',
  CANCELLED: 'CANCELLED'
};

export const CONTRACT_STATUS_LABELS = {
  [CONTRACT_STATUSES.DRAFT]: 'Draft',
  [CONTRACT_STATUSES.ACTIVE]: 'Aktif',
  [CONTRACT_STATUSES.EXPIRED]: 'Berakhir',
  [CONTRACT_STATUSES.TERMINATED]: 'Dihentikan',
  [CONTRACT_STATUSES.RENEWED]: 'Diperpanjang',
  [CONTRACT_STATUSES.CANCELLED]: 'Dibatalkan'
};

export const CONTRACT_STATUS_COLORS = {
  [CONTRACT_STATUSES.DRAFT]: 'gray',
  [CONTRACT_STATUSES.ACTIVE]: 'green',
  [CONTRACT_STATUSES.EXPIRED]: 'red',
  [CONTRACT_STATUSES.TERMINATED]: 'red',
  [CONTRACT_STATUSES.RENEWED]: 'blue',
  [CONTRACT_STATUSES.CANCELLED]: 'gray'
};

// Kategori kontrak
export const CONTRACT_CATEGORIES = {
  EMPLOYEE: 'EMPLOYEE',
  VENDOR: 'VENDOR',
  OTHER: 'OTHER'
};

export const CONTRACT_CATEGORY_LABELS = {
  [CONTRACT_CATEGORIES.EMPLOYEE]: 'Karyawan',
  [CONTRACT_CATEGORIES.VENDOR]: 'Vendor',
  [CONTRACT_CATEGORIES.OTHER]: 'Lainnya'
};

/**
 * Hitung selisih hari antara dua tanggal
 */
export function getDayDiff(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.ceil((d1 - d2) / (1000 * 60 * 60 * 24));
}

/**
 * Dapatkan tanggal hari ini dalam format YYYY-MM-DD
 */
export function getTodayDate() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  return `${year}-${month}-${day}`;
}

/**
 * Format tanggal ke format Indonesia (DD-MM-YYYY)
 */
export function formatDateID(date) {
  if (!date) return '-';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Format tanggal ke format Indonesia panjang
 */
export function formatDateLongID(date) {
  if (!date) return '-';
  const d = new Date(date);
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const dayName = days[d.getDay()];
  const day = d.getDate();
  const monthName = months[d.getMonth()];
  const year = d.getFullYear();
  return `${dayName}, ${day} ${monthName} ${year}`;
}

/**
 * Format tanggal relatif
 */
export function formatRelativeDate(date) {
  if (!date) return '-';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'hari ini';
  if (diffDays === 1) return 'besok';
  if (diffDays === -1) return 'kemarin';
  if (diffDays > 0) return `${diffDays} hari lagi`;
  return `${Math.abs(diffDays)} hari yang lalu`;
}

/**
 * Format nilai kontrak ke Rupiah
 */
export function formatCurrency(value) {
  if (!value && value !== 0) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Bangun pesan notifikasi kontrak
 */
export function buildContractNotificationMessage(contractTitle, contractNumber, partyName, type, daysLate = 0, reminderDays = 0) {
  const contractLabel = `${contractNumber} - ${contractTitle}`;
  const partyLabel = partyName || '-';

  switch (type) {
    case CONTRACT_NOTIFICATION_TYPES.REMINDER_30_DAYS:
      return `Kontrak "${contractLabel}" (${partyLabel}) akan berakhir dalam 30 hari.`;
    case CONTRACT_NOTIFICATION_TYPES.REMINDER_14_DAYS:
      return `Kontrak "${contractLabel}" (${partyLabel}) akan berakhir dalam 14 hari.`;
    case CONTRACT_NOTIFICATION_TYPES.REMINDER_7_DAYS:
      return `Kontrak "${contractLabel}" (${partyLabel}) akan berakhir dalam 7 hari.`;
    case CONTRACT_NOTIFICATION_TYPES.REMINDER_3_DAYS:
      return `Kontrak "${contractLabel}" (${partyLabel}) akan berakhir dalam 3 hari.`;
    case CONTRACT_NOTIFICATION_TYPES.REMINDER_1_DAY:
      return `Kontrak "${contractLabel}" (${partyLabel}) akan berakhir besok.`;
    case CONTRACT_NOTIFICATION_TYPES.DUE_TODAY:
      return `Kontrak "${contractLabel}" (${partyLabel}) berakhir hari ini.`;
    case CONTRACT_NOTIFICATION_TYPES.OVERDUE:
      return `Kontrak "${contractLabel}" (${partyLabel}) telah berakhir ${daysLate} hari yang lalu.`;
    default:
      return `Kontrak "${contractLabel}" (${partyLabel}).`;
  }
}

/**
 * Bangun judul notifikasi kontrak
 */
export function buildContractNotificationTitle(type) {
  switch (type) {
    case CONTRACT_NOTIFICATION_TYPES.REMINDER_30_DAYS:
    case CONTRACT_NOTIFICATION_TYPES.REMINDER_14_DAYS:
    case CONTRACT_NOTIFICATION_TYPES.REMINDER_7_DAYS:
    case CONTRACT_NOTIFICATION_TYPES.REMINDER_3_DAYS:
    case CONTRACT_NOTIFICATION_TYPES.REMINDER_1_DAY:
      return 'Kontrak Akan Berakhir';
    case CONTRACT_NOTIFICATION_TYPES.DUE_TODAY:
      return 'Kontrak Berakhir Hari Ini';
    case CONTRACT_NOTIFICATION_TYPES.OVERDUE:
      return 'Kontrak Telah Berakhir';
    default:
      return 'Notifikasi Kontrak';
  }
}