import { useEffect, useMemo, useRef, useState } from 'react';
import { clusterMapPoints, coordinatePair, categoryPin } from '../../lib/vendor-location-utils';
import { loadVendorMap, vendorTileConfig, vendorSatelliteConfig } from '../../lib/vendor-map-loader';
import './vendor-map.css';

const NO_POINTS = [];
const LABEL_MIN_ZOOM = 14; // label nama otomatis muncul saat zoom >= ini (pin sudah renggang)
const LABEL_MODES = [['auto', 'Auto'], ['always', 'Selalu'], ['off', 'Mati']];
// points: titik lokasi; focus: titik terpilih (pan kamera ke sana);
// selectedKey: `${candidate_id}/${location_id||''}` untuk sorotan pin.
// Pin dibedakan per KATEGORI vendor (warna + kode 2 huruf); vendor
// disetujui diberi badge centang. Klaster bernomor tetap biru.
// Label nama pin: mode Auto (muncul saat zoom cukup) / Selalu / Mati.
export default function VendorMap({ points = NO_POINTS, editable = false, onPick, onSelect, height = 400, focus = null, selectedKey = '' }) {
  const element = useRef(null), callbacks = useRef({ onPick, onSelect }), fitted = useRef(false), fittedPoints = useRef(null), tilesRef = useRef(null);
  callbacks.current = { onPick, onSelect };
  const [instance, setInstance] = useState(null), [fatal, setFatal] = useState(''), [tileError, setTileError] = useState(''), [retry, setRetry] = useState(0);
  const [legendOpen, setLegendOpen] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches);
  const [labelMode, setLabelMode] = useState(() => {
    try { return localStorage.getItem('vendor-map-labels') || 'auto'; } catch { return 'auto'; }
  });
  const changeLabelMode = (mode) => {
    setLabelMode(mode);
    try { localStorage.setItem('vendor-map-labels', mode); } catch { /* penyimpanan tidak tersedia — abaikan */ }
  };
  // Peta dasar: 'map' (OpenStreetMap) atau 'satellite' (Esri World Imagery).
  const [baseMode, setBaseMode] = useState(() => {
    try { return localStorage.getItem('vendor-map-base') === 'satellite' ? 'satellite' : 'map'; } catch { return 'map'; }
  });
  const changeBaseMode = (mode) => {
    setBaseMode(mode);
    try { localStorage.setItem('vendor-map-base', mode); } catch { /* penyimpanan tidak tersedia — abaikan */ }
  };
  const valid = useMemo(() => points.filter((p) => { try { return Boolean(coordinatePair(p.latitude, p.longitude)); } catch { return false; } }), [points]);
  // Kategori yang benar-benar ada pada titik saat ini → isi legenda relevan.
  const legendCategories = useMemo(() => {
    const counts = new Map();
    for (const p of valid) {
      const name = p.category_name || 'Tanpa kategori';
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [valid]);

  useEffect(() => {
    let cancelled = false, map, observer, frame;
    setFatal(''); setTileError(''); fitted.current = false;
    loadVendorMap().then((L) => {
      if (cancelled) return;
      map = L.map(element.current, { center: [-2, 118], zoom: 4, minZoom: 2, maxZoom: 19,
        scrollWheelZoom: true, dragging: true, touchZoom: true,
        maxBounds: [[-85.05112878, -180], [85.05112878, 180]], maxBoundsViscosity: 1 });
      map.attributionControl.setPrefix(false);
      if (editable) map.on('click', (e) => callbacks.current.onPick?.({ latitude: e.latlng.lat, longitude: e.latlng.lng, coordinate_source: 'PICK_ON_MAP' }));
      observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => map.invalidateSize({ pan: true, animate: false })); });
      observer.observe(element.current);
      setInstance({ L, map });
    }).catch(() => { if (!cancelled) setFatal('Peta belum dapat dimuat. Daftar lokasi dan tombol rute tetap dapat digunakan.'); });
    return () => { cancelled = true; observer?.disconnect(); cancelAnimationFrame(frame); map?.remove(); };
  }, [editable, retry]);

  // Layer peta dasar mengikuti mode (Peta/Satelit) — diganti tanpa membangun ulang peta.
  useEffect(() => {
    if (!instance) return;
    const { L, map } = instance;
    setTileError('');
    let config;
    try {
      config = baseMode === 'satellite' ? vendorSatelliteConfig() : vendorTileConfig();
    } catch (err) {
      setTileError(err.message);
      return;
    }
    const layer = L.tileLayer(config.url, { attribution: config.attribution, maxZoom: 19, noWrap: true,
      updateWhenIdle: true, keepBuffer: 0, referrerPolicy: 'origin' });
    layer.on('tileerror', () => setTileError('Peta dasar tidak dapat dimuat. Daftar lokasi dan tombol rute tetap dapat digunakan.'));
    tilesRef.current = layer;
    layer.addTo(map);
    return () => { layer.off(); layer.remove(); if (tilesRef.current === layer) tilesRef.current = null; };
  }, [instance, baseMode]);

  useEffect(() => {
    if (!instance) return;
    const { L, map } = instance;
    const layer = L.layerGroup().addTo(map);
    const clear = () => { layer.eachLayer((marker) => marker.off()); layer.clearLayers(); };
    const draw = () => {
      clear();
      const showLabels = !editable && (labelMode === 'always' || (labelMode === 'auto' && map.getZoom() >= LABEL_MIN_ZOOM));
      const visible = valid.filter((p) => map.getBounds().contains([Number(p.latitude), Number(p.longitude)]));
      const groups = editable ? visible.map((p) => ({ items: [p], lat: Number(p.latitude), lng: Number(p.longitude) })) : clusterMapPoints(visible, map.getZoom());
      for (const group of groups) {
        const p = group.items[0], clustered = group.items.length > 1;
        const isHighlighted = !clustered && !editable && selectedKey && `${p.candidate_id}/${p.location_id || ''}` === selectedKey;
        const title = clustered ? `${group.items.length} lokasi vendor` : `${p.business_name || 'Lokasi'} · ${p.location_name || 'Titik pilihan'}`;
        const content = document.createElement('span');
        content.className = `vendor-map-pin ${clustered ? 'vendor-map-cluster' : ''}${isHighlighted ? ' vendor-map-selected' : ''}`;
        if (clustered) {
          content.textContent = String(group.items.length);
        } else {
          const pin = categoryPin(p.category_name);
          content.style.background = pin.color;
          content.innerHTML = `<span class="vendor-map-code">${pin.code}</span>${p.qualification_status === 'APPROVED' ? '<span class="vendor-map-approved-badge" title="Disetujui">✓</span>' : ''}`;
        }
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
        if (showLabels && !clustered) marker.bindTooltip(p.business_name || 'Lokasi', { permanent: true, direction: 'right', offset: [20, 0], className: 'vendor-map-label', opacity: 1 });
        marker.addTo(layer);
      }
    };
    // fitBounds hanya saat kumpulan titik berubah — bukan saat sorotan
    // terpilih berubah (agar viewport tidak direset saat memilih titik).
    if (valid !== fittedPoints.current) {
      fittedPoints.current = valid;
      if (valid.length) {
        const positions = valid.map((p) => [Number(p.latitude), Number(p.longitude)]);
        if (!editable) map.fitBounds(positions, { padding: [40, 40], maxZoom: 16, animate: false });
        else if (!fitted.current) { map.setView(positions[0], 16, { animate: false }); fitted.current = true; }
        else if (!map.getBounds().contains(positions[0])) map.panTo(positions[0], { animate: false });
      }
    }
    map.on('moveend zoomend', draw); draw();
    return () => { map.off('moveend zoomend', draw); clear(); layer.remove(); };
  }, [instance, valid, editable, selectedKey, labelMode]);

  // Pindahkan kamera ke titik terpilih (dipilih dari daftar di samping peta).
  useEffect(() => {
    if (!instance || !focus) return;
    try {
      const [lat, lng] = coordinatePair(focus.latitude, focus.longitude);
      instance.map.setView([lat, lng], Math.max(instance.map.getZoom(), 15), { animate: true });
    } catch { /* koordinat tidak valid — abaikan */ }
  }, [instance, focus]);

  return <div className="space-y-2">
    {(fatal || tileError) && <div role="alert" className="card p-4 text-sm text-rose-300">{fatal || tileError} <button type="button" className="underline" onClick={() => {
      if (fatal) { setInstance(null); setRetry((n) => n + 1); }
      else { setTileError(''); tilesRef.current?.redraw(); }
    }}>Coba lagi</button></div>}
    {!instance && !fatal && <p role="status" className="text-sm text-ink-400">Memuat peta…</p>}
    <div className="relative">
      <div ref={element} role="region" aria-label={editable ? 'Pilih koordinat pada peta' : 'Peta lokasi vendor'} style={{ height }} className="vendor-map-container w-full rounded-xl border border-white/10" />
      {!editable && (
        <div className="vendor-map-controls">
          <div className="vendor-map-labels-control" role="group" aria-label="Mode label nama pin">
            <span className="px-2 text-slate-300" aria-hidden="true">Label</span>
            {LABEL_MODES.map(([value, label]) => (
              <button key={value} type="button" aria-pressed={labelMode === value} onClick={() => changeLabelMode(value)} title={value === 'auto' ? `Nama muncul otomatis saat zoom cukup dekat (≥${LABEL_MIN_ZOOM})` : value === 'always' ? 'Nama selalu tampil di setiap pin' : 'Nama hanya muncul saat kursor di atas pin'}>
                {label}
              </button>
            ))}
          </div>
          <div className="vendor-map-labels-control" role="group" aria-label="Jenis peta dasar">
            <span className="px-2 text-slate-300" aria-hidden="true">Peta</span>
            <button type="button" aria-pressed={baseMode === 'map'} onClick={() => changeBaseMode('map')} title="Peta standar OpenStreetMap">Jalan</button>
            <button type="button" aria-pressed={baseMode === 'satellite'} onClick={() => changeBaseMode('satellite')} title="Citra satelit Esri World Imagery">Satelit</button>
          </div>
        </div>
      )}
      {!editable && (
        legendOpen ? (
          <div className="vendor-map-legend" role="contentinfo" aria-label="Legenda peta">
            <div className="flex items-center justify-between gap-3">
              <strong className="text-[11px] uppercase tracking-wide text-slate-200">Legenda · kategori vendor</strong>
              <button type="button" className="text-slate-300 hover:text-white text-xs px-1" onClick={() => setLegendOpen(false)} aria-label="Sembunyikan legenda">✕</button>
            </div>
            {legendCategories.length === 0 ? <p className="text-slate-300 mt-1.5">Belum ada titik pada peta.</p> : (
              <ul className="mt-1.5 grid gap-y-1" style={{ gridTemplateColumns: legendCategories.length > 5 ? 'auto auto' : 'auto' }}>
                {legendCategories.map(([name, count]) => {
                  const pin = categoryPin(name === 'Tanpa kategori' ? null : name);
                  return <li key={name} className="flex items-center gap-2 whitespace-nowrap">
                    <span className="vendor-map-legend-dot" style={{ background: pin.color }} aria-hidden="true">{pin.code}</span>
                    <span className="text-slate-200">{name === 'Tanpa kategori' ? 'Tanpa kategori' : name}</span>
                    <span className="text-slate-400">({count})</span>
                  </li>;
                })}
              </ul>
            )}
            <p className="mt-2 pt-1.5 border-t border-white/15 text-slate-300 leading-relaxed">
              <span className="vendor-map-legend-check" aria-hidden="true">✓</span> disetujui · angka biru = kumpulan lokasi (klik untuk perbesar)
            </p>
          </div>
        ) : (
          <button type="button" className="vendor-map-legend vendor-map-legend-collapsed" onClick={() => setLegendOpen(true)} aria-label="Tampilkan legenda">Legenda</button>
        )
      )}
    </div>
    <div className="flex flex-wrap justify-end gap-2 text-xs text-ink-400">
      <a className="underline" href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">Laporkan masalah peta dasar</a>
    </div>
  </div>;
}
