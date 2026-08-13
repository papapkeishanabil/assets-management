# TESTING — PPM Test Guide

## Test runner
Semua test PPM adalah skrip Node (ESM) di `scripts/`. Mereka memakai
`scripts/_ppm-env.js` untuk memuat kredensial dari `.env.local`.

| Command | Apa yang diuji | Perlu `SUPABASE_SERVICE_KEY`? |
|---|---|---|
| `npm run test:ppm:m1`    | M1 Product Item + Component (48)        | ya |
| `npm run test:ppm:m1.1`  | M1.1 Default Component Set + Drag (40)  | ya |
| `npm run test:ppm:m2`    | M2/M2.1/M2.2 specs + technical review   | ya |
| `npm run test:ppm:m3`    | M3 Annotation & Component Discussion (46)| ya |
| `npm run test:ppm:m3.1`  | M3.1 UX: register, focus, connector, mobile (70) | ya |
| `npm run test:ppm:m3.1:render` | SSR smoke render tiap komponen M3.1 (12) — tangkap ReferenceError yang lolos build | tidak |
| `npm run test:ppm:m3.1:fit` | pure fit/fullscreen + resize-preserve logical viewport (17) | tidak |
| `npm run test:ppm:m4`    | M4 Decision ↔ Spec (pure helpers + DB contract: create/apply APPROVED/idempotency/stale conflict/force/reject/defer/rebase/RLS + **evidence immutability DB trigger** A–I via REST langsung) | ya |
| `npm run test:ppm:m4.5a` | M4.5A Spec Template + Technical Standard (DB contract: 5 tabel additive, seed product types, template/standard CRUD, NULL-safe uniqueness std+custom, DEFAULT vs STANDARD, RLS anon, standard_id link, pure helpers P1–P12 incl. **contextual spec picker** + clear-on-component-change + seed Scotchlight/Manset + **WIKA master patch 5 komponen/18 defs**) | ya |
| `npm run test:ppm:m4.5a.1` | M4.5A.1 Conditional Standard V1 (rules DB: create/typed/EQUALS eval 1→Single, 2→Double, unknown→none, component consistency trigger, cross-component rejected, duplicate/contradiction blocked, inactive ignored, simple tetap, contextual tetap, no-mutation, **unit suffix inch/cm/tanpa-unit + save/refresh unit context + evaluator semantics unchanged**, RLS, cleanup) | ya |
| `npm run test:ppm`       | aggregate: M1 → M1.1 → M2 → M3 → M3.1 → render-smoke → M4 → M4.5A → M4.5A.1 (571) | ya |

