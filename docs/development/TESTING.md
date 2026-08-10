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
| `npm run test:ppm`       | aggregate: M1 → M1.1 → M2 → M3 → M3.1 → render-smoke (284) | ya |

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
- Aggregate `npm run test:ppm`: 284 PASS / 0 FAIL (48+40+68+46+70+12)
- Build: PASS
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
