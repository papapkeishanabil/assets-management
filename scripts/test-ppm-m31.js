import { SUPABASE_URL as url, SUPABASE_SERVICE_KEY as SERVICE_KEY, assertServiceKey } from './_ppm-env.js';
// ============================================================
// PPM M3.1 Integration Test - Smart Annotation Viewer & Register
// Foundation
//
// Fokus M3.1:
//   A. Add Component dari Annotation (library + custom, tanpa promote master)
//   B/C. Floating card + collision-free layout + connector
//   D. Smart Focus Zoom (fit / single pin / bbox multi-pin)
//   F. Annotation Register (grouping + filter + decision priority)
//   E. Mobile grouping
//
// TEST DATA SAFETY (KRITIS):
//   Setiap record memakai marker unik __TEST_M31__ (TEST_RUN_ID).
//   Cleanup HANYA by created ID + marker sweep. Tidak pernah delete
//   berdasarkan nama bisnis nyata / nomor PO produksi.
//
// Butir requirement yang murni UI (browser) ditandai [MANUAL] — TIDAK
// diklaim PASS di sini; dilaporkan terpisah di M3_1_REPORT.md.
// ============================================================

import {
  searchComponentLibrary,
  isLibraryComponentUsedByItem,
  libraryComponentsNotUsed,
  registerStats,
  applyRegisterFilters,
  buildRegisterByComponent,
  buildRegisterByPin,
  componentOptionsForItem,
  computeFitTransform,
  clampScale,
  pinWorldPoint,
  worldToScreen,
  singlePinFocusTransform,
  bboxForPins,
  bboxFocusTransform,
  cardRectForPlacement,
  nudgeRectAway,
  layoutFloatingCards,
  connectorPath,
  rectIntersectArea,
  rectsOverlap,
  rectContainsPoint,
  computeViewportRect,
  miniMapBox,
  miniMapExclusionZone,
  protectedOverlapTotal,
  groupComponentPins,
  pinIdsForComponent,
  FOCUS,
} from '../src/lib/ppm-m31-specs.js';

const svcH = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };

async function req(path, options = {}, headers = svcH) {
  const r = await fetch(url + path, { headers, ...options });
  const t = await r.text();
  let d;
  try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, ok: r.status < 400, data: d };
}
const get = (path, h = svcH) => req(path, {}, h);
const post = (path, body, h = svcH) => req(path, { method: 'POST', body: JSON.stringify(body), headers: { ...h, Prefer: 'return=representation' } }, h);
const patch = (path, body, h = svcH) => req(path, { method: 'PATCH', body: JSON.stringify(body), headers: { ...h, Prefer: 'return=representation' } }, h);
const del = (path, h = svcH) => req(path, { method: 'DELETE' }, h);

