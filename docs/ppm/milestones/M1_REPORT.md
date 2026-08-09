# M1 — Product Item + Component (LOCKED)

## Status
**LOCKED** — tidak dirivisalkan. 48 PASS / 0 FAIL.

## Ringkasan
Foundasi PPM: `Meeting → PO → Product Item → Component`.
- `ppm_meeting_pos` = header PO.
- `product_types` (KEMEJA, CELANA) dan `component_definitions` (KERAH, SAKU_DADA, …, RETSETING).
- `ppm_po_items` = item per PO.
- `ppm_item_components` = komponen tiap item, dengan `component_name_snapshot` (stabil terhadap master).

## Test (verified)
- File: `scripts/test-ppm-m1.js`
- Marker test: `__TEST_M1__` (item_name), cleanup by ID + marker.
- Verifikasi: create item, clone komponen dasar, drag sorting (restore), edit item, snapshot stabil, cascade delete.
- **Result: 48 PASS / 0 FAIL** (last run).

## Migration
- `supabase/migrations/202608080003_ppm_m1_product_items.sql` (additive).

## Files (related)
- `scripts/test-ppm-m1.js`
- `scripts/test-ppm-m1.1.js` (regresi M1 juga dipakai di sini)
- `src/pages/PPMPoDetailPage.jsx` (konsumen utama model M1)

## Regresi
- `npm run test:ppm:m1` → 48 PASS.

> Detailed historical per-test listing tidak tersedia di repository; gunakan
> `node scripts/test-ppm-m1.js` untuk melihat daftar 48 assertion.
