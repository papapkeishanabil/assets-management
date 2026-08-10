// ============================================================
// PPM M3.1 BUGFIX — PURE TEST: Fullscreen / Fit-to-PO geometry
//
// Fit scale & transform dihitung terhadap dimensi container, jadi:
//  - fit scale NORMAL viewport  -> computeFitScale(world, normal dims)
//  - fit scale FULLSCREEN       -> computeFitScale(world, fullscreen dims)
//  - resize recompute           -> hitung ulang terhadap dimensi baru
//  - exit recompute             -> kembali ke dimensi normal
//  - pin normalized coordinate  -> stabil terhadap perubahan container
//  - focus center normalized    -> world center dipertahankan saat resize
//
// Murni (no DB / no browser / no Fullscreen API) — aman di CI.
// ============================================================
import {
  computeFitScale,
  computeFitTransform,
  pinWorldPoint,
  worldToScreen,
  singlePinFocusTransform,
  logicalZoomRatio,
  deriveViewportCenter,
  resolveTransformPreservingCenter,
  resolveTransformOnResize,
} from '../src/lib/ppm-m31-specs.js';

const WORLD = { w: 1000, h: 1400 };            // gambar PO portrait
const NORMAL = { w: 800, h: 600 };             // viewer normal
const FULLSCREEN = { w: 1600, h: 900 };        // viewer fullscreen (16:9)

const EPS = 1e-9;
let pass = 0;
let fail = 0;
const failures = [];

function approx(a, b, msg, eps = EPS) {
  if (Math.abs(a - b) > eps) {
    throw new Error(msg + ' | expected ' + b + ', got ' + a);
  }
}

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('  PASS: ' + name);
  } catch (e) {
    fail++;
    failures.push(name + ' -> ' + e.message);
    console.log('  FAIL: ' + name + ' -> ' + e.message);
  }
}

// ============================================================
// 1. FIT SCALE NORMAL vs FULLSCREEN (contain, aspect ratio benar)
// ============================================================
test('fit scale normal viewport', () => {
  const s = computeFitScale(WORLD.w, WORLD.h, NORMAL.w, NORMAL.h);
  approx(s, Math.min(800 / 1000, 600 / 1400), 'scale normal');
});

test('fit scale fullscreen viewport (dihitung ulang, bukan reuse pixel)', () => {
  const s = computeFitScale(WORLD.w, WORLD.h, FULLSCREEN.w, FULLSCREEN.h);
  approx(s, Math.min(1600 / 1000, 900 / 1400), 'scale fullscreen');
  approx(s, 900 / 1400, 'scale fullscreen harus dari dimensi container baru');
});

test('fit transform normal: seluruh PO terlihat (contain, tidak crop)', () => {
  const f = computeFitTransform(WORLD.w, WORLD.h, NORMAL.w, NORMAL.h);
  approx(f.scale, 600 / 1400, 'fit scale');
  if (WORLD.w * f.scale > NORMAL.w + EPS || WORLD.h * f.scale > NORMAL.h + EPS) {
    throw new Error('PO keluar viewport normal');
  }
  approx(f.tx, (800 - 1000 * f.scale) / 2, 'centered x');
  approx(f.ty, (600 - 1400 * f.scale) / 2, 'centered y');
});

test('fit transform fullscreen: seluruh PO terlihat (contain)', () => {
  const f = computeFitTransform(WORLD.w, WORLD.h, FULLSCREEN.w, FULLSCREEN.h);
  if (WORLD.w * f.scale > FULLSCREEN.w + EPS || WORLD.h * f.scale > FULLSCREEN.h + EPS) {
    throw new Error('PO keluar viewport fullscreen');
  }
});

test('aspect ratio preserved (normal & fullscreen)', () => {
  const ratio = WORLD.w / WORLD.h;
  [NORMAL, FULLSCREEN].forEach((v) => {
    const f = computeFitTransform(WORLD.w, WORLD.h, v.w, v.h);
    const rendered = (WORLD.w * f.scale) / (WORLD.h * f.scale);
    approx(rendered, ratio, 'aspect ratio @' + v.w + 'x' + v.h);
  });
});

