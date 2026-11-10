let loading;

export function loadVendorMap() {
  if (!loading) {
    loading = Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')])
      .then(([module]) => module.default || module)
      .catch((error) => { loading = null; throw error; });
  }
  return loading;
}

export function vendorTileConfig() {
  const url = import.meta.env.VITE_VENDOR_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const parsed = new URL(url.replace(/\{[zxy]\}/g, '0'));
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !['{z}', '{x}', '{y}'].every((p) => url.includes(p))) {
    throw new Error('Konfigurasi peta dasar tidak valid. Daftar lokasi dan rute tetap tersedia.');
  }
  const extra = (import.meta.env.VITE_VENDOR_MAP_TILE_CREDIT || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return { url, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>' + (extra ? ` · ${extra}` : '') };
}
