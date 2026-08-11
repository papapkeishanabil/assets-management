# PPM — Current State (Save Game)

> **Last updated:** 2026-08-10 — **M3 family LOCKED** + **M4 IMPLEMENTED /
> PENDING USER VERIFICATION** (Decision ↔ Technical Specification
> Reconciliation; additive proposal layer; NO LOCK). Regression aggregate
> **349 PASS / 0 FAIL** + build PASS. M3 family user-accepted 2026-08-10
> (*"M3 untuk sementara cukup, lanjut berikutnya."*). Viewer baseline dikunci.
> Incl. FINAL MEETING UX (Product Discussion Flow + MICRO-POLISH). Physical HP +
> projector physical test = DEFERRED (user reviewed on monitor/browser, not
> physical device).
> **Source of truth:** `AGENTS.md`, migration SQL di `supabase/migrations/`,
> test counts di bawah, dan kode aktual di `src/` (branch `modul-ppm`).
> Jangan edit milestone LOCKED.

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
                    ├── Technical Specification (ppm_component_specifications)
                    │     ├── Technical Review (review_status pada spesifikasi)
                    │     └── Spec Change Proposal (ppm_spec_change_proposals) [M4]
                    │           (governance: Decision → Spec; APPLY reuse resolveSpecification)
                    └── Annotation (ppm_annotations)  [M3]
                          └── Note (ppm_annotation_notes)  [M3]
                                (DECISION note = evidence link ke proposal [M4])
