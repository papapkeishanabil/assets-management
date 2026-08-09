# M2.2 — Technical Review UX Simplification & Empty Spec Fix (LOCKED)

## Status
**LOCKED** — 31 PASS (20 pure + 10 DB integration) + regression M1/M1.1/M2 hijau.

## Ringkasan (devangka)
- **Empty optional spec** tidak lagi menampilkan "Belum Direview"; tampil
  "Tidak Dicantumkan" di detail, tidak muncul di summary, tidak masuk stepper,
  tidak masuk denominator progress, tidak blocking.
- **`hasSpecValue` canonical** membedakan angka `0` dari kosong (bug lama
  false-negative pada `0`).
- **Source** (`Sumber: Manual`) tidak ditampilkan bila specification kosong.
- **Technical Review** satu spec per layar, auto-advance, navigasi prev/next;
  stepper hanya masuk `filter(isSpecificationReviewable)`.
- **Component aggregate status**: `✓ 2/2 Dikonfirmasi` / `2/3 Direview` /
  `⚠ 1 Perlu Dibahas` / `⏳ 1 Menunggu Konfirmasi` / `Belum ada spesifikasi
  untuk direview` (bukan error).
- **[Semua Sesuai]** level Component: hanya konfirmasi reviewable specs
  (>1 reviewable, semua NOT_REVIEWED, tak ada discussion/pending).
  Tidak pernah confirm empty optional. Bulk PO-level tidak diimplementasikan.
- **Discussion flow**: `Perlu Dibahas` → `DISCUSSION_REQUIRED` →
  `Set Keputusan` (nilai baru + notes) → `RESOLVED` (source MEETING,
  original/current preserved) **atau** `Menunggu Konfirmasi` → `PENDING`.
- **Status label konsisten (Bahasa Indonesia):** sesuai / perlu dibahas /
  menunggu konfirmasi / sudah diputuskan / belum direview / tidak dicantumkan.
- **Tidak ada migration schema baru** (presentation + workflow saja).

## Test (verified)
- 12 pure checks (M2.1 label/helper/review-eligibility)
- 20 pure checks (status label, aggregate, summary, auto-advance,
  discussion/resolve/pending flow, original/current preservation, hasSpecValue `0`)
- 10 DB integration checks (stepper hitung reviewable, markAllSesuai,
  discussion→RESOLVED, discussion→PENDING, edit invalidates review, source
  hanya muncul bila ada value, aggregate DB, progress PO, cleanup by ID+marker,
  regresi M2/M2.1)
- **Result: 31 PASS / 0 FAIL.**
- Regression: M1 48/48, M1.1 40/40, M2/M2.1 68/68.
- Build: PASS (EXIT 0).
- Manual responsive browser: PASS.
- Physical HP: DEFERRED.

## Files
- `src/lib/ppm-m2-specs.js` (`hasSpecValue`, `getSpecDisplayLabel`,
  `getSpecHelperText`, `isSpecificationReviewable`,
  `SPEC_STATUS_LABEL`, `SPEC_DISPLAY_VALUE`, `SPEC_SOURCE_DISPLAY`)
- `src/lib/ppm-m2-helpers.js` (`computeReviewProgress` reviewable-aware,
  `computeComponentAggregateStatus`, `markAllSesuaiComponent`)
- `src/components/ppm/SpecificationManagerModal.jsx`
- `src/components/ppm/TechnicalReviewModal.jsx`
- `src/components/ppm/ProductItemModal.jsx`
- `src/components/ppm/ComponentManagerModal.jsx`
- `src/pages/PPMPoDetailPage.jsx`
- `scripts/test-ppm-m2.js`
