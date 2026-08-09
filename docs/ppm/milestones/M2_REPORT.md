# M2 — Technical Specification Foundation (LOCKED)

## Status
**LOCKED** — bagian dari regression M2/M2.1 (68 PASS / 0 FAIL).

## Ringkasan
- `specification_definitions` = master spesifikasi (per komponen-def, `value_type`,
  `unit`, `is_required_default`).
- `ppm_component_specifications` = nilai spesifikasi tiap komponen, dengan:
  - `spec_key` / `spec_label` (snapshot),
  - `value` / `value_type` / `unit`,
  - `source_type` (`PO | MANUAL | MEETING`),
  - `review_status` (`NOT_REVIEWED | CONFIRMED | DISCUSSION_REQUIRED |
    PENDING | RESOLVED`),
  - `original_value` / `current value` preservation (#ADR-006).
- UI: `SpecificationManagerModal`, `TechnicalReviewModal`, `PPMPoDetailPage`.
- `src/lib/ppm-m2-specs.js` (pure) + `src/lib/ppm-m2-helpers.js` (re-export + logic).

## Test (verified)
- File: `scripts/test-ppm-m2.js`
- Marker: `__TEST_M2__` — cleanup by ID + marker.
- **Result: 68 PASS** (56 M2 core DB checks + 12 M2.1 pure).

## Files
- `supabase/migrations/202608080005_ppm_m2_component_specifications.sql`
- `src/lib/ppm-m2-specs.js`
- `src/lib/ppm-m2-helpers.js`
- `src/components/ppm/SpecificationManagerModal.jsx`
- `src/components/ppm/TechnicalReviewModal.jsx`
- `src/components/ppm/ComponentManagerModal.jsx`
- `src/components/ppm/ProductItemModal.jsx`
- `src/pages/PPMPoDetailPage.jsx`
- `scripts/test-ppm-m2.js`

> Detailed per-test assertion listing tidak tersedia di repository; jalankan
> `node scripts/test-ppm-m2.js` untuk daftar penuh (dipindai tiap build).