// ============================================================
// 2. RESIZE RECOMPUTE & EXIT RECOMPUTE
// ============================================================
test('fullscreen resize recompute (fit dihitung ulang utk dimensi baru)', () => {
  const normal = computeFitTransform(WORLD.w, WORLD.h, NORMAL.w, NORMAL.h);
  const fs = computeFitTransform(WORLD.w, WORLD.h, FULLSCREEN.w, FULLSCREEN.h);
  if (fs.scale === normal.scale) {
    throw new Error('fit scale harus dihitung ulang (berubah) saat container lebih besar');
  }
  if (fs.scale <= normal.scale) {
    throw new Error('fullscreen scale harus lebih besar dari normal scale');
  }
});

test('fullscreen exit recompute (kembali PERSIS ke normal Fit-to-PO)', () => {
  const normal1 = computeFitTransform(WORLD.w, WORLD.h, NORMAL.w, NORMAL.h);
  const fs = computeFitTransform(WORLD.w, WORLD.h, FULLSCREEN.w, FULLSCREEN.h);
  const normal2 = computeFitTransform(WORLD.w, WORLD.h, NORMAL.w, NORMAL.h);
  approx(normal2.scale, normal1.scale, 'scale restored');
  approx(normal2.tx, normal1.tx, 'tx restored');
  approx(normal2.ty, normal1.ty, 'ty restored');
  if (fs.scale === normal2.scale) throw new Error('fullscreen scale harus berbeda');
});

// ============================================================
// 3. PIN NORMALIZED COORDINATE STABLE
// ============================================================
test('pin normalized coordinate stable (normal & fullscreen)', () => {
  const pin = { xPct: 25, yPct: 50 };
  const wp = pinWorldPoint(pin.xPct, pin.yPct, WORLD.w, WORLD.h);
  approx(wp.x, 250, 'world x');
  approx(wp.y, 700, 'world y');
  // worldToScreen -> kembali ke koordinat world (inversi transform)
  [NORMAL, FULLSCREEN].forEach((v) => {
    const f = computeFitTransform(WORLD.w, WORLD.h, v.w, v.h);
    const sc = worldToScreen(wp.x, wp.y, f);
    const backX = (sc.x - f.tx) / f.scale;
    const backY = (sc.y - f.ty) / f.scale;
    approx(backX, wp.x, 'inverse x @' + v.w + 'x' + v.h, 1e-6);
    approx(backY, wp.y, 'inverse y @' + v.w + 'x' + v.h, 1e-6);
  });
});

// ============================================================
// 4. FOCUS CENTER NORMALIZED STABILITY (manual/focus mode resize)
// ============================================================
test('focus center normalized stability (world center dipertahankan saat resize)', () => {
  // Transform focus di viewer normal dengan world focus point C (mis. 250,700).
  const cx = 250;
  const cy = 700;
  const normalScale = 1.2;
  const tNormal = {
    scale: normalScale,
    tx: NORMAL.w / 2 - cx * normalScale,
    ty: NORMAL.h / 2 - cy * normalScale,
  };
  // Resize ke fullscreen mempertahankan normalized focus center yang sama.
  const ns = FULLSCREEN.w / WORLD.w; // contoh zoom baru (bisa di-clamp)
  const tFs = {
    scale: ns,
    tx: FULLSCREEN.w / 2 - cx * ns,
    ty: FULLSCREEN.h / 2 - cy * ns,
  };
  // Invariant "tidak lompat": focus world point tetap di tengah viewport,
  // baik di viewport normal maupun fullscreen (resolve ulang ke pixel baru).
  const scN = worldToScreen(cx, cy, tNormal);
  approx(scN.x, NORMAL.w / 2, 'focus tetap di tengah viewport normal (x)');
  approx(scN.y, NORMAL.h / 2, 'focus tetap di tengah viewport normal (y)');
  const scFs = worldToScreen(cx, cy, tFs);
  approx(scFs.x, FULLSCREEN.w / 2, 'focus tetap di tengah viewport fullscreen (x)');
  approx(scFs.y, FULLSCREEN.h / 2, 'focus tetap di tengah viewport fullscreen (y)');
});

