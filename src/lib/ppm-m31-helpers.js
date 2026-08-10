// ============================================================
// PPM M3.1 Helper Functions - Smart Annotation Viewer & Register
// Foundation
//
// M3.1 = UX/frontend. TIDAK ada migration baru (schema M1 + M3).
// Component ditambah dari Annotation memakai mekanisme M1 existing:
//   - dari Component Library : createItemComponent + ensureStandardSpecs
//   - custom                 : createItemComponent (is_custom=true) —
//                              TIDAK promote ke master component.
// ============================================================
import { createItemComponent, getMaxComponentSortOrder } from './ppm-m1-helpers.js';
import { ensureStandardSpecsForComponents } from './ppm-m2-helpers.js';
import {
  FOCUS,
  CARD,
  CARD_PLACEMENTS,
  MINI_MAP,
  clamp,
  rectContainsPoint,
  rectIntersectArea,
  rectsOverlap,
  moveToward,
  rectBoundaryPointAlongRay,
  computeFitTransform,
  computeFitScale,
  clampScale,
  pinWorldPoint,
  worldToScreen,
  singlePinFocusTransform,
  bboxForPins,
  bboxFocusTransform,
  computeViewportRect,
  logicalZoomRatio,
  deriveViewportCenter,
  resolveTransformPreservingCenter,
  resolveTransformOnResize,
  miniMapBox,
  miniMapExclusionZone,
  pinSafeRect,
  pinZoneOverlap,
  totalPinZoneOverlap,
  protectedOverlapTotal,
  cardRectForPlacement,
  nudgeRectAway,
  layoutFloatingCards,
  connectorPath,
  registerStats,
  applyRegisterFilters,
  buildComponentLookup,
  buildRegisterByComponent,
  buildRegisterByPin,
  componentOptionsForItem,
  searchComponentLibrary,
  isLibraryComponentUsedByItem,
  libraryComponentsNotUsed,
  groupComponentPins,
  pinIdsForComponent,
} from './ppm-m31-specs.js';

// Re-export: single source of truth lives in ppm-m31-specs.
export {
  FOCUS,
  CARD,
  CARD_PLACEMENTS,
  MINI_MAP,
  clamp,
  rectContainsPoint,
  rectIntersectArea,
  rectsOverlap,
  moveToward,
  rectBoundaryPointAlongRay,
  computeFitTransform,
  computeFitScale,
  clampScale,
  pinWorldPoint,
  worldToScreen,
  singlePinFocusTransform,
  bboxForPins,
  bboxFocusTransform,
  computeViewportRect,
  logicalZoomRatio,
  deriveViewportCenter,
  resolveTransformPreservingCenter,
  resolveTransformOnResize,
  miniMapBox,
  miniMapExclusionZone,
  pinSafeRect,
  pinZoneOverlap,
  totalPinZoneOverlap,
  protectedOverlapTotal,
  cardRectForPlacement,
  nudgeRectAway,
  layoutFloatingCards,
  connectorPath,
  registerStats,
  applyRegisterFilters,
  buildComponentLookup,
  buildRegisterByComponent,
  buildRegisterByPin,
  componentOptionsForItem,
  searchComponentLibrary,
  isLibraryComponentUsedByItem,
  libraryComponentsNotUsed,
  groupComponentPins,
  pinIdsForComponent,
};

// ============================================================
// DB: ADD COMPONENT FROM ANNOTATION (A)
// ============================================================

// Tambahkan komponen dari Component Library ke item produk.
// Memakai mekanisme M1 (createItemComponent) + clone standard specs M2,
// SAMA seperti "Kelola Komponen" -> "Dari Master".
// Return: component yang dibuat (dari DB).
export async function addComponentFromLibrary({ itemId, definition, locationLabel, createdBy }) {
  if (!itemId || !definition || !definition.id) {
    throw new Error('itemId dan definition wajib diisi');
  }
  const maxSort = (await getMaxComponentSortOrder(itemId)) || 0;
  const created = await createItemComponent({
    po_item_id: itemId,
    component_definition_id: definition.id,
    component_name_snapshot: definition.name,
    location_label: locationLabel || null,
    sort_order: maxSort + 1,
    is_custom: false,
    notes: null,
    created_by: createdBy || null,
  });
  // Spec-clone failure TIDAK boleh ditelan diam-diam: jika gagal, komponen
  // terbuat tanpa specs dan pemanggil menganggap sukses. Lempar agar caller
  // (drawer) bisa menampilkan toast error + jalankan cleanup-nya sendiri.
  try {
    await ensureStandardSpecsForComponents([created], createdBy || null);
  } catch (specErr) {
    console.error('Error cloning standard specs for new component:', specErr);
    throw specErr;
  }
  return created;
}

// Buat komponen CUSTOM untuk annotation. TIDAK promote ke master
// (component_definition_id = null, is_custom = true) — pola M1 existing.
// Return: component yang dibuat (dari DB).
export async function createCustomComponentForAnnotation({ itemId, name, locationLabel, createdBy }) {
  const trimmed = String(name || '').trim();
  if (!itemId || !trimmed) {
    throw new Error('itemId dan nama komponen wajib diisi');
  }
  const maxSort = (await getMaxComponentSortOrder(itemId)) || 0;
  return createItemComponent({
    po_item_id: itemId,
    component_definition_id: null,
    component_name_snapshot: trimmed,
    location_label: locationLabel || null,
    sort_order: maxSort + 1,
    is_custom: true,
    notes: null,
    created_by: createdBy || null,
  });
}