```

## Tabel penting

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
| `ppm_annotations` | pin annotation pada gambar PO (konteks item/komponen/spec) | M3 |
| `ppm_annotation_notes` | notes flat per pin (DISCUSSION/DECISION/INFO) | M3 |
| `ppm_spec_change_proposals` | governance: keputusan meeting → satu spec (typed proposed value + baseline snapshot + lifecycle PROPOSED/APPROVED/REJECTED/DEFERRED + stale protection + idempotency) | M4 |

## Locked Milestones

| Milestone | Status | Regression |
|---|---|---|
| M1 | LOCKED | 48 PASS / 0 FAIL |
| M1.1 | LOCKED | 40 PASS / 0 FAIL |
| M2 | LOCKED | 56 PASS + 12 M2.1 PASS = 68 PASS / 0 FAIL |
| M2.1 | LOCKED | (termasuk dalam 68 di atas) |
| M2.2 | LOCKED | 31 PASS / 0 FAIL |
| **M3** | **LOCKED** | 46 PASS / 0 FAIL (user-accepted 2026-08-10) |
| **M3.1** | **LOCKED** | 70 PASS / 0 FAIL (bagian dari M3) |
| **M3.2** | **LOCKED** | hardening + visual polish + Meeting Product Discussion Flow (bagian dari M3) |
| **M4** | **IMPLEMENTED / PENDING USER VERIFICATION** (NO LOCK) | 65 PASS / 0 FAIL (pure + DB); aggregate 349 PASS |

> **M3 family LOCKED (2026-08-10)** — user verifikasi manual ACCEPTED (regression
> 284 PASS / 0 FAIL + build PASS). Viewer baseline dikunci: Fit-to-PO, zoom/pan,
> fullscreen preservation, MiniMap, floating dark card, connector, multi-pin,
> smart component focus, Product Discussion Flow, Component Discussion, Meeting
> Focus Mode. Jangan refactor tanpa bug report / requirement eksplisit.

## Test & Build (hasil aktual, fresh — 2026-08-10)

- `npm run test:ppm:m3` → **46 PASS / 0 FAIL**
- `npm run test:ppm:m3.1` → **70 PASS / 0 FAIL**
- `npm run test:ppm:m3.1:render` → **12 PASS / 0 FAIL** (SSR smoke render)
- `npm run test:ppm:m3.1:fit` → **17 PASS / 0 FAIL** (pure fit/fullscreen + resize-preserve logical viewport; TIDAK termasuk aggregate)
- `npm run test:ppm:m4` → **65 PASS / 0 FAIL** (pure helpers + DB contract)
- `npm run test:ppm` (aggregate) → **349 PASS / 0 FAIL**
  (48 + 40 + 68 + 46 + 70 + 12 + 65 = 349; `test:ppm:m3.1:fit` dijalankan terpisah)
- `npm run build` → **PASS** (`vite build` EXIT 0, 1497 modules, 21.8s)
- Browser harness (Playwright, Chromium, komponen asli tanpa auth): **21 PASS / 0 FAIL**
  (per M3_REPORT; hasil lama — bukan hasil baru, harness tidak dijalankan ulang saat handoff ini)
- Manual browser halaman PO asli (auth): **NOT TESTED**

## Feature Inventory & Status (M3 / M3.1 / M4 — M4 belum LOCK)

Semua item di bawah **IMPLEMENTED / PENDING USER VERIFICATION** (kode + automated test
hijau; verifikasi manual user di browser belum selesai). Automated test PASS **tidak**
dianggap manual UX PASS. M3/M3.1 telah user-accepted (LOCKED); **M4 belum LOCK**.

| Fitur | Status | Catatan |
|---|---|---|
|---|---|---|
| Annotation CRUD: pin + notes (DISCUSSION/DECISION/INFO), status OPEN/RESOLVED, drag pin, delete (cascade), konteks item→komponen→(optional) spec | IMPLEMENTED / PENDING USER VERIFICATION | M3; migration `202608080006_ppm_m3_annotations.sql` |
| Rangkuman Komponen (group live item→komponen→pin→notes, decision prominent) | IMPLEMENTED / PENDING USER VERIFICATION | mobile card + right sidebar |
| **Annotation Viewer** — full PO Fit view (contain), zoom/pan (wheel, tombol, drag), toolbar (Fit/-/%/+/Fullscreen/Tambah Pin/Tampilkan Semua) | IMPLEMENTED / PENDING USER VERIFICATION | M3.1 |
| **Add Component dari Annotation** — dari Component Library (search + filter item) & custom (`is_custom`, tidak promote ke master) | IMPLEMENTED / PENDING USER VERIFICATION | M3.1 |
| **Smart Zoom / Focus** — single pin focus (~1.75x, pin di center), multi-pin bbox focus (margin + scale factor), fail-safe validasi finite | IMPLEMENTED / PENDING USER VERIFICATION | M3.1 |
| **Multi-pin selection** — floating summary cards, layout non-overlap (collision engine, pin tidak digeser), pin selalu visible | IMPLEMENTED / PENDING USER VERIFICATION | M3.1 |
| **Curved connector** — SVG cubic bezier card→pin, anchor di tepi kartu menghadap pin, marker arrow, glow | IMPLEMENTED / PENDING USER VERIFICATION | M3.1 |
| **Mini Map** — thumbnail full image kiri-bawah, viewport rectangle indicator, klik navigasi, exclusion zone kartu | IMPLEMENTED / PENDING USER VERIFICATION | M3.1 |
| **Daftar Pin / Rangkuman** — right sidebar desktop (340px, 2 tab, filter komponen+status) | IMPLEMENTED / PENDING USER VERIFICATION | M3.1 |
| **Annotation Register** — modal register per PO, filter item/komponen/status/Has Decision, statistik, klik row → focus pin | IMPLEMENTED / PENDING USER VERIFICATION | M3.1 |
| **Mobile bottom sheet** — pin detail di <640px; floating cards desktop tidak dirender di mobile | IMPLEMENTED / PENDING USER VERIFICATION | M3.1 |
| **Fullscreen viewer** — workspace fullscreen (toolbar + viewer + right panel), fit dihitung ulang terhadap dimensi container baru (bukan reuse pixel), exit kembali persis | IMPLEMENTED / PENDING USER VERIFICATION | M3.1 bugfix, sesi ini |
| **Meeting Focus Mode** — meeting IN_PROGRESS → sidebar aplikasi utama hidden + lebar penuh; status DB sebagai source of truth; persist sessionStorage; otomatis berakhir saat status berubah | IMPLEMENTED / PENDING USER VERIFICATION | `MeetingFocusContext` |
| **Meeting Product Discussion Flow** — meeting punya 2 sub-state UI (no DB): **Product Selection** (Order Overview + kartu produk + [Bahas Produk]) & **Product Discussion** (header + **component rail** `[Overview][Kerah][Saku]…` dari komponen nyata + workspace viewer [Overview=Fit-to-PO via fail-safe engine] + panel kanan **Diskusi** [specs + catatan visual komponen aktif] + nav [Sebelumnya/Berikutnya komponen] + [← Semua Produk]/[Berikutnya: …→ produk]). Admin blocks (Technical Review big block, Kelola Produk accordion) disembunyikan di meeting mode (display:none) → digantikan Product Flow + Technical Review via modal. Viewer internals TIDAK diubah (§15/§24); node workspace tetap mounted, order via CSS | IMPLEMENTED / PENDING USER FINAL VERIFICATION | `MeetingProductFlow`, `ComponentDiscussionContent`, `AnnotationSidebar` (tab Diskusi), `PPMPoDetailPage`, `index.css` — sesi ini |
| **Floating summary card = near-opaque charcoal contextual surface** (~#111827, alpha ~0.93–0.95) di kedua theme; connector biru tegas; pin biru; mini-map/toolbar/sidebar tetap light | IMPLEMENTED / PENDING USER VERIFICATION | M3.1 visual fix + M3 polish (sebelumnya frosted alpha 0.55–0.62) — **belum diverifikasi user** |
| **Meeting Workspace layout** — saat meeting IN_PROGRESS: section **di-reorder via flex `order`** → compact header → **ANNOTATION WORKSPACE (PRIMARY/hero, `min-height: calc(100vh-8rem)`)** → mobile recap → Technical Review → Produk → PO detail (collapsed + sekunder visual); PO summary/Review/Items collapse default (toggle expand), compact context strip, kontrol duplikat di-consolidate (toolbar viewer = primary; Tambah Pin & Tampilkan Semua `lg:hidden` di page header), card↔pin `CARD.GAP` 24→44, sidebar group bg subtle; non-meeting mode pass-through (admin layout tak berubah, urutan DOM admin dipertahankan) | IMPLEMENTED / PENDING USER FINAL VISUAL VERIFICATION | M3 polish + reorder, sesi ini — **belum diverifikasi user** |
| **M4 Decision ↔ Spec — Spec Change Proposal** (governance layer): keputusan meeting → satu spec via record `ppm_spec_change_proposals`; typed proposed value (`value_*` per `value_type`) **DIPISAH** dari `decision_note`; baseline snapshot spec's current value; lifecycle `PROPOSED → {APPROVED\|REJECTED\|DEFERRED}`; domain proposal status terpisah dari spec `review_status` & annotation `status` | IMPLEMENTED / PENDING USER VERIFICATION (NO LOCK) | M4; migration `202608100002_ppm_m4_spec_change_proposals.sql` (additive); `ppm-m4-specs.js` + `ppm-m4-helpers.js` |
| **M4 APPLY proposal → spec** — reuse `resolveSpecification()` (M2.2 path, NO new spec-mutation path, NO RPC): spec jadi `RESOLVED` + `source_type=MEETING`, `original_value_*` dijaga trigger M2 | IMPLEMENTED / PENDING USER VERIFICATION (NO LOCK) | M4; ADR-026 |
| **M4 Stale protection + idempotency** — APPLY compare baseline vs current: block default (`conflict_snapshot_json`) / force override (`applied_despite_conflict`) / rebase (review ulang); re-APPLY setelah APPROVED = no-op (`WHERE status IN (PROPOSED,DEFERRED)` guard) | IMPLEMENTED / PENDING USER VERIFICATION (NO LOCK) | M4; client-orchestrated (sesuai konvensi PPM) |
| **M4 Reconciliation UX** — `SpecReconciliationModal` (create: spec picker + SpecValueInput typed + decision_note; review: spec current + proposal + kartu konflik + 3-way actions) + badge compact "⚠ Belum Diselaraskan [Detail]" di FloatingPinCard (NO big form) + per-spec sub-row "⚠ Meeting Decision [Selaraskan]" di ComponentDiscussionContent. Viewer internals untouched (additive optional props) | IMPLEMENTED / PENDING USER VERIFICATION (NO LOCK) | M4; `SpecValueInput.jsx` (NEW pure), `SpecReconciliationModal.jsx` (NEW), patches FloatingPinCard / ComponentDiscussionContent / AnnotationSidebar / MeetingProductFlow / AnnotationCanvas (pass-through) / PPMPoDetailPage |
| Annotation untuk dokumen **PDF** (render pin) | NOT IMPLEMENTED | hanya gambar (jpg/jpeg/png); PDF dirender iframe tanpa pin |
| `po_document_id` / `page_number` (multi-page viewer) | NOT IMPLEMENTED | kolom ada di schema, diisi null |

## Manual UX Verification Status

Automated test PASS ≠ manual UX PASS. Berikut status jujur verifikasi manual user.

> **USER ACCEPTANCE — 2026-08-10:** User telah mereview visual current M3
> (Annotation & Component Discussion + Meeting Product Discussion Flow +
> micro-polish) dan menyatakan **"M3 untuk sementara cukup, lanjut berikutnya."**
> M3 family → **LOCKED**. Penerimaan ini = review visual user pada monitor/browser
> biasa (bukan perangkat fisik).

| Area | Status |
|---|---|
| M1–M2.2 manual responsive (Chrome emulation) | **PASS** (hasil lama, per report M1–M2.2) |
| M3/M3.1 browser **harness** (komponen asli, tanpa auth, Playwright) | **PASS** (21/21, hasil lama) |
| **M3 Meeting Product Discussion Flow + micro-polish** (visual user review) | **ACCEPTED** (user, 2026-08-10) — cukup untuk lanjut |
| Halaman PO asli (auth) — alur Tambah Pin / drag / register / sidebar | **ACCEPTED** (user visual review 2026-08-10) — kondisi kolektif diterima |
| **Fullscreen viewer** (workspace fullscreen: img tidak stretched, side panel sejajar, fit recompute saat resize, exit) | **ACCEPTED** (user, 2026-08-10) — via acceptance kolektif |
| **Floating card dark di Light theme** (card menonjol di atas PO terang) | **ACCEPTED** (user, 2026-08-10) — via acceptance kolektif |
| **Connector terlihat di Light theme** (biru, stroke + glow) | **ACCEPTED** (user, 2026-08-10) — via acceptance kolektif |
| **Meeting Focus Mode** (Mulai Meeting → sidebar hidden; Selesaikan → normal; refresh tetap focus) | **ACCEPTED** (user, 2026-08-10) — via acceptance kolektif |
| Physical HP device | **DEFERRED** (belum diuji di perangkat fisik — tunggu staging/Vercel) |
| Physical projector test | **DEFERRED** (user review pada monitor biasa, bukan proyektor fisik) |

## Known Current Issues / Outstanding Verification (harus dicek user di browser)

1. **Floating annotation card dark surface** (requirement user): diperbaiki sesi ini dengan
   palette dedicated `annotation-card` yang tidak bergantung theme. **Belum diverifikasi**
   di Light theme maupun Dark theme (TEST A–D di `M3_1_REPORT.md`).
2. **Transparansi kartu**: user minta card transparan — diubah ke frosted glass. Trade-off:
   teks abu harus cerah agar terbaca. **Belum diverifikasi** apakah alpha ~0.55–0.62 sudah
   pas / tidak terlalu transparan untuk teks status.
3. **Connector di Light theme "tidak terlihat"** (report user): dipertegas (warna lebih pekat,
   stroke lebih tebal, glow lebih kuat). **Belum diverifikasi**.
4. **Fullscreen viewer**: bug gambar stretched + side panel turun di bawah card (report user
   implisit saat fit/contain) — diperbaiki lewat class fullscreen di `index.css` + refactor
   `computeFitTransform`. **Belum diverifikasi** manual. Follow-up (2026-08-10): gambar PO
   sempat tetap kecil di tengah saat fullscreen (margin hitam semua sisi) karena ResizeObserver
   miss saat transisi `:fullscreen` → transform stagnan skala mode normal. Kini re-measure
   eksplisit saat `expanded` toggle di `AnnotationCanvas.jsx`. Follow-up lanjutan
   (2026-08-10): ditemukan **bug sign** di cabang preserve `measure()` —
   `(t.tx + viewerW/2)/scale` seharusnya `(viewerW/2 - t.tx)/scale` (konvensi
   `screen = tx + world*scale`) sehingga pusat viewport melompat ke titik world
   SALAH saat fullscreen/resize dan fokus pin / manual zoom HILANG (pin bisa
   terlempar off-screen). Fixed dengan ekstrak 4 pure functions
   (`logicalZoomRatio` / `deriveViewportCenter` / `resolveTransformPreservingCenter`
   / `resolveTransformOnResize`) di `ppm-m31-specs.js` + 8 pure test (§17);
   `measure()` kini memanggil resolver murni. Perilaku: Fit mode → recompute Fit
   container baru; manual/focus → PRESERVE logical viewport (center + zoom ratio).
   **Perlu verifikasi ulang**.
5. **Pin resolved** sekarang biru tua (`primary-800`) — beda visual vs sebelumnya abu-abu;
   pastikan masih bisa dibedakan dengan pin OPEN (biru `primary-600`).
6. `git diff src/index.css` vs disk: catatan — section fullscreen menggunakan
   `height:100% !important` pada `.viewer-root` + tanpa `display:flex` paksa pada
   `.annotation-workspace-inner` (versi ini yang tervalidasi build & 284 PASS).
7. Meeting Focus Mode: tombol "Mulai/Selesaikan Meeting" hanya tampil untuk creator atau
   super_admin; pastikan flow lengkap diverifikasi.
8. PDF tidak berpin (by design) — jangan dianggap bug.

## Next Planned Milestone

- **M3 family (M3 / M3.1 / M3.2) — LOCKED** (user-accepted 2026-08-10; regression
  284 PASS / 0 FAIL + build PASS).
- **M4 — Decision ↔ Technical Specification Reconciliation — IMPLEMENTED /
  PENDING USER VERIFICATION** (NO LOCK). Additive proposal layer; APPLY reuse
  `resolveSpecification()`. Regression aggregate 349 PASS / 0 FAIL + build PASS.
  Verifikasi manual user di browser belum selesai.
- Milestone berikutnya (M5) belum ditentukan (tunggu instruksi user).

> **Aturan eksplisit:** jangan lanjut milestone berikutnya tanpa instruksi spesifik dari user.

## Current Work / Uncommitted Work

Semua implementasi M3 + M3.1 berada di **working tree yang BELUM di-commit**.
HEAD terakhir = `d5bf8c7` (lock M2 + handoff standardization). Branch: `modul-ppm`.

**Tujuan perubahan saat ini:** menyelesaikan M3 (Annotation & Component Discussion) dan
M3.1 (Annotation Viewer UX) + bugfix fullscreen viewer + visual fix floating card dark
di Light theme; lalu **M4 (Decision ↔ Technical Specification Reconciliation)**.
**Jangan commit / push tanpa instruksi user.**

### M4 — Decision ↔ Technical Specification Reconciliation (sesi ini — PENDING USER VERIFICATION, NO LOCK)
**Business rule user:** Technical Specification = FINAL STRUCTURED PRODUCT TRUTH;
Annotation Decision = keputusan meeting. Keputusan yang berkaitan dgn spec & nilainya
berbeda → **rekonsiliasi eksplisit** via proposal layer (bukan overwrite langsung).
**Pure additive** — TIDAK rewrite M2/M3, TIDAK ubah schema spec/annotation/notes, TIDAK
tambah enum review_status (destructive ALTER dilarang), TIDAK buat RPC. APPLY **reuse
`resolveSpecification()`** (M2.2 path — RESOLVED + MEETING + original preserved trigger).
Detail penuh di `docs/ppm/milestones/M4_REPORT.md` + ADR-026.

- **NEW table `ppm_spec_change_proposals`** (additive): target spec + evidence (annotation
  + note, nullable SET NULL) + typed proposed value (`value_*` per `value_type`, MIRROR
  spec) **DIPISAH** dari `decision_note` (free text) + baseline snapshot + lifecycle
  `PROPOSED → {APPROVED|REJECTED|DEFERRED}` + APPLY audit (`applied_despite_conflict`,
  `conflict_snapshot_json`). 5 index + RLS (Pattern A SELECT; Pattern B WRITE via
  `meeting_po_id`) + trigger `updated_at` reuse. Migration
  `supabase/migrations/202608100002_ppm_m4_spec_change_proposals.sql` + runner.
- **Helpers:** `src/lib/ppm-m4-specs.js` (pure: `PROPOSAL_STATUS`/_LABELS/_COLORS,
  `UNRECONCILED_STATUSES`, `firstDecisionNote` centralize, `proposalValueInfo`/
  `proposalBaselineInfo`, `formatProposalValue`, `isUnreconciled`/`canTransition`/
  `isApplyable`, `detectConflict`, `specValueChanged`/`hasSpecOriginalValue`) +
  `src/lib/ppm-m4-helpers.js` (DB: `fetchProposalsForPO`, `createProposal` baseline
  snapshot, `applyProposal` idempotency+conflict+force+reuse `resolveSpecification`,
  `rejectProposal`/`deferProposal`/`rebaseProposal`/`fetchProposalById`). PGRST116 / 0
  rows = idempotent.
- **Components:** `SpecValueInput.jsx` (NEW pure typed input per value_type) +
  `SpecReconciliationModal.jsx` (NEW: create + review modes, kartu konflik, 3-way
  actions; tetap terbuka bila APPLY return `{conflict:true}`).
- **PATCH (additive optional props — no behavior change when absent):**
  `FloatingPinCard.jsx` (badge compact "⚠ Belum Diselaraskan [Detail]" sibling setelah
  DECISION, NO big form; link "Usulkan ke Spec" di expanded footer), `ComponentDiscussionContent.jsx`
  (per-spec sub-row "⚠ Meeting Decision [Selaraskan]"), `AnnotationSidebar.jsx` +
  `MeetingProductFlow.jsx` (pass-through `onSelaraskan`+`proposalsBySpec`),
  `AnnotationCanvas.jsx` (protected viewer — +optional `onProposeSpecChange` **pure
  pass-through**, no engine/geometry/focus change).
- **Orchestrator:** `PPMPoDetailPage.jsx` — `fetchProposalsForPO` di fetchPO; memo
  `proposalsBySpec`+`proposalsByAnnotation`; enrichment `annotation._unreconciledProposal`
  pada `filteredAnnotations` (derived map); 7 handler (`handleProposeSpecChange`/
  `handleSelaraskan`/`handleCreateProposal`/`handleApplyProposal` [return res, if
  `res.conflict`→toast+refresh+no close]/`handleRejectProposal`/`handleDeferProposal`/
  `handleRebaseProposal`); mount `<SpecReconciliationModal>`; wire
  `onProposeSpecChange={canManage ? handler : undefined}`.
- **Test:** `scripts/test-ppm-m4.js` (marker `__TEST_M4__<run_id>`; 65 PASS — pure via
  import + DB contract via REST service key; cleanup by created ID + marker sweep).
  `package.json` → `test:ppm:m4` + extend aggregate `test:ppm`.
- **Verification:** migration applied; `test:ppm:m4` 65 PASS / 0 FAIL; aggregate
  `test:ppm` **349 PASS / 0 FAIL**; `build` **PASS** (1497 modules, 21.8s).
  Manual browser (auth) — **NOT TESTED** (tunggu verifikasi user).
- **Status: IMPLEMENTED / PENDING USER VERIFICATION. NO LOCK M4. NO commit/push.
  NO M5.** Working tree unrelated Contract/PKWTT changes — TIDAK disentuh.

### M3 FINAL MEETING UX — Product Discussion Flow (sesi ini — PENDING USER FINAL VERIFICATION)
Restruktur information-flow meeting agar mengikuti narasi moderator:
`ORDER CONTEXT → PRODUCT SELECTION → VISUAL OVERVIEW → COMPONENT REVIEW → DISCUSSION/DECISION → PRODUCT COMPLETE → NEXT PRODUCT`.
Meeting TIDAK langsung buka Annotation Viewer tanpa konteks (masalah patch
sebelumnya yang "belum tepat secara information flow"). Dua sub-state UI baru
(no DB — `discussionItemId`/`discussionComponentId` = UI nav state):

- **Product Selection** (entry default): Order Overview (PO#, customer, Meeting
  Aktif, deadline/qty/N Produk/Review X/Y/N Pin — hanya field yang ada) + kartu
  per produk (index, qty, N komponen, Review X/Y, N pin) + **[Bahas Produk]**
  (primary) + [Kelola] (secondary admin). Terlihat tanpa scroll (TEST A).
- **Product Discussion** (setelah [Bahas Produk]): header ([← Semua Produk] +
  Review badge + [Berikutnya: …→]) + judul produk + **component rail**
  (`[Overview]` + tombol per komponen dgn status derive ✓/⚠/· + pin count;
  horizontal scroll) + nav [← Sebelumnya][Berikutnya →] + workspace viewer
  (Overview = Fit-to-PO) + panel kanan **Diskusi** (specs + catatan visual
  komponen aktif). Status rail derive: ✓ semua spec reviewed · ⚠ ada pin OPEN ·
  · netral (no new enum/DB).

**REUSE → INSPECT → PATCH (§0/§15/§17/§24):** Overview=Fit dicapai via
`focusRequest` fail-safe engine existing (`{type:'bbox', pinIds:[]}` → fallback
`setTransform({...fit})`) — **tidak ada perubahan viewer**. Click-component-focus
reuse `handleShowComponentPins` (§11). Komponen tanpa pin → no crash, viewer tetap
posisi terakhir (§12). Workspace node tetap mounted; reorder via CSS `order`;
tinggi via CSS → ResizeObserver re-measure canvas (§15-safe). Technical Review
tetap item-scoped via modal (§16). `ComponentDiscussionContent` = satu sumber
(§17) dipakai sidebar tab Diskusi (desktop) + blok mobile.

**Files (5 code — dalam budget §32):** `ComponentDiscussionContent.jsx` (NEW,
presentational pure), `MeetingProductFlow.jsx` (NEW, presentational pure),
`AnnotationSidebar.jsx` (PATCH — tab Diskusi + props `discussionItem`/
`discussionComponentId`/`onTechnicalReview`), `PPMPoDetailPage.jsx` (PATCH —
state + 7 handler reuse + wiring MeetingProductFlow + hide admin blocks via CSS +
sidebar wiring), `index.css` (PATCH — order/height scoped `.m-meeting-select`/
`.m-meeting-discuss` + `display:none` m-sec-review/m-sec-products). Admin/non-meeting
mode = pass-through (§31). Status: **IMPLEMENTED / PENDING USER FINAL VERIFICATION.
NO LOCK M3.** Lihat detail + laporan §22 per-file di
`docs/ppm/milestones/M3_1_REPORT.md` → "M3 Final Meeting UX — Product Discussion Flow".

### M3 Meeting UX — MICRO-POLISH (sesi ini — PENDING USER FINAL VERIFICATION)
Visual/copy/density only. **Tidak ada perubahan architecture/flow/viewer state/
zoom-pan/fullscreen/MiniMap/smart-focus/connector/collision/persistence/Technical
Review workflow/DB.** Patch-level (§0):
- **§1 Single Order Context:** hapus duplicate PO summary card di
  `MeetingProductFlow` (PO#/customer/Meeting Aktif tadinya diulang tepat di
  bawah meeting-header strip). PO context sekarang SATU sumber = meeting-header
  strip di `PPMPoDetailPage`, diperkaya dgn badge **Total qty** + `[Lihat Detail PO]`.
- **§2/§3 Density:** Product Selection card header `mb-3`→`mb-2`, row `py-2.5`→
  `py-2`; Product Discussion header dirapatkan (Review badge pindah ke baris
  judul; nav `mb-3`→`mb-2`).
- **§4/§5 Component rail pin count:** angka polos → **badge `badge-indigo` dgn
  tooltip "X pin"** (semantik jelas; angka = jumlah pin dari `compPinCounts`).
  Status icon derive (✓/⚠/·) tetap.
- **§6 Copy:** Overview list "no spec" (dev-speak) → `—` / pin-only. Bukan
  invent meaning.
- **§7/§8 Context header:** panel Diskusi dapat **eyebrow** "Pembahasan
  Komponen" / "Overview Produk" di atas judul → audience projector langsung
  tahu komponen yg dibahas. Overview title "Overview — {item}" → eyebrow + nama.
- **§10 Hierarchy:** `[Bahas Produk]` primary; **Kelola** → text link subtle.
- **§11 Spacing:** panel `space-y-4` → `space-y-3`.
- **§9 `[Technical Review]` button:** DIPERTAHANKAN (paling konsisten dgn modal
  domain "Technical Review"; user tandai acceptable).
- **§12-§16:** viewer/PO image/workspace header/floating card/connector/MiniMap
  **TIDAK DISENTUH** (§13/§14). Non-meeting mode unchanged (§16).

**Files (3 code):** `MeetingProductFlow.jsx` (remove dup card + density + rail
badge + Kelola subtle + drop dead props `po`/`poReview`/`totalPins` & import
`formatDateLongID`), `ComponentDiscussionContent.jsx` (eyebrow + "no spec"→`—` +
`space-y-3`), `PPMPoDetailPage.jsx` (`totalQty` computed + Total qty badge +
drop 3 dead props dari `<MeetingProductFlow>` call). Status: **IMPLEMENTED /
PENDING USER FINAL VERIFICATION. NO LOCK M3.**

### M3.2 — Hardening (small patches, sesi ini — PENDING USER FINAL VERIFICATION)
Patch-level only (REUSE → INSPECT → PATCH → VERIFY). **Tidak ada rewrite/V2,
tidak ada migration/ schema/ RLS/ business-logic/ koordinat pin.** Tema kontrak
sudah terpenuhi existing (tidak ada perubahan CSS). Lihat detail di
`docs/ppm/milestones/M3_1_REPORT.md` → "M3.2 — Hardening".

- MUST: (1) guard NaN posisi di `AnnotationPinDrawer`, (2) MiniMap `object-contain`,
  (3) expanded floating card re-measure (`activePinsKey` + `expandedCardId`).
- SHOULD: sort `activePins` by `pin_number`; toolbar `z-50`; `setAnnotationStatus`
  strict; `addComponentFromLibrary` re-throw clone-spec error; ComponentPicker deteksi
  by `component_definition_id`; MainLayout re-validasi status meeting saat tab visible;
  tuning `BBOX_CARD_MARGIN 0.30` / `BBOX_CARD_SCALE_FACTOR 0.78` (perlu konfirmasi visual);
  hapus dead `fetchAnnotations` (`PPMPoDetailPage`) & dead `import supabase`
  (`ppm-m31-helpers`).
- DEFERRED (conservative): `computeFitScale` `||1` & `computeViewportRect` finite guard
  tidak diubah (sudah di-neutralize; 9 test fit mematok nilai eksak).
- Test: aggregate `npm run test:ppm` **284 PASS / 0 FAIL**; `:fit` **17 PASS**; `:render` **12 PASS**; build **PASS**.

### M3 Final Visual Polish — Meeting Workspace Layout (sesi ini — PENDING USER FINAL VISUAL VERIFICATION)
PATCH scoped ke `meetingFocusActive === true` (non-meeting = pass-through). Tidak ada
V2/migration/RLS/business logic. Lihat detail di `M3_1_REPORT.md` → "M3 FINAL VISUAL POLISH".
- PO summary / Technical Review / Product Items collapse default + compact `.meeting-strip` /
  `.meeting-section-toggle` toggle (fungsi per-item utuh — hanya di-collapse, tidak hilang).
- Konsolidasi kontrol: toolbar viewer = primary; **Tambah Pin** & **Tampilkan Semua** `lg:hidden`
  di page header (tablet/mobile tetap). Daftar Pin (modal), Sembunyikan/Tampilkan Pin, Clear
  Selection tetap dipertahankan (audit: bukan duplikat).
- `.annotation-card` near-opaque charcoal (~#111827, alpha ~0.93–0.95; sebelumnya frosted 0.55–0.62).
- `CARD.GAP 24 → 44` (card↔pin ~40–80px; collision engine tak diubah).
- Sidebar group `bg-black/20 → bg-white/[0.025]`; `.focus-meeting-active` padding ketat + workspace `min-height: 72vh`.
- Files: `src/pages/PPMPoDetailPage.jsx`, `src/index.css`, `src/lib/ppm-m31-specs.js`, `src/components/ppm/AnnotationSidebar.jsx`.

### M3 Final Meeting Mode Layout Fix — Workspace First-Class (sesi ini — PENDING USER FINAL VISUAL VERIFICATION)
**Root cause:** polish sebelumnya *collapse* section tapi **tidak reorder** → workspace
masih di bawah fold, halaman meeting masih terbaca sebagai Detail PO admin.
**Fix = section reorder (information hierarchy), bukan viewer engine.**
- `.focus-meeting-active .page-container` jadi `display:flex; flex-direction:column`;
  tiap direct child diberi `order` → visual order: compact header(0) →
  **WORKSPACE(1, hero)** → mobile recap(2) → Review(3) → Produk(4) → PO detail(5).
  **DOM/JSX tidak berubah** → node workspace tetap mounted → zoom/pan/focus
  **tidak reset** saat toggle meeting (§15 preserve). 7 modal `return null` saat
  tutup → aman (bukan flex item); fixed-overlay saat buka → order tak berdampak.
- Header jadi ternary `meetingFocusActive ? <compact> : <full-admin>`. Compact =
  back link + `.meeting-strip` 1 baris (`PO# · Customer · [Meeting Aktif][N Produk]
  [Review X/Y][N Pin] · [Lihat Detail PO]`). Standalone strip lama difold-in.
- Workspace `min-height: calc(100vh - 8rem)` (dari 72vh) → hero tanpa scroll 1080p.
- Sekunder (Review/Produk/PO detail) border tipis + tanpa shadow di meeting mode.
- Marker class minimal (`m-sec-*`) pada card yang sudah ada — tanpa wrapper/pindah JSX.
- **Preserve (§15):** fullscreen (`position:fixed` → diambil dari flex flow),
  zoom/pan, focus preservation, MiniMap, connector, floating cards, pin layout,
  viewer transform, collision, smart focus, fullscreen re-measure. Admin mode:
  `.page-container` tetap block (flex hanya saat `.focus-meeting-active`).
- Files: `src/pages/PPMPoDetailPage.jsx` (header ternary + marker class),
  `src/index.css` (flex-column + order + hero height + sekunder styling).
- Test: `npm run test:ppm` aggregate **284 PASS / 0 FAIL**; `build` **PASS** (1491 modules).

### M3 Light Theme Badge Contrast Fix (sesi ini — PENDING USER FINAL VISUAL VERIFICATION)
**Root cause:** palet `success/warning/danger/primary/orange/indigo` di
`tailwind.config.js` adalah hex hardcode → TIDAK auto-invert seperti token `ink`.
Di Light Theme, badge (`Meeting Aktif`, `Review X/Y`, `Selesai` hijau; `Terbuka`,
`pending` kuning) jadi pucat & sulit dibaca di atas permukaan app terang.
**Fix = PATCH CSS scoped (bukan rewrite, JSX tak disentuh):**
- `[data-theme="light"] .badge-{green,yellow,red,blue,orange,indigo}` → teks `*-700`
  + bg/border `*/15`/`*/30` (terbaca di bg terang). `badge-gray` tak diubah.
- Re-pin `.annotation-card .badge-*` ke nilai **identik base** (`*-300`) → overlay
  FloatingPinCard (selalu gelap) tak terdampak; **Dark Theme nol perubahan visual.**
- Files: `src/index.css` (1 blok override Light Theme + 1 blok re-pin overlay).
- Test: `npm run test:ppm` **70 PASS / 0 FAIL** + SSR render **12 PASS / 0 FAIL**;
  `build` **PASS** (1491 modules, CSS 83.38 kB). Pure CSS → regresi hijau.
- **Follow-up ditangguhkan (menunggu konfirmasi):** teks warna langsung non-badge
  (`text-green-400`/`text-yellow-400`/`text-amber-400`/`text-orange-400`) di
  `AnnotationSidebar`/`TechnicalReviewModal`/`ProductItemModal`/`SpecificationManagerModal`
  juga pucat di Light Theme. Yang di overlay gelap (`FloatingPinCard`/`AnnotationRegisterModal`)
  sudah benar — JANGAN diubah.

### M3 Tampilkan Semua Pin — Desktop Discoverability Fix (sesi ini — PENDING USER FINAL VISUAL VERIFICATION)
**Root cause:** konsolidasi sesi lalu menyembunyikan tombol ber-label "Tampilkan
Semua Pin" di workspace toolbar pada desktop (`lg:hidden`) & memindahkannya ke
top-bar viewer — tapi di sana HANYA ikon Layers tanpa teks (tak recognizable).
User melaporkan "tombol tampilkan seluruh pin tidak ada".
**Fix = PATCH 1 tombol (pilihan user "Label di top-bar viewer"):** tombol `onSelectAll`
di `AnnotationCanvas.jsx` kini ber-label **"Tampilkan Semua"** + gaya disamakan dgn
sibling "Tambah Pin" (`px-2 py-1 text-[11px] font-semibold inline-flex gap-1`,
ikon `size={13}`); `aria-label` dihapus (teks visible jadi accessible name).
Single source, tanpa redundansi. **Preserve (§15):** mesin viewer tak disentuh.
- Files: `src/components/ppm/AnnotationCanvas.jsx` (label + style 1 tombol top-bar).
- Test: `npm run test:ppm` **70 PASS / 0 FAIL** + SSR render **12 PASS / 0 FAIL**;
  `build` **PASS**. Regresi hijau.

### M3 Connector Visibility — Halo + Thicker Stroke (sesi ini — PENDING USER FINAL VISUAL VERIFICATION)
**Symptom:** dari 4 pin + floating card, hanya 1 connector jelas terlihat; sisanya
tak terbaca (di atas gambar PO terang, Light theme). **Diagnosis (INSPECT):**
geometri `connectorPath()` benar (card ~58px dari pin → connector ~40-45px,
bukan degenerate), z-order benar (SVG `z-30` > card `z-20`, tidak occluded),
collision engine benar (`PIN_SAFE_RADIUS=36` kartu tidak menutupi pin). **Root
cause = visibilitas visual lemah** (stroke `2.5px` tipis + glow `0.35` + gradient
di atas PO terang) — Outstanding UX Issue #3. **Fix = PATCH visual-only (§15 aman):**
tambah 1 layer `<path>` halo putih (`#ffffff` w5.5 op0.9) di belakang stroke biru,
perkuat stroke `2.5→3`, glow `0.35→0.5`. Universal: putih = kontras di bg gelap,
biru tebal = kontras di bg terang. **Preserve (§15):** Bezier `connectorPath()`,
collision engine, `CARD.*`, layout kartu, z-order, dots, marker, MiniMap, cards,
pin layer, zoom/pan/focus — semua utuh. Tidak ada V2/engine baru.
- Files: `src/components/ppm/AnnotationCanvas.jsx` (1 block `<path>` halo + 2 attr).
- Test: `npm run test:ppm` **70 PASS / 0 FAIL** + SSR render **12 PASS / 0 FAIL**;
  `build` **PASS**. Regresi hijau.