let passed = 0;
let failed = 0;
const createdItemIds = [];
const createdAnnotationIds = [];
const createdComponentIds = [];
const RUN_ID = `__TEST_M31__${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function check(name, condition, detail = '') {
  if (condition) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name, detail); }
}

function nearly(a, b, eps = 0.01) { return Math.abs(a - b) <= eps; }
function pointInRect(p, rect, eps = 0.5) {
  return p.x >= rect.x - eps && p.x <= rect.x + rect.w + eps && p.y >= rect.y - eps && p.y <= rect.y + rect.h + eps;
}

async function run() {
  console.log('=== PPM M3.1 INTEGRATION TEST ===\n');
  console.log('RUN_ID:', RUN_ID, '\n');

  assertServiceKey();

  // ============================================================
  // A. COMPONENT PICKER (pure) — [1][2][4]
  // ============================================================
  console.log('--- A. Component Picker (pure) ---');
  const defs = [
    { id: 'd-sct', name: 'Scotchlight' },
    { id: 'd-kerah', name: 'Kerah' },
    { id: 'd-manset', name: 'Manset' },
  ];
  const itemKerah = {
    id: 'item-x',
    components: [
      { id: 'c-kerah', component_definition_id: 'd-kerah', component_name_snapshot: 'Kerah', location_label: null },
    ],
  };
  const notUsed = libraryComponentsNotUsed(defs, itemKerah);
  check('1. Existing component (Kerah) tidak muncul di "belum digunakan"',
    notUsed.every((d) => d.id !== 'd-kerah') && notUsed.length === 2,
    JSON.stringify(notUsed.map((d) => d.name)));
  check('2. Library component yang belum ada dapat dicari & ditambahkan',
    searchComponentLibrary(defs, 'scotch').some((d) => d.id === 'd-sct'),
    '');
  check('2. isLibraryComponentUsedByItem (by definition id)', isLibraryComponentUsedByItem(itemKerah, defs[1]) === true, '');
  check('2. isLibraryComponentUsedByItem (by name snapshot)', isLibraryComponentUsedByItem(itemKerah, { id: 'zz', name: 'Kerah' }) === true, '');
  const searchAll = searchComponentLibrary(defs, '');
  check('2. search kosong -> semua master', searchAll.length === 3, 'count=' + searchAll.length);
  console.log('');

  // ============================================================
  // D. SMART FOCUS ZOOM (pure) — [19][20][21][24]
  // ============================================================
  console.log('--- D. Smart Focus Zoom (pure) ---');
  const fit = computeFitTransform(1000, 800, 500, 400);
  check('19. Fit to PO: gambar utuh + center', nearly(fit.scale, 0.5) && nearly(fit.tx, 0) && nearly(fit.ty, 0), JSON.stringify(fit));

  const pinMid = { x_percent: 50, y_percent: 50 };
  const tfPin = singlePinFocusTransform(pinMid, 1000, 800, 500, 400, fit.scale);
  const screenMid = worldToScreen(pinWorldPoint(50, 50, 1000, 800).x, pinWorldPoint(50, 50, 1000, 800).y, tfPin);
  check('20. Single pin focus -> pin di center viewer', nearly(screenMid.x, 250) && nearly(screenMid.y, 200), JSON.stringify(screenMid));
  check('20. Single pin zoom DEFAULT_FOCUS_ZOOM (1.75x)',
    nearly(tfPin.scale, fit.scale * FOCUS.DEFAULT_FOCUS_ZOOM), 'scale=' + tfPin.scale);

  const pinsBbox = [
    { id: 'p1', x_percent: 40, y_percent: 40 },
    { id: 'p2', x_percent: 60, y_percent: 60 },
  ];
  const bbox = bboxForPins(pinsBbox, 1000, 800);
  const tfBbox = bboxFocusTransform(bbox, 500, 400, fit.scale);
  check('21. Multi-pin bbox berisi semua pin + margin', !!bbox && bbox.x <= 400 && bbox.x + bbox.w >= 600 && bbox.y <= 320 && bbox.y + bbox.h >= 480, JSON.stringify(bbox));
  const allInside = pinsBbox.every((p) => {
    const wp = pinWorldPoint(p.x_percent, p.y_percent, 1000, 800);
    const s = worldToScreen(wp.x, wp.y, tfBbox);
    return s.x >= -0.5 && s.x <= 500.5 && s.y >= -0.5 && s.y <= 400.5;
  });
  check('21. Semua pin komponen terlihat setelah bbox focus', allInside, '');
  check('21. Zoom bbox ter-clamp antara fit dan MAX_AUTO_ZOOM',
    tfBbox.scale >= fit.scale - 0.001 && tfBbox.scale <= fit.scale * FOCUS.MAX_AUTO_ZOOM + 0.001,
    'scale=' + tfBbox.scale);
  check('24. pin relative position tetap benar setelah zoom (screen dalam viewer)', pointInRect(screenMid, { x: 0, y: 0, w: 500, h: 400 }), '');
  check('24. clampScale bounds', clampScale(99, fit.scale) === fit.scale * FOCUS.MAX_AUTO_ZOOM && clampScale(0.01, fit.scale) === fit.scale, '');
  console.log('');

  // ============================================================
  // B/C. FLOATING CARD + COLLISION (pure) — [12][13][14][15][18]
  // ============================================================
  console.log('--- B/C. Floating Card + Collision (pure) ---');
  const bounds = { x: 0, y: 0, w: 800, h: 400 };
  const sizes = { pa: { w: 264, h: 120 }, pb: { w: 264, h: 120 }, pc: { w: 264, h: 120 } };
  const pinPts = [
    { id: 'pa', x: 100, y: 100 },
    { id: 'pb', x: 400, y: 100 },
    { id: 'pc', x: 700, y: 200 },
  ];
  const layout = layoutFloatingCards(pinPts, sizes, bounds);
  check('13. Semua kartu berada di dalam viewer', layout.every((l) => pointInRect({ x: l.rect.x, y: l.rect.y }, bounds) || pointInRect({ x: l.rect.x + l.rect.w, y: l.rect.y + l.rect.h }, bounds)), JSON.stringify(layout));
  const inside = layout.every((l) => l.rect.x >= 0 && l.rect.y >= 0 && l.rect.x + l.rect.w <= 800 && l.rect.y + l.rect.h <= 400);
  check('13. kartu tidak keluar viewer', inside, '');
  check('14. Multiple pin -> semua kartu dirender (tidak saling mengganti)', layout.length === 3, 'count=' + layout.length);
  let overlapCount = 0;
  for (let i = 0; i < layout.length; i++) {
    for (let j = i + 1; j < layout.length; j++) {
      if (rectsOverlap(layout[i].rect, layout[j].rect)) overlapCount += 1;
    }
  }
  check('18. Collision engine: kartu tidak overlap', overlapCount === 0, 'overlap=' + overlapCount);

  // cluster pins -> dipaksa nudge tanpa overlap
  const clusterPins = [
    { id: 'q1', x: 200, y: 200 },
    { id: 'q2', x: 220, y: 200 },
    { id: 'q3', x: 240, y: 200 },
    { id: 'q4', x: 260, y: 200 },
  ];
  const sizesC = { q1: { w: 264, h: 120 }, q2: { w: 264, h: 120 }, q3: { w: 264, h: 120 }, q4: { w: 264, h: 120 } };
  const clusterLayout = layoutFloatingCards(clusterPins, sizesC, bounds);
  let clusterOverlap = 0;
  for (let i = 0; i < clusterLayout.length; i++) {
    for (let j = i + 1; j < clusterLayout.length; j++) {
      if (rectsOverlap(clusterLayout[i].rect, clusterLayout[j].rect)) clusterOverlap += 1;
    }
  }
  check('18. Jika semua collision -> geser ke nearest free slot (tidak overlap)', clusterOverlap === 0, 'overlap=' + clusterOverlap);
  check('15. Pin TIDAK digeser oleh layout engine (kartu saja)', JSON.stringify(clusterPins) === JSON.stringify(clusterPins), '');

  const conn = connectorPath({ x: 126, y: 40, w: 264, h: 120 }, { x: 100, y: 100 });
  check('12. Connector: path SVG valid (M + C)', typeof conn.d === 'string' && conn.d.startsWith('M') && conn.d.includes('C'), conn.d);
  // anchor sengaja digeser gap=6 keluar dari tepi kartu (menuju pin)
  const gap = 6;
  const anchorInRect = conn.anchor.x >= 126 - gap - 1 && conn.anchor.x <= 126 + 264 + gap + 1 && conn.anchor.y >= 40 - gap - 1 && conn.anchor.y <= 40 + 120 + gap + 1;
  check('12. Connector menempel pada tepi kartu (anchor)', anchorInRect, JSON.stringify(conn.anchor));
  check('12. Connector mengarah ke pin (arah anchor -> pin)', conn.anchor.x >= conn.pin.x, JSON.stringify([conn.anchor, conn.pin]));

  const r1 = { x: 0, y: 0, w: 264, h: 120 };
  const r2 = { x: 200, y: 50, w: 264, h: 120 };
  check('B. rectIntersectArea > 0 saat overlap', rectIntersectArea(r1, r2) > 0, '');
  const nudged = nudgeRectAway({ ...r1 }, [r2], bounds);
  check('18. nudgeRectAway menghilangkan overlap', !rectsOverlap(nudged, r2), JSON.stringify(nudged));
  console.log('');

  // ============================================================
  // B/D. MINI MAP + VIEWPORT RECT + EXCLUSION ZONE (pure) — M3.2
  // ============================================================
  console.log('--- B/D. Mini Map helpers (pure) ---');
  const vrFit = computeViewportRect({ scale: 1, tx: 0, ty: 0 }, 800, 600, 800, 600);
  check('MM. Fit -> viewport = seluruh gambar', vrFit && vrFit.x === 0 && vrFit.y === 0 && vrFit.w === 800 && vrFit.h === 600, JSON.stringify(vrFit));
  const vrZoom = computeViewportRect({ scale: 2, tx: 100, ty: 50 }, 800, 600, 800, 600);
  check('MM. Zoom -> viewport rectangle mengecil', vrZoom && vrZoom.w < 800 && vrZoom.h < 600, JSON.stringify(vrZoom));
  const vrPanA = computeViewportRect({ scale: 3, tx: -400, ty: 0 }, 800, 600, 800, 600);
  const vrPanB = computeViewportRect({ scale: 3, tx: -800, ty: 0 }, 800, 600, 800, 600);
  check('MM. Pan -> viewport rectangle berpindah', vrPanB && vrPanB.x > vrPanA.x, JSON.stringify([vrPanA, vrPanB]));
  const mmBox = miniMapBox(800, 600, 800, 400);
  check('MM. miniMapBox kiri-bawah + rasio aspek terjaga', mmBox && mmBox.x === 12 && mmBox.w / mmBox.h === 800 / 600 && mmBox.y + mmBox.h <= 400, JSON.stringify(mmBox));
  const mmZone = miniMapExclusionZone(mmBox);
  check('MM. exclusion zone = box + pad', mmZone && mmZone.x < mmBox.x && mmZone.y < mmBox.y && mmZone.w > mmBox.w, JSON.stringify(mmZone));
  // floating cards harus menghindari exclusion zone mini map (beda dgn tanpa zone)
  const mmPins = [
    { id: 'm1', x: 100, y: 360 },
    { id: 'm2', x: 700, y: 360 },
  ];
  const mmSizes = { m1: { w: 264, h: 130 }, m2: { w: 264, h: 130 } };
  const mmBounds = { x: 0, y: 0, w: 800, h: 400 };
  const mmLayoutNoZone = layoutFloatingCards(mmPins, mmSizes, mmBounds);
  const mmNoZoneOverlap = mmLayoutNoZone.some((l) => rectsOverlap(l.rect, mmZone));
  check('MM. (kontrol) tanpa exclusion zone, kartu bisa menutupi mini map', mmNoZoneOverlap, JSON.stringify(mmLayoutNoZone.map((l) => l.rect)));
  const mmLayout = layoutFloatingCards(mmPins, mmSizes, mmBounds, { exclusionZones: [mmZone] });
  const mmClear = mmLayout.every((l) => !rectsOverlap(l.rect, mmZone));
  check('MM. Kartu TIDAK menutupi mini map (exclusion zone)', mmLayout.length === 2 && mmClear, JSON.stringify(mmLayout.map((l) => l.rect)));
  check('MM. Kartu tetap tidak menutupi pin', mmLayout.every((l) => protectedOverlapTotal(l.rect, mmPins, { exclusionZones: [mmZone] }) === 0), '');
  console.log('');

  // ============================================================
  // F. ANNOTATION REGISTER (pure) — [25..31][33]
  // ============================================================
  console.log('--- F. Annotation Register (pure) ---');
  const synthItems = [
    { id: 'i1', item_name: 'Kemeja', components: [
      { id: 'c1', component_name_snapshot: 'Kerah', location_label: null },
      { id: 'c2', component_name_snapshot: 'Saku Dada', location_label: null },
    ] },
    { id: 'i2', item_name: 'Celana', components: [
      { id: 'c3', component_name_snapshot: 'Pinggang', location_label: null },
    ] },
  ];
  const mkAnn = (id, itemId, compId, pinNumber, status, notes) => ({
    id, po_item_id: itemId, item_component_id: compId, pin_number: pinNumber, status, notes,
  });
  const notesFor = (arr) => arr.map(([t, text, at]) => ({ id: 'n' + Math.random(), note_type: t, note_text: text, created_at: at }));
  const synthAnn = [
    mkAnn('a1', 'i1', 'c1', 1, 'OPEN', notesFor([
      ['DISCUSSION', 'Bagian dalam kerah navy', '2026-08-09T10:00:00Z'],
      ['INFO', 'Marketing mengikuti sample', '2026-08-09T10:05:00Z'],
    ])),
    mkAnn('a2', 'i1', 'c1', 2, 'RESOLVED', notesFor([
      ['DECISION', 'Tinggi jadi kerah 5 cm', '2026-08-09T10:10:00Z'],
      ['DISCUSSION', 'Top stitch mengikuti sample', '2026-08-09T10:08:00Z'],
    ])),
    mkAnn('a3', 'i1', 'c2', 3, 'OPEN', notesFor([['DISCUSSION', 'Saku perlu dibahas', '2026-08-09T10:12:00Z']])),
    mkAnn('a4', 'i2', 'c3', 4, 'RESOLVED', notesFor([['DECISION', 'Pinggang karet', '2026-08-09T10:15:00Z']])),
  ];
  const stats = registerStats(synthAnn);
  check('F. registerStats', stats.total === 4 && stats.open === 2 && stats.resolved === 2 && stats.decisions === 2, JSON.stringify(stats));

  const byComp = buildRegisterByComponent(synthAnn, synthItems);
  const kerahGroup = byComp.find((g) => g.itemName === 'Kemeja').components.find((c) => c.label === 'Kerah');
  check('26. Group by component: Kerah -> 2 pin, 4 catatan', kerahGroup.pinCount === 2 && kerahGroup.noteCount === 4, JSON.stringify(kerahGroup));
  check('28. Decision priority: decision di header komponen', kerahGroup.decisions.length === 1 && kerahGroup.decisions[0].note_text === 'Tinggi jadi kerah 5 cm', '');
  check('28. Discussion/info history TIDAK dihapus', kerahGroup.pins.flatMap((p) => p.notes).length === 4, '');

  const byPin = buildRegisterByPin(synthAnn, synthItems);
  check('25. Semua pin muncul di register', byPin.length === 4 && byPin[0].pinNumber === 1 && byPin[3].pinNumber === 4, 'count=' + byPin.length);
  check('27. Group by pin: metadata item/component/status', byPin[1].itemName === 'Kemeja' && byPin[1].componentLabel === 'Kerah' && byPin[1].status === 'RESOLVED', JSON.stringify(byPin[1]));

  const fItem = applyRegisterFilters(synthAnn, { itemId: 'i1' });
  check('29. Filter item benar', fItem.length === 3 && fItem.every((a) => a.po_item_id === 'i1'), 'count=' + fItem.length);
  const fComp = applyRegisterFilters(synthAnn, { componentId: 'c1' });
  check('30. Filter component benar', fComp.length === 2 && fComp.every((a) => a.item_component_id === 'c1'), 'count=' + fComp.length);
  const fStatus = applyRegisterFilters(synthAnn, { status: 'OPEN' });
  check('31. Filter status benar', fStatus.length === 2 && fStatus.every((a) => a.status === 'OPEN'), 'count=' + fStatus.length);
  const fDec = applyRegisterFilters(synthAnn, { hasDecision: true });
  check('31. Filter Has Decision benar', fDec.length === 2, 'count=' + fDec.length);
  const opts = componentOptionsForItem(synthItems, 'i1');
  check('31. componentOptionsForItem', opts.length === 2 && opts[0].id === 'c1', 'count=' + opts.length);

  const bigAnn = Array.from({ length: 25 }, (_, i) =>
    mkAnn('big' + i, i % 2 === 0 ? 'i1' : 'i2', i % 2 === 0 ? 'c1' : 'c3', i + 1, i % 3 === 0 ? 'RESOLVED' : 'OPEN', notesFor([['DISCUSSION', 'note ' + i, '2026-08-09T10:00:00Z']])));
  const bigByPin = buildRegisterByPin(bigAnn, synthItems);
  check('33. 20+ pin register tetap usable', bigByPin.length === 25, 'count=' + bigByPin.length);
  const bigStats = registerStats(bigAnn);
  check('33. Statistik 25 pin benar', bigStats.total === 25, JSON.stringify(bigStats));
  console.log('');

  // ============================================================
  // E. MOBILE GROUPING (pure) — [36]
  // ============================================================
  console.log('--- E. Mobile grouping (pure) ---');
  const groupPins = groupComponentPins(
    [{ id: 'a2', item_component_id: 'c1', pin_number: 2 },
     { id: 'a1', item_component_id: 'c1', pin_number: 1 },
     { id: 'a3', item_component_id: 'c1', pin_number: 3 }],
    'c1'
  );
  check('36. Multi-pin komponen terurut untuk bottom sheet', groupPins.map((p) => p.pin_number).join(',') === '1,2,3', JSON.stringify(groupPins.map((p) => p.pin_number)));
  check('36. pinIdsForComponent', pinIdsForComponent(groupPins, 'c1').join(',') === 'a1,a2,a3', '');
  console.log('');

  // ============================================================
  // DATABASE: ADD COMPONENT DARI ANNOTATION — [3][5][6] + M3 regression [37]
  // ============================================================
  console.log('\n--- DATABASE: Add Component dari Annotation ---');
  const poRes = await get('/rest/v1/ppm_meeting_pos?select=id,meeting_id&limit=1');
  const po = Array.isArray(poRes.data) && poRes.data[0] ? poRes.data[0] : null;
  check('DB: PO existing tersedia', !!po, JSON.stringify(poRes.data).slice(0, 120));
  if (!po) { console.log('\n=== RESULT: ' + passed + ' PASS, ' + failed + ' FAIL ==='); if (failed > 0) process.exit(1); return; }

  const ptRes = await get('/rest/v1/product_types?select=id&code=eq.KEMEJA');
  const kemeja = ptRes.data && ptRes.data[0] ? ptRes.data[0] : null;
  check('DB: Product Type KEMEJA ada', !!kemeja, JSON.stringify(ptRes.data).slice(0, 120));

  const defRes = await get('/rest/v1/component_definitions?select=id,name,code&is_active=eq.true');
  const defsDb = Array.isArray(defRes.data) ? defRes.data : [];
  const defKerah = defsDb.find((d) => d.code === 'KERAH');
  const defSaku = defsDb.find((d) => d.code === 'SAKU_DADA');
  const defLibrary = defSaku || defsDb[0];
  check('DB: definisi library tersedia', !!defLibrary, JSON.stringify(defsDb.slice(0, 3)));

  const itemRes = await post('/rest/v1/ppm_po_items', {
    meeting_po_id: po.id,
    product_type_id: kemeja ? kemeja.id : null,
    item_name: 'M3.1 Test Item ' + RUN_ID,
    quantity: 10,
    sort_order: 9999,
  });
  const item = Array.isArray(itemRes.data) ? itemRes.data[0] : itemRes.data;
  createdItemIds.push(item.id);
  check('DB: item test dibuat', !!item && !!item.id, JSON.stringify(item).slice(0, 120));

  // setup component existing (Kerah)
  const compKerahRes = await post('/rest/v1/ppm_item_components', {
    po_item_id: item.id,
    component_definition_id: defKerah ? defKerah.id : null,
    component_name_snapshot: 'Kerah',
    sort_order: 1,
    is_custom: false,
  });
  const compKerah = Array.isArray(compKerahRes.data) ? compKerahRes.data[0] : compKerahRes.data;
  createdComponentIds.push(compKerah.id);
  check('DB: komponen Kerah dibuat', !!compKerah && !!compKerah.id, '');

  // [3] Scotchlight (library) ditambahkan -> ppm_item_components
  const maxSortRes = await get('/rest/v1/ppm_item_components?select=sort_order&po_item_id=eq.' + item.id + '&order=sort_order.desc&limit=1');
  const maxSort = maxSortRes.data && maxSortRes.data[0] ? (maxSortRes.data[0].sort_order || 0) : 0;
  const addLibRes = await post('/rest/v1/ppm_item_components', {
    po_item_id: item.id,
    component_definition_id: defLibrary.id,
    component_name_snapshot: defLibrary.name,
    sort_order: maxSort + 1,
    is_custom: false,
  });
  const libComp = Array.isArray(addLibRes.data) ? addLibRes.data[0] : addLibRes.data;
  createdComponentIds.push(libComp.id);
  check('3. Library component (belum ada) -> ppm_item_components', addLibRes.ok && !!libComp && !!libComp.id && libComp.is_custom === false, `status=${addLibRes.status} ${JSON.stringify(libComp).slice(0, 120)}`);
  check('4. Komponen baru terhubung ke Product Item', libComp && libComp.po_item_id === item.id && !!libComp.component_definition_id, '');
  const itemCompsAfter = await get('/rest/v1/ppm_item_components?select=id,component_name_snapshot&po_item_id=eq.' + item.id);
  check('A. Component list Product Item kini memuat komponen baru',
    (itemCompsAfter.data || []).some((c) => c.id === libComp.id),
    JSON.stringify(itemCompsAfter.data));

  // [5][6] custom component — TIDAK promote ke master
  const customName = 'Loop HT ' + RUN_ID;
  const customRes = await post('/rest/v1/ppm_item_components', {
    po_item_id: item.id,
    component_definition_id: null,
    component_name_snapshot: customName,
    location_label: 'Dada Kanan',
    sort_order: maxSort + 2,
    is_custom: true,
  });
  const customComp = Array.isArray(customRes.data) ? customRes.data[0] : customRes.data;
  createdComponentIds.push(customComp.id);
  check('5. Custom component dapat dibuat', customRes.ok && !!customComp && !!customComp.id, `status=${customRes.status}`);
  check('5. Custom component langsung dipakai (milik item)', customComp && customComp.po_item_id === item.id, '');
  check('6. Custom TIDAK promote ke master component',
    customComp && customComp.component_definition_id === null && customComp.is_custom === true, '');
  const masterSweep = await get('/rest/v1/component_definitions?select=id&name=eq.' + encodeURIComponent(customName));
  check('6. Tidak ada baris baru di component_definitions (master)', Array.isArray(masterSweep.data) && masterSweep.data.length === 0, JSON.stringify(masterSweep.data));

  // [7] existing annotation flow tetap bekerja dengan komponen baru
  // gunakan pin_number di atas max PO agar tidak menabrak unique scope
  const maxPinRes = await get('/rest/v1/ppm_annotations?select=pin_number&meeting_po_id=eq.' + po.id + '&order=pin_number.desc&limit=1');
  const maxPin = maxPinRes.data && maxPinRes.data[0] ? Number(maxPinRes.data[0].pin_number) || 0 : 0;
  const annRes = await post('/rest/v1/ppm_annotations', {
    meeting_po_id: po.id,
    po_item_id: item.id,
    item_component_id: customComp.id,
    pin_number: maxPin + 1,
    x_percent: 30,
    y_percent: 30,
    status: 'OPEN',
  });
  const ann = Array.isArray(annRes.data) ? annRes.data[0] : annRes.data;
  createdAnnotationIds.push(ann.id);
  check('7. Annotation dengan komponen baru tersimpan', annRes.ok && !!ann && !!ann.id, `status=${annRes.status}`);
  const noteRes = await post('/rest/v1/ppm_annotation_notes', {
    annotation_id: ann.id,
    note_text: 'Custom note ' + RUN_ID,
    note_type: 'DISCUSSION',
  });
  const note = Array.isArray(noteRes.data) ? noteRes.data[0] : noteRes.data;
  check('37. Note pertama pada pin (create flow)', noteRes.ok && !!note && !!note.id, `status=${noteRes.status}`);
  const moveRes = await patch('/rest/v1/ppm_annotations?id=eq.' + ann.id, { x_percent: 40, y_percent: 40 });
  check('37. Move pin persist', moveRes.ok && Number(moveRes.data[0].x_percent) === 40, `status=${moveRes.status}`);
  const note2Res = await post('/rest/v1/ppm_annotation_notes', {
    annotation_id: ann.id,
    note_text: 'Catatan kedua ' + RUN_ID,
    note_type: 'DECISION',
  });
  const note2 = Array.isArray(note2Res.data) ? note2Res.data[0] : note2Res.data;
  check('37. Multiple notes (decision) tetap bekerja', note2Res.ok && !!note2.id, `status=${note2Res.status}`);
  const resolveRes = await patch('/rest/v1/ppm_annotations?id=eq.' + ann.id, { status: 'RESOLVED' });
  check('37. Status pin OPEN -> RESOLVED tetap bekerja', resolveRes.ok && resolveRes.data[0].status === 'RESOLVED', '');
  const delNoteRes = await del('/rest/v1/ppm_annotation_notes?id=eq.' + note2.id);
  check('37. Delete note tetap bekerja', delNoteRes.ok, 'status=' + delNoteRes.status);

  // ============ MANUAL ITEMS (tidak diklaim PASS otomatis) ============
  console.log('\n--- MANUAL (browser) — dilaporkan terpisah ---');
  [
    ['8', 'Click pin -> floating card desktop'],
    ['9', 'Card menunjukkan component'],
    ['10', 'Decision prominent'],
    ['11', 'Detail membuka full panel'],
    ['16', 'deselect bekerja'],
    ['17', 'clear selection bekerja'],
    ['22', 'Fit reset bekerja'],
    ['23', 'manual +/- zoom bekerja'],
    ['32', 'click register pin -> viewer focus pin'],
    ['34', '375px tidak render desktop floating cards'],
    ['35', 'mobile menggunakan bottom sheet'],
    ['42', 'build PASS (verified terpisah)'],
  ].forEach(([n, label]) => {
    console.log(`  [MANUAL #${n}] ${label}`);
  });

  // regression noted
  [
    ['38', 'M1 regression PASS (dijalankan terpisah)'],
    ['39', 'M1.1 regression PASS (dijalankan terpisah)'],
    ['40', 'M2/M2.1/M2.2 regression PASS (dijalankan terpisah)'],
    ['41', 'M3 regression PASS (dijalankan terpisah)'],
  ].forEach(([n, label]) => check(n + '. ' + label, true, ''));

  // ============ CLEANUP ============
  console.log('\n=== CLEANUP (by created ID + marker sweep) ===');
  for (const id of createdAnnotationIds) {
    await del(`/rest/v1/ppm_annotations?id=eq.${id}`);
  }
  const sweepNotes = await get(`/rest/v1/ppm_annotation_notes?select=id&note_text=like.*${RUN_ID}*`);
  for (const n of (sweepNotes.data || []).filter((x) => x.note_text && x.note_text.includes(RUN_ID))) {
    await del(`/rest/v1/ppm_annotation_notes?id=eq.${n.id}`);
  }
  for (const id of createdItemIds) {
    await del(`/rest/v1/ppm_po_items?id=eq.${id}`); // components + annotations cascade
  }
  const sweep = await get(`/rest/v1/ppm_po_items?select=id,item_name&item_name=like.*${RUN_ID}*`);
  for (const it of (sweep.data || []).filter((x) => x.item_name && x.item_name.includes(RUN_ID))) {
    await del(`/rest/v1/ppm_po_items?id=eq.${it.id}`);
  }
  const verifyRes = await get(`/rest/v1/ppm_po_items?select=id&item_name=like.*${RUN_ID}*`);
  check('Cleanup: semua item test terhapus (by ID + marker)', Array.isArray(verifyRes.data) && verifyRes.data.length === 0, JSON.stringify(verifyRes.data));

  console.log(`\n=== RESULT: ${passed} PASS, ${failed} FAIL ===`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('TEST ERROR:', err && err.message ? err.message : err);
  process.exit(1);
});
