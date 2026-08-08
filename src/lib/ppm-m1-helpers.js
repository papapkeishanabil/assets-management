// ============================================================
// PPM M1 Helper Functions - Product Item & Component
// Meeting -> PO -> Product Item -> Component
// ============================================================
import { supabase } from './supabase';

// ============================================================
// MASTER DATA
// ============================================================

// Fetch all active product types
export async function fetchProductTypes() {
  const { data, error } = await supabase
    .from('product_types')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data || [];
}

// Fetch all active component definitions
export async function fetchComponentDefinitions() {
  const { data, error } = await supabase
    .from('component_definitions')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data || [];
}

// ============================================================
// PRODUCT ITEMS (ppm_po_items)
// ============================================================

// Fetch all product items for a PO, with component counts
// If includeComponents is true, embeds the components array too
export async function fetchPOItems(meetingPoId, includeComponents = false) {
  const { data, error } = await supabase
    .from('ppm_po_items')
    .select('*, product_types(name)')
    .eq('meeting_po_id', meetingPoId)
    .order('sort_order');
  if (error) throw error;

  if (data && data.length > 0) {
    const itemIds = data.map(it => it.id);
    const { data: compData, error: compError } = await supabase
      .from('ppm_item_components')
      .select('*, component_definitions(name)')
      .in('po_item_id', itemIds)
      .order('sort_order');
    if (compError) throw compError;

    // Group components by item id
    const compMap = {};
    (compData || []).forEach(c => {
      if (!compMap[c.po_item_id]) compMap[c.po_item_id] = [];
      compMap[c.po_item_id].push(c);
    });

    return data.map(it => ({
      ...it,
      component_count: (compMap[it.id] || []).length,
      components: includeComponents ? (compMap[it.id] || []) : undefined
    }));
  }
  return data || [];
}

// Fetch a single product item
export async function fetchPOItem(itemId) {
  const { data, error } = await supabase
    .from('ppm_po_items')
    .select('*, product_types(name)')
    .eq('id', itemId)
    .single();
  if (error) throw error;
  return data;
}

