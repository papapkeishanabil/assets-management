/**
 * Hook usePWA
 *
 * Hook untuk mengelola Progressive Web App (PWA):
 * - Instalasi PWA (beforeinstallprompt)
 * - Registrasi Service Worker
 * - Izin notifikasi sistem
 * - Deteksi mode standalone
 *
 * @returns {Object} State dan fungsi untuk mengelola PWA
 */
import { useState, useEffect, useCallback } from 'react';

export function usePWA() {
  const [registration, setRegistration] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [swStatus, setSwStatus] = useState('checking');
  const [swError, setSwError] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(
    'Notification' in window ? Notification.permission : 'unsupported'
  );
  // === Deteksi mode standalone ===
  useEffect(() => {
    const checkStandalone = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches;
      setIsStandalone(standalone);
      if (standalone) setIsInstalled(true);
    };
    checkStandalone();
  }, []);

  // === Registrasi Service Worker ===
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setSwStatus('unsupported');
      return;
    }

    let cancelled = false;

    const registerSW = async () => {
      try {
        // vite-plugin-pwa (registerType: 'autoUpdate') sudah menangani
        // registrasi SW secara otomatis. Di sini kita hanya membaca
        // registrasi yang ada agar hook tetap menjadi sumber kebenaran
        // untuk status SW di seluruh aplikasi.
        const existing = await navigator.serviceWorker.getRegistration();
        if (!existing) {
          // Fallback: jika untuk suatu sebab auto-registrasi gagal,
          // coba daftarkan SW secara manual.
          const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
          if (cancelled) return;
          setRegistration(reg);

          reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (installing) {
              setSwStatus('installing');
              installing.addEventListener('statechange', () => {
                if (cancelled) return;
                switch (installing.state) {
                  case 'installed':
                    setSwStatus(navigator.serviceWorker.controller ? 'waiting' : 'installed');
                    break;
                  case 'activated':
                    setSwStatus('active');
                    break;
                  case 'redundant':
                    setSwStatus('redundant');
                    break;
                }
              });
            }
          });

          if (reg.active) setSwStatus('active');
          return;
        }

        setRegistration(existing);
        setSwStatus(existing.active ? 'active' : 'installing');

        // Jika SW sudah terdaftar tapi belum mengontrol halaman ini,
        // ada kemungkinan SW baru aktif tapi halaman belum di-refresh.
        //controllerchange akan menyelaraskan status saat SW mengambil alih.
      } catch (error) {
        if (!cancelled) {
          setSwStatus('error');
          setSwError(error.message || 'Gagal mendaftarkan service worker');
        }
      }
    };

    registerSW();

    const handleControllerChange = () => setSwStatus('active');
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);
  // === Event beforeinstallprompt ===
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // === Event appinstalled ===
  useEffect(() => {
    const handler = () => {
      setIsInstalled(true);
      setIsStandalone(true);
      setIsInstallable(false);
    };
    window.addEventListener('appinstalled', handler);
    return () => window.removeEventListener('appinstalled', handler);
  }, []);

  // === Install aplikasi ===
  const installApp = useCallback(async () => {
    if (!deferredPrompt) {
      return { outcome: 'not_available', message: 'Browser belum menawarkan instalasi atau aplikasi sudah ter-install.' };
    }
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setIsInstallable(false);
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsStandalone(true);
        return { outcome: 'accepted', message: 'Aplikasi berhasil di-install.' };
      }
      return { outcome: 'dismissed', message: 'Instalasi dibatalkan.' };
    } catch (error) {
      return { outcome: 'error', message: error.message || 'Gagal meng-install aplikasi.' };
    }
  }, [deferredPrompt]);

  // === Minta izin notifikasi ===
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
      return 'unsupported';
    }
    if (Notification.permission === 'denied') return 'denied';
    if (Notification.permission === 'granted') return 'granted';
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission;
    } catch (error) {
      return 'error';
    }
  }, []);
  // === Kirim notifikasi sistem uji ===
  const sendTestNotification = useCallback(async () => {
    if (!registration || !registration.active) {
      throw new Error('Service worker tidak aktif.');
    }
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      throw new Error('Izin notifikasi belum diberikan.');
    }
    const testData = {
      url: '/maintenance/schedules?notification_test=success',
      test: true,
      timestamp: new Date().toISOString()
    };
    // Kirim pesan ke service worker yang sedang mengontrol halaman agar SW
    // yang menjalankan showNotification. Lebih reliable dibanding
    // registration.showNotification() langsung dari page context.
    const controller = navigator.serviceWorker.controller;
    if (!controller) {
      // Fallback: jika SW belum mengontrol halaman, coba langsung dari page.
      // Ini tidak 100% reliable di semua browser, tapi lebih baik daripada
      // tidak menampilkan sama sekali.
      console.warn('[Harmas] Service worker belum mengontrol halaman, fallback ke registration.showNotification()');
      try {
        await registration.showNotification('Harmas Asset Management', {
          body: 'Tes berhasil. Penggantian oli Mesin Jahit 01 akan jatuh tempo dalam 3 hari.',
          tag: 'harmas-system-notification-test',
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          data: testData,
          requireInteraction: true,
          actions: [{ action: 'view-schedule', title: 'Lihat Jadwal' }]
        });
      } catch (err) {
        throw new Error('Gagal menampilkan notifikasi: ' + err.message);
      }
      return { success: true, time: new Date().toISOString(), tag: 'harmas-system-notification-test', fallback: true };
    }
    try {
      await controller.postMessage({
        type: 'SHOW_TEST_NOTIFICATION',
        payload: {
          title: 'Harmas Asset Management',
          body: 'Tes berhasil. Penggantian oli Mesin Jahit 01 akan jatuh tempo dalam 3 hari.',
          tag: 'harmas-system-notification-test',
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          data: testData,
          requireInteraction: true,
          actions: [{ action: 'view-schedule', title: 'Lihat Jadwal' }]
        }
      });
      console.log('[Harmas] Pesan terkirim ke SW, menunggu notifikasi muncul...');
    } catch (err) {
      console.error('[Harmas] Gagal kirim pesan ke SW:', err);
      throw new Error('Gagal mengirim pesan ke service worker: ' + err.message);
    }
    return { success: true, time: new Date().toISOString(), tag: 'harmas-system-notification-test' };
  }, [registration]);

  // === Verifikasi notifikasi dengan getNotifications ===
  const verifyNotification = useCallback(async () => {
    if (!registration || !registration.active) {
      return { found: false, notifications: [], error: 'Service worker tidak aktif.' };
    }
    if (!navigator.serviceWorker.controller) {
      return {
        found: false,
        notifications: [],
        error: 'Service worker aktif, tetapi belum mengontrol halaman ini. Muat ulang halaman agar SW mengambil alih kontrol.'
      };
    }
    try {
      const notifications = await registration.getNotifications({ tag: 'harmas-system-notification-test' });
      return {
        found: notifications.length > 0,
        count: notifications.length,
        notifications: notifications.map(n => ({ title: n.title, body: n.body, tag: n.tag }))
      };
    } catch (error) {
      return { found: false, notifications: [], error: error.message };
    }
  }, [registration]);

  return {
    registration, isStandalone, isInstalled, isInstallable,
    deferredPrompt, swStatus, swError, notificationPermission,
    installApp, requestNotificationPermission, sendTestNotification, verifyNotification
  };
}
