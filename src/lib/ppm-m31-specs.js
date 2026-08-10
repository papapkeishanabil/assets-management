// ============================================================
// PPM M3.1 PURE HELPERS - Smart Annotation Viewer & Register Foundation
// Pure (no DB/import.meta.env) — aman diimport dari test Node (ESM).
// Import dari src/lib/ppm-m31-helpers.js untuk dipakai frontend.
//
// Fokus M3.1:
//  A. Add Component langsung dari Annotation (library + custom)
//  B. Floating Pin Information Card (desktop) + SVG connector
//  C. Multi-pin selection + collision-free card layout
//  D. Smart Focus Zoom (fit / single pin / multi-pin bbox)
//  F. Annotation Register (group by component / pin, filter, decision priority)
//  E. Mobile grouping (bottom sheet summary)
// ============================================================
import {
  decisionFirstNotes,
  componentDisplayLabel,
} from './ppm-m3-specs.js';

// ============================================================
// CONSTANTS — configurable (bukan hardcode tersembunyi)
// ============================================================
export const FOCUS = {
  MIN_AUTO_ZOOM: 1.0,          // zoom minimal = fit page
  DEFAULT_FOCUS_ZOOM: 1.75,    // single pin focus
  MAX_AUTO_ZOOM: 3.0,          // zoom maksimal auto
  BBOX_MARGIN: 0.16,           // safe margin (%) di sekitar bounding box multi-pin
  TRANSITION_MS: 300,          // smooth transition (250–350ms)
  BBOX_CARD_MARGIN: 0.30,      // margin ekstra saat multi-pin focus (ruang untuk kartu) — M3.2 tuning
  BBOX_CARD_SCALE_FACTOR: 0.78,// zoom keluar sedikit saat multi-pin + kartu — M3.2 tuning
};

export const CARD = {
  GAP: 44,                     // jarak kartu dari pin (longgar agar connector terlihat) — M3 polish: ~40-80px target
  PIN_RADIUS: 14,              // radius visual pin (h-6 ~ 24px)
  PIN_SAFE_RADIUS: 36,         // zona proteksi pin: kartu TIDAK boleh menutupi zona ini
  PIN_CONNECTOR_OFFSET: 14,    // ujung connector = tepi pin (offset dari center pin)
  MAX_NUDGE_ITER: 14,          // iterasi "geser ke nearest free slot"
  PIN_OVERLAP_PENALTY: 1e6,    // penalti kartu menutupi zona pin
};

// 8 candidate placement, corner dulu (menjauh dari pin lain), lalu tepi
export const CARD_PLACEMENTS = [
  'top-right',
  'top-left',
  'bottom-right',
  'bottom-left',
  'right',
  'left',
  'top',
  'bottom',
];

export const MINI_MAP = {
  WIDTH: 220,              // lebar thumbnail desktop (210–250px)
  MAX_HEIGHT: 150,         // tinggi maksimal thumbnail
  MARGIN: 12,              // jarak dari tepi viewer
  BORDER_RADIUS: 10,
  ZONE_PAD: 10,            // padding zona proteksi mini map (exclusion zone kartu)
};

// ============================================================
// GEOMETRY (pure)
// ============================================================
export function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function rectContainsPoint(rect, p) {
  return p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
}

// Luas irisan dua rect. 0 bila tidak berpotongan.
export function rectIntersectArea(a, b) {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  if (x1 <= x0 || y1 <= y0) return 0;
  return (x1 - x0) * (y1 - y0);
}

export function rectsOverlap(a, b) {
  return rectIntersectArea(a, b) > 0;
}

export function moveToward(from, to, dist) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: from.x, y: from.y };
  const u = dist / len;
  return { x: from.x + dx * u, y: from.y + dy * u };
}

// Titik di tepi rect pada garis dari center rect menuju target.
export function rectBoundaryPointAlongRay(rect, target) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const hw = rect.w / 2;
  const hh = rect.h / 2;
  let t = Infinity;
  if (dx !== 0) t = Math.min(t, hw / Math.abs(dx));
  if (dy !== 0) t = Math.min(t, hh / Math.abs(dy));
  if (!Number.isFinite(t)) t = 1;
  return { x: cx + dx * t, y: cy + dy * t };
}

// ============================================================
// SMART FOCUS ZOOM (D)
// ============================================================