### M3 Pin Contrast — Solid White Border (sesi ini — PENDING USER FINAL VISUAL VERIFICATION)
**Symptom:** "warna pin kurang kontras dengan background." **Diagnosis (INSPECT):**
pin non-selected pakai `border border-white/30` (1px, opasitas tipis) + fill
`bg-primary-600/90` & `bg-primary-800/90` (biru medium/gelap, sedikit tembus) →
tepian putih terlalu samar; pin biru-gelap (RESOLVED) yang menempel di trim biru-tua
PO (kerah/cuff) ikut menyatu. **Bukan** masalah koordinat/layout/collision/z-order
(dijaga §0/§15). **Fix = PATCH visual-only (§15 aman):** perkuat border jadi putih
solid `border-2 border-white` (OPEN) / `border-2 border-white/70` (RESOLVED) + buang
opasitas `/90` agar fill vivid → tepi putih = kontras universal di bg terang (body
kuning) maupun gelap (trim biru-tua). Paralel dgn filosofi halo connector.
**Preserve (§0/§15):** koordinat pin, layout/positioning, select/drag, z-order,
collision, multi-pin, ukuran `h-6` — semua utuh. Pin SELECTED tak diubah.
**Diferensiasi tetap:** SELECTED=ring+glow · OPEN=border putih solid · RESOLVED=border putih/70 + fill gelap.
- Files: `src/components/ppm/AnnotationCanvas.jsx` (2 state-branch className).
- Test: `npm run test:ppm` aggregate **284 PASS / 0 FAIL** (48+40+68+46+70+12) +
  SSR render **12 PASS / 0 FAIL**; `build` **PASS**. Regresi hijau.

