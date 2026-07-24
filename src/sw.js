/**
 * Harmas Asset Management - Service Worker
 *
 * Service worker untuk mendukung:
 * - Instalasi PWA (Progressive Web App)
 * - Notifikasi sistem melalui Notifications API
 * - Penanganan klik notifikasi
 *
 * CATATAN:
 * - Service worker ini TIDAK menyimpan token autentikasi ke cache.
 * - Service worker ini TIDAK menyimpan data API sensitif ke cache.
 * - Service worker ini TIDAK meng-cache response Supabase Auth.
 * - Push subscription dan VAPID key belum diimplementasikan pada tahap ini.
 */

import { precacheAndRoute } from 'workbox-precaching';

// Precache semua aset aplikasi (manifest diinject oleh vite-plugin-pwa)
precacheAndRoute(self.__WB_MANIFEST);

/**
 * Menangani klik pada notifikasi sistem.
 * - Menutup notifikasi
 * - Mencari jendela aplikasi yang sudah terbuka
 * - Jika ditemukan, fokuskan jendela tersebut
 * - Jika belum terbuka, buka aplikasi dengan URL yang ditentukan
 */
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;

  // Tutup notifikasi
  notification.close();

  // Tentukan URL tujuan
  let urlToOpen = '/';
  if (notification.data && notification.data.url) {
    urlToOpen = notification.data.url;
  }

  // Untuk action "Lihat Jadwal"
  if (action === 'view-schedule') {
    urlToOpen = notification.data && notification.data.url
      ? notification.data.url
      : '/maintenance/schedules';
  }

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })
    .then((windowClients) => {
      // Cari jendela aplikasi yang sudah terbuka
      for (const client of windowClients) {
        if ('focus' in client) {
          // Navigasi ke URL tujuan
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Jika tidak ada jendela terbuka, buka jendela baru
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

/**
 * Menangani penutupan notifikasi (opsional)
 */
self.addEventListener('notificationclose', (event) => {
  const notification = event.notification;
  console.log('[Harmas SW] Notification closed:', notification.tag);
});

/**
 * Menangani pesan dari page untuk membuat notifikasi sistem.
 * Page mengirim pesan SHOW_TEST_NOTIFICATION, lalu SW yang
 * memanggil self.registration.showNotification() agar notifikasi
 * lebih reliable di seluruh browser/OS.
 */
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'SHOW_TEST_NOTIFICATION') return;
  const { payload } = event.data;
  console.log('[Harmas SW] SHOW_TEST_NOTIFICATION received:', payload.title);
  const options = {
    body: payload.body,
    tag: payload.tag,
    icon: payload.icon,
    badge: payload.badge,
    data: payload.data,
    requireInteraction: payload.requireInteraction,
    actions: payload.actions
  };
  event.waitUntil(
    self.registration.showNotification(payload.title, options)
      .then(() => {
        console.log('[Harmas SW] Notification shown successfully');
      })
      .catch((err) => {
        console.error('[Harmas SW] showNotification failed:', err);
      })
  );
});

/**
 * Push Notification: Handle push event dari server/backend
 * Backend mengirim push message via VAPID, SW yang menampilkan notifikasi.
 */
self.addEventListener('push', (event) => {
  console.log('[Harmas SW] Push event received');
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (err) {
    console.error('[Harmas SW] Failed to parse push payload:', err);
    return;
  }

  const options = {
    body: payload.body || payload.message,
    tag: payload.tag || 'harmas-push-notification',
    icon: payload.icon || '/icon-192x192.png',
    badge: payload.badge || '/icon-192x192.png',
    data: payload.data || {},
    requireInteraction: payload.requireInteraction !== false,
    actions: payload.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Harmas Asset Management', options)
      .then(() => console.log('[Harmas SW] Push notification shown'))
      .catch((err) => console.error('[Harmas SW] Push showNotification failed:', err))
  );
});

/**
 * Periodic Sync: Cek jadwal secara berkala di background.
 * Hanya berjalan jika browser mendukung dan user mengizinkan.
 */
self.addEventListener('periodicsync', (event) => {
  console.log('[Harmas SW] Periodic sync received:', event.tag);
  if (event.tag !== 'harmas-notification-sync') return;

  event.waitUntil(
    checkSchedulesAndNotify()
      .then(() => console.log('[Harmas SW] Periodic sync check completed'))
      .catch((err) => console.error('[Harmas SW] Periodic sync failed:', err))
  );
});

/**
 * Cek jadwal via fetch ke Edge Function atau internal endpoint,
 * lalu tampilkan notifikasi jika ada yang cocok.
 */
async function checkSchedulesAndNotify() {
  // PERLU DIIMPLEMENTASIKAN:
  // 1. Fetch jadwal dari Supabase Edge Function / API endpoint
  // 2. Cek mana yang perlu notifikasi (H-7, H-3, H-1, hari ini, overdue)
  // 3. Tampilkan notifikasi via self.registration.showNotification()
  console.log('[Harmas SW] checkSchedulesAndNotify - perlu implementasi fetch ke API');
}