// Scale contain agar SELURUH gambar (world W/H) terlihat di dalam viewer,
// menjaga aspect ratio (contain — bukan cover/crop/stretch).
// Pure: dipakai untuk normal viewport DAN fullscreen viewport.
export function computeFitScale(worldW, worldH, viewerW, viewerH) {
  if (!worldW || !worldH || !viewerW || !viewerH) return 1;
  return Math.min(viewerW / worldW, viewerH / worldH) || 1;
}

// Transform agar seluruh gambar (world W/H) fit di dalam viewer, ter-center.
export function computeFitTransform(worldW, worldH, viewerW, viewerH) {
  if (!worldW || !worldH || !viewerW || !viewerH) return { scale: 1, tx: 0, ty: 0 };
  const scale = computeFitScale(worldW, worldH, viewerW, viewerH);
  const tx = (viewerW - worldW * scale) / 2;
  const ty = (viewerH - worldH * scale) / 2;
  return { scale, tx, ty };
}

// ============================================================
// RESIZE-PRESERVE LOGICAL VIEWPORT (fullscreen enter/exit, window resize)
// ============================================================
// Saat container viewer berubah ukuran (masuk/keluar fullscreen, resize
// jendela), pan/translate pixel LAMA tidak valid. Yang stabil adalah
// "logical viewport": titik world (image-space) di PUSAT viewport + rasio
// zoom relatif terhadap Fit. Resolve ulang keduanya ke pixel container BARU
// agar user tetap melihat AREA PO yang sama (TIDAK reset ke Fit), KECUALI
// mode memang Fit (recompute Fit utk container baru). Pure & teruji (§17).
//
// Catatan geometri: konvensi transform = screen = tx + world*scale (lihat
// worldToScreen). Maka titik world di pusat viewport = (viewerW/2 - tx)/scale,
// BUKAN (tx + viewerW/2)/scale. Bug sign lama di measure() menyebabkan pusat
// viewport melompat ke titik world salah saat resize -> fokus hilang; kini
// fixed lewat deriveViewportCenter yang benar (teruji).

// Rasio zoom logis: scale relatif terhadap Fit (1.0 = Fit, 1.75 = fokus pin).
// Stabil terhadap perubahan ukuran container (tidak bergantung pixel absolut).
export function logicalZoomRatio(scale, fitScale) {
  return Number(scale) / (Number(fitScale) || 1);
}

// Titik world (image-space px) di PUSAT viewport saat ini.
export function deriveViewportCenter(transform, viewerW, viewerH) {
  const s = Number(transform && transform.scale) || 1;
  const tx = Number(transform && transform.tx) || 0;
  const ty = Number(transform && transform.ty) || 0;
  return { x: (viewerW / 2 - tx) / s, y: (viewerH / 2 - ty) / s };
}

// Resolve transform BARU yang mempertahankan image-space center + rasio zoom
// logis untuk container baru (newFit dihitung utk newViewerW/H).
export function resolveTransformPreservingCenter(centerX, centerY, logicalZoom, newFit, newViewerW, newViewerH) {
  const fitScale = Number(newFit && newFit.scale) || 1;
  const ns = clampScale(Number(logicalZoom) * fitScale, fitScale);
  return {
    scale: ns,
    tx: newViewerW / 2 - Number(centerX) * ns,
    ty: newViewerH / 2 - Number(centerY) * ns,
  };
}

// Keputusan resize (dipakai measure() saat container berubah):
//  - fitMode true  -> recompute Fit-to-PO utk container baru.
//  - fitMode false -> PRESERVE logical viewport (image-space center + zoom ratio).
export function resolveTransformOnResize(currentTransform, currentFitScale, currentViewerW, currentViewerH, fitMode, newFit, newViewerW, newViewerH) {
  if (fitMode) return { ...newFit };
  const ratio = logicalZoomRatio(currentTransform.scale, currentFitScale);
  const center = deriveViewportCenter(currentTransform, currentViewerW, currentViewerH);
  return resolveTransformPreservingCenter(center.x, center.y, ratio, newFit, newViewerW, newViewerH);
}

// Batasi scale agar antara fit dan fit * MAX_AUTO_ZOOM.
export function clampScale(scale, fitScale, opts = {}) {
  const fit = fitScale || 1;
  const min = fit * (opts.min || FOCUS.MIN_AUTO_ZOOM);
  const max = fit * (opts.max || FOCUS.MAX_AUTO_ZOOM);
  return clamp(scale, min, max);
}