### M3 Meeting Mode — "Lihat Detail PO" Posisi (sesi ini — PENDING USER FINAL VISUAL VERIFICATION)
**Symptom:** "saat klik lihat detil PO, informasi PO muncul di bagian BAWAH
halaman, seharusnya di ATAS." **Diagnosis (INSPECT):** di meeting mode, section
di-reorder via CSS flex `order` (workspace jadi hero order 1). Urutan lama:
header(0)→workspace(1)→mobilerecap(2)→review(3)→products(4)→**podetail(5)**.
Kartu PO detail (`m-sec-podetail`) hanya dirender saat user klik "Lihat Detail PO",
tapi `order:5` menempatkannya paling bawah (harus scroll lewati workspace 100vh).
**Fix = PATCH §15-aman (CSS order, BUKAN JSX move):** kelas `m-podetail-open`
ditambahkan ke `page-container` saat `meetingSections.po` true → CSS mempromosikan
`m-sec-podetail` ke `order:1` (tepat di bawah header, di atas workspace hero),
workspace turun ke `order:2`. Toggle "Sembunyikan" menghapus kelas → workspace
kembali hero. Node workspace TIDAK di-unmount → zoom/pan/focus TIDAK reset.
**Preserve (§15):** mount-state workspace, transform/zoom/pan/focus, DOM order
(JSX struktur tak berubah), urutan default meeting (workspace-first), urutan
admin mode (tak terdampak — hanya berlaku saat `.focus-meeting-active`).
- Files: `src/pages/PPMPoDetailPage.jsx` (1 conditional className di page-container),
  `src/index.css` (5 rule order scoped `.m-podetail-open`).
