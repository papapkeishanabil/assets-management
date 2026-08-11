import { useState, useRef, useMemo, useCallback, useLayoutEffect, useEffect } from 'react';
import { Plus, Minus, Maximize, Minimize2, Loader2, Layers } from 'lucide-react';
import { clampPercent, ANNOTATION_STATUS_LABELS } from '../../lib/ppm-m3-helpers';
import {
  FOCUS,
  computeFitTransform,
  resolveTransformOnResize,
  clampScale,
  pinWorldPoint,
  worldToScreen,
  singlePinFocusTransform,
  bboxForPins,
  bboxFocusTransform,
  layoutFloatingCards,
  connectorPath,
  miniMapBox,
  miniMapExclusionZone,
} from '../../lib/ppm-m31-helpers';
import FloatingPinCard from './FloatingPinCard';
import MiniMap from './MiniMap';

// ============================================================
// AnnotationCanvas — Smart PO viewer (M3.1).
//
// - Viewer fixed box (70vh) dengan world (gambar) yang bisa di-
//   zoom/pan (wheel, drag, tombol) dan di-fit ke PO (default).
// - Pin dirender di LAYER LAYAR (tidak di-scale bersama gambar)
//   sehingga nomor pin selalu terbaca; posisi dihitung dari
//   x%/y% + transform.
// - Single pin focus (DEFAULT_FOCUS_ZOOM) & multi-pin focus
//   (bounding box + margin) dengan transition 300ms.
// - Multi-select pin (desktop): floating cards + SVG connector,
//   layout collision-free (hanya kartu yang digeser, pin tidak).
// - Mobile: isMobile -> floating card dinonaktifkan; tap pin
//   dirutekan via onPinClick (parent membuka bottom sheet).
// - Semua konstanta zoom configurable di FOCUS (ppm-m31-specs).
// ============================================================
export default function AnnotationCanvas({
  documentUrl,
  documentName,
  annotations,
  showPins,
  addMode,
  canManage,
  selectedPinIds,
  focusRequest,
  onFocusConsumed,
  isMobile,
  onAddClick,
  onPinClick,
  onMovePin,
  onOpenPinDetail,
  onClosePinCard,
  expanded,
  onToggleFullscreen,
  onToggleAddMode,
  onSelectAll,
  // M4 (optional, pure pass-through -> FloatingPinCard): rekonsiliasi
  // spec. TIDAK mengubah viewer engine / geometry / focus.
  onProposeSpecChange,
}) {
  const viewerRef = useRef(null);
  const worldRef = useRef(null);
  const dragRef = useRef(null);
  const panRef = useRef(null);
  const measureRef = useRef(null);
  const cardRefs = useRef({});
  const appliedFocusRef = useRef('');
  const measuredKeyRef = useRef('');

  const [viewerSize, setViewerSize] = useState({ w: 0, h: 0 });
  const [worldSize, setWorldSize] = useState({ w: 0, h: 0 });
  const [fit, setFit] = useState({ scale: 1, tx: 0, ty: 0 });
  const [transform, setTransform] = useState({ scale: 1, tx: 0, ty: 0 });
  // Canonical view state: fitMode = transform == Fit-to-PO (contain).
  // Dipakai agar saat container resize (masuk/keluar fullscreen) fit
  // DIHITUNG ULANG terhadap dimensi container baru, bukan reuse scale lama.
  const [fitMode, setFitMode] = useState(true);
  const fitModeRef = useRef(true);
  const [dragging, setDragging] = useState(null); // { id, x, y } percent
  const [transitioning, setTransitioning] = useState(false);
  const [measuredSizes, setMeasuredSizes] = useState({});
  const [imageLoaded, setImageLoaded] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState(null);

  const applyFitMode = (v) => {
    fitModeRef.current = v;
    setFitMode(v);
  };

  // ---------- MEASURE ----------
  const measure = useCallback(() => {
    const v = viewerRef.current;
    const w = worldRef.current;
    if (!v || !w) return;
    const vw = v.clientWidth;
    const vh = v.clientHeight;
    const ww = w.offsetWidth;
    const wh = w.offsetHeight;
    if (!vw || !vh || !ww || !wh) return;
    const newFit = computeFitTransform(ww, wh, vw, vh);
    const prev = measureRef.current;
    setViewerSize({ w: vw, h: vh });
    setWorldSize({ w: ww, h: wh });
    setFit(newFit);
    setTransform((t) => {
      if (!prev) return { ...newFit };
      // Resize (masuk/keluar fullscreen / window resize):
      //  - fitMode true  -> recompute Fit-to-PO utk dimensi container BARU.
      //  - fitMode false -> PRESERVE logical viewport (image-space center +
      //    zoom ratio relatif Fit) agar user tetap melihat AREA PO yang sama
      //    (TIDAK reset ke Fit). Pure logic di ppm-m31-specs (teruji) —
      //    memperbaiki bug sign lama (center lompat ke titik world salah).
      return resolveTransformOnResize(
        t, prev.fitScale, prev.viewerW, prev.viewerH,
        fitModeRef.current, newFit, vw, vh,
      );
    });
    measureRef.current = { fitScale: newFit.scale, viewerW: vw, viewerH: vh };
  }, []);

  useEffect(() => { measure(); }, [measure]);

  useEffect(() => {
    const v = viewerRef.current;
    if (!v || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(v);
    return () => ro.disconnect();
  }, [measure]);

  // Expanded (fullscreen) berubah -> paksa re-measure agar Fit-to-PO
  // dihitung ulang terhadap dimensi container BARU. ResizeObserver pada
  // viewer-root tidak selalu mem-fire andalan saat transisi :fullscreen
  // (race animasi/layout OS) -> transform bisa stagnan pakai skala mode
  // normal sehingga gambar PO tampak kecil di tengah dengan margin besar.
  // measure() idempoten (re-read DOM), aman dipanggil berulang sepanjang
  // jendela transisi (~300ms) sampai layout settle.
  useEffect(() => {
    if (typeof expanded !== 'boolean') return;
    measure();
    const raf = requestAnimationFrame(measure);
    const t1 = setTimeout(measure, 120);
    const t2 = setTimeout(measure, 300);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [expanded, measure]);

  // ---------- WHEEL ZOOM (cursor-center) ----------
  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      applyFitMode(false);
      setTransform((t) => {
        const ns = clampScale(t.scale * factor, fit.scale);
        const k = ns / t.scale;
        return { scale: ns, tx: cx - (cx - t.tx) * k, ty: cy - (cy - t.ty) * k };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [fit.scale]);

  // ---------- PAN ----------
  const handleViewerPointerDown = (e) => {
    if (addMode) return;
    if (e.button !== undefined && e.button !== 0) return;
    // Jangan memulai pan (dan setPointerCapture) pada elemen interaktif
    // (pin, tombol zoom/fit, input, link). setPointerCapture mengalihkan
    // event pointer ke region sehingga `click` anak elemen tidak ter-deliver.
    if (e.target && e.target.closest && e.target.closest('[data-pin], button, a, input, select, label')) return;
    panRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      tx0: transform.tx,
      ty0: transform.ty,
      moved: false,
    };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
  };
  const handleViewerPointerMove = (e) => {
    const p = panRef.current;
    if (!p) return;
    const dx = e.clientX - p.startX;
    const dy = e.clientY - p.startY;
    if (!p.moved && Math.abs(dx) + Math.abs(dy) > 4) p.moved = true;
    setTransform((t) => ({ ...t, tx: p.tx0 + dx, ty: p.ty0 + dy }));
  };
  const handleViewerPointerEnd = (e) => {
    const p = panRef.current;
    panRef.current = null;
    if (p && e.currentTarget.hasPointerCapture && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // ---------- ADD MODE CLICK ----------
  const screenToPercent = (clientX, clientY) => {
    if (worldSize.w <= 0 || worldSize.h <= 0) return null;
    const rect = viewerRef.current ? viewerRef.current.getBoundingClientRect() : null;
    if (!rect) return null;
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const wx = (sx - transform.tx) / transform.scale;
    const wy = (sy - transform.ty) / transform.scale;
    return {
      x: clampPercent((wx / worldSize.w) * 100),
      y: clampPercent((wy / worldSize.h) * 100),
    };
  };

  const handleImageClick = (e) => {
    if (!addMode || dragRef.current || panRef.current) return;
    const pos = screenToPercent(e.clientX, e.clientY);
    if (pos && onAddClick) onAddClick(pos.x, pos.y);
  };

  // ---------- PIN DRAG / CLICK ----------
  const handlePinPointerDown = (e, annotation) => {
    if (addMode) return;
    if (e.button !== undefined && e.button !== 0) return;
    if (worldSize.w <= 0 || worldSize.h <= 0) return;
    const startWorld = pinWorldPoint(annotation.x_percent, annotation.y_percent, worldSize.w, worldSize.h);
    dragRef.current = {
      id: annotation.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startWorldX: startWorld.x,
      startWorldY: startWorld.y,
      startScale: transform.scale,
      moved: false,
    };
    if (canManage) {
      setDragging({ id: annotation.id, x: Number(annotation.x_percent), y: Number(annotation.y_percent) });
    }

    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const dxScreen = ev.clientX - d.startClientX;
      const dyScreen = ev.clientY - d.startClientY;
      if (Math.abs(dxScreen) + Math.abs(dyScreen) > 4) d.moved = true;
      if (!canManage) return;
      const worldX = d.startWorldX + dxScreen / d.startScale;
      const worldY = d.startWorldY + dyScreen / d.startScale;
      setDragging({
        id: d.id,
        x: clampPercent((worldX / worldSize.w) * 100),
        y: clampPercent((worldY / worldSize.h) * 100),
      });
    };

    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      const d = dragRef.current;
      dragRef.current = null;
      setDragging(null);
      if (!d) return;
      if (!d.moved) {
        if (onPinClick) onPinClick(annotation);
        return;
      }
      if (!canManage) return;
      const worldX = d.startWorldX + (ev.clientX - d.startClientX) / d.startScale;
      const worldY = d.startWorldY + (ev.clientY - d.startClientY) / d.startScale;
      const px = clampPercent((worldX / worldSize.w) * 100);
      const py = clampPercent((worldY / worldSize.h) * 100);
      if (onMovePin) onMovePin(d.id, px, py);
    };

    const onCancel = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      dragRef.current = null;
      setDragging(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  };

  // ---------- FOCUS REQUEST (D) ----------
  useEffect(() => {
    if (!focusRequest || !imageLoaded || worldSize.w <= 0 || viewerSize.w <= 0 || viewerSize.h <= 0) return;
    const key = focusRequest.type === 'pin' ? 'p:' + focusRequest.pinId : 'b:' + (focusRequest.pinIds || []).join(',');
    if (appliedFocusRef.current === key) return;
    let tf = null;
    if (focusRequest.type === 'pin') {
      const pin = (annotations || []).find((a) => a.id === focusRequest.pinId);
      if (pin) {
        tf = singlePinFocusTransform(pin, worldSize.w, worldSize.h, viewerSize.w, viewerSize.h, fit.scale);
      }
    } else if (focusRequest.type === 'bbox') {
      const pins = (annotations || []).filter((a) => (focusRequest.pinIds || []).includes(a.id));
      if (pins.length) {
        const bbox = bboxForPins(pins, worldSize.w, worldSize.h, { margin: FOCUS.BBOX_CARD_MARGIN });
        tf = bboxFocusTransform(bbox, viewerSize.w, viewerSize.h, fit.scale, { scaleFactor: FOCUS.BBOX_CARD_SCALE_FACTOR });
      }
    }
    // Fail-safe: jika perhitungan menghasilkan NaN/Infinity, jangan pernah
    // blank viewer — fallback ke Fit-to-PO yang valid.
    const valid = tf && Number.isFinite(tf.scale) && Number.isFinite(tf.tx) && Number.isFinite(tf.ty)
      && tf.scale > 0;
    appliedFocusRef.current = key;
    setTransitioning(true);
    if (valid) {
      applyFitMode(false);
      setTransform(tf);
    } else {
      applyFitMode(true);
      setTransform({ ...fit });
    }
    const t = setTimeout(() => setTransitioning(false), FOCUS.TRANSITION_MS + 50);
    if (onFocusConsumed) onFocusConsumed();
    return () => clearTimeout(t);
  }, [focusRequest, imageLoaded, worldSize, viewerSize, fit, annotations, onFocusConsumed]);

  // ---------- ZOOM CONTROLS ----------
  const zoomBy = (factor) => {
    if (viewerSize.w <= 0) return;
    applyFitMode(false);
    setTransitioning(true);
    setTransform((t) => {
      const ns = clampScale(t.scale * factor, fit.scale);
      const k = ns / t.scale;
      const cx = viewerSize.w / 2;
      const cy = viewerSize.h / 2;
      return { scale: ns, tx: cx - (cx - t.tx) * k, ty: cy - (cy - t.ty) * k };
    });
    setTimeout(() => setTransitioning(false), FOCUS.TRANSITION_MS + 50);
  };
  const fitNow = () => {
    applyFitMode(true);
    setTransitioning(true);
    setTransform({ ...fit });
    setTimeout(() => setTransitioning(false), FOCUS.TRANSITION_MS + 50);
  };
  const zoomPercent = fit.scale ? Math.round((transform.scale / fit.scale) * 100) : 100;

  // ---------- ACTIVE SELECTED PINS (cards only desktop) ----------
  // Urutkan stabil by pin_number agar layout kartu tidak melompat saat
  // seleksi berubah urutan (urutan dari DB sudah by pin_number, ini jadi
  // invariant eksplisit yang tahan terhadap perubahan cara seleksi dibangun).
  const activePins = useMemo(() => {
    if (!showPins || isMobile) return [];
    return (annotations || [])
      .filter((a) => (selectedPinIds || []).includes(a.id))
      .slice()
      .sort((a, b) => (a.pin_number ?? 0) - (b.pin_number ?? 0));
  }, [annotations, selectedPinIds, showPins, isMobile]);
  // expandedCardId disertakan ke key agar saat kartu di-ekspansi/ciutkan,
  // kartu di-ukur ulang (tinggi berubah) -> layout & clamp pakai ukuran riil,
  // bukan tinggi stale versi ciut (M3.2 expanded re-measure).
  const activePinsKey = activePins.map((a) => a.id).join(',') + (expandedCardId ? '|' + expandedCardId : '');

  // measure card sizes (hidden first, then placed without overlap)
  useLayoutEffect(() => {
    if (activePins.length === 0) {
      measuredKeyRef.current = '';
      setMeasuredSizes({});
      return;
    }
    if (measuredKeyRef.current === activePinsKey) return;
    const sizes = {};
    activePins.forEach((a) => {
      const el = cardRefs.current[a.id];
      if (el) sizes[a.id] = { w: el.offsetWidth || 264, h: el.offsetHeight || 120 };
    });
    if (Object.keys(sizes).length === activePins.length) {
      measuredKeyRef.current = activePinsKey;
      setMeasuredSizes(sizes);
    }
  }, [activePins, activePinsKey]);

  const measured = activePins.length > 0 && activePins.every((a) => measuredSizes[a.id]);

  // Mini Map tampil di desktop (bukan mobile) setelah gambar terukur.
  const showMiniMap = !isMobile && imageLoaded && worldSize.w > 0 && worldSize.h > 0 && viewerSize.w >= 420;

  const pinScreenPos = (annotation, dragPos) => {
    const xPct = dragPos ? dragPos.x : Number(annotation.x_percent);
    const yPct = dragPos ? dragPos.y : Number(annotation.y_percent);
    const wp = pinWorldPoint(xPct, yPct, worldSize.w, worldSize.h);
    return worldToScreen(wp.x, wp.y, transform);
  };

  // collision-free card layout + connectors
  const cardLayout = useMemo(() => {
    if (!measured) return [];
    const bounds = { x: 0, y: 0, w: viewerSize.w, h: viewerSize.h };
    // Mini Map = exclusion zone: kartu tidak boleh menutupinya.
    const mmBox = showMiniMap ? miniMapBox(worldSize.w, worldSize.h, viewerSize.w, viewerSize.h) : null;
    const exclusionZones = mmBox ? [miniMapExclusionZone(mmBox)] : [];
    const pinPts = activePins.map((a) => ({ id: a.id, x: pinScreenPos(a, null).x, y: pinScreenPos(a, null).y }));
    return layoutFloatingCards(pinPts, measuredSizes, bounds, { exclusionZones }).map((item) => {
      const pinPt = pinPts.find((p) => p.id === item.pinId);
      return { ...item, connector: connectorPath(item.rect, pinPt) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measured, activePinsKey, measuredSizes, transform.scale, transform.tx, transform.ty, viewerSize.w, viewerSize.h, showMiniMap]);

  const markerId = 'ppm-pin-arrow';

  // Ukuran floating card saat di-ekspansi (dipakai untuk clamp posisi).
  const EXPANDED_CARD_W = 340;
  const EXPANDED_CARD_EST_H = 440;

  // Toggle ekspansi floating card (Detail -> / Tutup Detail).
  const handleToggleCardExpand = (annotation) => {
    setExpandedCardId((prev) => (prev === annotation.id ? null : annotation.id));
  };

  // Klik Mini Map: pindahkan pusat tampilan ke titik (koordinat world).
  const handleMiniMapNavigate = (worldX, worldY) => {
    if (viewerSize.w <= 0 || viewerSize.h <= 0) return;
    applyFitMode(false);
    setTransitioning(true);
    setTransform((t) => ({
      ...t,
      tx: viewerSize.w / 2 - worldX * t.scale,
      ty: viewerSize.h / 2 - worldY * t.scale,
    }));
    setTimeout(() => setTransitioning(false), FOCUS.TRANSITION_MS + 50);
  };

  const visiblePins = showPins ? annotations || [] : [];
  const fitTransformCss = `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`;
  return (
    <div
      ref={viewerRef}
      className="viewer-root relative overflow-hidden rounded-lg border border-white/10 bg-ink-950 select-none"
      style={{ height: '70vh' }}
      onPointerDown={handleViewerPointerDown}
      onPointerMove={handleViewerPointerMove}
      onPointerUp={handleViewerPointerEnd}
      onPointerCancel={handleViewerPointerEnd}
      role="region"
      aria-label="Viewer dokumen PO dengan pin annotation"
    >
      {/* ===== TOOLBAR (Fit ke PO | - | % | + | Fullscreen | Tambah Pin) ===== */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-0.5 rounded-lg border border-white/15 bg-ink-900/90 px-1.5 py-1 shadow-xl">
        <button
          type="button"
          onClick={fitNow}
          className={'px-2 py-1 text-[11px] font-semibold rounded ' +
            (fitMode ? 'text-primary-300 bg-primary-500/15' : 'text-ink-200 hover:text-white')}
          title="Fit ke PO (reset zoom dan posisi)"
        >
          Fit ke PO
        </button>
        <span className="mx-0.5 h-4 w-px bg-white/15" aria-hidden="true" />
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.25)}
          className="p-1.5 text-ink-300 hover:text-white rounded"
          title="Perkecil"
          aria-label="Perkecil zoom"
        >
          <Minus size={15} />
        </button>
        <span className="text-[11px] font-mono text-ink-200 w-11 text-center tabular-nums">
          {zoomPercent}%
        </span>
        <button
          type="button"
          onClick={() => zoomBy(1.25)}
          className="p-1.5 text-ink-300 hover:text-white rounded"
          title="Perbesar"
          aria-label="Perbesar zoom"
        >
          <Plus size={15} />
        </button>
        <span className="mx-0.5 h-4 w-px bg-white/15" aria-hidden="true" />
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="p-1.5 text-ink-300 hover:text-white rounded"
            title={expanded ? 'Keluar dari mode focus' : 'Focus / Fullscreen viewer'}
            aria-label={expanded ? 'Keluar fullscreen' : 'Focus / Fullscreen'}
          >
            {expanded ? <Minimize2 size={15} /> : <Maximize size={15} />}
          </button>
        )}
        {onSelectAll && annotations.length > 0 && (
          <button
            type="button"
            onClick={onSelectAll}
            className="px-2 py-1 text-[11px] font-semibold rounded inline-flex items-center gap-1 text-ink-200 hover:text-white"
            title="Tampilkan semua pin sekaligus (select semua + focus zoom)"
          >
            <Layers size={13} /> Tampilkan Semua
          </button>
        )}
        {canManage && onToggleAddMode && (
          <button
            type="button"
            onClick={onToggleAddMode}
            className={'px-2 py-1 text-[11px] font-semibold rounded inline-flex items-center gap-1 ' +
              (addMode ? 'bg-primary-500 text-white' : 'text-ink-200 hover:text-white')}
            title="Klik gambar untuk menempatkan pin baru"
          >
            <Plus size={13} /> Tambah Pin
          </button>
        )}
      </div>

      {/* ===== WORLD (image, scaled) ===== */}
      <div
        ref={worldRef}
        className="absolute top-0 left-0"
        style={{
          transform: fitTransformCss,
          transformOrigin: '0 0',
          transition: transitioning ? `transform ${FOCUS.TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1)` : 'none',
        }}
        onClick={handleImageClick}
      >
        <img
          src={documentUrl}
          alt={documentName || 'Dokumen PO'}
          className="block w-auto h-auto select-none"
          draggable={false}
          onLoad={() => { setImageLoaded(true); measure(); }}
        />
        {addMode && (
          <div className="pointer-events-none absolute inset-0 rounded-lg border-2 border-primary-400/60 bg-primary-500/5 flex items-center justify-center">
            <span className="badge badge-blue text-xs">Klik pada gambar untuk menempatkan pin</span>
          </div>
        )}
      </div>

      {/* ===== PIN LAYER (screen space — not scaled) ===== */}
      <div className={'absolute inset-0 ' + (addMode ? 'pointer-events-none' : '')}>
        {visiblePins.map((annotation) => {
          const isSelected = (selectedPinIds || []).includes(annotation.id);
          const d = dragging && dragging.id === annotation.id ? dragging : null;
          const pos = pinScreenPos(annotation, d);
          const isOpen = annotation.status === 'OPEN';
          return (
            <button
              key={annotation.id}
              type="button"
              data-pin={annotation.id}
              onPointerDown={(e) => handlePinPointerDown(e, annotation)}
              className={
                'absolute flex items-center justify-center h-6 min-w-[24px] px-1 rounded-full text-[11px] font-bold shadow-lg transition-colors ' +
                'touch-none cursor-pointer hover:scale-110 z-30 ' +
                (isSelected
                  ? 'bg-primary-500 text-white ring-2 ring-white z-40'
                  : isOpen
                    ? 'bg-primary-600 text-white border-2 border-white'
                    : 'bg-primary-800 text-white border-2 border-white/70')
              }
              style={{
                left: pos.x,
                top: pos.y,
                transform: 'translate(-50%, -50%)',
                ...(isSelected ? { boxShadow: '0 0 0 4px rgba(59,130,246,0.3), 0 0 16px 2px rgba(59,130,246,0.55)' } : null),
              }}
              title={annotation._componentLabel || ('Pin ' + annotation.pin_number)}
              aria-label={`Pin ${annotation.pin_number}, ${annotation._componentLabel || 'komponen'}, ${ANNOTATION_STATUS_LABELS[annotation.status]}`}
            >
              {annotation.pin_number}
            </button>
          );
        })}
      </div>

      {/* ===== FLOATING CARDS + CONNECTOR (desktop only) ===== */}
      {!isMobile && activePins.length > 0 && (
        <>
          <svg
            className="absolute inset-0 z-30 pointer-events-none"
            width={viewerSize.w}
            height={viewerSize.h}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="ppm-conn-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
              <filter id="ppm-conn-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <marker id={markerId} markerWidth="10" markerHeight="10" refX="8.5" refY="5" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M1,1 L9,5 L1,9 Z" fill="url(#ppm-conn-grad)" stroke="rgba(255,255,255,0.9)" strokeWidth="0.8" strokeLinejoin="round" />
              </marker>
            </defs>
            {cardLayout.filter((item) => item.pinId !== expandedCardId).map((item) => (
              <path
                key={item.pinId + '-glow'}
                d={item.connector.d}
                fill="none"
                stroke="url(#ppm-conn-grad)"
                strokeWidth="6"
                strokeLinecap="round"
                opacity="0.5"
                filter="url(#ppm-conn-glow)"
                style={{ transition: transitioning ? `d ${FOCUS.TRANSITION_MS}ms, opacity ${FOCUS.TRANSITION_MS}ms` : 'none' }}
              />
            ))}
            {/* Halo putih tebal di belakang stroke biru -> connector tetap jelas
                terlihat di atas gambar PO terang (Light theme) maupun gelap (Dark).
                Pure presentational: TIDAK mengubah geometri connectorPath / mesin
                collision / layout kartu / z-order. (Fix Outstanding UX Issue #3.) */}
            {cardLayout.filter((item) => item.pinId !== expandedCardId).map((item) => (
              <path
                key={item.pinId + '-outline'}
                d={item.connector.d}
                fill="none"
                stroke="#ffffff"
                strokeWidth="5.5"
                strokeLinecap="round"
                opacity="0.9"
                style={{ transition: transitioning ? `d ${FOCUS.TRANSITION_MS}ms, opacity ${FOCUS.TRANSITION_MS}ms` : 'none' }}
              />
            ))}
            {cardLayout.filter((item) => item.pinId !== expandedCardId).map((item) => (
              <path
                key={item.pinId}
                d={item.connector.d}
                fill="none"
                stroke="url(#ppm-conn-grad)"
                strokeWidth="3"
                strokeLinecap="round"
                markerEnd={'url(#' + markerId + ')'}
                style={{
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.45))',
                  transition: transitioning ? `d ${FOCUS.TRANSITION_MS}ms, opacity ${FOCUS.TRANSITION_MS}ms` : 'none',
                }}
              />
            ))}
            {cardLayout.filter((item) => item.pinId !== expandedCardId).map((item) => (
              <circle
                key={item.pinId + '-dot-halo'}
                cx={item.connector.anchor.x}
                cy={item.connector.anchor.y}
                r="5"
                fill="rgba(147,197,253,0.35)"
              />
            ))}
            {cardLayout.filter((item) => item.pinId !== expandedCardId).map((item) => (
              <circle
                key={item.pinId + '-dot'}
                cx={item.connector.anchor.x}
                cy={item.connector.anchor.y}
                r="2.5"
                fill="#bfdbfe"
                stroke="#ffffff"
                strokeWidth="1"
              />
            ))}
          </svg>

          {activePins.map((a) => {
            const l = cardLayout.find((x) => x.pinId === a.id);
            const isExpanded = expandedCardId === a.id;
            let style = { left: 0, top: 0, visibility: 'hidden' };
            if (l && measured) {
              if (isExpanded) {
                // Expanded card lebih lebar/tinggi — clamp agar tetap dalam viewer.
                style = {
                  left: Math.max(8, Math.min(l.rect.x, viewerSize.w - EXPANDED_CARD_W - 8)),
                  top: Math.max(8, Math.min(l.rect.y, viewerSize.h - EXPANDED_CARD_EST_H - 8)),
                  visibility: 'visible',
                };
              } else {
                style = { left: l.rect.x, top: l.rect.y, visibility: 'visible' };
              }
            }
            return (
              <div
                key={a.id}
                className={'absolute ' + (isExpanded ? 'z-[25]' : 'z-20')}
                style={{
                  ...style,
                  transition: transitioning ? 'left 300ms, top 300ms' : 'none',
                }}
              >
                <FloatingPinCard
                  ref={(el) => { cardRefs.current[a.id] = el; }}
                  annotation={a}
                  expanded={isExpanded}
                  onToggleExpand={handleToggleCardExpand}
                  onOpenDetail={onOpenPinDetail}
                  onClose={onClosePinCard}
                  onProposeSpecChange={onProposeSpecChange}
                />
              </div>
            );
          })}
        </>
      )}

      {/* ===== MINI MAP (desktop) ===== */}
      {showMiniMap && (
        <MiniMap
          documentUrl={documentUrl}
          documentName={documentName}
          worldSize={worldSize}
          viewerSize={viewerSize}
          transform={transform}
          onNavigate={handleMiniMapNavigate}
        />
      )}

      {!imageLoaded && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink-950/70">
          <Loader2 className="animate-spin text-primary-400" size={28} />
        </div>
      )}
    </div>
  );
}