// Titik pin dalam koordinat world (pixel gambar tampil).
export function pinWorldPoint(xPercent, yPercent, worldW, worldH) {
  return {
    x: (Number(xPercent) || 0) / 100 * worldW,
    y: (Number(yPercent) || 0) / 100 * worldH,
  };
}

// World point -> layar viewer (transform { scale, tx, ty }, origin 0 0).
export function worldToScreen(x, y, transform) {
  return {
    x: transform.tx + x * transform.scale,
    y: transform.ty + y * transform.scale,
  };
}

// Transform fokus single pin: pin di-center viewer, zoom DEFAULT_FOCUS_ZOOM.
export function singlePinFocusTransform(pin, worldW, worldH, viewerW, viewerH, fitScale, opts = {}) {
  const targetScale = clampScale(fitScale * (opts.zoom || FOCUS.DEFAULT_FOCUS_ZOOM), fitScale, opts);
  const p = pinWorldPoint(pin.x_percent, pin.y_percent, worldW, worldH);
  return {
    scale: targetScale,
    tx: viewerW / 2 - p.x * targetScale,
    ty: viewerH / 2 - p.y * targetScale,
  };
}

// Bounding box (dalam koordinat world) semua pin + safe margin.
export function bboxForPins(pins, worldW, worldH, opts = {}) {
  const list = (pins || []).filter((p) => p && Number.isFinite(Number(p.x_percent)));
  if (list.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  list.forEach((p) => {
    const pt = pinWorldPoint(p.x_percent, p.y_percent, worldW, worldH);
    minX = Math.min(minX, pt.x);
    minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x);
    maxY = Math.max(maxY, pt.y);
  });
  let w = maxX - minX;
  let h = maxY - minY;
  const margin = Math.max(w, h, Math.max(worldW, worldH) * 0.02) * (opts.margin || FOCUS.BBOX_MARGIN);
  const x = clamp(minX - margin, 0, worldW);
  const y = clamp(minY - margin, 0, worldH);
  w = clamp(maxX + margin, 0, worldW) - x;
  h = clamp(maxY + margin, 0, worldH) - y;
  return { x, y, w: Math.max(w, 1), h: Math.max(h, 1) };
}

// Transform fokus bounding box multi-pin: seluruh pin terlihat + margin.
// opts.scaleFactor < 1 = zoom keluar ekstra agar floating cards punya ruang.
export function bboxFocusTransform(bbox, viewerW, viewerH, fitScale, opts = {}) {
  if (!bbox) return null;
  const scale = clampScale(Math.min(viewerW / bbox.w, viewerH / bbox.h) * (opts.scaleFactor || 1), fitScale, opts);
  const cx = bbox.x + bbox.w / 2;
  const cy = bbox.y + bbox.h / 2;
  return {
    scale,
    tx: viewerW / 2 - cx * scale,
    ty: viewerH / 2 - cy * scale,
  };
}

// Rect area gambar yang TERLIHAT di viewer (koordinat world), di-clamp ke
// batas gambar. Dipakai untuk rectangle di Mini Map.
export function computeViewportRect(transform, worldW, worldH, viewerW, viewerH) {
  if (!transform || !worldW || !worldH || !viewerW || !viewerH) return null;
  const inv = 1 / (transform.scale || 1);
  const x0 = (0 - transform.tx) * inv;
  const y0 = (0 - transform.ty) * inv;
  const x1 = (viewerW - transform.tx) * inv;
  const y1 = (viewerH - transform.ty) * inv;
  const minX = clamp(Math.min(x0, x1), 0, worldW);
  const minY = clamp(Math.min(y0, y1), 0, worldH);
  const maxX = clamp(Math.max(x0, x1), 0, worldW);
  const maxY = clamp(Math.max(y0, y1), 0, worldH);
  return { x: minX, y: minY, w: Math.max(maxX - minX, 0), h: Math.max(maxY - minY, 0) };
}