- Test: `npm run test:ppm` aggregate **284 PASS / 0 FAIL** + SSR render **12 PASS / 0
  FAIL**; `build` **PASS**. Regresi hijau.

### M3 Meeting Side-by-Side — Component Explorer + Quick-Add Pin (sesi ini — PENDING USER FINAL VISUAL VERIFICATION)
**Symptom:** saat meeting membahas komponen (mis. kerah) lalu muncul point diskusi,
user harus scroll naik ke workspace + re-pick komponen di drawer = friksi. **Niat:**
gambar + daftar komponen tampil bersama; tambah pin utk komponen yg sedang dibahas
tanpa scroll & tanpa re-pick. **Temuan kunci (INSPECT):** workspace SUDAH 2-kolom
di desktop ≥1024px (gambar `flex-1` | `AnnotationSidebar` 340px) → "side-by-side"
sudah ada di level workspace, TIDAK perlu rewrite layout halaman.
**Fix = PATCH §0/§15/§17-aman (REUSE, bukan rewrite):**
1. `AnnotationSidebar.jsx` — **tab ke-3 "Komponen"** (Component Explorer ringkas):
   item→komponen dgn spec summary + jumlah pin + tombol **"Tambah Pin"** per
   komponen. Tab "Daftar Pin"/"Rangkuman" utuh. `initialTab="komponen"` di meeting.
