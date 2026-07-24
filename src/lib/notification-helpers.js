// Helper functions untuk sistem notifikasi reminder jadwal pemeliharaan

// Tipe notifikasi
export const NOTIFICATION_TYPES = {
  REMINDER_7_DAYS: 'REMINDER_7_DAYS',
  REMINDER_3_DAYS: 'REMINDER_3_DAYS',
  REMINDER_1_DAY: 'REMINDER_1_DAY',
  REMINDER_CUSTOM: 'REMINDER_CUSTOM',
  DUE_TODAY: 'DUE_TODAY',
  OVERDUE: 'OVERDUE'
};

// Label untuk setiap tipe notifikasi
export const NOTIFICATION_TYPE_LABELS = {
  [NOTIFICATION_TYPES.REMINDER_7_DAYS]: 'Pengingatan 7 Hari',
  [NOTIFICATION_TYPES.REMINDER_3_DAYS]: 'Pengingatan 3 Hari',
  [NOTIFICATION_TYPES.REMINDER_1_DAY]: 'Pengingatan 1 Hari',
  [NOTIFICATION_TYPES.REMINDER_CUSTOM]: 'Pengingatan',
  [NOTIFICATION_TYPES.DUE_TODAY]: 'Jatuh Tempo Hari Ini',
  [NOTIFICATION_TYPES.OVERDUE]: 'Terlambat'
};

// Warna badge untuk setiap tipe notifikasi
export const NOTIFICATION_TYPE_COLORS = {
  [NOTIFICATION_TYPES.REMINDER_7_DAYS]: 'blue',
  [NOTIFICATION_TYPES.REMINDER_3_DAYS]: 'yellow',
  [NOTIFICATION_TYPES.REMINDER_1_DAY]: 'orange',
  [NOTIFICATION_TYPES.REMINDER_CUSTOM]: 'blue',
  [NOTIFICATION_TYPES.DUE_TODAY]: 'red',
  [NOTIFICATION_TYPES.OVERDUE]: 'red'
};

// Ikon untuk setiap tipe notifikasi (nama icon lucide-react)
export const NOTIFICATION_TYPE_ICONS = {
  [NOTIFICATION_TYPES.REMINDER_7_DAYS]: 'Calendar',
  [NOTIFICATION_TYPES.REMINDER_3_DAYS]: 'Calendar',
  [NOTIFICATION_TYPES.REMINDER_1_DAY]: 'Calendar',
  [NOTIFICATION_TYPES.REMINDER_CUSTOM]: 'Calendar',
  [NOTIFICATION_TYPES.DUE_TODAY]: 'AlertCircle',
  [NOTIFICATION_TYPES.OVERDUE]: 'AlertTriangle'
};

/**
 * Hitung selisih hari antara dua tanggal
 * @param {string|Date} date1
 * @param {string|Date} date2
 * @returns {number} selisih hari (positif jika date1 > date2)
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
 * @returns {string}
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
 * @param {string|Date} date
 * @returns {string}
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
 * Format tanggal ke format Indonesia panjang (Senin, 15 Januari 2026)
 * @param {string|Date} date
 * @returns {string}
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
 * Format tanggal relatif (misal: "7 hari lagi", "kemarin", "hari ini")
 * @param {string|Date} date
 * @returns {string}
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
 * Dapatkan label filter notifikasi
 * @param {string} filter
 * @returns {string}
 */
export function getNotificationFilterLabel(filter) {
  const labels = {
    all: 'Semua',
    unread: 'Belum Dibaca',
    read: 'Sudah Dibaca',
    upcoming: 'Mendatang',
    due: 'Jatuh Tempo',
    overdue: 'Terlambat'
  };
  return labels[filter] || 'Semua';
}

/**
 * Dapatkan ikon berdasarkan tipe notifikasi
 * @param {string} type
 * @returns {string} nama icon lucide-react
 */
export function getNotificationIcon(type) {
  return NOTIFICATION_TYPE_ICONS[type] || 'Bell';
}

/**
 * Dapatkan warna badge berdasarkan tipe notifikasi
 * @param {string} type
 * @returns {string}
 */