// Kotak thumbnail Mini Map (koordinat viewer), anchored kiri-bawah, menjaga
// rasio aspek gambar agar thumbnail penuh tanpa letterbox.
export function miniMapBox(worldW, worldH, viewerW, viewerH, opts = {}) {
  if (!worldW || !worldH || !viewerW || !viewerH) return null;
  const margin = opts.margin ?? MINI_MAP.MARGIN;
  const maxW = Math.min(opts.width ?? MINI_MAP.WIDTH, Math.max(viewerW - 2 * margin, 1));
  const maxH = opts.maxHeight ?? MINI_MAP.MAX_HEIGHT;
  const aspect = worldH / worldW;
  let w = maxW;
  let h = w * aspect;
  if (h > maxH) {
    h = maxH;
    w = h / aspect;
  }
  const x = margin;
  const y = Math.max(viewerH - h - margin, 0);
  return { x, y, w, h };
}

// Exclusion zone Mini Map (rect + pad) untuk layout floating cards.
export function miniMapExclusionZone(box, opts = {}) {
  if (!box) return null;
  const pad = opts.zonePad ?? MINI_MAP.ZONE_PAD;
  return { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 };
}

// ============================================================
// FLOATING CARD LAYOUT / COLLISION ENGINE (B, C)
// ============================================================

// Rect kandidat untuk satu placement (di-clamp ke bounds).
export function cardRectForPlacement(placement, pin, cardW, cardH, bounds, opts = {}) {
  const gap = opts.gap ?? CARD.GAP;
  const r = opts.pinRadius ?? CARD.PIN_RADIUS;
  let x = 0, y = 0;
  switch (placement) {
    case 'right':
      x = pin.x + r + gap; y = pin.y - cardH / 2;
      break;
    case 'left':
      x = pin.x - cardW - r - gap; y = pin.y - cardH / 2;
      break;
    case 'bottom':
      x = pin.x - cardW / 2; y = pin.y + r + gap;
      break;
    case 'top':
      x = pin.x - cardW / 2; y = pin.y - cardH - r - gap;
      break;
    case 'bottom-right':
      x = pin.x + r + gap; y = pin.y + gap;
      break;
    case 'bottom-left':
      x = pin.x - cardW - r - gap; y = pin.y + gap;
      break;
    case 'top-right':
      x = pin.x + r + gap; y = pin.y - cardH - gap;
      break;
    case 'top-left':
      x = pin.x - cardW - r - gap; y = pin.y - cardH - gap;
      break;
    default:
      x = pin.x + r + gap; y = pin.y - cardH / 2;
  }
  const w = cardW, h = cardH;
  x = clamp(x, bounds.x, Math.max(bounds.x, bounds.x + bounds.w - w));
  y = clamp(y, bounds.y, Math.max(bounds.y, bounds.y + bounds.h - h));
  return { x, y, w, h };
}

// Zona proteksi pin (persegi di sekitar pin) — kartu tidak boleh menutupinya.
export function pinSafeRect(pin, opts = {}) {
  const r = opts.pinSafeRadius ?? CARD.PIN_SAFE_RADIUS;
  return { x: pin.x - r, y: pin.y - r, w: r * 2, h: r * 2 };
}

// Luas kartu yang menutupi zona proteksi satu pin.
export function pinZoneOverlap(rect, pin, opts = {}) {
  return rectIntersectArea(rect, pinSafeRect(pin, opts));
}

// Total luas kartu yang menutupi zona proteksi SEMUA pin (bukan hanya miliknya).
export function totalPinZoneOverlap(rect, pins, opts = {}) {
  return (pins || []).reduce((sum, p) => sum + pinZoneOverlap(rect, p, opts), 0);
}

// Total overlap kartu terhadap zona proteksi pin + exclusion zone (mini map dll).
export function protectedOverlapTotal(rect, pins, opts = {}) {
  return totalPinZoneOverlap(rect, pins, opts)
    + (opts.exclusionZones || []).reduce((sum, z) => sum + rectIntersectArea(rect, z), 0);
}

function scoreCandidate(rect, pin, allPins, placed, opts) {
  let overlap = 0;
  placed.forEach((p) => { overlap += rectIntersectArea(rect, p); });
  // Penalti: kartu menutupi zona pin MANAPUN atau exclusion zone (mini map).
  const pinPenalty = protectedOverlapTotal(rect, allPins, opts) * (opts.pinOverlapPenalty ?? CARD.PIN_OVERLAP_PENALTY);
  const dist = Math.hypot(rect.x + rect.w / 2 - pin.x, rect.y + rect.h / 2 - pin.y);
  return overlap + pinPenalty + dist * 0.01;
}

