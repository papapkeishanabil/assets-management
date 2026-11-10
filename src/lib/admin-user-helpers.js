import { supabase } from './supabase';

export async function submitAdminUserChange(payload) {
  const { data, error } = await supabase.functions.invoke('admin-update-user', { body: payload });
  if (error) {
    let response;
    try { response = await error.context?.json(); } catch { /* Network or non-JSON error. */ }
    if (response?.error && typeof response.error === 'string') throw new Error(response.error);
    if (response?.code === 'NOT_FOUND' || error.context?.status === 404) throw new Error('Layanan perubahan pengguna belum aktif. Hubungi pengelola aplikasi.');
    throw new Error('Perubahan belum dapat dikirim. Periksa koneksi atau masuk kembali lalu coba ulang.');
  }
  if (!data?.success) throw new Error(data?.error || 'Perubahan pengguna belum tersimpan.');
  return data;
}