// ============================================================
// 5. RESIZE-PRESERVE LOGICAL VIEWPORT (§17 pure tests)
// Fullscreen/exit/window-resize: pertahankan image-space center + logical
// zoom ratio (TIDAK reset ke Fit) kecuali mode memang Fit.
// ============================================================

// §17.1 — derive logical image center from transform
test('deriveViewportCenter: titik world di pusat viewport', () => {
  // transform yang center-kan world point (250,700) di viewer 800x600 @ scale 1.2
  const t = { scale: 1.2, tx: 800 / 2 - 250 * 1.2, ty: 600 / 2 - 700 * 1.2 };
  const c = deriveViewportCenter(t, 800, 600);
  approx(c.x, 250, 'center x');
  approx(c.y, 700, 'center y');
});

// §17.2 — resolve transform from logical center after resize
test('resolveTransformPreservingCenter: center tetap di pusat setelah resize', () => {
  const newFit = computeFitTransform(WORLD.w, WORLD.h, FULLSCREEN.w, FULLSCREEN.h);
  const t = resolveTransformPreservingCenter(250, 700, 1.75, newFit, FULLSCREEN.w, FULLSCREEN.h);
  const c = deriveViewportCenter(t, FULLSCREEN.w, FULLSCREEN.h);
  approx(c.x, 250, 'center x preserved');
  approx(c.y, 700, 'center y preserved');
});

// §17.3 — preserve zoom ratio normal -> fullscreen
test('preserve zoom ratio: normal -> fullscreen (1.75x + center dipertahankan)', () => {
  const normalFit = computeFitTransform(WORLD.w, WORLD.h, NORMAL.w, NORMAL.h);
  const fsFit = computeFitTransform(WORLD.w, WORLD.h, FULLSCREEN.w, FULLSCREEN.h);
  // kondisi normal: fokus 1.75x di world (250,700)
  const tNormal = resolveTransformPreservingCenter(250, 700, 1.75, normalFit, NORMAL.w, NORMAL.h);
  // resize ke fullscreen via resolveTransformOnResize (fitMode=false = manual/focus)
  const tFs = resolveTransformOnResize(tNormal, normalFit.scale, NORMAL.w, NORMAL.h, false, fsFit, FULLSCREEN.w, FULLSCREEN.h);
  approx(logicalZoomRatio(tFs.scale, fsFit.scale), 1.75, 'logical zoom ratio fullscreen', 1e-9);
  const cFs = deriveViewportCenter(tFs, FULLSCREEN.w, FULLSCREEN.h);
  approx(cFs.x, 250, 'center x fullscreen preserved');
  approx(cFs.y, 700, 'center y fullscreen preserved');
});

// §17.4 — preserve zoom ratio fullscreen -> normal (round-trip, exit/ESC)
test('preserve zoom ratio: fullscreen -> normal (round-trip exit/ESC)', () => {
  const normalFit = computeFitTransform(WORLD.w, WORLD.h, NORMAL.w, NORMAL.h);
  const fsFit = computeFitTransform(WORLD.w, WORLD.h, FULLSCREEN.w, FULLSCREEN.h);
  const tFs = resolveTransformPreservingCenter(250, 700, 1.75, fsFit, FULLSCREEN.w, FULLSCREEN.h);
  const tNormal = resolveTransformOnResize(tFs, fsFit.scale, FULLSCREEN.w, FULLSCREEN.h, false, normalFit, NORMAL.w, NORMAL.h);
  approx(logicalZoomRatio(tNormal.scale, normalFit.scale), 1.75, 'logical zoom ratio restored', 1e-9);
  const cN = deriveViewportCenter(tNormal, NORMAL.w, NORMAL.h);
  approx(cN.x, 250, 'center x normal restored');
  approx(cN.y, 700, 'center y normal restored');
});

