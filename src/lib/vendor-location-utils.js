export const LOCATION_TYPES = { RUMAH_PRODUKSI: 'Rumah Produksi', WORKSHOP_JAHIT: 'Workshop Jahit', WORKSHOP_BORDIR: 'Workshop Bordir', PABRIK: 'Pabrik', GUDANG: 'Gudang', TOKO: 'Toko', KANTOR: 'Kantor', LAINNYA: 'Lainnya' };
export const PHOTO_TYPES = { EXTERIOR: 'Tampak luar', ENTRANCE: 'Pintu masuk', PRODUCTION_AREA: 'Area produksi', MACHINES: 'Mesin', WAREHOUSE: 'Gudang', OTHER: 'Lainnya' };
export const VERIFICATION_LABELS = { UNVERIFIED: 'Belum diverifikasi', NEEDS_REVISIT: 'Perlu kunjungan ulang', VERIFIED: 'Terverifikasi' };
export const LOCATION_READ_ROLES = ['sourcing', 'hrd', 'direksi', 'super_admin'];

export function coordinatePair(latitude, longitude) {
  const empty = (v) => v === '' || v === null || v === undefined || (typeof v === 'string' && !v.trim());
  if (empty(latitude) && empty(longitude)) return null;
  if (empty(latitude) || empty(longitude)) throw new Error('Latitude dan longitude harus diisi berpasangan');
  const lat = Number(latitude), lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error('Koordinat di luar rentang latitude/longitude');
  return { latitude: lat, longitude: lng };
}

export function parseMapCoordinates(input) {
  const value = input.trim();
  const pair = /^([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)$/;
  let match = value.match(pair);
  if (match) return { ...coordinatePair(match[1], match[2]), coordinate_source: 'MANUAL' };
  let url;
  try { url = new URL(value); } catch { throw new Error('Masukkan pasangan koordinat atau URL Google Maps lengkap'); }
  if (['maps.app.goo.gl', 'goo.gl'].includes(url.hostname)) throw new Error('Tautan pendek belum dapat diurai. Buka Maps lalu salin URL lengkap atau koordinat.');
  if (url.protocol !== 'https:' || !['google.com', 'www.google.com', 'maps.google.com', 'google.co.id', 'www.google.co.id', 'maps.google.co.id'].includes(url.hostname)) throw new Error('Gunakan URL HTTPS Google Maps yang valid');
  const decoded = decodeURIComponent(url.pathname + url.search);
  match = decoded.match(/!3d([+-]?\d+(?:\.\d+)?)!4d([+-]?\d+(?:\.\d+)?)/)
    || (url.searchParams.get('q') || url.searchParams.get('query') || '').match(pair)
    || decoded.match(/@([+-]?\d+(?:\.\d+)?),([+-]?\d+(?:\.\d+)?)(?:,|\/|$)/);
  if (!match) throw new Error('URL tidak memuat koordinat yang dapat dipastikan. Tempel koordinat secara manual.');
  return { ...coordinatePair(match[1], match[2]), coordinate_source: 'MAPS_LINK' };
}

export function googleMapsUrl(latitude, longitude) {
  const point = coordinatePair(latitude, longitude);
  return point ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${point.latitude},${point.longitude}`)}` : null;
}

export function locationReadiness(location) {
  const point = coordinatePair(location.latitude, location.longitude);
  const complete = Boolean(point && location.address_line?.trim() && location.city?.trim() && location.province?.trim()
    && location.photos?.some((p) => p.photo_type === 'EXTERIOR' && !p.is_archived));
  return { complete, label: !complete ? 'Data Lokasi Belum Lengkap' : location.verification_status === 'VERIFIED' ? 'Lokasi Terverifikasi' : 'Koordinat Belum Diverifikasi',
    badge: !complete ? 'badge-orange' : location.verification_status === 'VERIFIED' ? 'badge-green' : 'badge-yellow' };
}

export function filterMapPoints(rows, filters) {
  return rows.filter((p) => (!filters.category || p.category_id === filters.category)
    && (!filters.specialty || p.specialty_ids?.includes(filters.specialty)) && (!filters.stage || p.process_stage === filters.stage)
    && (!filters.qualification || p.qualification_status === filters.qualification) && (!filters.operational || p.operational_status === filters.operational)
    && (!filters.pic || p.internal_pic_id === filters.pic) && (!filters.city || p.city === filters.city)
    && (!filters.verification || p.verification_status === filters.verification) && (!filters.primary || p.is_primary)
    && (filters.scope !== 'active' || Boolean(p.vendor_id)) && (filters.scope !== 'candidate' || !p.vendor_id)
    && (!filters.search || `${p.business_name} ${p.candidate_code} ${p.location_name || ''}`.toLocaleLowerCase('id-ID').includes(filters.search.toLocaleLowerCase('id-ID'))));
}

// Grid Web Mercator: seluruh titik terwakili, jumlah DOM marker dibatasi oleh
// cluster/viewport. Tidak menyembunyikan lokasi ke-1001 atau pin gudang kedua.
export function clusterMapPoints(points, zoom = 6) {
  const scale = 256 * 2 ** zoom, groups = new Map();
  for (const p of points) {
    const pair = coordinatePair(p.latitude, p.longitude);
    if (!pair) continue;
    const lat = Math.max(-85.05112878, Math.min(85.05112878, pair.latitude));
    const sine = Math.sin(lat * Math.PI / 180);
    const x = (pair.longitude + 180) / 360 * scale;
    const y = (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * scale;
    const key = `${Math.floor(x / 64)}:${Math.floor(y / 64)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  return [...groups.values()].map((items) => ({ items, lat: items.reduce((n, p) => n + Number(p.latitude), 0) / items.length,
    lng: items.reduce((n, p) => n + Number(p.longitude), 0) / items.length }));
}

export function detectPhotoMime(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return 'image/png';
  const ascii = (start, end) => String.fromCharCode(...bytes.slice(start, end));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export async function validatePhotoFile(file) {
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('Ukuran foto harus 1 byte sampai 5 MB');
  const ext = file.name.split('.').pop()?.toLowerCase();
  const extensions = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  const actual = detectPhotoMime(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!extensions[ext] || extensions[ext] !== file.type || actual !== file.type) throw new Error('Ekstensi, MIME dan signature harus cocok: JPG, PNG atau WebP');
}

export async function preparePhoto(file) {
  await validatePhotoFile(file);
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 40000000 || !bitmap.width || !bitmap.height) throw new Error('Resolusi foto terlalu besar/tidak valid (maksimal 40 megapiksel)');
    const ratio = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86));
    if (!blob || blob.size > 5242880) throw new Error('Foto gagal dikompresi ke batas 5 MB');
    return blob; // Encode ulang pixel: metadata asli/EXIF tidak disalin.
  } finally { bitmap.close(); }
}