2. `AnnotationPinDrawer.jsx` — prop baru **`defaultComponentId`** → komponen
   ter-pre-select saat drawer buka (create-branch reset).
3. `PPMPoDetailPage.jsx` — state `pendingPinComponentId` + handler
   `handleQuickAddPin(component)`: set owner item sbg `expandedItemId` (supaya
   `defaultItemId` cocok), pre-select komponen, filter canvas, **zoom ke area
   pin komponen** (reuse `focusRequest`/`pinIdsForComponent`), aktifkan
   `addPinMode`. Sidebar sudah di sebelah gambar → TANPA scroll.
**Alur jadi:** bahas kerah → klik "Tambah Pin" di baris kerah (sidebar) → gambar
zoom ke kerah + mode penempatan → klik gambar → drawer dgn **kerah terpilih** →
note → simpan.
**Preserve (§15):** AnnotationCanvas internals (transform/zoom/pan/focus-engine/
MiniMap/connector/floating card/pin layout) utuh — `focusRequest` dipakai apa
adanya. **(§0):** reuse sidebar/drawer/canvas/state-machine, tidak ada V2/new
viewer. **(§17):** Component Explorer = presentasi ringkas data `items` yg sama
(satu sumber/dua tata letak), bukan duplikat blok produk.
- Files: `src/components/ppm/AnnotationSidebar.jsx` (+1 tab + Component Explorer),
  `src/components/ppm/AnnotationPinDrawer.jsx` (+prop `defaultComponentId`),
  `src/pages/PPMPoDetailPage.jsx` (+state +handler +wiring).
