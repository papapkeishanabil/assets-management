# M3 — Annotation & Component Discussion (LOCKED)

## Status
**LOCKED** (user-accepted 2026-08-10). Regression 284 PASS / 0 FAIL + build PASS.
Viewer baseline dikunci — jangan refactor tanpa bug report / requirement user
eksplisit / integration requirement milestone baru.

## Ringkasan (devangka)
- **Annotation menempel pada gambar dokumen PO** dengan konteks hierarki
  `Product Item → Component → (optional) Technical Specification`.
- **Pin = posisi visual + konteks; Notes = isi diskusi.** Satu pin boleh
  punya BANYAK notes (FLAT, bukan nested reply).
- **Koordinat relative `x_percent`/`y_percent` (0–100, DB CHECK)** — tahan
  resize / desktop / proyektor / responsive mobile. Bukan pixel absolut.
- **`note_type`**: `DISCUSSION | DECISION | INFO`. Decision note hanya
  annotation note — **TIDAK mengubah `ppm_component_specifications`**
  (M2.2 tetap LOCKED). Integration Annotation Decision → Technical
  Specification ditentukan setelah UX annotation stabil.
- **Multi-pin pada komponen yang sama VALID** (tanpa unique constraint pada
  `item_component_id`).
- **Pin number unik per scope dokumen/page PO** (partial unique index dengan
  COALESCE sentinel untuk `po_document_id`/`page_number` yang nullable).
- **Rangkuman Komponen**: group live dari query (item → komponen → pin →
  notes), decision tampil lebih menonjol, TANPA table recap baru.
- **Drag pin**: desktop pointer / touch-hold; persist hanya saat drag END;
  rollback visual + toast error jika save gagal; `touch-action:none` hanya
  pada elemen pin.
- **TIDAK ada realtime / mention / attachment / nested reply / Canva / PO
  correction** di M3.

## M3.1 — Annotation UX Extension (implemented, bagian dari M3)

Detail lengkap di `docs/ppm/milestones/M3_1_REPORT.md`. Inti:
- **Annotation Viewer** — smart viewer: Fit-to-PO (contain), zoom/pan, toolbar,
  fullscreen workspace, Mini Map.
- **ComponentPicker** — assign komponen ke pin; add komponen dari Library /
  custom langsung dari annotation.
- **Smart focus** — single pin zoom center; multi-pin bbox focus.
- **Multi-pin floating cards** non-overlap + **curved connector**.
- **AnnotationRegisterModal** — register pin per PO.
- **Right sidebar** Daftar Pin / Rangkuman (desktop).
- **Mobile bottom sheet** di bawah 640px.
- **Pure helpers** `ppm-m31-specs.js`/`ppm-m31-helpers.js`.

## Manual Browser Bug — BLANK/Black viewer on pin selection (FIXED)

**Report user:** klik pin → viewer/page blank/hitam; "Tampilkan Semua Pin
Kerah" → blank. Automated regression tetap PASS & build PASS — bug ini
hanya muncul di runtime browser.

### Root cause (exact)
`src/components/ppm/FloatingPinCard.jsx` memakai identifier `NOTE_TYPE_COLORS`
yang **tidak di-import** (dead variable) → `ReferenceError` saat render kartu
pertama → React unmount seluruh component tree → blank/hitam. Vite build
tidak menangkap ini.

### Fix
1. Hapus baris dead `decisionBadge`.
2. Fail-safe focus di `AnnotationCanvas.jsx`: validasi `Number.isFinite` pada
   transform sebelum apply; jika invalid → fallback Fit-to-PO (viewer tidak
   pernah blank).
3. `setPointerCapture` pan tidak dimulai pada elemen interaktif
   (`[data-pin], button, a, input, select, label`) — tombol zoom/fit di
   dalam viewer kembali berfungsi.

### Regression baru
- `scripts/test-ppm-m31-render.js` — SSR smoke (esbuild + react-dom/server).
  **Terbukti menangkap bug ini**.
- `scripts/test-m31-browser.py` + harness `dev-viewer-test.html/jsx` —
  real-browser test (Chromium via Playwright) terhadap komponen asli.

### Manual retest (real browser, Playwright Chromium)
21/21 PASS (hasil lama; harness tidak dijalankan ulang saat handoff ini).
Halaman PO asli yang butuh auth masih **NOT TESTED** manual.

## Fullscreen Viewer Bugfix (sesi ini — PENDING USER VERIFICATION)

**Issue:** saat viewer di-expand/fullscreen, gambar PO ikut membentang
(`max-h-[70vh]`/`max-h-full` di class `<img>` + tinggi container 70vh),
dan side panel turun ke bawah card — bukan workspace layout utuh.

### Fix
- `AnnotationCanvas.jsx`: `<img>` lepas dari pembatasan max-h; `viewer-root`
  inline height `70vh` hanya untuk mode normal.
- `ppm-m31-specs.js`: refactor jadi `computeFitTransform(world, viewport,
  focusPoint, prevTransform)` + ekspor `computeFitScale`; container resize
  (masuk/keluar fullscreen) → fit **dihitung ulang** terhadap dimensi baru,
  bukan reuse pixel; mode focus mempertahankan world center saat resize.
- `src/index.css`: class `.annotation-workspace-active` — workspace utuh
  (toolbar + viewer + right panel) mengisi monitor; fallback tanpa Fullscreen
  API; sidebar `position: static` saat fullscreen.
- Test baru `scripts/test-ppm-m31-fit.js` (pure geometry): 9 PASS / 0 FAIL.

## Floating Annotation Card Visual Fix — dark surface (sesi ini — PENDING USER VERIFICATION)