// Geser rect ke "nearest free slot" sehingga tidak overlap dengan rect lain.
// Mencoba kandidat jarak FULL-clear pada dua arah tiap sumbu; memilih yang
// tetap dalam bounds, tidak overlap, dan paling dekat (skor terkecil).
// opts.pinZones = daftar pin: kartu juga tidak boleh menutupi zona proteksinya.
// opts.exclusionZones = daftar rect yang juga harus dihindari (mini map, dll).
export function nudgeRectAway(rect, placed, bounds, opts = {}) {
  let cur = { ...rect };
  const maxIter = opts.maxIter ?? CARD.MAX_NUDGE_ITER;
  const zones = (opts.pinZones || []).map((p) => pinSafeRect(p, opts));
  const obstacles = zones.concat(opts.exclusionZones || []);
  for (let i = 0; i < maxIter; i++) {
    const overlap = placed.find((p) => rectsOverlap(cur, p)) || obstacles.find((z) => rectsOverlap(cur, z));
    if (!overlap) break;
    const p = overlap;
    // Jarak penuh agar dua rect tidak berpotongan lagi.
    const clearRight = (p.x + p.w) - cur.x + 1;
    const clearLeft = p.x - (cur.x + cur.w) - 1;
    const clearDown = (p.y + p.h) - cur.y + 1;
    const clearUp = p.y - (cur.y + cur.h) - 1;
    const candidates = [
      { dx: clearRight, dy: 0 },
      { dx: clearLeft, dy: 0 },
      { dx: 0, dy: clearDown },
      { dx: 0, dy: clearUp },
    ];
    let best = null;
    let bestScore = Infinity;
    for (const cand of candidates) {
      const nx = clamp(cur.x + cand.dx, bounds.x, Math.max(bounds.x, bounds.x + bounds.w - cur.w));
      const ny = clamp(cur.y + cand.dy, bounds.y, Math.max(bounds.y, bounds.y + bounds.h - cur.h));
      const movedRect = { ...cur, x: nx, y: ny };
      if (rectsOverlap(movedRect, p)) continue; // harus benar-benar clear dari obstacle ini
      if (obstacles.some((z) => z !== p && rectsOverlap(movedRect, z))) continue; // jangan tutup pin/zone lain
      let ov = 0;
      placed.forEach((q) => { if (q !== p) ov += rectIntersectArea(movedRect, q); });
      const dist = Math.abs(cand.dx) + Math.abs(cand.dy);
      const score = ov * 1000 + dist;
      if (score < bestScore) { bestScore = score; best = movedRect; }
    }
    if (!best) break; // tidak ada slot bebas pada iterasi ini
    cur = best;
  }
  return cur;
}

// Layout kartu floating tanpa overlap. Pins TIDAK digeser — hanya kartu.
// Input:
//   pins       - [{ id, x, y }] posisi pin di layar viewer
//   cardSizes  - { [id]: { w, h } } ukuran kartu yang terukur
//   bounds     - { x, y, w, h } area viewer
// Output: [{ pinId, rect }]
export function layoutFloatingCards(pins, cardSizes, bounds, opts = {}) {
  const allPins = pins || [];
  const result = [];
  const placed = [];
  allPins.forEach((pin) => {
    const size = cardSizes[pin.id];
    const w = size ? size.w : (opts.defaultW || 264);
    const h = size ? size.h : (opts.defaultH || 120);
    let best = null;
    let bestScore = Infinity;
    let bestFallback = null;
    let bestFallbackScore = Infinity;
    for (const placement of CARD_PLACEMENTS) {
      const rect = cardRectForPlacement(placement, pin, w, h, bounds, opts);
      const score = scoreCandidate(rect, pin, allPins, placed, opts);
      if (score < bestScore) {
        bestScore = score;
        best = { rect, placement };
      }
      // Fallback terbaik = kandidat yang PALING SEDIKIT menutupi zona pin /
      // exclusion zone (prioritas: pin & mini map tetap terlihat > kartu tidak overlap).
      const fb = protectedOverlapTotal(rect, allPins, opts);
      if (fb < bestFallbackScore) {
        bestFallbackScore = fb;
        bestFallback = { rect, placement };
      }
    }
    let finalRect = best.rect;
    let placement = best.placement;
    // Kartu TIDAK boleh menutupi zona pin / exclusion zone (prioritas #1).
    // Kalau semua kandidat menutupinya, pakai yang paling sedikit menutupinya.
    if (bestFallback && protectedOverlapTotal(finalRect, allPins, opts) > 0 && bestFallbackScore < protectedOverlapTotal(finalRect, allPins, opts)) {
      finalRect = bestFallback.rect;
      placement = bestFallback.placement;
    }
    // Pisahkan kartu satu sama lain, tapi tanpa menutupi zona pin / exclusion zone.
    if (placed.some((p) => rectsOverlap(finalRect, p)) || protectedOverlapTotal(finalRect, allPins, opts) > 0) {
      finalRect = nudgeRectAway(finalRect, placed, bounds, { ...opts, pinZones: allPins });
    }
    result.push({ pinId: pin.id, rect: finalRect, placement });
    placed.push(finalRect);
  });
  return result;
}

