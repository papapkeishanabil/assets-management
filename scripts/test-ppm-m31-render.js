// ============================================================
// PPM M3.1 — SSR RENDER SMOKE TEST (regression root cause)
//
// Menangkap bug runtime render yang LULUS dari `vite build`:
//   - identifier dipakai tapi tidak di-import (ReferenceError)
//   - undefined/null access saat render
//   - invalid ref / transform / koordinat saat render
//
// Cara kerja:
//   1. Tulis entry JSX sementara (berisi renderToString tiap komponen
//      M3.1 dengan data sample).
//   2. Bundle via esbuild (devDependency vite) — `import.meta.env`
//      di-shim agar modul supabase aman di-load di Node.
//   3. Import bundle & jalankan. Komponen yang THROW saat render =
//      FAIL. (Build tidak menangkap ini karena bundler tidak resolv
//      identifier yang tidak di-import.)
//
// Tidak butuh SUPABASE_SERVICE_KEY / koneksi DB.
// ============================================================
import { build } from 'esbuild';
import { writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const entry = path.join(__dirname, '.m31-render-entry.jsx');
const outfile = path.join(__dirname, '.m31-render-out.cjs');

const ENV_SHIM = JSON.stringify({
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_PUBLISHABLE_KEY: '',
  VITE_VAPID_PUBLIC_KEY: '',
});

const ENTRY_SOURCE = String.raw`import * as React from 'react';
import { renderToString } from 'react-dom/server';
import FloatingPinCard from '../src/components/ppm/FloatingPinCard.jsx';
import AnnotationCanvas from '../src/components/ppm/AnnotationCanvas.jsx';
import AnnotationRegisterModal from '../src/components/ppm/AnnotationRegisterModal.jsx';
import MobilePinSummarySheet from '../src/components/ppm/MobilePinSummarySheet.jsx';
import ComponentPicker from '../src/components/ppm/ComponentPicker.jsx';
import MiniMap from '../src/components/ppm/MiniMap.jsx';
import AnnotationSidebar from '../src/components/ppm/AnnotationSidebar.jsx';

const noop = () => {};
const notes1 = [
  { id: 'n1', note_type: 'DECISION', note_text: 'Tinggi jadi kerah 5 cm' },
  { id: 'n2', note_type: 'DISCUSSION', note_text: 'Bagian dalam kerah navy' },
];
const notes2 = [{ id: 'n3', note_type: 'INFO', note_text: 'Mengikuti sample lama' }];
const items = [
  {
    id: 'item1',
    item_name: 'Kemeja ERT',
    components: [
      { id: 'c1', component_name_snapshot: 'Kerah', component_definition_id: null, is_custom: false },
      { id: 'c2', component_name_snapshot: 'Saku', component_definition_id: null, is_custom: false },
    ],
  },
];
const annotations = [
  { id: 'p1', pin_number: 1, x_percent: 30, y_percent: 40, status: 'OPEN', po_item_id: 'item1', item_component_id: 'c1', component_specification_id: null, _componentLabel: 'Kerah', _itemName: 'Kemeja ERT', notes: notes1 },
  { id: 'p2', pin_number: 2, x_percent: 60, y_percent: 70, status: 'RESOLVED', po_item_id: 'item1', item_component_id: 'c1', component_specification_id: null, _componentLabel: 'Kerah', _itemName: 'Kemeja ERT', notes: notes2 },
];
const po = { po_number: 'PO-TEST-001', project_name: 'Proyek Test', customer_name: 'PT Test' };
const meeting = { title: 'Meeting Test' };

export const results = [];
function run(name, node) {
  try {
    const html = renderToString(node);
    results.push({ name, ok: true, len: html.length });
  } catch (err) {
    results.push({ name, ok: false, error: String((err && err.stack) || err) });
  }
}

run('FloatingPinCard (decision)', React.createElement(FloatingPinCard, { annotation: annotations[0], onOpenDetail: noop, onClose: noop }));
run('FloatingPinCard (no decision)', React.createElement(FloatingPinCard, { annotation: annotations[1], onOpenDetail: noop, onClose: noop }));
run('AnnotationCanvas desktop (multi-select cards + connector)', React.createElement(AnnotationCanvas, {
  documentUrl: 'about:blank', documentName: 'PO', annotations, showPins: true, addMode: false,
  canManage: true, selectedPinIds: ['p1', 'p2'], focusRequest: null, onFocusConsumed: noop,
  isMobile: false, onAddClick: noop, onPinClick: noop, onMovePin: noop, onOpenPinDetail: noop, onClosePinCard: noop,
  onToggleFullscreen: noop, onSelectAll: noop, onToggleAddMode: noop, expanded: false,
}));
run('AnnotationCanvas mobile (no floating cards)', React.createElement(AnnotationCanvas, {
  documentUrl: 'about:blank', documentName: 'PO', annotations, showPins: true, addMode: false,
  canManage: true, selectedPinIds: ['p1'], focusRequest: null, onFocusConsumed: noop,
  isMobile: true, onAddClick: noop, onPinClick: noop, onMovePin: noop, onOpenPinDetail: noop, onClosePinCard: noop,
}));
run('AnnotationCanvas fullscreen (expanded workspace)', React.createElement(AnnotationCanvas, {
  documentUrl: 'about:blank', documentName: 'PO', annotations, showPins: true, addMode: false,
  canManage: true, selectedPinIds: ['p1'], focusRequest: null, onFocusConsumed: noop,
  isMobile: false, onAddClick: noop, onPinClick: noop, onMovePin: noop, onOpenPinDetail: noop, onClosePinCard: noop,
  expanded: true, onToggleFullscreen: noop, onSelectAll: noop, onToggleAddMode: noop,
}));
run('AnnotationRegisterModal', React.createElement(AnnotationRegisterModal, { open: true, onClose: noop, annotations, items, po, meeting, onFocusPin: noop }));
run('MobilePinSummarySheet', React.createElement(MobilePinSummarySheet, { open: true, annotation: annotations[0], annotations, onClose: noop, onFocusPin: noop, onOpenDetail: noop }));
run('ComponentPicker', React.createElement(ComponentPicker, { components: items[0].components, itemId: 'item1', value: 'c1', onChange: noop, canManage: true, profile: null }));
run('MiniMap', React.createElement(MiniMap, { documentUrl: 'about:blank', documentName: 'PO', worldSize: { w: 800, h: 600 }, viewerSize: { w: 800, h: 400 }, transform: { scale: 1, tx: 0, ty: 0 }, onNavigate: noop }));
run('MiniMap zoomed (viewport rect)', React.createElement(MiniMap, { documentUrl: 'about:blank', documentName: 'PO', worldSize: { w: 800, h: 600 }, viewerSize: { w: 800, h: 400 }, transform: { scale: 2.5, tx: -200, ty: -100 }, onNavigate: noop }));
run('AnnotationSidebar (pins tab)', React.createElement(AnnotationSidebar, { annotations, items, selectedPinIds: ['p1'], onFocusPin: noop, onFocusComponent: noop, className: '' }));
run('AnnotationSidebar (recap tab)', React.createElement(AnnotationSidebar, { annotations, items, selectedPinIds: [], onFocusPin: noop, onFocusComponent: noop, initialTab: 'recap', className: '' }));
`;

let pass = 0;
let fail = 0;
let written = false;
try {
  writeFileSync(entry, ENTRY_SOURCE);
  written = true;
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    jsx: 'automatic',
    define: { 'import.meta.env': ENV_SHIM },
    absWorkingDir: root,
    logLevel: 'silent',
    sourcemap: false,
  });

  const require = createRequire(import.meta.url);
  delete require.cache[outfile];
  const mod = require(outfile);
  const results = mod.results || [];

  console.log('\n--- M3.1 SSR RENDER SMOKE (catch runtime ReferenceError / render crash) ---');
  for (const r of results) {
    if (r.ok) {
      pass += 1;
      console.log('  PASS: ' + r.name + ' (html ' + r.len + ' chars)');
    } else {
      fail += 1;
      console.log('  FAIL: ' + r.name);
      console.log('        ' + (r.error || '').split('\n').slice(0, 6).join('\n        '));
    }
  }
  if (results.length === 0) {
    fail += 1;
    console.log('  FAIL: tidak ada hasil render (entry tidak jalan?)');
  }
} catch (err) {
  fail += 1;
  console.log('  FAIL: bundle/run error');
  console.log('        ' + String((err && err.stack) || err).split('\n').slice(0, 8).join('\n        '));
} finally {
  if (written) rmSync(entry, { force: true });
  rmSync(outfile, { force: true });
}

console.log('\n=== RESULT: ' + pass + ' PASS, ' + fail + ' FAIL ===');
process.exit(fail > 0 ? 1 : 0);
