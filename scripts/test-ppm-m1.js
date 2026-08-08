// ============================================================
// PPM M1 Integration Test
// Verifies: Meeting -> PO -> Product Item -> Component
// Uses service role key (bypasses RLS, which is fine for schema testing)
// Test data is cleaned up afterward.
// ============================================================

const url = 'https://uwlxkwyauxwewoexfgwi.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3bHhrd3lhdXh3ZXdvZXhmZ3dpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDYwODk4MiwiZXhwIjoyMTAwMTg0OTgyfQ.1Axuw7mObIbzeFiG7ZeKQCmzm-AVtyxaPbbAxfbeo3k';
const h = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };

async function req(path, options = {}) {
  const r = await fetch(url + path, { headers: h, ...options });
  const t = await r.text();
  let d;
  try { d = JSON.parse(t); } catch { d = t; }
  if (r.status >= 400) throw new Error(`${r.status}: ${JSON.stringify(d)}`);
  return d;
}

const get = (path) => req(path);
const post = (path, body) => req(path, {
  method: 'POST',
  body: JSON.stringify(body),
  headers: { ...h, Prefer: 'return=representation' }
});
const del = (path) => req(path, { method: 'DELETE' });

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log('  PASS:', name);
  } else {
    failed++;
    console.log('  FAIL:', name, detail);
  }
}