// Path SVG connector (curved) dari kartu ke pin + titik jangkar.
export function connectorPath(cardRect, pinPoint, opts = {}) {
  const inside = rectContainsPoint(cardRect, pinPoint);
  const anchor = inside
    ? closestRectEdgePoint(cardRect, pinPoint)
    : rectBoundaryPointAlongRay(cardRect, pinPoint);
  const gap = opts.gap ?? 6;
  const anchorOut = moveToward(anchor, pinPoint, gap);
  const pinOffset = opts.pinOffset ?? CARD.PIN_CONNECTOR_OFFSET;
  const pinEdge = moveToward(pinPoint, anchor, pinOffset);
  const midX = (anchorOut.x + pinEdge.x) / 2;
  const d = `M ${anchorOut.x} ${anchorOut.y} C ${midX} ${anchorOut.y}, ${midX} ${pinEdge.y}, ${pinEdge.x} ${pinEdge.y}`;
  return { d, anchor: anchorOut, pin: pinEdge, inside };
}

// Titik terdekat di tepi rect terhadap titik p (dipakai saat pin berada
// di dalam kartu, agar connector keluar dari tepi terdekat, bukan sisi jauh).
export function closestRectEdgePoint(rect, p) {
  const segs = [
    { x1: rect.x, y1: rect.y, x2: rect.x + rect.w, y2: rect.y },
    { x1: rect.x + rect.w, y1: rect.y, x2: rect.x + rect.w, y2: rect.y + rect.h },
    { x1: rect.x, y1: rect.y + rect.h, x2: rect.x + rect.w, y2: rect.y + rect.h },
    { x1: rect.x, y1: rect.y, x2: rect.x, y2: rect.y + rect.h },
  ];
  let best = null;
  let bestD = Infinity;
  segs.forEach((s) => {
    const len2 = (s.x2 - s.x1) * (s.x2 - s.x1) + (s.y2 - s.y1) * (s.y2 - s.y1) || 1;
    const t = clamp(((p.x - s.x1) * (s.x2 - s.x1) + (p.y - s.y1) * (s.y2 - s.y1)) / len2, 0, 1);
    const q = { x: s.x1 + (s.x2 - s.x1) * t, y: s.y1 + (s.y2 - s.y1) * t };
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bestD) { bestD = d; best = q; }
  });
  return best || { x: rect.x, y: rect.y };
}

// ============================================================
// ANNOTATION REGISTER (F)
// ============================================================

export function registerStats(annotations) {
  const list = (annotations || []).filter((a) => a && a.id);
  let open = 0, resolved = 0, decisions = 0, notes = 0;
  list.forEach((a) => {
    if (a.status === 'OPEN') open += 1;
    else resolved += 1;
    const ns = a.notes || [];
    notes += ns.length;
    decisions += ns.filter((n) => n.note_type === 'DECISION').length;
  });
  return { total: list.length, open, resolved, decisions, notes };
}

export function applyRegisterFilters(annotations, filters = {}) {
  const { itemId, componentId, status, hasDecision } = filters;
  return (annotations || []).filter((a) => {
    if (itemId && a.po_item_id !== itemId) return false;
    if (componentId && a.item_component_id !== componentId) return false;
    if (status && a.status !== status) return false;
    if (hasDecision && !(a.notes || []).some((n) => n.note_type === 'DECISION')) return false;
    return true;
  });
}

