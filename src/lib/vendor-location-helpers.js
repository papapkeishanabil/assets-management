import { supabase } from './supabase';
import { coordinatePair, preparePhoto } from './vendor-location-utils';

// Frontend dapat dirilis sebelum backend lokasi. Jangan menyamakan RLS/network
// error dengan backend yang belum tersedia; hanya kode missing relation/RPC.
const backendPending = (error) => ['PGRST202', 'PGRST205', '42P01', '42883'].includes(error?.code);

export async function fetchLocations(candidateId) {
  const { data, error } = await supabase.from('vendor_locations').select(`*,
    verifier:user_profiles!vendor_locations_verified_by_fkey(id,full_name),
    photos:vendor_location_photos(*,uploader:user_profiles!vendor_location_photos_uploaded_by_fkey(id,full_name))`)
    .eq('candidate_id', candidateId).order('is_primary', { ascending: false }).order('created_at').order('id');
  if (error) { if (backendPending(error)) return null; throw error; }
  return data || [];
}

export function locationPayload(form, canVerify) {
  const pair = coordinatePair(form.latitude, form.longitude);
  const payload = { location_name: form.location_name.trim(), location_type: form.location_type,
    ...Object.fromEntries(['address_line', 'village', 'district', 'city', 'province', 'postal_code'].map((k) => [k, form[k].trim() || null])),
    latitude: pair?.latitude ?? null, longitude: pair?.longitude ?? null, coordinate_source: pair ? form.coordinate_source || 'MANUAL' : null };
  if (canVerify) { payload.verification_status = form.verification_status; payload.verification_notes = form.verification_notes.trim() || null; }
  if (!payload.location_name) throw new Error('Nama lokasi wajib diisi');
  return payload;
}

export async function saveLocation(candidateId, form, canVerify) {
  const payload = locationPayload(form, canVerify);
  const query = form.id ? supabase.from('vendor_locations').update(payload).eq('id', form.id).eq('candidate_id', candidateId)
    : supabase.from('vendor_locations').insert({ ...payload, candidate_id: candidateId });
  const { data, error } = await query.select('id').single();
  if (error) throw error;
  return data.id;
}

export async function setPrimaryLocation(id) {
  const { error } = await supabase.rpc('vendor_set_primary_location', { p_location_id: id });
  if (error) throw error;
}
export async function setCoverPhoto(id) {
  const { error } = await supabase.rpc('vendor_set_cover_photo', { p_photo_id: id });
  if (error) throw error;
}
export async function updateLocationPhoto(id, payload) {
  const { data, error } = await supabase.from('vendor_location_photos').update(payload).eq('id', id).select('id').single();
  if (error) throw error;
  return data;
}
export async function uploadLocationPhoto(location, file, form) {
  const blob = await preparePhoto(file);
  const extension = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' }[blob.type];
  if (!extension) throw new Error('Browser tidak menghasilkan format foto yang didukung');
  const id = crypto.randomUUID(), path = `${location.candidate_id}/${location.id}/${id}.${extension}`;
  const { error: uploadError } = await supabase.storage.from('vendor-photos').upload(path, blob, { upsert: false, contentType: blob.type, cacheControl: '600' });
  if (uploadError) throw uploadError;
  const { error } = await supabase.from('vendor_location_photos').insert({ id, location_id: location.id, storage_path: path,
    photo_type: form.photo_type, caption: form.caption.trim() || null, taken_at: form.taken_at ? new Date(`${form.taken_at}:00+07:00`).toISOString() : null,
    file_mime: blob.type, file_size: blob.size });
  if (error) {
    const { error: cleanup } = await supabase.storage.from('vendor-photos').remove([path]);
    if (cleanup) throw new Error(`${error.message}. Berkas upload belum terdaftar; minta admin membersihkan orphan ${path}`);
    throw error;
  }
}
export async function signedPhotoUrl(path) {
  const { data, error } = await supabase.storage.from('vendor-photos').createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}
export async function fetchMapPoints() {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from('vendor_map_points').select('*').order('candidate_id').order('location_id', { nullsFirst: true }).range(from, from + 499);
    if (error) { if (backendPending(error)) return null; throw error; }
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
export async function fetchLocationMonitoring(category = '', pic = '') {
  const { data, error } = await supabase.rpc('vendor_location_monitoring', { p_category_id: category || null, p_pic_id: pic || null });
  if (error) { if (backendPending(error)) return null; throw error; }
  return data;
}
export async function fetchActiveMasterVendors() {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from('vendors').select('id,vendor_code,vendor_name').eq('is_active', true).order('vendor_name').order('id').range(from, from + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
export async function linkExistingActiveVendor(id) {
  const { data, error } = await supabase.rpc('vendor_link_existing_active', { p_vendor_id: id });
  if (error) throw error;
  return data;
}
export async function fetchLinkedMasterCandidate(id) {
  const { data, error } = await supabase.from('vendor_candidates').select('id')
    .eq('vendor_id', id).order('created_at').order('id').limit(1).maybeSingle();
  if (error) throw error;
  return data?.id || null;
}
export async function fetchMapSpecialties() {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from('vendor_specialties').select('id,name,category_id').order('name').order('id').range(from, from + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