async function run() {
  console.log('=== PPM M1 INTEGRATION TEST ===\n');

  // 1. Get existing PO
  const pos = await get('/rest/v1/ppm_meeting_pos?select=id,po_number&limit=1');
  check('PO existing tersedia', Array.isArray(pos) && pos.length > 0, JSON.stringify(pos));
  if (!pos.length) { console.log('ABORT: no PO found'); process.exit(1); }
  const poId = pos[0].id;
  console.log('PO:', pos[0].po_number, '\n');

  // 2. Get product types
  const pts = await get('/rest/v1/product_types?select=id,code&code=in.("KEMEJA","CELANA")&order=code');
  const kemeja = pts.find(p => p.code === 'KEMEJA');
  const celana = pts.find(p => p.code === 'CELANA');
  check('Product Type KEMEJA ada', !!kemeja);
  check('Product Type CELANA ada', !!celana);
  console.log('');

  // 3. Get component definitions we need
  const compDefs = await get('/rest/v1/component_definitions?select=id,code');
  const def = (code) => compDefs.find(c => c.code === code);
  const requiredDefs = ['KERAH','BAH_YOKE','ARMHOLE','SAKU_DADA','MANSET','BORDIR','VELCRO','PINGGANG','GOLPI','SAKU_SAMPING','SAKU_BELAKANG','RETSLETING'];
  requiredDefs.forEach(code => check(`Component definition ${code} ada`, !!def(code)));
  console.log('');

  // Test items use a __TEST_M1__ marker prefix so the cleanup script
  // can identify them safely and NEVER touch real user data.
  const TEST_ITEM1_NAME = 'Kemeja ERT __TEST_M1__';
  const TEST_ITEM2_NAME = 'Celana ERT __TEST_M1__';

  // 4. Create Product Item: Kemeja ERT (test)
  const item1Res = await post('/rest/v1/ppm_po_items', {
    meeting_po_id: poId,
    product_type_id: kemeja.id,
    item_name: TEST_ITEM1_NAME,
    quantity: 134,
    gender_category: 'PRIA',
    sort_order: 1,
    notes: 'Test M1 Kemeja'
  });
  const item1 = Array.isArray(item1Res) ? item1Res[0] : item1Res;
  check('Item Kemeja ERT (test) berhasil dibuat', !!item1.id, JSON.stringify(item1));
  const item1Id = item1.id;
  console.log('');

  // 5. Create Product Item: Celana ERT (test)
  const item2Res = await post('/rest/v1/ppm_po_items', {
    meeting_po_id: poId,
    product_type_id: celana.id,
    item_name: TEST_ITEM2_NAME,
    quantity: 134,
    sort_order: 2
  });
  const item2 = Array.isArray(item2Res) ? item2Res[0] : item2Res;
  check('Item Celana ERT (test) berhasil dibuat', !!item2.id, JSON.stringify(item2));
  const item2Id = item2.id;
  console.log('');

  // 6. Add Kemeja components (8 total)
  const kemejaComps = [
    ['KERAH', 'Kerah', ''],
    ['BAH_YOKE', 'Bah / Yoke', ''],
    ['ARMHOLE', 'Armhole', ''],
    ['SAKU_DADA', 'Saku Dada', 'Dada Kiri'],
    ['SAKU_DADA', 'Saku Dada', 'Dada Kanan'],  // DUPLICATE allowed
    ['MANSET', 'Manset', ''],
    ['BORDIR', 'Bordir', 'Dada'],
    ['VELCRO', 'Velcro', 'Lengan']
  ];

  for (let i = 0; i < kemejaComps.length; i++) {
    const [code, name, loc] = kemejaComps[i];
    const rRes = await post('/rest/v1/ppm_item_components', {
      po_item_id: item1Id,
      component_definition_id: def(code)?.id || null,
      component_name_snapshot: name,
      location_label: loc || null,
      sort_order: i + 1,
      is_custom: false
    });
    const r = Array.isArray(rRes) ? rRes[0] : rRes;
    check(`Kemeja component ${i + 1}: ${name}${loc ? ' - ' + loc : ''}`, !!r.id, JSON.stringify(r));
  }
  console.log('');

  // 7. Add Celana components (6 total)
  const celanaComps = [
    ['PINGGANG', 'Pinggang', ''],
    ['GOLPI', 'Golpi', ''],
    ['SAKU_SAMPING', 'Saku Samping', 'Kiri'],
    ['SAKU_SAMPING', 'Saku Samping', 'Kanan'],
    ['SAKU_BELAKANG', 'Saku Belakang', ''],
    ['RETSLETING', 'Resleting', '']
  ];
  for (let i = 0; i < celanaComps.length; i++) {
    const [code, name, loc] = celanaComps[i];
    const rRes = await post('/rest/v1/ppm_item_components', {
      po_item_id: item2Id,
      component_definition_id: def(code)?.id || null,
      component_name_snapshot: name,
      location_label: loc || null,
      sort_order: i + 1,
      is_custom: false
    });
    const r = Array.isArray(rRes) ? rRes[0] : rRes;
    check(`Celana component ${i + 1}: ${name}${loc ? ' - ' + loc : ''}`, !!r.id, JSON.stringify(r));
  }
  console.log('');

  // 8. Custom Component
  const customRes = await post('/rest/v1/ppm_item_components', {
    po_item_id: item1Id,
    component_definition_id: null,
    component_name_snapshot: 'Ventilasi Mesh Punggung',
    location_label: 'Punggung',
    sort_order: 9,
    is_custom: true,
    notes: 'Custom test component'
  });
  const custom = Array.isArray(customRes) ? customRes[0] : customRes;
  check('Custom component berhasil dibuat (is_custom=true, def_id=null)', !!custom.id && custom.is_custom === true && custom.component_definition_id === null, JSON.stringify(custom));
  console.log('');

  // 9. Verify read-back: Kemeja items + components
  // Filter to only the TEST items (ignore any coexisting real user data)
  const readItems = await get(`/rest/v1/ppm_po_items?select=id,item_name,quantity,product_type_id&meeting_po_id=eq.${poId}&order=sort_order`);
  const testItems = (readItems || []).filter(it => it.item_name && String(it.item_name).includes('__TEST_M1__'));
  check('Read-back: 2 product items (test)', Array.isArray(testItems) && testItems.length === 2, JSON.stringify(readItems));

  const kemejaItems = await get(`/rest/v1/ppm_po_items?select=id,item_name&meeting_po_id=eq.${poId}&item_name=eq.${encodeURIComponent(TEST_ITEM1_NAME)}`);
  const kemejaId = kemejaItems[0].id;
  const readComps1 = await get(`/rest/v1/ppm_item_components?select=component_name_snapshot,location_label,is_custom,sort_order&po_item_id=eq.${kemejaId}&order=sort_order`);
  check('Read-back: Kemeja punya 9 komponen (8 + 1 custom)', Array.isArray(readComps1) && readComps1.length === 9, JSON.stringify(readComps1.map(c => c.component_name_snapshot)));

  // Verify duplicate Saku Dada
  const sakuDadaCount = readComps1.filter(c => c.component_name_snapshot === 'Saku Dada').length;
  check('Duplicate Saku Dada diperbolehkan (2 entries)', sakuDadaCount === 2, `count=${sakuDadaCount}`);

  // Verify sort order intact
  const sortOrders = readComps1.map(c => c.sort_order);
  check('Sort order components berurutan', sortOrders.join(',') === '1,2,3,4,5,6,7,8,9', sortOrders.join(','));

  const readComps2 = await get(`/rest/v1/ppm_item_components?select=component_name_snapshot,location_label&po_item_id=eq.${item2Id}&order=sort_order`);
  check('Read-back: Celana punya 6 komponen', Array.isArray(readComps2) && readComps2.length === 6, JSON.stringify(readComps2.map(c => c.component_name_snapshot)));
  console.log('');

  // 10. Verify drag-and-drop reorder persistence (batch update simulation)
  // Simulates: drag Kerah (pos 1) to position 4
  const refetched = await get(`/rest/v1/ppm_item_components?select=id,sort_order&po_item_id=eq.${kemejaId}&order=sort_order`);
  const originalOrder = refetched.map(c => c.id);
  const originalSorts = refetched.map(c => c.sort_order);

  // New order: move first item (Kerah) to position 4
  // [Kerah, Bah/Yoke, Armhole, SakuDadaKiri, SakuDadaKanan, Manset, Bordir, Velcro, Custom]
  // -> [Bah/Yoke, Armhole, SakuDadaKiri, Kerah, SakuDadaKanan, Manset, Bordir, Velcro, Custom]
  const newOrder = [...originalOrder];
  const moved = newOrder.splice(0, 1)[0];
  newOrder.splice(3, 0, moved);

  // Batch update: assign new sort_order 1..N
  const batchUpdates = newOrder.map((id, idx) => ({ id, sort_order: idx + 1 }));
  for (const u of batchUpdates) {
    await req(`/rest/v1/ppm_item_components?id=eq.${u.id}`, { method: 'PATCH', body: JSON.stringify({ sort_order: u.sort_order }) });
  }

  // Verify after "drag": Kerah is now at position 4
  const afterDrag = await get(`/rest/v1/ppm_item_components?select=id,sort_order&po_item_id=eq.${kemejaId}&order=sort_order`);
  check('Drag Kerah pos 1 -> pos 4 berhasil', afterDrag[3].id === moved, JSON.stringify(afterDrag.map(c => c.sort_order)));
  check('Sort order unik setelah drag (no duplicates)', new Set(afterDrag.map(c => c.sort_order)).size === afterDrag.length, JSON.stringify(afterDrag.map(c => c.sort_order)));

  // Simulate reload: fetch again and verify order persists
  const afterReload = await get(`/rest/v1/ppm_item_components?select=id,sort_order&po_item_id=eq.${kemejaId}&order=sort_order`);
  check('Reload: Kerah tetap posisi 4', afterReload[3].id === moved, JSON.stringify(afterReload.map(c => c.sort_order)));

  // Drag last item (Custom) to first position
  const lastId = afterReload[afterReload.length - 1].id;
  const order2 = afterReload.map(c => c.id);
  const lastMoved = order2.splice(order2.length - 1, 1)[0];
  order2.unshift(lastMoved);
  for (let i = 0; i < order2.length; i++) {
    await req(`/rest/v1/ppm_item_components?id=eq.${order2[i]}`, { method: 'PATCH', body: JSON.stringify({ sort_order: i + 1 }) });
  }
  const afterDragLast = await get(`/rest/v1/ppm_item_components?select=id,sort_order&po_item_id=eq.${kemejaId}&order=sort_order`);
  check('Drag item terakhir ke posisi pertama berhasil', afterDragLast[0].id === lastMoved, JSON.stringify(afterDragLast.map(c => c.sort_order)));
  const afterReload2 = await get(`/rest/v1/ppm_item_components?select=id,sort_order&po_item_id=eq.${kemejaId}&order=sort_order`);
  check('Reload: item terakhir tetap posisi pertama', afterReload2[0].id === lastMoved, JSON.stringify(afterReload2.map(c => c.sort_order)));

  // Restore original order
  for (let i = 0; i < originalOrder.length; i++) {
    await req(`/rest/v1/ppm_item_components?id=eq.${originalOrder[i]}`, { method: 'PATCH', body: JSON.stringify({ sort_order: originalSorts[i] }) });
  }
  const restored = await get(`/rest/v1/ppm_item_components?select=id,sort_order&po_item_id=eq.${kemejaId}&order=sort_order`);
  check('Restore sort_order berhasil', restored.map(c => c.id).join(',') === originalOrder.join(','), JSON.stringify(restored.map(c => c.sort_order)));

  // 11. Update Product Item (edit)
  const updated = await req(`/rest/v1/ppm_po_items?id=eq.${item1Id}`, {
    method: 'PATCH',
    headers: { ...h, Prefer: 'return=representation' },
    body: JSON.stringify({ quantity: 140, notes: 'Updated test' })
  });
  const readUpdated = await get(`/rest/v1/ppm_po_items?select=quantity,notes&id=eq.${item1Id}`);
  check('Edit Product Item berhasil (quantity 134 -> 140)', readUpdated[0].quantity === 140 && readUpdated[0].notes === 'Updated test', JSON.stringify(readUpdated));
  console.log('');

  // Update sort_order PATCH needs Prefer header too
  // 12. Verify component snapshots persisted (stability)
  const snapshotCheck = await get(`/rest/v1/ppm_item_components?select=component_name_snapshot&po_item_id=eq.${kemejaId}&component_name_snapshot=eq.Saku Dada`);
  check('Snapshot name stabil setelah reload', Array.isArray(snapshotCheck) && snapshotCheck.length === 2, JSON.stringify(snapshotCheck));

  // ============ CLEANUP ============
  console.log('\n=== CLEANUP ===');
  // Delete items (components cascade)
  await del(`/rest/v1/ppm_po_items?id=eq.${item1Id}`);
  await del(`/rest/v1/ppm_po_items?id=eq.${item2Id}`);
  const afterDelete = await get(`/rest/v1/ppm_po_items?select=id&meeting_po_id=eq.${poId}&item_name=like.*__TEST_M1__*`);
  check('Cleanup: test items dihapus', Array.isArray(afterDelete) && afterDelete.length === 0, JSON.stringify(afterDelete));
  // Verify components also deleted (cascade)
  const compsAfter = await get(`/rest/v1/ppm_item_components?select=id&po_item_id=eq.${item1Id}`);
  check('Cleanup: komponen cascade terhapus', Array.isArray(compsAfter) && compsAfter.length === 0, JSON.stringify(compsAfter));
  const compsAfter2 = await get(`/rest/v1/ppm_item_components?select=id&po_item_id=eq.${item2Id}`);
  check('Cleanup: komponen Celana cascade terhapus', Array.isArray(compsAfter2) && compsAfter2.length === 0, JSON.stringify(compsAfter2));

  console.log(`\n=== RESULT: ${passed} PASS, ${failed} FAIL ===`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('TEST ERROR:', err.message);
  process.exit(1);
});