export function getNotificationColor(type) {
  return NOTIFICATION_TYPE_COLORS[type] || 'gray';
}

/**
 * Dapatkan label berdasarkan tipe notifikasi
 * @param {string} type
 * @returns {string}
 */
export function getNotificationTypeLabel(type) {
  return NOTIFICATION_TYPE_LABELS[type] || type;
}

/**
 * Cek apakah notifikasi termasuk kategori "mendatang"
 * @param {string} type
 * @returns {boolean}
 */
export function isUpcomingNotification(type) {
  return [
    NOTIFICATION_TYPES.REMINDER_7_DAYS,
    NOTIFICATION_TYPES.REMINDER_3_DAYS,
    NOTIFICATION_TYPES.REMINDER_1_DAY,
    NOTIFICATION_TYPES.REMINDER_CUSTOM
  ].includes(type);
}

/**
 * Cek apakah notifikasi termasuk kategori "jatuh tempo"
 * @param {string} type
 * @returns {boolean}
 */
export function isDueNotification(type) {
  return type === NOTIFICATION_TYPES.DUE_TODAY;
}

/**
 * Cek apakah notifikasi termasuk kategori "terlambat"
 * @param {string} type
 * @returns {boolean}
 */
export function isOverdueNotification(type) {
  return type === NOTIFICATION_TYPES.OVERDUE;
}

/**
 * Bangun pesan notifikasi berdasarkan jenis pemeliharaan dan aset
 * @param {string} maintenanceTypeName - Nama jenis pemeliharaan
 * @param {string} assetCode - Kode aset
 * @param {string} assetName - Nama aset
 * @param {string} type - Tipe notifikasi
 * @param {number} daysLate - Jumlah hari terlambat (untuk OVERDUE)
 * @returns {string}
 */
export function buildNotificationMessage(maintenanceTypeName, assetCode, assetName, type, daysLate = 0, reminderDays = 0) {
  const assetLabel = `${assetCode} - ${assetName}`;
  const maintenanceLabel = maintenanceTypeName;

  switch (type) {
    case NOTIFICATION_TYPES.REMINDER_7_DAYS:
      return `${maintenanceLabel} untuk ${assetLabel} akan jatuh tempo dalam 7 hari.`;
    case NOTIFICATION_TYPES.REMINDER_3_DAYS:
      return `${maintenanceLabel} untuk ${assetLabel} akan jatuh tempo dalam 3 hari.`;
    case NOTIFICATION_TYPES.REMINDER_1_DAY:
      return `${maintenanceLabel} untuk ${assetLabel} akan jatuh tempo besok.`;
    case NOTIFICATION_TYPES.REMINDER_CUSTOM:
      return `${maintenanceLabel} untuk ${assetLabel} akan jatuh tempo dalam ${reminderDays} hari.`;
    case NOTIFICATION_TYPES.DUE_TODAY:
      return `${maintenanceLabel} untuk ${assetLabel} harus dilaksanakan hari ini.`;
    case NOTIFICATION_TYPES.OVERDUE:
      return `${maintenanceLabel} untuk ${assetLabel} telah terlambat ${daysLate} hari.`;
    default:
      return `${maintenanceLabel} untuk ${assetLabel}.`;
  }
}

/**
 * Bangun judul notifikasi berdasarkan tipe
 * @param {string} type
 * @returns {string}
 */
export function buildNotificationTitle(type) {
  switch (type) {
    case NOTIFICATION_TYPES.REMINDER_7_DAYS:
    case NOTIFICATION_TYPES.REMINDER_3_DAYS:
    case NOTIFICATION_TYPES.REMINDER_1_DAY:
    case NOTIFICATION_TYPES.REMINDER_CUSTOM:
      return 'Jadwal Pemeliharaan Mendatang';
    case NOTIFICATION_TYPES.DUE_TODAY:
      return 'Pemeliharaan Jatuh Tempo Hari Ini';
    case NOTIFICATION_TYPES.OVERDUE:
      return 'Pemeliharaan Terlambat';
    default:
      return 'Notifikasi';
  }
}
