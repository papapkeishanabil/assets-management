import { useEffect, useMemo, useRef, useState } from 'react';
import { clusterMapPoints, coordinatePair } from '../../lib/vendor-location-utils';
import { loadVendorMap, vendorTileConfig } from '../../lib/vendor-map-loader';
import './vendor-map.css';

const NO_POINTS = [];
export default function VendorMap({ points = NO_POINTS, editable = false, onPick, onSelect, height = 400 }) {
  const element = useRef(null), callbacks = useRef({ onPick, onSelect }), fitted = useRef(false);
  callbacks.current = { onPick, onSelect };
  const [instance, setInstance] = useState(null), [fatal, setFatal] = useState(''), [tileError, setTileError] = useState(''), [retry, setRetry] = useState(0);
  const valid = useMemo(() => points.filter((p) => { try { return Boolean(coordinatePair(p.latitude, p.longitude)); } catch { return false; } }), [points]);

  useEffect(() => {
    let cancelled = false, map, tiles, observer, frame;
    setFatal(''); setTileError(''); fitted.current = false;
    loadVendorMap().then((L) => {
      if (cancelled) return;
      const config = vendorTileConfig();
      map = L.map(element.current, { center: [-2, 118], zoom: 4, minZoom: 2, maxZoom: 19, scrollWheelZoom: false,
        maxBounds: [[-85.05112878, -180], [85.05112878, 180]], maxBoundsViscosity: 1 });
      map.attributionControl.setPrefix(false);
      tiles = L.tileLayer(config.url, { attribution: config.attribution, maxZoom: 19, noWrap: true,
        updateWhenIdle: true, keepBuffer: 0, referrerPolicy: 'origin' });
      tiles.on('tileerror', () => { if (!cancelled) setTileError('Peta dasar tidak dapat dimuat. Daftar lokasi dan tombol rute tetap dapat digunakan.'); });
      tiles.addTo(map);
      if (editable) map.on('click', (e) => callbacks.current.onPick?.({ latitude: e.latlng.lat, longitude: e.latlng.lng, coordinate_source: 'PICK_ON_MAP' }));
      observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => map.invalidateSize({ pan: true, animate: false })); });
      observer.observe(element.current);
      setInstance({ L, map, tiles });
    }).catch(() => { if (!cancelled) setFatal('Peta belum dapat dimuat. Daftar lokasi dan tombol rute tetap dapat digunakan.'); });
    return () => { cancelled = true; observer?.disconnect(); cancelAnimationFrame(frame); tiles?.off(); map?.remove(); };
  }, [editable, retry]);

  useEffect(() => {
    if (!instance) return;
    const { L, map } = instance;
    const layer = L.layerGroup().addTo(map);
    const clear = () => { layer.eachLayer((marker) => marker.off()); layer.clearLayers(); };
    const draw = () => {
      clear();
      const visible = valid.filter((p) => map.getBounds().contains([Number(p.latitude), Number(p.longitude)]));
      const groups = editable ? visible.map((p) => ({ items: [p], lat: Number(p.latitude), lng: Number(p.longitude) })) : clusterMapPoints(visible, map.getZoom());
      for (const group of groups) {
        const p = group.items[0], clustered = group.items.length > 1;
        const title = clustered ? `${group.items.length} lokasi vendor` : `${p.business_name || 'Lokasi'} · ${p.location_name || 'Titik pilihan'}`;
        const content = document.createElement('span'); content.className = `vendor-map-pin ${clustered ? 'vendor-map-cluster' : p.qualification_status === 'APPROVED' ? 'vendor-map-approved' : 'vendor-map-prospect'}`;
        content.textContent = clustered ? String(group.items.length) : '●';
        const marker = L.marker([group.lat, group.lng], { title, keyboard: true, draggable: editable,
          icon: L.divIcon({ html: content, className: 'vendor-map-marker', iconSize: [36, 36], iconAnchor: [18, 18] }) });
        marker.on('click', () => {
          if (!clustered) return callbacks.current.onSelect?.(p);
          if (map.getZoom() < 19) return map.setView([group.lat, group.lng], Math.min(19, map.getZoom() + 2), { animate: false });
          const list = document.createElement('div'); list.className = 'vendor-map-coincident';
          for (const point of group.items) {
            const button = document.createElement('button'); button.type = 'button';
            button.textContent = `${point.business_name} · ${point.location_name || 'Lokasi'}`;
            button.addEventListener('click', () => { callbacks.current.onSelect?.(point); map.closePopup(); }); list.append(button);
          }
          L.DomEvent.disableClickPropagation(list);
          L.popup({ maxHeight: 240, maxWidth: 320 }).setLatLng([group.lat, group.lng]).setContent(list).openOn(map);
        });
        if (editable) marker.on('dragend', () => { const position = marker.getLatLng(); callbacks.current.onPick?.({ latitude: position.lat, longitude: position.lng, coordinate_source: 'PICK_ON_MAP' }); });
        marker.addTo(layer);
      }
    };
    if (valid.length) {
      const positions = valid.map((p) => [Number(p.latitude), Number(p.longitude)]);
      if (!editable) map.fitBounds(positions, { padding: [40, 40], maxZoom: 16, animate: false });
      else if (!fitted.current) { map.setView(positions[0], 16, { animate: false }); fitted.current = true; }
      else if (!map.getBounds().contains(positions[0])) map.panTo(positions[0], { animate: false });
    }
    map.on('moveend zoomend', draw); draw();
    return () => { map.off('moveend zoomend', draw); clear(); layer.remove(); };
  }, [instance, valid, editable]);

  return <div className="space-y-2">
    {(fatal || tileError) && <div role="alert" className="card p-4 text-sm text-rose-300">{fatal || tileError} <button type="button" className="underline" onClick={() => {
      if (fatal) { setInstance(null); setRetry((n) => n + 1); }
      else { setTileError(''); instance?.tiles.redraw(); }
    }}>Coba lagi</button></div>}
    {!instance && !fatal && <p role="status" className="text-sm text-ink-400">Memuat peta…</p>}
    <div ref={element} role="region" aria-label={editable ? 'Pilih koordinat pada peta' : 'Peta lokasi vendor'} style={{ height }} className="vendor-map-container w-full rounded-xl border border-white/10" />
    <div className="flex flex-wrap justify-between gap-2 text-xs text-ink-400">
      {!editable && <span>● Hijau: disetujui · ● Jingga: kandidat lain · Angka biru: kelompok lokasi, klik untuk memperbesar.</span>}
      <a className="underline" href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">Laporkan masalah peta dasar</a>
    </div>
  </div>;
}