- Test: `npm run test:ppm` aggregate **284 PASS / 0 FAIL** + SSR render **12 PASS /
  0 FAIL** (sidebar pins/recap tab tetap PASS dgn tab baru); `build` **PASS**.

**Modified (tracked):**
- `package.json` — script test `m3`, `m3.1`, `m3.1:render`, `m3.1:fit`, `m4`, aggregate `test:ppm`
- `src/App.jsx` — wrap `MainLayout` dengan `MeetingFocusProvider`
- `src/components/layout/MainLayout.jsx` — Meeting Focus Mode (sidebar hidden, badge, validasi status DB)
- `src/pages/PPMMeetingRoomPage.jsx` — tombol Mulai/Selesaikan/Buka Kembali meeting + sinkron focus
- `src/pages/PPMPoDetailPage.jsx` — integrasi Annotation Viewer, sidebar, drawer, register, mobile sheet, fullscreen, focus + **M4 (proposal fetch/enrich + 7 handler + mount SpecReconciliationModal)**
- `src/index.css` — palette `annotation-card*` (dedicated dark overlay), class fullscreen workspace, `focus-meeting-active`
- `src/components/ppm/FloatingPinCard.jsx` — **M4: +optional `onProposeSpecChange` + badge "Belum Diselaraskan"**
- `src/components/ppm/ComponentDiscussionContent.jsx` — **M4: +optional `onSelaraskan` + per-spec sub-row**
- `src/components/ppm/AnnotationSidebar.jsx` — **M4: pass-through `onSelaraskan`+`proposalsBySpec`**
- `src/components/ppm/MeetingProductFlow.jsx` — **M4: pass-through ke mobile ComponentDiscussionContent**
- `src/components/ppm/AnnotationCanvas.jsx` — **M4: +optional `onProposeSpecChange` (pure pass-through, viewer engine untouched)**
- `docs/*` + `AGENTS.md` — handoff/status