## Requirement environment
1. Salin `.env.example` → `.env.local`.
2. Isi `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (public).
3. Isi `SUPABASE_SERVICE_KEY` (service_role) + `SUPABASE_ANON_KEY` (publishable)
   untuk keperluan DB + RLS test.
4. `.env.local` adalah **gitignored** — tidak pernah commit.

### Tanpa key
Script akan **abort dengan pesan jelas** (`assertServiceKey()`) dan `exit(1)`.
Jangan biarkan test crash ambigu atau — yang jauh lebih buruk — menggunakan
key yang di-hardcode.

## Test data safety (KRITIS — jangan direvisi)
- Setiap run memakai `TEST_RUN_ID` unik (`__TEST_M1__`, `__TEST_M1_1__`,
  `__TEST_M2__`).
- Cleanup hanya berdasarkan **created ID + marker sweep** — **TIDAK** berdasarkan
  nama bisnis nyata.
- ✅ diizinkan: `WHERE item_name LIKE '%__TEST_M2__%'`
- ❌ dilarang: delete by `"Kemeja ERT"`, `"Celana ERT"`, nomor PO produksi,
  pelanggan `PT WIKA` / `PT AKP`, atau nama apa pun di luar marker.

## Hasil terakhir (verified)
- M1: 48 PASS / 0 FAIL
- M1.1: 40 PASS / 0 FAIL
- M2 + M2.1 + M2.2: 68 + 31 → (`node scripts/test-ppm-m2.js` melaporkan
  68 = 12 M2.1 + 56 M2 core; M2.2 31 PASS dilaporkan terpisah)
- M3: 46 PASS / 0 FAIL
- M3.1: 70 PASS / 0 FAIL
- M3.1 render-smoke (SSR): 12 PASS / 0 FAIL
- M3.1 fit/fullscreen + resize-preserve (pure geometry): 17 PASS / 0 FAIL (dijalankan terpisah)
- Browser harness (Playwright, Chromium): 21 PASS / 0 FAIL
- M4: 65 PASS / 0 FAIL (pure helpers via import + DB contract via REST service key)
- Aggregate `npm run test:ppm`: 571 PASS / 0 FAIL (48+40+68+46+70+12+97+123+67)
- Build: PASS
- **M4 corrective patch (2026-08-12): M4 97 PASS / 0 FAIL; aggregate 381 PASS / 0
  FAIL (48+40+68+46+70+12+97); build PASS** — lihat M4_REPORT.md Verification.
- **M4 CORRECTIVE PATCH (2026-08-12):**
  - **False-pass dikoreksi** — test evidence lama memakai kolom salah
    (`position_x/position_y`) → menguji `id=eq.undefined` → PASS palsu. Kini
    memakai schema aktual (`x_percent/y_percent`) + setup invariant `mustCreate()`
    (insert WAJIB berhasil; gagal → SEGERA FAIL + abort). Tidak ada query
    `id=eq.undefined`.
  - **Evidence immutability DB-level** — migration additive
    `202608120001_ppm_m4_evidence_immutability.sql` + runner
    `scripts/run-ppm-m4-evidence-migration.js`. Trigger blok UPDATE/DELETE note
    yang direferensikan `ppm_spec_change_proposals.annotation_note_id` (semua
    status proposal), error token `PPM_NOTE_REFERENCED_AS_SPEC_EVIDENCE`.
    Diuji via REST langsung (A: PROPOSED UPDATE, B: DEFERRED UPDATE,
    C: APPROVED UPDATE, D: REJECTED UPDATE, E: DELETE, F: unrelated UPDATE,
    G: unrelated DELETE, H: note asli tidak berubah, I: proposal utuh).
  - **Bulk guard DEFERRED** — `hasUnreconciledProposalsForComponent` dihapus
    (tidak ada call-site / bulk action aktif di UI).
  - **Rerun DB regression (2026-08-12) — SELESAI & HIJAU:**
    migration `202608120001` applied (`run-ppm-m4-evidence-migration.js` →
    204; rilis pertama 400 "cannot use subquery in trigger WHEN condition" →
    migration dikoreksi: cek dipindah ke body fungsi, WHEN dihapus) → structural
    verify PASS (`verify-ppm-m4-evidence-migration.js`: function +
    trigger update + trigger delete + index idx_pmscp_note terbukti di DB) →
    `npm run test:ppm:m4` **97 PASS / 0 FAIL** → aggregate `npm run test:ppm`
    **381 PASS / 0 FAIL** (48+40+68+46+70+12+97) → `npm run build` **PASS**.
- **M4.5A (2026-08-12):**
  - Migration `202608120002_ppm_m45a_spec_templates.sql` applied
    (`run-ppm-m45a-migration.js` → 204) + structural verify PASS
    (`verify-ppm-m45a-migration.js`: 5 tabel + 5 unique index + RLS + 10 policies
    + seed KEMEJA_LAPANGAN/KEMEJA_KANTOR + legacy KEMEJA tetap).
  - **Bug NULL-trap ditemukan saat test & diperbaiki:** draft index memakai pola
    M1.1 `(location_label IS NULL), location_label` — PostgreSQL menganggap NULL
    berbeda sehingga duplicate komponen lokasi NULL lolos (test 7a FAIL).
    Diganti `COALESCE(location_label,'')` di 2 index komponen; diterapkan ulang
    ke DB (tabel baru, kosong); test 7a hijau.
  - `npm run test:ppm:m4.5a` **62 PASS / 0 FAIL** (DB contract via REST service
    key: template/standard CRUD, NULL-safe uniqueness std+custom (NULL location
    & NULL def), DEFAULT vs STANDARD terpisah, standard_id link, RLS anon
    write/read, pure helpers P1–P6 via import langsung).
  - Aggregate `npm run test:ppm` **443 PASS / 0 FAIL** (48+40+68+46+70+12+97+62)
    → `npm run build` **PASS**.
  - **M4.5A manual-verification bugfix (2026-08-12):** dropdown spec kini
    contextual ke component aktif. Root cause: fallback `(defOptions.length ?
    defOptions : specDefs)` di PPMSpecTemplatesPage — SCOTCHLIGHT (0 def di
    master) menampilkan spec semua komponen. Fallback dihapus; pure helper
    `defsForComponent` + `specsAfterComponentChange` (clear incompatible spec
    saat ganti component). `test:ppm:m4.5a` **79 PASS / 0 FAIL**; aggregate
    **460 PASS / 0 FAIL** (48+40+68+46+70+12+97+79) → build PASS.
  - **M4.5A seed master APPROVED user (2026-08-12):** `202608120003` applied —
    SCOTCHLIGHT ×4 (JENIS/LEBAR/POSISI/STITCH_SCOTCHLIGHT) + LEBAR_MANSET,
    idempotent `ON CONFLICT DO NOTHING`, pola M2. `test:ppm:m4.5a` **88 PASS /
    0 FAIL**; aggregate **469 PASS / 0 FAIL** (48+40+68+46+70+12+97+88) →
    build PASS.
- **M4.5A WIKA master patch (2026-08-13):**
  - Migration `202608130001_ppm_wika_master_patch.sql` applied — **5 komponen**
    (Badan Depan, Lengan, Kerah, Manset, Cuff) + **18 spec definitions**,
    idempotent `ON CONFLICT DO NOTHING`, TANPA nilai WIKA (isi manual via
    context-aware picker). `test:ppm:m4.5a` **123 PASS / 0 FAIL**; aggregate
    **536 PASS / 0 FAIL** (48+40+68+46+70+12+97+123) → build PASS.
- **M4.5A.1 (2026-08-13):**
  - Migration `202608130002_ppm_m45a1_conditional_standards.sql` applied
    (`run-ppm-m4.5a.1-migration.js` → 204) + structural verify PASS
    (`verify-ppm-m4.5a.1-migration.js`: tabel rules + unique index kondisi +
    trigger konsistensi + RLS policies).
  - `npm run test:ppm:m4.5a.1` **67 PASS / 0 FAIL** (DB contract via REST
    service key + evaluator murni via import; **unit suffix bugfix**: suffix
    unit dari snapshot `default_unit` via `ruleUnitLabel`, TANPA hardcode).
    Aggregate `npm run test:ppm`
    **571 PASS / 0 FAIL** (48+40+68+46+70+12+97+123+67) → `npm run build`
    **PASS**. Simple Standard (FIXED) tetap didukung — BUKAN rule engine.
  - **LOCKED (user-accepted 2026-08-13):** manual verification user PASS —
    contextual picker; unit inch/cm; template persistence Edit→Save→Refresh;
    duplicate + contradictory rule protection; conditional standard
    1 inch→Single Stitch / 2 inch→Double Stitch.
- **Re-verified 2026-08-10** setelah patch M3 sesi ini (connector halo + pin
  contrast border putih solid di `AnnotationCanvas.jsx`; meeting-mode "Lihat Detail
  PO" section-order CSS di `PPMPoDetailPage.jsx` + `index.css`; meeting side-by-side
  Component Explorer + quick-add pin per komponen via tab "Komponen" di
  `AnnotationSidebar.jsx` + prop `defaultComponentId` di `AnnotationPinDrawer.jsx`
  + state `pendingPinComponentId`/handler `handleQuickAddPin` di
  `PPMPoDetailPage.jsx`): aggregate 284 PASS / 0 FAIL + SSR render 12 PASS / 0 FAIL
  + build PASS — tanpa regressi. Detail per-fix di
  `docs/ppm/milestones/M3_1_REPORT.md` (PENDING user final visual verification).
- **Re-verified 2026-08-10** setelah patch M3 FINAL MEETING UX — Product Discussion
  Flow: dua sub-state meeting (Product Selection / Product Discussion) + component
  rail + tab "Diskusi" sidebar + Order Overview entry. NEW `ComponentDiscussionContent.jsx`
  + `MeetingProductFlow.jsx` (presentational pure); PATCH `AnnotationSidebar.jsx`
  (tab Diskusi + props discussionItem/discussionComponentId/onTechnicalReview),
  `PPMPoDetailPage.jsx` (state discussionItemId/discussionComponentId + 7 handler
  reuse handleShowComponentPins/focusRequest fail-safe + wiring MeetingProductFlow +
  meetingLayoutClass + sidebar wiring), `index.css` (order/height scoped
  `.m-meeting-select`/`.m-meeting-discuss` + display:none m-sec-review/m-sec-products
  di meeting). Viewer internals TIDAK diubah (Overview=Fit via focusRequest fail-safe
  engine). Aggregate 284 PASS / 0 FAIL + build PASS (1493 modules) — tanpa regressi.
  Detail per-fix di `docs/ppm/milestones/M3_1_REPORT.md` (test row S; PENDING user
  final visual verification).
- **Re-verified 2026-08-10** setelah M3 Meeting UX **MICRO-POLISH** (visual/copy/
  density only — no architecture/flow/viewer/DB change): hapus duplicate PO summary
  card (single Order Context = meeting-header strip + Total qty badge), Product
  Selection/Discussion header density, component rail pin count → badge dgn tooltip
  "X pin", panel Diskusi eyebrow "Pembahasan Komponen"/"Overview Produk", hapus copy
  "no spec" → `—`, Kelola → subtle secondary, space-y-3. PATCH `MeetingProductFlow.jsx`
  (drop dead props po/poReview/totalPins + import formatDateLongID), `ComponentDiscussionContent.jsx`,
  `PPMPoDetailPage.jsx` (totalQty + drop 3 dead props dari MeetingProductFlow call).
  Aggregate 284 PASS / 0 FAIL + build PASS — tanpa regressi. Detail per-fix di
  `docs/ppm/milestones/M3_1_REPORT.md` (test row T; PENDING user final visual verification).
- **Re-verified 2026-08-10** setelah implementasi **M4 — Decision ↔ Technical
  Specification Reconciliation** (additive proposal layer `ppm_spec_change_proposals`):
  NEW `src/lib/ppm-m4-specs.js` (pure) + `src/lib/ppm-m4-helpers.js` (DB, APPLY reuse
  `resolveSpecification` — NO new spec-mutation path, NO RPC) + `SpecValueInput.jsx`
  (pure typed input) + `SpecReconciliationModal.jsx` (create + review + kartu konflik +
  3-way actions); PATCH additive optional props `FloatingPinCard.jsx` (badge compact,
  NO big form), `ComponentDiscussionContent.jsx` (per-spec sub-row), `AnnotationSidebar.jsx`,
  `MeetingProductFlow.jsx`, `AnnotationCanvas.jsx` (pure pass-through `onProposeSpecChange`,
  viewer engine untouched), `PPMPoDetailPage.jsx` (proposal fetch/enrich + 7 handler +
  mount modal). Migration `202608100002_ppm_m4_spec_change_proposals.sql` additive (no
  DROP, no destructive ALTER, no enum change). Domain proposal status terpisah dari
  spec `review_status` & annotation `status`. Stale protection (baseline snapshot +
  conflict + force + rebase) + idempotency (`WHERE status IN (PROPOSED,DEFERRED)`).
  `npm run test:ppm:m4` 65 PASS / 0 FAIL; aggregate `npm run test:ppm` **349 PASS / 0
  FAIL**; `build` **PASS** (1497 modules) — tanpa regressi M1–M3. Detail di
  `docs/ppm/milestones/M4_REPORT.md` + ADR-026. PENDING user verification (NO LOCK M4).
- **Re-verified 2026-08-11** setelah patch M3 **EDIT CATATAN PIN** (fitur yang sebelumnya
  hilang: catatan pin hanya bisa dibuat/dihapus, belum bisa diubah). PATCH `src/lib/ppm-m3-helpers.js`
  (NEW `updateNote(noteId, {note_text, note_type})` — validasi sama dgn addNoteToAnnotation:
  blank-check + normalize; note_type opsional), `src/components/ppm/AnnotationPinDrawer.jsx`
  (state edit `editingNoteId`/`editNoteText`/`editNoteType` + reset di open useEffect +
  3 handler `handleStartEditNote`/`handleSaveEditNote`/`handleCancelEditNote` + tombol Pencil
  inline + form edit textarea/jenis/Save-Cancel mengikuti pola form Tambah Catatan). **TIDAK
  ada migration** — RLS UPDATE policy pada `ppm_annotation_notes` sudah ada (creator meeting /
  super_admin, sama dgn delete). Additive only (NO DROP/RENAME, NO viewer/DB/RLS change).
  Aggregate `npm run test:ppm` **349 PASS / 0 FAIL** + `build` **PASS** — tanpa regressi.
  PENDING user final visual verification (NO commit/push, NO auto-LOCK).
- Manual responsive browser (Chrome emulation): M1–M2.2 PASS; M3/M3.1
  **PASS pada harness komponen asli** (`scripts/test-m31-browser.py`).
- **USER ACCEPTANCE — 2026-08-10:** User mereview visual current M3 (Annotation
  & Component Discussion + Meeting Product Discussion Flow + micro-polish) pada
  monitor/browser dan menyatakan *"M3 untuk sementara cukup, lanjut berikutnya."*
  → **M3 family (M3 / M3.1 / M3.2) LOCKED.** Penerimaan ini = review visual user
  pada monitor/browser biasa, BUKAN perangkat fisik.
- Physical HP device: **DEFERRED** (belum diuji di perangkat fisik — tunggu
  staging/Vercel).
- Physical projector test: **DEFERRED** (user review pada monitor biasa, bukan
  proyektor fisik).

## Browser / manual testing
- Gunakan Chrome DevTools responsive → mobile 375px.
- Skenario wajib lihat di `docs/ppm/milestones/M2_2_REPORT.md` ("Manual
  responsive browser: PASS").
- Jika AI tidak dapat membuka browser, laporkan **NOT TESTED** — jangan claim
  PASS.

## Build
```bash
npm run build
```
Harus lulus tanpa error (Vite). Jangan abaikan warning "chunks larger than
500 kB" — itu *warning*, bukan failure.

## Regresi
Setiap milestone baru — termasuk M2.2 — **wajib lolaskan regressi M1, M1.1, M2
sebelum LOCKED**. `npm run test:ppm` adalah regression gabungan.
