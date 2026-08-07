// Helper functions untuk modul jadwal pemeliharaan berdasarkan waktu

// Interval units yang diperbolehkan
export const INTERVAL_UNITS = {
  DAY: 'DAY',
  WEEK: 'WEEK',
  MONTH: 'MONTH',
  YEAR: 'YEAR'
};

export const INTERVAL_UNIT_LABELS = {
  [INTERVAL_UNITS.DAY]: 'Hari',
  [INTERVAL_UNITS.WEEK]: 'Minggu',
  [INTERVAL_UNITS.MONTH]: 'Bulan',
  [INTERVAL_UNITS.YEAR]: 'Tahun'
};

// Interval type untuk jadwal pemeliharaan
export const INTERVAL_TYPE = {
  TIME: 'TIME',
  ODOMETER: 'ODOMETER',
  BOTH: 'BOTH'
};

export const INTERVAL_TYPE_LABELS = {
  [INTERVAL_TYPE.TIME]: 'Berdasarkan Waktu',
  [INTERVAL_TYPE.ODOMETER]: 'Berdasarkan Kilometer',
  [INTERVAL_TYPE.BOTH]: 'Berdasarkan Waktu & Kilometer'
};

// Status jadwal
export const SCHEDULE_STATUS = {
  SAFE: 'SAFE',
  APPROACHING: 'APPROACHING',
  DUE: 'DUE',
  OVERDUE: 'OVERDUE',
  INACTIVE: 'INACTIVE'
};

export const SCHEDULE_STATUS_LABELS = {
  [SCHEDULE_STATUS.SAFE]: 'Aman',
  [SCHEDULE_STATUS.APPROACHING]: 'Mendekati Jadwal',
  [SCHEDULE_STATUS.DUE]: 'Jatuh Tempo',
  [SCHEDULE_STATUS.OVERDUE]: 'Terlambat',
  [SCHEDULE_STATUS.INACTIVE]: 'Nonaktif'
};

export const SCHEDULE_STATUS_COLORS = {
  [SCHEDULE_STATUS.SAFE]: 'green',
  [SCHEDULE_STATUS.APPROACHING]: 'yellow',
  [SCHEDULE_STATUS.DUE]: 'blue',
  [SCHEDULE_STATUS.OVERDUE]: 'red',
  [SCHEDULE_STATUS.INACTIVE]: 'gray'
};

/**
 * Hitung tanggal berikutnya berdasarkan interval
 * @param {string|Date} lastDate - Tanggal pemeliharaan terakhir
 * @param {number} intervalValue - Nilai interval
 * @param {string} intervalUnit - Satuan interval (DAY, WEEK, MONTH, YEAR)
 * @returns {Date} Tanggal berikutnya
 */
export function calculateNextDate(lastDate, intervalValue, intervalUnit) {
  const baseDate = new Date(lastDate);
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const day = baseDate.getDate();

  let nextDate;

  switch (intervalUnit) {
    case INTERVAL_UNITS.DAY:
      nextDate = new Date(baseDate);
      nextDate.setDate(day + intervalValue);
      break;

    case INTERVAL_UNITS.WEEK:
      nextDate = new Date(baseDate);
      nextDate.setDate(day + (intervalValue * 7));
      break;

    case INTERVAL_UNITS.MONTH:
      // Hitung bulan dengan benar, tangani perbedaan jumlah hari per bulan
      nextDate = new Date(year, month + intervalValue, day);
      // Jika tanggal melebihi akhir bulan, JS akan otomatis menggeser ke bulan berikutnya
      // Pastikan tanggal valid
      if (nextDate.getMonth() !== (month + intervalValue) % 12 && intervalValue > 0) {
        // Tanggal tidak valid untuk bulan target, gunakan tanggal terakhir bulan target
        nextDate = new Date(year, month + intervalValue + 1, 0); // Tanggal 0 = hari terakhir bulan sebelumnya
      }
      break;

    case INTERVAL_UNITS.YEAR:
      nextDate = new Date(year + intervalValue, month, day);
      // Tangani kasus 29 Februari
      if (nextDate.getMonth() !== month) {
        nextDate = new Date(year + intervalValue, month + 1, 0);
      }
      break;

    default:
      nextDate = new Date(baseDate);
      break;
  }

  return nextDate;
}

/**
 * Hitung kilometer berikutnya berdasarkan interval odometer
 * @param {number} lastOdometer - Kilometer terakhir
 * @param {number} odometerInterval - Interval kilometer (misal: 5000)
 * @returns {number} Kilometer berikutnya
 */
export function calculateNextOdometer(lastOdometer, odometerInterval) {
  if (!lastOdometer || !odometerInterval) return null;
  return parseFloat(lastOdometer) + parseFloat(odometerInterval);
}

/**
 * Cek apakah tanggal adalah hari kerja (Senin-Jumat)
 * @param {Date} date
 * @returns {boolean}
 */
export function isWeekday(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5; // 1 = Senin, 5 = Jumat
}

/**
 * Sesuaikan tanggal ke hari Senin jika jatuh pada akhir pekan
 * @param {Date} date
 * @returns {{date: Date, adjusted: boolean}}
 */
