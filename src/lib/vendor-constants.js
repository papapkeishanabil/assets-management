// Konstanta Modul Manajemen Vendor — sinkron dengan CHECK constraint
// migration 202611040001_vendor_management_phase1.sql (jangan ubah nilai DB sembarangan).

// Tiga dimensi status (spec §2) — berbeda dan tidak saling menggantikan.
export const PROCESS_STAGE = {
  LEAD: 'LEAD',
  CONTACTING: 'CONTACTING',
  PROFILE_VERIFICATION: 'PROFILE_VERIFICATION',
  SITE_VERIFICATION: 'SITE_VERIFICATION',
  SAMPLE_ASSIGNED: 'SAMPLE_ASSIGNED',
  SAMPLE_IN_PROGRESS: 'SAMPLE_IN_PROGRESS',
  SAMPLE_RECEIVED: 'SAMPLE_RECEIVED',
  QC_REVIEW: 'QC_REVIEW',
  SAMPLE_REVISION: 'SAMPLE_REVISION',
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  CLOSED: 'CLOSED',
  ABANDONED: 'ABANDONED'
};

export const PROCESS_STAGE_LABELS = {
  [PROCESS_STAGE.LEAD]: 'Lead Masuk',
  [PROCESS_STAGE.CONTACTING]: 'Kontak Awal',
  [PROCESS_STAGE.PROFILE_VERIFICATION]: 'Profil Diverifikasi',
  [PROCESS_STAGE.SITE_VERIFICATION]: 'Verifikasi Lokasi',
  [PROCESS_STAGE.SAMPLE_ASSIGNED]: 'Sampel Ditugaskan',
  [PROCESS_STAGE.SAMPLE_IN_PROGRESS]: 'Sampel Dikerjakan',
  [PROCESS_STAGE.SAMPLE_RECEIVED]: 'Sampel Diterima',
  [PROCESS_STAGE.QC_REVIEW]: 'QC Berjalan',
  [PROCESS_STAGE.SAMPLE_REVISION]: 'Revisi Sampel',
  [PROCESS_STAGE.AWAITING_APPROVAL]: 'Menunggu Keputusan',
  [PROCESS_STAGE.CLOSED]: 'Selesai',
  [PROCESS_STAGE.ABANDONED]: 'Tidak Dilanjutkan'
};

export const QUALIFICATION_STATUS = {
  PROSPECT: 'PROSPECT',
  UNDER_EVALUATION: 'UNDER_EVALUATION',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  RESERVE: 'RESERVE',
  REJECTED: 'REJECTED',
  FROZEN: 'FROZEN'
};

export const QUALIFICATION_LABELS = {
  [QUALIFICATION_STATUS.PROSPECT]: 'Prospek',
  [QUALIFICATION_STATUS.UNDER_EVALUATION]: 'Evaluasi',
  [QUALIFICATION_STATUS.PENDING_APPROVAL]: 'Menunggu Approval',
  [QUALIFICATION_STATUS.APPROVED]: 'Disetujui',
  [QUALIFICATION_STATUS.RESERVE]: 'Cadangan',
  [QUALIFICATION_STATUS.REJECTED]: 'Ditolak',
  [QUALIFICATION_STATUS.FROZEN]: 'Dibekukan'
};

export const OPERATIONAL_STATUS = {
  NOT_ACTIVE: 'NOT_ACTIVE',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  INACTIVE: 'INACTIVE'
};

export const OPERATIONAL_LABELS = {
  [OPERATIONAL_STATUS.NOT_ACTIVE]: 'Belum Aktif',
  [OPERATIONAL_STATUS.ACTIVE]: 'Aktif',
  [OPERATIONAL_STATUS.SUSPENDED]: 'Ditangguhkan',
  [OPERATIONAL_STATUS.INACTIVE]: 'Nonaktif'
};

// Kelas badge CSS (didefinisikan di index.css)
export const PROCESS_STAGE_BADGES = {
  [PROCESS_STAGE.LEAD]: 'badge-gray',
  [PROCESS_STAGE.CONTACTING]: 'badge-blue',
  [PROCESS_STAGE.PROFILE_VERIFICATION]: 'badge-blue',
  [PROCESS_STAGE.SITE_VERIFICATION]: 'badge-indigo',
  [PROCESS_STAGE.SAMPLE_ASSIGNED]: 'badge-blue',
  [PROCESS_STAGE.SAMPLE_IN_PROGRESS]: 'badge-yellow',
  [PROCESS_STAGE.SAMPLE_RECEIVED]: 'badge-yellow',
  [PROCESS_STAGE.QC_REVIEW]: 'badge-indigo',
  [PROCESS_STAGE.SAMPLE_REVISION]: 'badge-orange',
  [PROCESS_STAGE.AWAITING_APPROVAL]: 'badge-yellow',
  [PROCESS_STAGE.CLOSED]: 'badge-green',
  [PROCESS_STAGE.ABANDONED]: 'badge-gray'
};

