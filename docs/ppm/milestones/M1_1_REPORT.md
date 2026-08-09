# M1.1 — Default Component Set + Drag Sorting (LOCKED)

## Status
**LOCKED** — 40 PASS / 0 FAIL.

## Ringkasan
- `product_type_default_components`: template urutan (sort_order) per Product
  Type (Kemeja = 8, Celana = 7).
- Clone default → item; komponen tetap **editable** (bisa uncheck, custom, reorder).
- Drag reorder **item-level** (`ppm_item_components.sort_order`) tidak
  mengubah `sort_order` master.
- **RLS:** anonymous (publishable key) tidak boleh INSERT ke master;
  service role tetap bisa baca.
- **Safety:** migration hanya INSERT ke master — tidak menulis ke
  `ppm_item_components` (existing item tidak terdampak).

## Test (verified)
- File: `scripts/test-ppm-m1.1.js`
- Marker: `__TEST_M1_1__<random>` — cleanup by created ID + marker sweep.
- Butuh `SUPABASE_SERVICE_KEY` (abort jelas bila tidak ada).
- **Result: 40 PASS / 0 FAIL** (last run).

## Files
- `supabase/migrations/202608080004_product_type_default_components.sql`
- `scripts/test-ppm-m1.1.js`
- `scripts/apply-m1.1.js` (helper clone default → item)
- `src/lib/ppm-m2-helpers.js` (logic `createPOItemWithDefaults`-style tetap dipakai UI)

> Detailed per-test listing tidak tersedia di repository; jalankan script untuk daftar 40 assertion.