**Issue (report user):** di app theme LIGHT, floating summary card ikut
menjadi light/putih karena memakai token yang ter-invert di Light theme
(`bg-ink-900/40`, `text-white` → navy, `text-ink-400/300`, `border-white/20`).

### Fix
- **Dedicated overlay palette** di `index.css` (`annotation-card*`) —
  terisolasi, tidak memakai `.card`/`.glass`/`bg-card`/`text-foreground`/
  token `ink`/`white`. Card SELALU dark di kedua theme.
- **Transparan (frosted glass)**: alpha ~0.55–0.62 + `backdrop-blur(18px)
  saturate(160%)` sesuai permintaan user.
- **Teks dipertegas** agar terbaca di atas kartu transparan: `sub #cbd5e1`,
  `faint #94a3b8`, `body #f1f5f9`, link #93c5fd.
- **Connector** dipertegas agar terlihat di Light theme: gradient
  `#3b82f6→#818cf8`, stroke 2.5px, glow opacity 0.35.
- **Pin RESOLVED** diubah dari abu-abu → biru tua `primary-800` (target
  Pin=BIRU).
- **TIDAK mengubah** DB, business logic, RLS, zoom, koordinat pin, notes,
  Technical Review, atau global theme.

> Detail + skenario manual TEST A–D: `M3_1_REPORT.md`.

## Test (verified — hasil aktual 2026-08-09)
- `npm run test:ppm:m3` → **46 PASS / 0 FAIL**.
- `npm run test:ppm:m3.1` → **70 PASS / 0 FAIL**.
- `npm run test:ppm:m3.1:render` → **12 PASS / 0 FAIL** (SSR smoke render).
- `npm run test:ppm:m3.1:fit` → **9 PASS / 0 FAIL** (pure fit/fullscreen; terpisah).
- Aggregate `npm run test:ppm` → **284 PASS / 0 FAIL** (48+40+68+46+70+12).
- Build → **PASS** (`vite build`, ~1491 modules).
- Browser harness (Playwright): 21 PASS / 0 FAIL (hasil lama).
- Manual responsive browser: M1–M2.2 PASS; M3/M3.1 **PASS pada harness**;
  halaman PO asli (auth) **NOT TESTED**.

## Files
- `supabase/migrations/202608080006_ppm_m3_annotations.sql`
- `src/lib/ppm-m3-specs.js`, `src/lib/ppm-m3-helpers.js`
- `src/lib/ppm-m31-specs.js`, `src/lib/ppm-m31-helpers.js`
- `src/components/ppm/` — `AnnotationCanvas.jsx`, `AnnotationPinDrawer.jsx`,
  `AnnotationRegisterModal.jsx`, `AnnotationSidebar.jsx`, `ComponentPicker.jsx`,
  `FloatingPinCard.jsx`, `MiniMap.jsx`, `MobilePinSummarySheet.jsx`
- `src/contexts/MeetingFocusContext.jsx`
- `src/pages/PPMPoDetailPage.jsx`, `src/pages/PPMMeetingRoomPage.jsx`,
  `src/components/layout/MainLayout.jsx`, `src/App.jsx`, `src/index.css`
- `scripts/` — `run-ppm-m3-migration.js`, `test-ppm-m3.js`, `test-ppm-m31.js`,
  `test-ppm-m31-render.js`, `test-ppm-m31-fit.js`, `test-m31-browser.py`
- `dev-viewer-test.html` / `dev-viewer-test.jsx` (dev harness)
- `package.json` (script test m3/m3.1/render/fit/agregat)

## Manual browser scenario (belum diverifikasi pada halaman asli)
A. Buka PO → item → gambar depan → `Tambah Pin` → klik area kerah →
   Component=Kerah → note "Bagian dalam kerah navy" → Save → **Pin #1** muncul.
B. Pin kedua area kerah lain, Component=Kerah → **Pin #2**.
C. Rangkuman Komponen → `KERAH 2 pin 2 catatan`.
D. Drag Pin #1 → refresh → posisi persistent.
E. Tambah note kedua Pin #1 → refresh → persist.
F. Hide/Show pins.
G. Chrome responsive 375px.
H. Console tanpa error baru.

### M3.1 (belum diverifikasi)
I. Hover pin → card menunjukkan component + decision prominent; connector
   arrow menempel pada tepi kartu yang menghadap pin.
J. Click pin → card ter-focus (zoom ~1.75x, pin di tengah); click area kosong
   → kembali ke fit.
K. `Lihat Register` → modal register: filter bekerja; klik row pin → focus.
L. Rangkuman Komponen → "Lihat N Pin" → viewer filter komponen + bbox focus.
M. Mobile 375px: bottom sheet, pan/zoom tetap jalan.
N. `+ Komponen Baru` dari drawer → custom component langsung di-assign ke pin.
O. **Fullscreen viewer** — masuk/keluar fullscreen, fit recompute, side panel
   sejajar, gambar tidak stretched.
P. **Floating card dark di Light theme** (TEST A–D di M3_1_REPORT).

## Known Limitations (M3)
- Annotation hanya untuk dokumen **gambar** (jpg/jpeg/png). Dokumen PDF
  dirender sebagai iframe tanpa pin (belum ada page renderer).
- Filter pin per komponen memakai komponen item **aktif**; jika belum ada item
  di-expand, hanya "Semua Pin".
- `po_document_id` / `page_number` sudah ada di schema tapi null (belum ada
  viewer multi-page).
- Penghapusan/renumber pin tidak otomatis menomori ulang.

## Outstanding UX Issues (harus diverifikasi user)
1. Floating card dark + transparansi + keterbacaan teks abu (Light theme).
2. Connector visibility di Light theme.
3. Fullscreen viewer (fit, layout, side panel).
4. Pin RESOLVED biru vs OPEN.
5. Meeting Focus Mode (sidebar hidden saat IN_PROGRESS).