export function adjustToWeekday(date) {
  const result = new Date(date);
  let adjusted = false;

  while (!isWeekday(result)) {
    result.setDate(result.getDate() + 1);
    adjusted = true;
  }

  return { date: result, adjusted };
}

/**
 * Hitung tanggal berikutnya dengan penyesuaian hari kerja
 * @param {string|Date} lastDate
 * @param {number} intervalValue
 * @param {string} intervalUnit
 * @returns {{nextDate: Date, adjusted: boolean}}
 */
export function calculateNextMaintenanceDate(lastDate, intervalValue, intervalUnit) {
  const nextDate = calculateNextDate(lastDate, intervalValue, intervalUnit);
  const { date: adjustedDate, adjusted } = adjustToWeekday(nextDate);
  return { nextDate: adjustedDate, adjusted };
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
 * Format tanggal ke format Indonesia dengan nama hari (Senin, 15 Januari 2026)
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
 * Hitung status jadwal pemeliharaan
 * @param {string|Date} nextMaintenanceDate
 * @param {number} reminderDaysBefore
 * @param {boolean} isActive
 * @returns {{status: string, daysRemaining: number, label: string, color: string}}
 */
export function getScheduleStatus(nextMaintenanceDate, reminderDaysBefore, isActive) {
  if (!isActive) {
    return {
      status: SCHEDULE_STATUS.INACTIVE,
      daysRemaining: 0,
      label: SCHEDULE_STATUS_LABELS[SCHEDULE_STATUS.INACTIVE],
      color: SCHEDULE_STATUS_COLORS[SCHEDULE_STATUS.INACTIVE]
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextDate = new Date(nextMaintenanceDate);
  nextDate.setHours(0, 0, 0, 0);

  const diffTime = nextDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    // Terlambat
    return {
      status: SCHEDULE_STATUS.OVERDUE,
      daysRemaining: diffDays, // negatif
      label: SCHEDULE_STATUS_LABELS[SCHEDULE_STATUS.OVERDUE],
      color: SCHEDULE_STATUS_COLORS[SCHEDULE_STATUS.OVERDUE]
    };
  }

  if (diffDays === 0) {
    // Jatuh tempo
    return {
      status: SCHEDULE_STATUS.DUE,
      daysRemaining: 0,
      label: SCHEDULE_STATUS_LABELS[SCHEDULE_STATUS.DUE],
      color: SCHEDULE_STATUS_COLORS[SCHEDULE_STATUS.DUE]
    };
  }

  // Cek apakah dalam periode pengingat
  if (diffDays <= reminderDaysBefore) {
    return {
      status: SCHEDULE_STATUS.APPROACHING,
      daysRemaining: diffDays,
      label: SCHEDULE_STATUS_LABELS[SCHEDULE_STATUS.APPROACHING],
      color: SCHEDULE_STATUS_COLORS[SCHEDULE_STATUS.APPROACHING]
    };
  }

  // Aman
  return {
    status: SCHEDULE_STATUS.SAFE,
    daysRemaining: diffDays,
    label: SCHEDULE_STATUS_LABELS[SCHEDULE_STATUS.SAFE],
    color: SCHEDULE_STATUS_COLORS[SCHEDULE_STATUS.SAFE]
  };
}

/**
 * Hitung status odometer berdasarkan kilometer saat ini dan kilometer berikutnya
 * @param {number} currentOdometer - Kilometer saat ini
 * @param {number} nextOdometerDue - Kilometer berikutnya yang harus ditukar
 * @param {number} odometerReminderKm - Kilometer sebelumnya untuk pengingat
 * @returns {{status: string, kmRemaining: number, label: string, color: string}}
 */
export function getOdometerScheduleStatus(currentOdometer, nextOdometerDue, odometerReminderKm = 0) {
  if (!currentOdometer || !nextOdometerDue) {
    return {
      status: SCHEDULE_STATUS.SAFE,
      kmRemaining: 0,
      label: SCHEDULE_STATUS_LABELS[SCHEDULE_STATUS.SAFE],
      color: SCHEDULE_STATUS_COLORS[SCHEDULE_STATUS.SAFE]
    };
  }

  const current = parseFloat(currentOdometer);
  const next = parseFloat(nextOdometerDue);
  const reminder = parseFloat(odometerReminderKm) || 0;

  const kmRemaining = next - current;

  if (kmRemaining < 0) {
    // Terlambat
    return {
      status: SCHEDULE_STATUS.OVERDUE,
      kmRemaining: kmRemaining,
      label: SCHEDULE_STATUS_LABELS[SCHEDULE_STATUS.OVERDUE],
      color: SCHEDULE_STATUS_COLORS[SCHEDULE_STATUS.OVERDUE]
    };
  }

  if (kmRemaining === 0) {
    // Jatuh tempo
    return {
      status: SCHEDULE_STATUS.DUE,
      kmRemaining: 0,
      label: SCHEDULE_STATUS_LABELS[SCHEDULE_STATUS.DUE],
      color: SCHEDULE_STATUS_COLORS[SCHEDULE_STATUS.DUE]
    };
  }

  // Cek apakah dalam periode pengingat
  if (kmRemaining <= reminder) {
    return {
      status: SCHEDULE_STATUS.APPROACHING,
      kmRemaining: kmRemaining,
      label: SCHEDULE_STATUS_LABELS[SCHEDULE_STATUS.APPROACHING],
      color: SCHEDULE_STATUS_COLORS[SCHEDULE_STATUS.APPROACHING]
    };
  }

  // Aman
  return {
    status: SCHEDULE_STATUS.SAFE,
    kmRemaining: kmRemaining,
    label: SCHEDULE_STATUS_LABELS[SCHEDULE_STATUS.SAFE],
    color: SCHEDULE_STATUS_COLORS[SCHEDULE_STATUS.SAFE]
  };
}

/**
 * Hitung status gabungan (time + odometer) untuk interval_type BOTH
 * Mengembalikan status terburuk (paling mendekat ke due/overdue)
 * @param {object} timeStatus - Status dari getScheduleStatus
 * @param {object} odometerStatus - Status dari getOdometerScheduleStatus
 * @returns {object} Status gabungan
 */
export function getCombinedScheduleStatus(timeStatus, odometerStatus) {
  const priority = {
    [SCHEDULE_STATUS.OVERDUE]: 5,
    [SCHEDULE_STATUS.DUE]: 4,
    [SCHEDULE_STATUS.APPROACHING]: 3,
    [SCHEDULE_STATUS.SAFE]: 2,
    [SCHEDULE_STATUS.INACTIVE]: 1
  };

  if (timeStatus.status === SCHEDULE_STATUS.INACTIVE || odometerStatus.status === SCHEDULE_STATUS.INACTIVE) {
    return timeStatus.status === SCHEDULE_STATUS.INACTIVE ? timeStatus : odometerStatus;
  }

  if (priority[timeStatus.status] >= priority[odometerStatus.status]) {
    return timeStatus;
  }
  return odometerStatus;
}

/**
 * Format interval (misal: "2 Bulan")
 * @param {number} value
 * @param {string} unit
 * @returns {string}
 */
export function formatInterval(value, unit) {
  const unitLabel = INTERVAL_UNIT_LABELS[unit] || unit;
  return `${value} ${unitLabel}`;
}

/**
 * Format interval odometer (misal: "5.000 km")
 * @param {number} value
 * @returns {string}
 */
export function formatOdometerInterval(value) {
  if (!value) return '-';
  return `${parseFloat(value).toLocaleString('id-ID')} km`;
}

/**
 * Cek apakah kombinasi aset dan jenis pemeliharaan sudah ada dan aktif
 * @param {object} supabase - client supabase
 * @param {string} assetId
 * @param {string} maintenanceTypeId
 * @param {string|null} excludeId - ID jadwal yang sedang diedit (untuk exclude diri sendiri)
 * @returns {Promise<boolean>} - true jika duplikat ditemukan
 */
export async function checkDuplicateSchedule(supabase, assetId, maintenanceTypeId, excludeId = null) {
  let query = supabase
    .from('maintenance_schedules')
    .select('id')
    .eq('asset_id', assetId)
    .eq('maintenance_type_id', maintenanceTypeId)
    .eq('is_active', true);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query;
  if (error) return false;
  return data && data.length > 0;
}

/**
 * Hitung ulang jadwal setelah pelaksanaan dicatat.
 * Jadwal bersifat rutin, sehingga tidak perlu dibuat ulang —
 * cukup update last_* dan next_* berdasarkan tanggal/odometer pelaksanaan.
 *
 * @param {object} schedule - Data jadwal saat ini (dari maintenance_schedules)
 * @param {object} execution - Data pelaksanaan { execution_date, odometer_at_execution }
 * @returns {object} Update object untuk maintenance_schedules
 */
export function calculateNextScheduleAfterExecution(schedule, execution) {
  const updates = {};

  // Update tanggal terakhir & hitung tanggal berikutnya (time-based)
  if (schedule.interval_type === INTERVAL_TYPE.TIME || schedule.interval_type === INTERVAL_TYPE.BOTH) {
    const lastDate = execution.execution_date || schedule.last_maintenance_date;
    const { nextDate } = calculateNextMaintenanceDate(
      lastDate,
      schedule.interval_value,
      schedule.interval_unit
    );
    updates.last_maintenance_date = lastDate;
    updates.next_maintenance_date = formatDateID(nextDate).split('-').reverse().join('-'); // YYYY-MM-DD
  }

  // Update odometer terakhir & hitung odometer berikutnya (odometer-based)
  if (schedule.interval_type === INTERVAL_TYPE.ODOMETER || schedule.interval_type === INTERVAL_TYPE.BOTH) {
    const lastOdometer = execution.odometer_at_execution || schedule.last_odometer;
    if (lastOdometer && schedule.odometer_interval_value) {
      const nextOdometer = calculateNextOdometer(lastOdometer, schedule.odometer_interval_value);
      updates.last_odometer = parseFloat(lastOdometer);
      updates.next_odometer_due = nextOdometer;
    }
  }

  return updates;
}
