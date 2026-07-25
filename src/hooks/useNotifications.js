import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../lib/constants';
import {
  NOTIFICATION_TYPES,
  buildNotificationMessage,
  buildNotificationTitle,
  getDayDiff,
  getTodayDate
} from '../lib/notification-helpers';

/**
 * Hook untuk mengelola notifikasi
 * - Fetch notifikasi milik pengguna
 * - Mark as read
 * - Run reminder check
 */
export function useNotifications() {
  const { profile, role } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const reminderRunRef = useRef(false);

  // Fetch semua notifikasi milik pengguna
  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          maintenance_schedule:maintenance_schedules(
            id,
            asset:assets(id, asset_code, asset_name),
            maintenance_type:maintenance_types(id, maintenance_code, maintenance_name)
          )
        `)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setNotifications(data || []);
      setUnreadCount((data || []).filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  // Fetch jumlah notifikasi belum dibaca saja (untuk badge)
  const fetchUnreadCount = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_read', false);

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [profile?.id]);

  // Mark satu notifikasi sebagai dibaca
  const markAsRead = useCallback(async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', profile.id);

      if (error) throw error;
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }, [profile?.id]);

  // Mark semua notifikasi sebagai dibaca
  const markAllAsRead = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', profile.id)
        .eq('is_read', false);

      if (error) throw error;
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [profile?.id]);

  // Fungsi reminder - memeriksa jadwal dan membuat notifikasi
  const runReminderCheck = useCallback(async () => {
    if (!profile?.id || reminderRunRef.current) return;
    reminderRunRef.current = true;

    try {
      const today = getTodayDate();

      // 1. Ambil semua jadwal pemeliharaan aktif dengan aset aktif
      const { data: schedules, error: schedError } = await supabase
        .from('maintenance_schedules')
        .select(`
          id,
          asset_id,
          maintenance_type_id,
          next_maintenance_date,
          is_active,
          responsible_user_id,
          reminder_days_before,
          asset:assets!inner(id, asset_code, asset_name, is_active),
          maintenance_type:maintenance_types!inner(id, maintenance_code, maintenance_name)
        `)
        .eq('is_active', true)
        .eq('asset.is_active', true);

      if (schedError) throw schedError;
      if (!schedules || schedules.length === 0) return;

      // 2. Ambil id role yang berhak (super_admin/hrd/direksi)
      //    Pakai dua langkah agar tidak ambigu (PGRST201) — di skema ini
      //    ada lebih dari satu relasi antara user_profiles dan roles.
      const { data: allowedRoles, error: rolesError } = await supabase
        .from('roles')
        .select('id, role_name')
        .in('role_name', ['super_admin', 'hrd', 'direksi']);

      if (rolesError) throw rolesError;

      const allowedRoleIds = (allowedRoles || []).map(r => r.id);

      // 3. Ambil user aktif dengan role berhak
      const { data: users, error: userError } = await supabase
        .from('user_profiles')
        .select('id, account_status')
        .eq('account_status', 'ACTIVE')
        .in('role_id', allowedRoleIds);

      if (userError) throw userError;

      // 3. Untuk setiap jadwal, tentukan notifikasi yang perlu dibuat
      const notificationsToCreate = [];

      for (const schedule of schedules) {
        const daysDiff = getDayDiff(schedule.next_maintenance_date, today);
        const reminderDays = Number(schedule.reminder_days_before) || 0;
        let notificationType = null;
        let daysLate = 0;

        // Tentukan tipe notifikasi berdasarkan selisih hari.
        // Urutan penting: jatuh tempo & terlambat dicek lebih dulu, lalu
        // tangga reminder standar (7/3/1), terakhir reminder khusus sesuai
        // pengaturan reminder_days_before jadwal.
        if (daysDiff === 0) {
          notificationType = NOTIFICATION_TYPES.DUE_TODAY;
        } else if (daysDiff < 0) {
          // Terlambat - hanya buat notifikasi pertama kali memasuki status terlambat
          notificationType = NOTIFICATION_TYPES.OVERDUE;
          daysLate = Math.abs(daysDiff);
        } else if (daysDiff === 7) {
          notificationType = NOTIFICATION_TYPES.REMINDER_7_DAYS;
        } else if (daysDiff === 3) {
          notificationType = NOTIFICATION_TYPES.REMINDER_3_DAYS;
        } else if (daysDiff === 1) {
          notificationType = NOTIFICATION_TYPES.REMINDER_1_DAY;
        } else if (reminderDays > 0 && daysDiff === reminderDays) {
          // Pengingat khusus sesuai pengaturan "reminder_days_before" jadwal
          notificationType = NOTIFICATION_TYPES.REMINDER_CUSTOM;
        }

        if (!notificationType) continue;

        // Bangun pesan
        const title = buildNotificationTitle(notificationType);
        const message = buildNotificationMessage(
          schedule.maintenance_type?.maintenance_name || '-',
          schedule.asset?.asset_code || '-',
          schedule.asset?.asset_name || '-',
          notificationType,
          daysLate,
          reminderDays
        );

        // Tentukan penerima
        const recipientUserIds = new Set();

        // Semua user dengan role berhak.
        // Pakai user_profiles.id (bukan auth_user_id) karena
        // notifications.user_id -> user_profiles(id), dan notifikasi
        // dibaca berdasarkan profile.id.
        users.forEach(u => {
          recipientUserIds.add(u.id);
        });

        // Jika ada responsible_user_id, tambahkan ke penerima
        if (schedule.responsible_user_id) {
          recipientUserIds.add(schedule.responsible_user_id);
        }

        // Buat notifikasi untuk setiap penerima
        for (const userId of recipientUserIds) {
          notificationsToCreate.push({
            user_id: userId,
            maintenance_schedule_id: schedule.id,
            notification_type: notificationType,
            title,
            message,
            notification_date: today,
            reference_url: `/maintenance/schedules/${schedule.id}`
          });
        }
      }

      // 4. Insert notifikasi (gunakan upsert untuk mencegah duplikat)
      if (notificationsToCreate.length > 0) {
        const { error: insertError } = await supabase
          .from('notifications')
          .upsert(notificationsToCreate, {
            onConflict: 'user_id,maintenance_schedule_id,notification_type,notification_date',
            ignoreDuplicates: true
          });

        if (insertError) throw insertError;
      }

      // 5. Re-fetch notifikasi setelah pembuatan
      await fetchNotifications();
    } catch (error) {
      console.error('Error running reminder check:', error);
    }
  }, [profile?.id, fetchNotifications]);

  // Fetch on mount
  useEffect(() => {
    if (profile?.id) {
      fetchNotifications();
    }
  }, [fetchNotifications]);

  // Subscribe ke perubahan notifikasi secara real-time
  // Gunakan unique channel name per hook instance untukhindari error
  // "cannot add postgres_changes callbacks after subscribe()"
  // saat hook dipakai di multiple component (MainLayout + DashboardPage)
  const channelIdRef = useRef(`notifications-changes-${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    if (!profile?.id) return;

    let subscription;
    try {
      subscription = supabase
        .channel(channelIdRef.current)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${profile.id}`
          },
          (payload) => {
            setNotifications(prev => [payload.new, ...prev]);
            setUnreadCount(prev => prev + 1);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${profile.id}`
          },
          (payload) => {
            setNotifications(prev =>
              prev.map(n => n.id === payload.new.id ? payload.new : n)
            );
            if (payload.new.is_read) {
              setUnreadCount(prev => Math.max(0, prev - 1));
            }
          }
        )
        .subscribe();
    } catch (error) {
      console.error('Error setting up realtime subscription:', error);
    }

    return () => {
      if (subscription) {
        try {
          supabase.removeChannel(subscription);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [profile?.id]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    runReminderCheck,
    reminderRunRef
  };
}