**Untracked (baru):**
- `supabase/migrations/202608080006_ppm_m3_annotations.sql`
- **`supabase/migrations/202608100002_ppm_m4_spec_change_proposals.sql`** (M4 additive)
- `src/lib/ppm-m3-specs.js`, `src/lib/ppm-m3-helpers.js` (M3 pure + DB)
- `src/lib/ppm-m31-specs.js`, `src/lib/ppm-m31-helpers.js` (M3.1 pure + DB)
- **`src/lib/ppm-m4-specs.js`, `src/lib/ppm-m4-helpers.js`** (M4 pure + DB)
- `src/components/ppm/` — `AnnotationCanvas.jsx`, `AnnotationSidebar.jsx`, `AnnotationPinDrawer.jsx`, `AnnotationRegisterModal.jsx`, `MobilePinSummarySheet.jsx`, `ComponentPicker.jsx`, `FloatingPinCard.jsx`, `MiniMap.jsx`, **`SpecValueInput.jsx` (M4), `SpecReconciliationModal.jsx` (M4)**
- `src/contexts/MeetingFocusContext.jsx`
- `scripts/` — `run-ppm-m3-migration.js`, `test-ppm-m3.js`, `test-ppm-m31.js`, `test-ppm-m31-render.js`, `test-ppm-m31-fit.js`, `test-m31-browser.py`, **`run-ppm-m4-migration.js`, `test-ppm-m4.js` (M4)**
- `dev-viewer-test.html`, `dev-viewer-test.jsx` (harness browser)
- `docs/ppm/milestones/M3_REPORT.md`, `M3_1_REPORT.md`, **`M4_REPORT.md` (M4)**

## Known Limitations (project)

- Tidak ada realtime (WebSocket) — perubahan perlu refresh.
- Bulk "Semua Sesuai" di level PO belum ada (hanya level Component).
- Assignment workflow "Menunggu konfirmasi dari: \<nama\>" belum terhubung ke sistem user.
- Browser/mobile fisik belum diverifikasi (Chrome emulation saja).
- Annotation hanya untuk dokumen gambar; PDF dirender tanpa pin.
- Filter pin per komponen memakai item yang sedang expand (jika tidak ada item expand → hanya "Semua Pin").
- `po_document_id`/`page_number` null (belum ada viewer multi-page).
- Pin tidak di-renumber otomatis saat dihapus.

## Related docs

- `docs/ppm/PPM_DECISIONS.md` (incl. ADR-026)
- `docs/ppm/PPM_ROADMAP.md`
- `docs/ppm/milestones/M3_REPORT.md`
- `docs/ppm/milestones/M3_1_REPORT.md`
- `docs/ppm/milestones/M4_REPORT.md`
- `docs/development/DEV_SETUP.md`
- `docs/development/TESTING.md`
- `docs/development/AI_HANDOFF.md`
