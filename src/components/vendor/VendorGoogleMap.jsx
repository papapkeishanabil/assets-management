import { useEffect, useRef, useState } from 'react';
import { clusterMapPoints, coordinatePair } from '../../lib/vendor-location-utils';
import { googleMapsConfigured, googleMapId, loadGoogleMaps } from '../../lib/google-maps-loader';

export default function VendorGoogleMap({ points = [], editable = false, onPick, onSelect, height = 400 }) {
  const element = useRef(null), mapRef = useRef(null), callbacks = useRef({ onPick, onSelect });
  callbacks.current = { onPick, onSelect };
  const [api, setApi] = useState(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!googleMapsConfigured()) return;
    let ignore = false;
    setError('');
    const authError = () => setError('Akses Google Maps ditolak. Periksa API key, billing, domain dan Map ID.');
    window.addEventListener('harmas-maps-auth-error', authError);
    loadGoogleMaps().then((sdk) => {
      if (ignore) return;
      const map = new sdk.Map(element.current, { center: { lat: -2, lng: 118 }, zoom: 4, mapId: googleMapId(), streetViewControl: false, mapTypeControl: false, gestureHandling: 'cooperative' });
      mapRef.current = map;
      if (editable) map.addListener('click', (event) => callbacks.current.onPick?.({ latitude: event.latLng.lat(), longitude: event.latLng.lng(), coordinate_source: 'PICK_ON_MAP' }));
      setApi(sdk);
    }).catch((err) => { if (!ignore) setError(err.message); });
    return () => { ignore = true; window.removeEventListener('harmas-maps-auth-error', authError); if (mapRef.current) window.google?.maps?.event?.clearInstanceListeners(mapRef.current); mapRef.current = null; };
  }, [editable, retry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!api || !map || error) return;
    const valid = points.filter((p) => { try { return Boolean(coordinatePair(p.latitude, p.longitude)); } catch { return false; } });
    let markers = [];
    const clear = () => { markers.forEach((m) => { api.event.clearInstanceListeners(m); m.map = null; }); markers = []; };
    const draw = () => {
      clear();
      const bounds = map.getBounds();
      const visible = valid.filter((p) => !bounds || bounds.contains({ lat: Number(p.latitude), lng: Number(p.longitude) }));
      const groups = editable ? visible.map((p) => ({ items: [p], lat: Number(p.latitude), lng: Number(p.longitude) })) : clusterMapPoints(visible, map.getZoom() || 4);
      for (const group of groups) {
        const p = group.items[0], clustered = group.items.length > 1;
        const marker = new api.AdvancedMarkerElement({ map, position: { lat: group.lat, lng: group.lng }, gmpDraggable: editable,
          title: clustered ? `${group.items.length} lokasi vendor` : `${p.business_name || 'Lokasi'} · ${p.location_name || 'Titik pilihan'}` });
        const content = document.createElement('div');
        content.className = 'rounded-full border-2 border-white shadow-lg px-2 py-1 text-xs font-semibold';
        content.style.background = clustered ? '#1e40af' : p.qualification_status === 'APPROVED' ? '#15803d' : '#d97706'; content.style.color = '#fff';
        content.textContent = clustered ? String(group.items.length) : '●';
        marker.append(content);
        marker.addListener('click', () => {
          if (clustered) { map.setCenter({ lat: group.lat, lng: group.lng }); map.setZoom(Math.min(21, (map.getZoom() || 4) + 2)); }
          else callbacks.current.onSelect?.(p);
        });
        if (editable) marker.addListener('dragend', () => {
          const pos = marker.position;
          callbacks.current.onPick?.({ latitude: typeof pos.lat === 'function' ? pos.lat() : pos.lat, longitude: typeof pos.lng === 'function' ? pos.lng() : pos.lng, coordinate_source: 'PICK_ON_MAP' });
        });
        markers.push(marker);
      }
    };
    if (valid.length) {
      const bounds = new api.LatLngBounds(); valid.forEach((p) => bounds.extend({ lat: Number(p.latitude), lng: Number(p.longitude) })); map.fitBounds(bounds, 40);
      api.event.addListenerOnce(map, 'idle', () => { if (valid.length === 1 && map.getZoom() > 16) map.setZoom(16); });
    }
    const listener = map.addListener('idle', draw); draw();
    return () => { listener.remove(); clear(); };
  }, [api, points, editable, error]);

  if (!googleMapsConfigured()) return <div className="card p-5 text-sm text-ink-400" role="status">Peta belum dikonfigurasi. Gunakan daftar lokasi dan tombol Buka Google Maps. Koordinat tetap dapat diisi manual atau melalui GPS.</div>;
  return <div className="space-y-2">
    {error && <div role="alert" className="card p-4 text-sm text-rose-300">{error} <button className="underline" onClick={() => { setApi(null); setRetry((n) => n + 1); }}>Coba lagi</button></div>}
    {!api && !error && <p role="status" className="text-sm text-ink-400">Memuat Google Maps…</p>}
    <div ref={element} aria-label={editable ? 'Pilih koordinat pada peta' : 'Peta lokasi vendor'} style={{ height, display: error ? 'none' : 'block' }} className="w-full rounded-xl border border-white/10" />
    {!editable && <p className="text-xs text-ink-400">● Hijau: disetujui · ● Jingga: kandidat lain · Angka biru: kelompok lokasi, klik untuk memperbesar.</p>}
  </div>;
}
