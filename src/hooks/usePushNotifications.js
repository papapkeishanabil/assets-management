import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  subscribeUserToPush,
  unsubscribeUserFromPush,
  isUserSubscribedToPush,
  getVapidPublicKey
} from '../lib/push-notifications';

/**
 * Hook untuk mengelola langganan Web Push per user.
 * - subscribe(): minta izin notifikasi + langgan Push API + simpan ke DB
 * - unsubscribe(): berhenti berlangganan + hapus dari DB
 * - status: supported / permission / subscribed
 *
 * Catatan: butuh VAPID public key (VITE_VAPID_PUBLIC_KEY) dan service worker aktif.
 */
export function usePushNotifications() {
  const { profile } = useAuth();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const swInNav = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    const hasPush = typeof PushManager !== 'undefined';
    const swOk = swInNav && hasPush;
    const vapid = getVapidPublicKey();
    const vapidOk = !!vapid;
    // DEBUG sementara - memastikan env & API terbaca
    console.log('[push-debug]', {
      swOk,
      swInNav,
      hasPush,
      vapidLen: vapid ? vapid.length : 0,
      vapidHead: vapid ? vapid.slice(0, 8) : null,
      vapidOk,
      envHead: import.meta.env.VITE_VAPID_PUBLIC_KEY ? String(import.meta.env.VITE_VAPID_PUBLIC_KEY).slice(0, 8) : null,
      href: typeof window !== 'undefined' ? window.location.href : null
    });
    const ok = swOk && vapidOk;
    setSupported(ok);
    setPermission(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
    if (ok) {
      isUserSubscribedToPush().then(setSubscribed).catch(() => setSubscribed(false));
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!profile?.id) {
      setError('User belum terdeteksi');
      return false;
    }
    if (!supported) {
      setError('Browser/perangkat ini tidak mendukung push, atau VAPID key belum dikonfigurasi');
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        const p = await Notification.requestPermission();
        setPermission(p);
        if (p !== 'granted') {
          setError('Izin notifikasi ditolak. Aktifkan via pengaturan browser.');
          return false;
        }
      }
      try {
        await subscribeUserToPush(profile.id);
      } catch (saveErr) {
        console.error('[push-debug] subscribeUserToPush FAILED:', saveErr);
        setError(saveErr?.message || 'Gagal menyimpan langganan');
        return false;
      }
      console.log('[push-debug] subscribe SUCCESS, langganan tersimpan');
      setSubscribed(true);
      return true;
    } catch (e) {
      console.error('Push subscribe failed:', e);
      setError(e?.message || 'Gagal berlangganan push');
      return false;
    } finally {
      setLoading(false);
    }
  }, [profile?.id, supported]);

  const unsubscribe = useCallback(async () => {
    if (!profile?.id) return false;
    setLoading(true);
    setError(null);
    try {
      await unsubscribeUserFromPush();
      setSubscribed(false);
      return true;
    } catch (e) {
      console.error('Push unsubscribe failed:', e);
      setError(e?.message || 'Gagal berhenti berlangganan');
      return false;
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  return { supported, permission, subscribed, loading, error, subscribe, unsubscribe };
}
