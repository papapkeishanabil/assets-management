// Helper untuk alur pemeriksaan lapangan (surveyor -> penilaian HRD/Teknisi)
import { NOTIFICATION_TYPES } from './notification-helpers';

/**
 * Ambil daftar user penerima notifikasi penilaian (role HRD, Super Admin, Direksi, dan koordinator WO).
 * "Teknisi" penilai diwakili role HRD/Super Admin/Direksi (lihat catatan di halaman penilaian).
 * @param {object} supabase - client supabase
 * @param {string|null} koordinatorId - responsible_user_id pada work order (opsional)
 * @returns {Promise<string[]>} array user_profiles.id
 */
export async function getReviewerUserIds(supabase, koordinatorId = null) {
  const ids = new Set();
  if (koordinatorId) ids.add(koordinatorId);

  const { data: roles } = await supabase
    .from('roles')
    .select('id')
    .in('role_name', ['super_admin', 'hrd', 'direksi']);
  const roleIds = new Set((roles || []).map(r => r.id));

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, role_id')
    .eq('account_status', 'ACTIVE');

  (profiles || []).forEach(p => {
    if (roleIds.has(p.role_id)) ids.add(p.id);
  });

  return [...ids];
}

/**
 * Buat notifikasi untuk sebuah daftar penerima.
 * @param {object} supabase - client supabase
 * @param {string[]} userIds - daftar user_profiles.id penerima
 * @param {object} payload - { type, title, message, recordId, referenceUrl }
 */
export async function createNotifications(supabase, userIds, payload) {
  if (!userIds || userIds.length === 0) return;

  const rows = userIds.map(uid => ({
    user_id: uid,
    notification_type: payload.type,
    title: payload.title,
    message: payload.message,
    maintenance_record_id: payload.recordId || null,
    reference_url: payload.referenceUrl || null,
    notification_date: new Date().toISOString().slice(0, 10)
  }));

  const { error } = await supabase.from('notifications').insert(rows);
  if (error) {
    console.error('Error creating inspection notifications:', error);
  }
}

/**
 * Surveyor mengirim hasil pemeriksaan (draft -> menunggu_penilaian)
 * dan memberi notifikasi ke HRD/Teknisi penilai.
 * @param {object} supabase - client supabase
 * @param {object} params - { recordId, koordinatorId, assetLabel, maintenanceLabel, submitterName }
 */
export async function submitInspectionForReview(supabase, params) {
  const { recordId, koordinatorId, assetLabel, maintenanceLabel, submitterName } = params;

  const { error } = await supabase
    .from('maintenance_records')
    .update({
      inspection_status: 'menunggu_penilaian',
      submitted_at: new Date().toISOString(),
      submitted_by: params.submitterId
    })
    .eq('id', recordId);
  if (error) throw error;

  const reviewerIds = await getReviewerUserIds(supabase, koordinatorId);

  await createNotifications(supabase, reviewerIds, {
    type: NOTIFICATION_TYPES.INSPECTION_SUBMITTED,
    title: 'Hasil Pemeriksaan Perlu Dinilai',
    message: `${maintenanceLabel || 'Pemeriksaan'} untuk ${assetLabel} dikirim oleh ${submitterName || 'surveyor'}. Silakan lakukan penilaian kondisi aset.`,
    recordId,
    referenceUrl: `/inspections/${recordId}`
  });

  return reviewerIds;
}

/**
 * HRD/Teknisi menyelesaikan penilaian dan memberi notifikasi ke surveyor.
 * @param {object} supabase - client supabase
 * @param {object} params - { recordId, surveyorId, assetLabel, maintenanceLabel }
 */
export async function completeInspectionReview(supabase, params) {
  const { recordId, surveyorId, assetLabel, maintenanceLabel, needsRepair } = params;

  await createNotifications(supabase, surveyorId ? [surveyorId] : [], {
    type: NOTIFICATION_TYPES.INSPECTION_ASSESSED,
    title: 'Hasil Pemeriksaan Telah Dinilai',
    message: `Penilaian untuk ${maintenanceLabel || 'pemeriksaan'} ${assetLabel} telah selesai${needsRepair ? ' dan perlu ditindaklanjuti (perbaikan)' : ''}.`,
    recordId,
    referenceUrl: `/inspections/${recordId}`
  });
}
