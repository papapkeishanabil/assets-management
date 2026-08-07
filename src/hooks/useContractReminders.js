import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  CONTRACT_NOTIFICATION_TYPES,
  buildContractNotificationMessage,
  buildContractNotificationTitle,
  getDayDiff,
  getTodayDate
} from '../lib/contract-helpers';

/**
 * Hook untuk mengelola reminder kontrak
 * - Memeriksa kontrak yang akan/ sudah berakhir
 * - Membuat notifikasi otomatis
 */
export function useContractReminders() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const reminderRunRef = useRef(false);

  // Fungsi untuk menjalankan pengecekan reminder kontrak
  const runContractReminderCheck = useCallback(async () => {
    if (!profile?.id || reminderRunRef.current) return;
    reminderRunRef.current = true;

    try {
      const today = getTodayDate();

      // 1. Ambil semua kontrak aktif
      const { data: contracts, error: contractError } = await supabase
        .from('contracts')
        .select(`
          id,
          contract_number,
          title,
          start_date,
          end_date,
          reminder_days_before,
          employee_id,
          vendor_id,
          responsible_user_id,
          contract_type:contract_types!inner(id, type_code, type_name, category),
          employee:user_profiles!left(id, full_name),
          vendor:vendors!left(id, vendor_name)
        `)
        .eq('is_active', true)
        .eq('contract_status', 'ACTIVE');

      if (contractError) throw contractError;
      if (!contracts || contracts.length === 0) return;

      // 2. Ambil user dengan role super_admin, hrd, direksi
      const { data: allowedRoles, error: rolesError } = await supabase
        .from('roles')
        .select('id, role_name')
        .in('role_name', ['super_admin', 'hrd', 'direksi']);

      if (rolesError) throw rolesError;
      const allowedRoleIds = (allowedRoles || []).map(r => r.id);

      const { data: users, error: userError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('account_status', 'ACTIVE')
        .in('role_id', allowedRoleIds);

      if (userError) throw userError;

      // 3. Untuk setiap kontrak, tentukan notifikasi
      const notificationsToCreate = [];

      for (const contract of contracts) {
        const daysDiff = getDayDiff(contract.end_date, today);
        const reminderDays = Number(contract.reminder_days_before) || 7;
        let notificationType = null;
        let daysLate = 0;

        // Tentukan tipe notifikasi
        if (daysDiff === 0) {
          notificationType = CONTRACT_NOTIFICATION_TYPES.DUE_TODAY;
        } else if (daysDiff < 0) {
          notificationType = CONTRACT_NOTIFICATION_TYPES.OVERDUE;
          daysLate = Math.abs(daysDiff);
        } else if (daysDiff === 30) {
          notificationType = CONTRACT_NOTIFICATION_TYPES.REMINDER_30_DAYS;
        } else if (daysDiff === 14) {
          notificationType = CONTRACT_NOTIFICATION_TYPES.REMINDER_14_DAYS;
        } else if (daysDiff === 7) {
          notificationType = CONTRACT_NOTIFICATION_TYPES.REMINDER_7_DAYS;
        } else if (daysDiff === 3) {
          notificationType = CONTRACT_NOTIFICATION_TYPES.REMINDER_3_DAYS;
        } else if (daysDiff === 1) {
          notificationType = CONTRACT_NOTIFICATION_TYPES.REMINDER_1_DAY;
        } else if (reminderDays > 0 && daysDiff === reminderDays) {
          notificationType = CONTRACT_NOTIFICATION_TYPES.REMINDER_7_DAYS;
        }

        if (!notificationType) continue;

        // Dapatkan nama pihak terkait
        const partyName = contract.employee?.full_name || contract.vendor?.vendor_name || '-';

        // Bangun pesan
        const title = buildContractNotificationTitle(notificationType);
        const message = buildContractNotificationMessage(
          contract.title,
          contract.contract_number,
          partyName,
          notificationType,
          daysLate,
          reminderDays
        );

        // Tentukan penerima
        const recipientUserIds = new Set();
        users.forEach(u => recipientUserIds.add(u.id));
        if (contract.responsible_user_id) {
          recipientUserIds.add(contract.responsible_user_id);
        }

        // Buat notifikasi untuk setiap penerima
        for (const userId of recipientUserIds) {
          notificationsToCreate.push({
            user_id: userId,
            notification_type: notificationType,
            title,
            message,
            notification_date: today,
            reference_url: `/contracts/${contract.id}`
          });
        }
      }

      // 4. Insert notifikasi (gunakan upsert untuk cegah duplikat)
      if (notificationsToCreate.length > 0) {
        const { error: insertError } = await supabase
          .from('notifications')
          .upsert(notificationsToCreate, {
            onConflict: 'user_id,notification_type,notification_date',
            ignoreDuplicates: true
          });

        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error('Error running contract reminder check:', error);
    }
  }, [profile?.id]);

  return {
    loading,
    runContractReminderCheck,
    reminderRunRef
  };
}