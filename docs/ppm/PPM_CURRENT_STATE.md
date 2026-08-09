# PPM — Current State (Save Game)

> **Last updated:** 2026-08-09
> **Source of truth:** `AGENTS.md`, migration SQL di `supabase/migrations/`,
> dan test counts di bawah. Jangan edit milestone LOCKED.

## Stack (verified)

- Node 22.15.0 (`.nvmrc`) · npm 10.9.2 · ESM
- React 18 · Vite 5.0.8 · Tailwind CSS 3.4 · PostCSS 8
- @supabase/supabase-js 2.39 (anon/publishable only di frontend)
- react-router-dom 6 · @dnd-kit · lucide-react · react-hot-toast
- vite-plugin-pwa 0.17.5
- Backend: Supabase PostgreSQL + **RLS active** (dipertahankan)

## Data Hierarchy

```
Meeting
  └── PO (ppm_meeting_pos)
        └── Product Item (ppm_po_items)
              └── Component (ppm_item_components)
                    └── Technical Specification (ppm_component_specifications)
                          └── Technical Review (review_status on spesifikasi)
```

## Tabel penting (existing)

| Tabel | Keterangan | Milestone |
|---|---|---|
| `product_types` | Kemeja / Celana | M1 |
| `component_definitions` | 12+ def komponen | M1 |
| `product_type_default_components` | default komponen per tipe (sorted) | M1.1 |
| `ppm_po_items` | item per PO | M1 |
| `ppm_item_components` | komponen tiap item (dengan snapshot nama) | M1 |
| `specification_definitions` | definisi spesifikasi (master) | M2 |
| `ppm_component_specifications` | nilai spesifikasi per komponen | M2 |
| `ppm_meeting_pos` | header PO | M1 |

> `review_status` (TEXT: `NOT_REVIEWED | CONFIRMED | DISCUSSION_REQUIRED | PENDING | RESOLVED`)
> dan `source_type` (`PO | MANUAL | MEETING`) tinggal di kolom
> `ppm_component_specifications`.

## Locked Milestones

| Milestone | Status | Regression |
|---|---|---|
| M1 | LOCKED | 48 PASS / 0 FAIL |
| M1.1 | LOCKED | 40 PASS / 0 FAIL |
| M2 | LOCKED | 56 PASS + 12 M2.1 PASS = 68 PASS / 0 FAIL |
| M2.1 | LOCKED | (termasuk dalam 68 di atas) |
| M2.2 | LOCKED | 31 PASS / 0 FAIL |

- **Production build:** PASS (`npx vite build` EXIT 0, ~1469 module).
- **Manual responsive browser (Chrome emulation):** PASS.
- **Physical HP:** DEFERRED sampai staging/Vercel.

## Domain Facts (jangan dipaksakan jadi default universal)

- **Default komponen:** Kemeja = 8, Celana = 7.
- **Specification Definition ≠ Specification Value.**
  Contoh: definisi "Tinggi Jadi Kerah, unit cm" ≠ "5 cm" (itu nilai PO,
  bukan default universal Kemeja).
- **Kemeja WIKA ≠ Kemeja AKP.** Sama-sama "Kemeja" tidak berarti spesifikasi
  identik.
- **Empty optional specification:** tidak reviewable, tidak blocking, tidak
  masuk denominator progress, dan **bukan** `review_status` baru — hanya
  presentation state `"Tidak Dicantumkan"` (#ADR-007).
- **Repeat Order** akan pakai Model Library / Golden Reference
  (#ADR-008) — belum ada, jangan dipaksakan input ulang.
- **Physical HP** test tetap ditunda sampai staging.

## Next Planned Milestone

- **M3 — Annotation & Component Discussion** — PLANNED, belum dimulai.

> **Aturan eksplisit:** jangan mulai M3 hanya karena roadmap tersedia.
> Tunggu instruksi spesifik dari user.

## Known Limitations (current)

- Tidak ada realtime (WebSocket) — perubahan perlu refresh.
- Bulk "Semua Sesuai" di level PO belum ada (hanya level Component).
- Assignment workflow "Menunggu konfirmasi dari: \<nama\>" belum terhubung ke
  sistem user — hanya notes + status PENDING.
- Browser/mobile fisik belum diverifikasi (Chrome emulation saja).

## Related docs

- `docs/ppm/PPM_DECISIONS.md`
- `docs/ppm/PPM_ROADMAP.md`
- `docs/ppm/milestones/M2_2_REPORT.md`
- `docs/development/DEV_SETUP.md`
- `docs/development/TESTING.md`
- `docs/development/AI_HANDOFF.md`