export const QUALIFICATION_BADGES = {
  [QUALIFICATION_STATUS.PROSPECT]: 'badge-gray',
  [QUALIFICATION_STATUS.UNDER_EVALUATION]: 'badge-blue',
  [QUALIFICATION_STATUS.PENDING_APPROVAL]: 'badge-yellow',
  [QUALIFICATION_STATUS.APPROVED]: 'badge-green',
  [QUALIFICATION_STATUS.RESERVE]: 'badge-indigo',
  [QUALIFICATION_STATUS.REJECTED]: 'badge-red',
  [QUALIFICATION_STATUS.FROZEN]: 'badge-gray'
};

export const OPERATIONAL_BADGES = {
  [OPERATIONAL_STATUS.NOT_ACTIVE]: 'badge-gray',
  [OPERATIONAL_STATUS.ACTIVE]: 'badge-green',
  [OPERATIONAL_STATUS.SUSPENDED]: 'badge-orange',
  [OPERATIONAL_STATUS.INACTIVE]: 'badge-gray'
};

// Urutan visual pipeline untuk bar progres di detail vendor
export const PROCESS_STAGE_FLOW = [
  PROCESS_STAGE.LEAD,
  PROCESS_STAGE.CONTACTING,
  PROCESS_STAGE.PROFILE_VERIFICATION,
  PROCESS_STAGE.SITE_VERIFICATION,
  PROCESS_STAGE.SAMPLE_ASSIGNED,
  PROCESS_STAGE.SAMPLE_IN_PROGRESS,
  PROCESS_STAGE.SAMPLE_RECEIVED,
  PROCESS_STAGE.QC_REVIEW,
  PROCESS_STAGE.AWAITING_APPROVAL,
  PROCESS_STAGE.CLOSED
];

// Profil vendor
export const VENDOR_SOURCES = {
  REFERENSI: 'Referensi',
  GOOGLE_MAPS: 'Google Maps',
  GOOGLE_SEARCH: 'Google Search',
  INSTAGRAM: 'Instagram',
  MARKETPLACE: 'Marketplace',
  KUNJUNGAN: 'Kunjungan',
  PAMERAN: 'Pameran',
  LAINNYA: 'Lainnya'
};

export const LEGAL_STATUS = {
  BELUM_DICEK: 'Belum Dicek',
  PROSES_VERIFIKASI: 'Proses Verifikasi',
  LENGKAP: 'Lengkap',
  TIDAK_LENGKAP: 'Tidak Lengkap'
};

export const LEGAL_STATUS_BADGES = {
  BELUM_DICEK: 'badge-gray',
  PROSES_VERIFIKASI: 'badge-yellow',
  LENGKAP: 'badge-green',
  TIDAK_LENGKAP: 'badge-red'
};

export const CAPACITY_UNITS = ['pcs', 'meter', 'kg', 'roll', 'stitch', 'set', 'lainnya'];

export const BUSINESS_TYPES = { USAHA: 'Badan Usaha', PERORANGAN: 'Perorangan' };

// Role yang boleh menulis data pipeline vendor (selaras policy RLS fase 1)
export const VENDOR_WRITE_ROLES = ['sourcing', 'hrd', 'super_admin'];

// Nilai kelayakan yang merupakan KEPUTUSAN AKHIR — hanya direksi/super_admin
// (ditegakkan trigger guard DB `vendor_guard_restricted_columns`; UI hanya
// menyembunyikan opsi, database tetap penjaga sebenarnya).
export const DECISION_QUALIFICATION_STATUSES = [
  QUALIFICATION_STATUS.APPROVED,
  QUALIFICATION_STATUS.RESERVE,
  QUALIFICATION_STATUS.REJECTED,
  QUALIFICATION_STATUS.FROZEN
];

export const VENDOR_APPROVER_ROLES = ['direksi', 'super_admin'];