// Create a product item
export async function createPOItem({ meeting_po_id, product_type_id, item_name, quantity, gender_category, notes, created_by, sort_order }) {
  const { data, error } = await supabase
    .from('ppm_po_items')
    .insert([{
      meeting_po_id,
      product_type_id: product_type_id || null,
      item_name,
      quantity: quantity || null,
      gender_category: gender_category || null,
      notes: notes || null,
      created_by: created_by || null,
      sort_order: sort_order || 0
    }])
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// Update a product item
export async function updatePOItem(itemId, updates) {
  const { data, error } = await supabase
    .from('ppm_po_items')
    .update(updates)
    .eq('id', itemId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// Delete a product item (components cascade via FK ON DELETE CASCADE)
export async function deletePOItem(itemId) {
  const { error } = await supabase
    .from('ppm_po_items')
    .delete()
    .eq('id', itemId);
  if (error) throw error;
}

// Get the max sort_order for items in a PO
export async function getMaxPOItemSortOrder(meetingPoId) {
  const { data, error } = await supabase
    .from('ppm_po_items')
    .select('sort_order')
    .eq('meeting_po_id', meetingPoId)
    .order('sort_order', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data.length > 0 ? (data[0].sort_order || 0) : 0;
}

// ============================================================
// ITEM COMPONENTS (ppm_item_components)
// ============================================================

// Fetch all components for an item, with definition names
export async function fetchItemComponents(poItemId) {
  const { data, error } = await supabase
    .from('ppm_item_components')
    .select('*, component_definitions(name)')
    .eq('po_item_id', poItemId)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

// Create an item component
// For custom components: component_definition_id=null, is_custom=true, component_name_snapshot=custom name
export async function createItemComponent({ po_item_id, component_definition_id, component_name_snapshot, location_label, sort_order, is_custom, notes, created_by }) {
  const { data, error } = await supabase
    .from('ppm_item_components')
    .insert([{
      po_item_id,
      component_definition_id: component_definition_id || null,
      component_name_snapshot,
      location_label: location_label || null,
      sort_order: sort_order || 0,
      is_custom: is_custom || false,
      notes: notes || null,
      created_by: created_by || null
    }])
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// Update an item component
export async function updateItemComponent(componentId, updates) {
  const { data, error } = await supabase
    .from('ppm_item_components')
    .update(updates)
    .eq('id', componentId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// Delete an item component
export async function deleteItemComponent(componentId) {
  const { error } = await supabase
    .from('ppm_item_components')
    .delete()
    .eq('id', componentId);
  if (error) throw error;
}

// Get the max sort_order for components in an item
export async function getMaxComponentSortOrder(poItemId) {
  const { data, error } = await supabase
    .from('ppm_item_components')
    .select('sort_order')
    .eq('po_item_id', poItemId)
    .order('sort_order', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data.length > 0 ? (data[0].sort_order || 0) : 0;
}

// Reorder components (swap sort_order of two components)
export async function swapComponentSort(aId, bId) {
  // Fetch both
  const { data: comps, error: fetchError } = await supabase
    .from('ppm_item_components')
    .select('id, sort_order')
    .in('id', [aId, bId]);
  if (fetchError) throw fetchError;
  if (!comps || comps.length !== 2) throw new Error('Komponen tidak ditemukan');

  const a = comps.find(c => c.id === aId);
  const b = comps.find(c => c.id === bId);

  // Update both
  const { error: errorA } = await supabase
    .from('ppm_item_components')
    .update({ sort_order: b.sort_order })
    .eq('id', a.id);
  if (errorA) throw errorA;

  const { error: errorB } = await supabase
    .from('ppm_item_components')
    .update({ sort_order: a.sort_order })
    .eq('id', b.id);
  if (errorB) throw errorB;
}

// Batch reorder components after drag-and-drop.
// Compares original order vs new order and only sends updates
// for components whose sort_order actually changed.
// This prevents duplicate sort_order and minimizes DB queries.
// @param {Array<{id: string}>} orderedComponentIds - component ids in the new order
export async function reorderItemComponents(poItemId, orderedComponentIds) {
  if (!poItemId || !orderedComponentIds || orderedComponentIds.length === 0) return;

  // Fetch current components to compare orders
  const { data: comps, error: fetchError } = await supabase
    .from('ppm_item_components')
    .select('id, sort_order')
    .eq('po_item_id', poItemId);
  if (fetchError) throw fetchError;

  // Build old order map
  const oldOrderMap = {};
  (comps || []).forEach(c => { oldOrderMap[c.id] = c.sort_order || 0; });

  // Build new order (1-based index as sort_order)
  const updates = [];
  orderedComponentIds.forEach((id, index) => {
    const newOrder = index + 1;
    if (oldOrderMap[id] !== newOrder) {
      updates.push({ id, sort_order: newOrder });
    }
  });

  // If no changes, nothing to do
  if (updates.length === 0) return;

  // Use per-row UPDATE instead of upsert.
  //
  // Why not upsert?
  // `upsert(..., { onConflict: 'id' })` executes
  //   INSERT ... ON CONFLICT (id) DO UPDATE
  // which makes Postgres re-evaluate the INSERT policy's WITH CHECK against
  // the PROPOSED row. Our payload only contains { id, sort_order }, so
  // po_item_id becomes NULL in the proposed row. The INSERT policy requires
  // a valid po_item_id (item.id = po_item_id), so it FAILS under RLS
  // -> "new row violates row-level security policy" -> drag shows error toast.
  //
  // Per-row UPDATE (.update().eq('id')) only triggers the UPDATE policy
  // against the EXISTING row, whose po_item_id is intact — this passes for
  // meeting creator / super_admin (same pattern as editing a product item,
  // which works). This is the safest implementation under this RLS setup.
  const results = await Promise.all(updates.map(u =>
    supabase
      .from('ppm_item_components')
      .update({ sort_order: u.sort_order })
      .eq('id', u.id)
  ));
  const failed = results.find(r => r.error);
  if (failed) throw failed.error;
}

// Reorder items (swap sort_order of two items)
export async function swapPOItemSort(aId, bId) {
  const { data: items, error: fetchError } = await supabase
    .from('ppm_po_items')
    .select('id, sort_order')
    .in('id', [aId, bId]);
  if (fetchError) throw fetchError;
  if (!items || items.length !== 2) throw new Error('Item tidak ditemukan');

  const a = items.find(c => c.id === aId);
  const b = items.find(c => c.id === bId);

  const { error: errorA } = await supabase
    .from('ppm_po_items')
    .update({ sort_order: b.sort_order })
    .eq('id', a.id);
  if (errorA) throw errorA;

  const { error: errorB } = await supabase
    .from('ppm_po_items')
    .update({ sort_order: a.sort_order })
    .eq('id', b.id);
  if (errorB) throw errorB;
}

// ============================================================
// PO READINESS
// ============================================================

// Check how many product items a PO has
export async function getPOItemCount(meetingPoId) {
  const { count, error } = await supabase
    .from('ppm_po_items')
    .select('*', { count: 'exact', head: true })
    .eq('meeting_po_id', meetingPoId);
  if (error) throw error;
  return count || 0;
}

// ============================================================
// DISPLAY HELPERS
// ============================================================

// Build a display name for a component
// e.g. "Saku Dada" + "Dada Kiri" => "Saku Dada - Dada Kiri"
export function buildComponentDisplayName(componentName, locationLabel) {
  if (!componentName) return '';
  if (locationLabel && locationLabel.trim()) {
    return `${componentName} - ${locationLabel.trim()}`;
  }
  return componentName;
}

// ============================================================
// M1.1: DEFAULT COMPONENT SET
// ============================================================

// Fetch default component definitions for a product type
export async function fetchDefaultComponents(productTypeId) {
  if (!productTypeId) return [];
  const { data, error } = await supabase
    .from('product_type_default_components')
    .select('*, component_definitions(name, code)')
    .eq('product_type_id', productTypeId)
    .eq('is_default', true)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

// Bulk insert item components in one statement
export async function createItemComponentsBulk(poItemId, components) {
  const payloads = (components || []).map(c => ({
    po_item_id: poItemId,
    component_definition_id: c.component_definition_id || null,
    component_name_snapshot: c.component_name_snapshot,
    location_label: c.location_label || null,
    sort_order: c.sort_order,
    is_custom: c.is_custom || false,
    notes: c.notes || null,
    created_by: c.created_by || null,
  }));
  if (payloads.length === 0) return [];
  const { data, error } = await supabase
    .from('ppm_item_components')
    .insert(payloads)
    .select('*');
  if (error) throw error;
  return data || [];
}

// Atomic create PO item + selected default components.
// If bulk components insert fails, delete the item to avoid orphan.
export async function createPOItemWithDefaults({
  meeting_po_id,
  product_type_id,
  item_name,
  quantity,
  gender_category,
  notes,
  created_by,
  sort_order,
  selectedDefaults,
}) {
  const item = await createPOItem({
    meeting_po_id,
    product_type_id,
    item_name,
    quantity,
    gender_category,
    notes,
    created_by,
    sort_order,
  });

  if (selectedDefaults && selectedDefaults.length > 0 && product_type_id) {
    const base = (await getMaxComponentSortOrder(item.id)) || 0;
    const comps = selectedDefaults.map((d, i) => ({
      component_definition_id: d.component_definition_id,
      component_name_snapshot: d.name || d.component_name_snapshot,
      location_label: d.default_location_label || null,
      sort_order: base + i + 1,
      is_custom: false,
      created_by: created_by || null,
    }));
    try {
      await createItemComponentsBulk(item.id, comps);
    } catch (e) {
      await supabase.from('ppm_po_items').delete().eq('id', item.id);
      throw e;
    }
  }

  return item;
}

// NULL-safe key for matching a component instance by definition + location.
// Two rows match only when both component_definition_id AND location_label
// are equal (treating NULL = NULL). This is intentionally stricter than
// matching by name snapshot or text label — the same definition used at two
// different locations (e.g. "Saku Dada - Dada Kiri" / "- Dada Kanan")
// must NOT be treated as duplicates.
export function defaultComponentKey(componentDefinitionId, locationLabel) {
  return `${componentDefinitionId ?? 'null'}::${locationLabel ?? 'null'}`;
}

// Read-only preview of what "Terapkan Komponen Dasar" would do.
// Returns:
//   hasProductType    — false if the item has no product_type_id
//   defaults          — full default set for the product type (may be [])
//   existingMatched   — default rows the item ALREADY has (component_definition_id + location_label, NULL-safe)
//   toAdd             — default rows the item is MISSING
// Does NOT write anything. The UI shows existingMatched/toAdd for confirmation,
// then calls applyDefaultComponents() to actually insert.
export async function previewDefaultComponents(itemId, productTypeId) {
  if (!productTypeId) {
    return { hasProductType: false, defaults: [], existingMatched: [], toAdd: [] };
  }

  const defaults = await fetchDefaultComponents(productTypeId);

  const { data: existing, error } = await supabase
    .from('ppm_item_components')
    .select('component_definition_id, location_label')
    .eq('po_item_id', itemId);
  if (error) throw error;

  const have = new Set((existing || []).map((c) =>
    defaultComponentKey(c.component_definition_id, c.location_label)
  ));

  const existingMatched = [];
  const toAdd = [];
  defaults.forEach((d) => {
    if (have.has(defaultComponentKey(d.component_definition_id, d.default_location_label))) {
      existingMatched.push(d);
    } else {
      toAdd.push(d);
    }
  });

  return { hasProductType: true, defaults, existingMatched, toAdd };
}

// Apply default components to an EXISTING item — inserts only the missing ones.
// Recomputes the diff at apply time (does not trust a stale preview), so this is
// safe even if the item's components changed between preview and confirm.
// @param createdBy — optional user_profiles.id to stamp on the new components
export async function applyDefaultComponents(itemId, productTypeId, createdBy) {
  if (!productTypeId) return { addedCount: 0, added: [], message: 'Item tidak mempunyai jenis produk' };

  const { toAdd } = await previewDefaultComponents(itemId, productTypeId);
  if (!toAdd.length) return { addedCount: 0, added: [], message: 'Semua komponen dasar sudah ada' };

  const base = (await getMaxComponentSortOrder(itemId)) || 0;
  const comps = toAdd.map((d, i) => ({
    component_definition_id: d.component_definition_id,
    component_name_snapshot: d.component_definitions?.name || d.component_name_snapshot,
    location_label: d.default_location_label || null,
    sort_order: base + i + 1,
    is_custom: false,
    created_by: createdBy || null,
  }));

  const added = await createItemComponentsBulk(itemId, comps);
  return { addedCount: added.length, added, message: `${added.length} komponen ditambahkan` };
}
