let loading;
export const googleMapsConfigured = () => Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY && import.meta.env.VITE_GOOGLE_MAPS_MAP_ID);
export const googleMapId = () => import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;

export async function loadGoogleMaps() {
  if (!googleMapsConfigured()) throw new Error('Peta belum dikonfigurasi. Daftar lokasi dan navigasi tetap tersedia.');
  if (loading) return loading;
  loading = (async () => {
    window.gm_authFailure = () => window.dispatchEvent(new Event('harmas-maps-auth-error'));
    if (!window.google?.maps?.importLibrary) {
      await new Promise((resolve, reject) => {
        const callback = `harmasMapsLoaded${Date.now()}`;
        const script = document.createElement('script');
        const timer = setTimeout(() => fail(), 20000);
        const clean = () => { clearTimeout(timer); delete window[callback]; };
        const fail = () => { clean(); script.remove(); reject(new Error('Google Maps gagal dimuat. Periksa jaringan atau konfigurasi API.')); };
        window[callback] = () => { clean(); resolve(); };
        script.onerror = fail; script.async = true;
        const params = new URLSearchParams({ key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY, v: 'weekly', loading: 'async', callback, libraries: 'marker' });
        script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
        document.head.append(script);
      });
    }
    const [maps, marker] = await Promise.all([window.google.maps.importLibrary('maps'), window.google.maps.importLibrary('marker')]);
    return { ...maps, ...marker, LatLngBounds: window.google.maps.LatLngBounds, event: window.google.maps.event };
  })().catch((error) => { loading = null; throw error; });
  return loading;
}
