/**
 * Push Notification Helpers
 *
 * - Generate VAPID keys (butuh generate sekali saja)
 * - Subscribe ke Push API
 * - Simpan subscription ke Supabase
 */

import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/**
 * Convert base64 string ke Uint8Array untuk VAPID key
 */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

/**
 * Dapatkan VAPID public key dari env
 */
export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}

/**
 * Subscribe ke Push API dan simpan ke Supabase
 */
export async function subscribeUserToPush(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Browser tidak mendukung Push API');
  }

  const registration = await navigator.serviceWorker.ready;

  // Cek apakah sudah subscribe
  const existingSubscription = await registration.pushManager.getSubscription();
  if (existingSubscription) {
    // Update di Supabase
    await saveSubscription(userId, existingSubscription);
    return existingSubscription;
  }

  // Subscribe baru
  const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey
  });

  await saveSubscription(userId, subscription);
  return subscription;
}

/**
 * Simpan subscription ke Supabase
 */
async function saveSubscription(userId, subscription) {
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      subscription: subscription.toJSON(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    });

  if (error) throw error;
}

/**
 * Unsubscribe dari Push API
 */
export async function unsubscribeUserFromPush(userId) {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    await subscription.unsubscribe();
  }

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId);
}

/**
 * Cek apakah user sudah subscribe
 */
export async function isUserSubscribedToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return !!subscription;
}