// §17.5 — Fit mode still recompute Fit (tidak preserve manual)
test('Fit mode: recompute Fit untuk container baru (bukan preserve)', () => {
  const normalFit = computeFitTransform(WORLD.w, WORLD.h, NORMAL.w, NORMAL.h);
  const fsFit = computeFitTransform(WORLD.w, WORLD.h, FULLSCREEN.w, FULLSCREEN.h);
  const tManual = resolveTransformPreservingCenter(250, 700, 1.75, normalFit, NORMAL.w, NORMAL.h);
  const tFs = resolveTransformOnResize(tManual, normalFit.scale, NORMAL.w, NORMAL.h, true, fsFit, FULLSCREEN.w, FULLSCREEN.h);
  approx(tFs.scale, fsFit.scale, 'fit scale');
  approx(tFs.tx, fsFit.tx, 'fit tx');
  approx(tFs.ty, fsFit.ty, 'fit ty');
});

// §17.6 — manual mode does NOT become Fit (zoom dipertahankan > fit)
test('manual/focus mode TIDAK menjadi Fit (scale > fit, ratio dipertahankan)', () => {
  const fsFit = computeFitTransform(WORLD.w, WORLD.h, FULLSCREEN.w, FULLSCREEN.h);
  // kondisi normal manual: ratio 1.75 vs fitScale 0.5
  const tManual = { scale: 1.75 * 0.5, tx: 100, ty: 100 };
  const tFs = resolveTransformOnResize(tManual, 0.5, NORMAL.w, NORMAL.h, false, fsFit, FULLSCREEN.w, FULLSCREEN.h);
  if (tFs.scale <= fsFit.scale) throw new Error('manual mode tidak boleh jatuh ke Fit (scale harus > fit)');
  approx(tFs.scale / fsFit.scale, 1.75, 'logical zoom ratio preserved (zoomed in)', 1e-9);
});

// §17.7 — normalized pin focus stable (pin tetap di pusat viewport)
test('singlePinFocus: pin di pusat viewport (normalized stable)', () => {
  const fit = computeFitScale(WORLD.w, WORLD.h, NORMAL.w, NORMAL.h);
  const pin = { x_percent: 25, y_percent: 50 };
  const tf = singlePinFocusTransform(pin, WORLD.w, WORLD.h, NORMAL.w, NORMAL.h, fit);
  const wp = pinWorldPoint(25, 50, WORLD.w, WORLD.h);
  const sc = worldToScreen(wp.x, wp.y, tf);
  approx(sc.x, NORMAL.w / 2, 'pin di center x');
  approx(sc.y, NORMAL.h / 2, 'pin di center y');
  // center derivation harus persis mengembalikan titik pin
  const c = deriveViewportCenter(tf, NORMAL.w, NORMAL.h);
  approx(c.x, wp.x, 'derive center x == pin world x');
  approx(c.y, wp.y, 'derive center y == pin world y');
});

// §17.8 — finite guards (zero/undefined/missing tidak menghasilkan NaN)
test('finite guards: input 0/undefined tidak menghasilkan NaN', () => {
  const c = deriveViewportCenter({ scale: 0, tx: undefined, ty: 0 }, 800, 600);
  if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) throw new Error('deriveViewportCenter tidak finite');
  if (!Number.isFinite(logicalZoomRatio(1.5, undefined))) throw new Error('logicalZoomRatio(fitScale undefined) tidak finite');
  if (!Number.isFinite(logicalZoomRatio(0, 0))) throw new Error('logicalZoomRatio(0,0) tidak finite');
  const t = resolveTransformPreservingCenter(250, 700, 1.5, { scale: 0 }, 1600, 900);
  if (!Number.isFinite(t.scale) || !Number.isFinite(t.tx) || !Number.isFinite(t.ty)) {
    throw new Error('resolveTransformPreservingCenter(fitScale 0) tidak finite');
  }
});

// ============================================================
// RESULT
// ============================================================
console.log('');
console.log('=== RESULT: ' + pass + ' PASS, ' + fail + ' FAIL ===');
if (fail > 0) {
  console.log('Failures:');
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
process.exit(0);
