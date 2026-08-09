# M2.1 — Operational Labels & Review Eligibility (LOCKED)

## Status
**LOCKED** — 12 pure checks (termasuk dalam 68 M2).

## Ringkasan
- `SPEC_LABEL_OVERRIDE`: label tampilan operasional per `spec_key`
  (mis. "Jenis / Bentuk Kerah", "Tinggi Jadi Kerah", "Lebar Jadi Saku").
- `SPEC_HELPER_TEXT`: helper text kecil per spec.
- `hasSpecValue(spec)` canonical: membedakan angka `0` dari kosong.
- `isSpecificationReviewable(spec)`: reviewable bila ada value / notes / required.
- Empty optional tidak masuk denominator progress.

## Test (verified) — 12 pure checks (no DB)
1. MODEL_KERAH tampil "Jenis / Bentuk Kerah"
2. TINGGI_KERAH tampil "Tinggi Jadi Kerah"
3. MODEL_SAKU tampil "Jenis / Konstruksi Saku"
4. Lebar/Tinggi Saku pakai "Jadi"
5. helper text tampil & sesuai kata kunci
6. empty optional field tidak blocking (tidak reviewable)
7. empty optional tidak masuk denominator progress
8. filled field masuk review
9. custom specification tetap reviewable
10. spec_key & snapshot label tidak berubah (hanya display)
11. typo UI (Kelolly / SESUAI / PULU) tidak ditemukan
12. SPEC_LABEL_OVERRIDE map tidak kosong & konsisten

## Files
- `src/lib/ppm-m2-specs.js` (`SPEC_LABEL_OVERRIDE`, `SPEC_HELPER_TEXT`,
  `getSpecDisplayLabel`, `getSpecHelperText`, `hasSpecValue`,
  `isSpecificationReviewable`)
- `src/lib/ppm-m2-helpers.js` (re-export)
- bagian M2.1 pure checks berada di `scripts/test-ppm-m2.js`