export function buildComponentLookup(items) {
  const byId = {};
  (items || []).forEach((it) => {
    byId[it.id] = it.item_name || '';
    (it.components || []).forEach((c) => { byId[c.id] = c; });
  });
  return byId;
}

// Group by Component (default). Decision dinaikkan ke header komponen.
export function buildRegisterByComponent(annotations, items) {
  const list = (annotations || []).filter((a) => a && a.id);
  const pinByComponent = {};
  list.forEach((a) => {
    if (!pinByComponent[a.item_component_id]) pinByComponent[a.item_component_id] = [];
    pinByComponent[a.item_component_id].push(a);
  });
  return (items || []).map((item) => {
    const itemPins = list.filter((a) => a.po_item_id === item.id);
    if (itemPins.length === 0) return null;
    const components = (item.components || [])
      .map((c) => {
        const pins = (pinByComponent[c.id] || []).slice().sort((a, b) => Number(a.pin_number) - Number(b.pin_number));
        if (pins.length === 0) return null;
        const allNotes = [];
        pins.forEach((p) => (p.notes || []).forEach((n) => allNotes.push({ ...n, _pinNumber: p.pin_number, _pinId: p.id })));
        return {
          component: c,
          label: componentDisplayLabel(c),
          pinCount: pins.length,
          noteCount: allNotes.length,
          decisions: allNotes.filter((n) => n.note_type === 'DECISION'),
          pins: pins.map((p) => ({ ...p, notes: decisionFirstNotes(p.notes || []) })),
        };
      })
      .filter(Boolean);
    if (components.length === 0) return null;
    const notes = [];
    components.forEach((g) => g.pins.forEach((p) => (p.notes || []).forEach((n) => notes.push(n))));
    return { item, itemName: item.item_name || '', components, pinCount: itemPins.length, noteCount: notes.length };
  }).filter(Boolean);
}

// Group by Pin Number.
export function buildRegisterByPin(annotations, items) {
  const lookup = buildComponentLookup(items);
  const list = (annotations || []).slice().sort((a, b) => Number(a.pin_number) - Number(b.pin_number));
  return list.map((a) => {
    const comp = typeof lookup[a.item_component_id] === 'object' ? lookup[a.item_component_id] : null;
    const itemName = a._itemName || (typeof lookup[a.po_item_id] === 'string' ? lookup[a.po_item_id] : '');
    const componentLabel = a._componentLabel || (comp ? componentDisplayLabel(comp) : '');
    return {
      annotation: a,
      pinNumber: Number(a.pin_number),
      itemName,
      componentLabel,
      specLabel: a._specLabel || '',
      status: a.status,
      notes: decisionFirstNotes(a.notes || []),
    };
  });
}

// Opsi filter komponen untuk item tertentu.
export function componentOptionsForItem(items, itemId) {
  const item = (items || []).find((it) => it.id === itemId);
  return item ? (item.components || []) : [];
}

// ============================================================
// COMPONENT PICKER (A)
// ============================================================

// Cari Component Library berdasarkan nama (case-insensitive).
export function searchComponentLibrary(definitions, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return (definitions || []).slice();
  return (definitions || []).filter((d) => String(d.name || '').toLowerCase().includes(q));
}

// Apakah definisi library sudah terpasang di item?
// Cocokkan by component_definition_id ATAU by component_name_snapshot.
export function isLibraryComponentUsedByItem(item, definition) {
  const defName = String(definition && (definition.name || definition.component_name_snapshot) || '').toLowerCase();
  return ((item && item.components) || []).some((c) =>
    (c.component_definition_id && c.component_definition_id === definition.id) ||
    (defName && String(c.component_name_snapshot || '').toLowerCase() === defName)
  );
}

// Definisi library yang BELUM terpasang pada item.
export function libraryComponentsNotUsed(definitions, item) {
  return (definitions || []).filter((d) => !isLibraryComponentUsedByItem(item, d));
}

// ============================================================
// MOBILE (E) — grouping pin per komponen untuk bottom sheet
// ============================================================

export function groupComponentPins(annotations, componentId) {
  return (annotations || [])
    .filter((a) => a.item_component_id === componentId)
    .slice()
    .sort((a, b) => Number(a.pin_number) - Number(b.pin_number));
}

export function pinIdsForComponent(annotations, componentId) {
  return groupComponentPins(annotations, componentId).map((a) => a.id);
}
