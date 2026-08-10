# M3.1 — Annotation UX Extension (LOCKED)

## Status
**LOCKED** (user-accepted 2026-08-10) — bagian dari M3 family. Regression
284 PASS / 0 FAIL + build PASS. Detail M3 inti: `docs/ppm/milestones/M3_REPORT.md`.

## Lingkup M3.1
Semua UX/viewer/frontend — **TIDAK ada migration baru** (schema M1 + M3).

1. **Annotation Viewer (smart viewer)**
   - Fit-to-PO default (contain, seluruh gambar terlihat, aspect ratio dijaga).
   - Zoom/pan: wheel (cursor-center), tombol +/−, drag pan, Fit ke PO.
   - Toolbar overlay: Fit ke PO | − | % | + | Fullscreen | Tampilkan Semua | Tambah Pin.
   - Pin dirender di **layer layar** (tidak di-scale dengan gambar) — nomor selalu terbaca.
2. **Add Component dari Annotation**
   - ComponentPicker: search Component Library + filter by item.
   - Dari Library → `createItemComponent` + clone standard specs (M1/M2 mechanism).
   - Custom → `is_custom=true`, `component_definition_id=null` — **TIDAK** promote ke master.
3. **Smart Zoom / Focus**
   - Single pin: zoom `DEFAULT_FOCUS_ZOOM` (1.75x), pin di center viewer.
   - Multi-pin: bounding box + margin (`BBOX_CARD_MARGIN` 0.24, scale factor 0.85) → semua pin + kartu terlihat.
   - Fail-safe: transform selalu divalidasi `Number.isFinite` → fallback Fit (viewer tidak pernah blank).
4. **Multi-pin selection + floating cards**
   - Collision-free layout (8 candidate placement + nudge ke nearest free slot).
   - Kartu digeser, **pin tidak**; kartu tidak menutupi zona proteksi pin / mini map.
   - Expanded card di tempat (Detail → / Tutup Detail), clamp dalam viewer.
5. **Curved connector**
   - SVG cubic bezier card→pin, anchor di tepi kartu yang menghadap pin.
   - Marker arrow + glow; warna biru tegas (`#3b82f6→#818cf8`).
6. **Mini Map**
   - Thumbnail full image (left-bottom), viewport rectangle indicator, klik → navigasi.
   - Exclusion zone: kartu floating tidak menutupi mini map.
7. **Daftar Pin / Rangkuman (right sidebar desktop)**
   - Tab [Daftar Pin]: filter komponen + status, group per komponen, klik pin → focus.
   - Tab [Rangkuman]: register group per komponen, decision prominent.
8. **Annotation Register (modal)**
   - Filter item/komponen/status/Has Decision; statistik per item & komponen.
9. **Mobile bottom sheet**
   - <640px: tap pin → bottom sheet (multi-pin per komponen terurut); floating cards tidak dirender.
10. **Fullscreen viewer (bugfix)**
    - Workspace utuh (toolbar + viewer + right panel), bukan hanya image.
    - Fit scale dihitung ulang terhadap dimensi container baru; exit kembali persis.
    - **Re-measure eksplisit saat `expanded` toggle** (follow-up 2026-08-10): ResizeObserver
      pada viewer-root tidak reliabel mem-fire saat transisi `:fullscreen` (race animasi/layout
      OS) sehingga transform bisa stagnan pakai skala mode normal → gambar PO tampak kecil di
      tengah dengan margin hitam semua sisi. Fix: `useEffect` di `AnnotationCanvas` memanggil
      `measure()` (segera + rAF + timeout 120/300ms) saat `expanded` berubah. Pure geometry
      (`computeFitTransform`) tidak berubah; 9 test `:fit` tetap PASS.
11. **Meeting Focus Mode**
    - `MeetingFocusContext`: meeting IN_PROGRESS → sidebar aplikasi hidden, halaman lebar penuh.
    - Status DB = source of truth; persist `sessionStorage`; otomatis berakhir saat status berubah.
    - Tombol Mulai / Selesaikan / Buka Kembali di `PPMMeetingRoomPage` (creator/super_admin).
12. **Floating summary card = dark contextual surface (visual fix)**
    - Dedicated palette `annotation-card*` di `index.css` — selalu dark di kedua theme.
    - Near-opaque charcoal overlay (~#111827, alpha ~0.93–0.95, blur 18px) — M3 polish:
      projector-readable premium dark surface (sebelumnya frosted alpha ~0.55–0.62).
    - Teks dipertegas agar terbaca; status chip tetap berwarna aksen (OPEN amber, RESOLVED green, DISCUSSION blue, DECISION green).
    - Detail panel / sidebar / mobile bottom sheet **tetap mengikuti theme aplikasi**.

## Automated test (hasil aktual 2026-08-09)
- `npm run test:ppm:m3.1` → **70 PASS / 0 FAIL**
  (pure: fit/focus/bbox/clamp/card layout/connector/mini-map/register/grouping/picker + DB: add component flow, annotation CRUD, regression M1/M1.1/M2/M3).
- `npm run test:ppm:m3.1:render` → **12 PASS / 0 FAIL** (SSR smoke semua komponen M3.1, termasuk canvas expanded/fullscreen).
- `npm run test:ppm:m3.1:fit` → **17 PASS / 0 FAIL** (fit scale normal vs fullscreen, recompute resize/exit, aspect preserved, pin & focus normalized stable, +8 §17 resize-preserve logical viewport: derive center, resolve after resize, preserve zoom ratio normal↔fullscreen, Fit mode recompute, manual≠Fit, finite guards).
- Build → **PASS**.
- Browser harness (Playwright): 21 PASS / 0 FAIL (hasil lama, tanpa auth).

## M3.2 — Hardening (small patches, sesi ini — PENDING USER FINAL VERIFICATION)

**Filosofi:** REUSE → INSPECT → PATCH → VERIFY. **Tidak ada rewrite, tidak ada
komponen V2.** Semua perubahan patch-level ke implementasi M3/M3.1 yang sudah ada.
Tidak ada migration, tidak ada perubahan schema/RLS/business logic/koordinat pin.

### MUST (3)
1. **AnnotationPinDrawer — guard NaN posisi.** `Posisi: ...%` view-mode kini
   pakai null-guard (sama pola dengan `FloatingPinCard.jsx`): `x_percent != null ?
   Number(...).toFixed(1) : '-'`. Menghilangkan `NaN%` / `0.0%` menyesatkan.
2. **MiniMap — `object-cover` → `object-contain`.** Thumbnail PO tidak lagi
   terpotong; rasio aspek dijaga (contain = letterbox, no crop/stretch).
3. **Expanded floating card — re-measure.** `activePinsKey` kini menyertakan
   `expandedCardId` sehingga saat kartu di-ekspansi/ciutkan, kartu diukur ulang
   (tinggi riil) sebelum layout+clamp — bukan tinggi stale versi ciut.

### SHOULD (diterapkan, semua minimal)
4. **`activePins` diurutkan stabil by `pin_number`** (invariant eksplisit;
   tahan terhadap perubahan urutan seleksi).
5. **Toolbar `z-40` → `z-50`** (di atas pin terpilih `z-40` agar pin di tepi atas
   tidak menutupi tombol toolbar).
6. **`setAnnotationStatus` strict** — throw pada status invalid (sebelumnya
   memaksa menjadi OPEN diam-diam).
7. **`addComponentFromLibrary` tidak menelan error clone-spec** — re-throw agar
   caller (drawer) menampilkan toast + cleanup (sebelumnya hanya `console.error`).
8. **ComponentPicker — deteksi "sudah digunakan" utama by
   `component_definition_id`** (name dipertahankan sbg fallback, konsisten dengan
   helper `isLibraryComponentUsedByItem` yang diverifikasi test).
9. **MainLayout — re-validasi status meeting saat tab kembali visible/focus**
   (`focusTick` + listener `focus`/`visibilitychange`) — menutup celah desync
   tanpa Realtime/polling.
10. **Tuning konstanta multi-pin focus** ke starting point directive:
    `BBOX_CARD_MARGIN 0.24 → 0.30`, `BBOX_CARD_SCALE_FACTOR 0.85 → 0.78`
    (ruang ekstra utk kartu; **perlu konfirmasi visual TEST B/C**).
11. **Hapus dead `fetchAnnotations`** di `PPMPoDetailPage` (tidak pernah dipanggil;
    fetch aktual via `fetchPO` + `refreshAnnotations`).
12. **Hapus dead `import { supabase }`** di `ppm-m31-helpers.js` (tidak dipakai).

### FULLSCREEN PRESERVE LOGICAL VIEWPORT (koreksi requirement fullscreen, sesi ini)
13. **Bug sign di cabang preserve `measure()`** — root cause "fokus hilang saat
    fullscreen". Konvensi transform = `screen = tx + world*scale`; maka titik
    world di pusat viewport = `(viewerW/2 - tx)/scale`, **BUKAN**
    `(tx + viewerW/2)/scale`. Sign lama menyebabkan pusat viewport melompat ke
    titik world SALAH saat container resize (fullscreen enter/exit / window
    resize) → di mode manual/focus, area yang dilihat user bergeser jauh
    (pin bisa terlempar off-screen; bukan reset ke Fit, melainkan center salah).
    **Fixed** lewat ekstrak 4 pure functions di `ppm-m31-specs.js`
    (`logicalZoomRatio`, `deriveViewportCenter`,
    `resolveTransformPreservingCenter`, `resolveTransformOnResize`) + 8 pure
    test (§17). `measure()` kini memanggil `resolveTransformOnResize` (cabang
    inline yang bug dihapus). Perilaku benar: **Fit mode → recompute Fit utk
    container baru; manual/focus → PRESERVE image-space center + logical zoom
    ratio (TIDAK reset ke Fit).** Zoom indicator (`scale/fit`) sudah logical
    ratio → stabil normal↔fullscreen. Tidak ada rewrite, tidak ada viewer
    duplikat; transform model, smart focus, Mini Map, collision, kartu,
    connector, Fullscreen API tidak berubah.

### M3 FINAL VISUAL POLISH — MEETING WORKSPACE LAYOUT (sesi ini — PENDING USER FINAL VISUAL VERIFICATION)

**Filosofi:** PATCH, bukan rewrite. Semua perubahan layout di-gate pada
`meetingFocusActive === true` (meeting IN_PROGRESS). Non-meeting mode = pass-through
(tampil persis seperti sebelumnya). Tidak ada V2/komponen baru/migration/RLS/business logic.

1. **Meeting Workspace compaction (`PPMPoDetailPage`).** Saat meeting aktif:
   - **PO summary card** → compact `.meeting-strip` (deadline · review progress ·
     total pin · [Lihat detail PO]). Card penuh di-collapse default, expand via toggle.
   - **Technical Review** → header tetap (title + TOTAL badge) sebagai ringkasan;
     per-item list di-collapse default, toggle [Lihat]/[Sembunyikan].
   - **Product Items** → compact `.meeting-section-toggle` "Produk (N)" + [Kelola Produk];
     list + aksi per-item (Kelola Komponen / Tech Review / edit / delete / reorder) tetap
     utuh, hanya di-collapse default, expand via toggle. **Tidak ada fungsi yang hilang.**
   - Tujuan: Annotation Workspace tampil menonjol di atas tanpa scroll jauh.
2. **Konsolidasi kontrol (desktop).** Toolbar viewer = primary bar (Fit/-/%/+/Fullscreen/
   Layers/Tambah Pin). Duplikat di page header di-hide pada `lg:` — tombol **Tambah Pin**
   dan **Tampilkan Semua Pin** kini `lg:hidden` (desktop pakai toolbar). Tablet/mobile tetap
   pakai tombol page-header (entry point mereka). **Audit:** Daftar Pin (buka Register
   *modal*, bukan duplikat sidebar), Sembunyikan/Tampilkan Pin (tak ada di toolbar),
   Clear Selection (kontekstual) → tetap dipertahankan.
3. **Floating card near-opaque.** `.annotation-card` alpha 0.55–0.62 → ~0.93–0.95, base
   ~#111827; shadow diperkuat. Teks/border/chip tak berubah (sudah tuned untuk dark).
4. **Card↔pin distance.** `CARD.GAP 24 → 44` (target ~40–80px). Constant-only — collision
   engine (8 placement, nudge, clamp, scoring, protected/exclusion zone) tak diubah.
5. **Sidebar group bg.** `bg-black/20` (slab abu tebal) → `bg-white/[0.025]` (subtle).
6. **Meeting-layout CSS.** `.focus-meeting-active` → padding lebih ketat,
   `.annotation-workspace { min-height: 72vh }`, utility `.meeting-strip` / `.meeting-section-toggle`.
7. **Tidak diubah (preserve):** viewer width flex (~75-80%)/sidebar ~340px sudah in-range;
   MiniMap (sudah object-contain); connector (sudah blue-indigo); tema kontrak (card
   always-dark, workspace/sidebar/toolbar/minimap ikut theme); fullscreen/viewport/zoom/pan/
   smart focus/collision.

**Test (verified 2026-08-10):** `npm run test:ppm` aggregate **284 PASS / 0 FAIL**;
`test:ppm:m3.1:render` **12 PASS**; `build` **PASS**. Regresi penuh hijau.

### M3 FINAL MEETING MODE LAYOUT FIX — WORKSPACE FIRST-CLASS (sesi ini — PENDING USER FINAL VISUAL VERIFICATION)

**Root cause:** polish sesi sebelumnya **collapse** section admin tapi **tidak
me-reorder** — urutan DOM tetap `Header → PO summary → Review → Products →
Workspace`, sehingga workspace masih di bawah fold dan halaman meeting masih
terbaca sebagai halaman Detail PO admin. **Masalah = information hierarchy /
section order, bukan viewer engine.**

**Filosofi:** PATCH, bukan rewrite. Reorder **visual** via flexbox `order` pada
`.focus-meeting-active .page-container` (bukan pemindahan blok JSX). DOM/JSX
tidak berubah → node `.annotation-workspace` tetap mounted → state viewer
(zoom/pan/focus/selection) **tidak ter-reset** saat toggle meeting (§15
preserve). Non-meeting mode = pass-through penuh (admin layout tak berubah).
Tidak ada V2/komponen baru/migration/RLS/business logic.

1. **Meeting section reorder (`index.css`).** `.focus-meeting-active
   .page-container` kini `display:flex; flex-direction:column`. Tiap direct
   child diberi `order`:
   - `.m-sec-header` → **order 0** (compact meeting header)
   - `.annotation-workspace` → **order 1** (PRIMARY / hero)
   - `.m-sec-mobilerecap` → **order 2** (Rangkuman mobile, `<lg`)
   - `.m-sec-review` → **order 3** (Technical Review)
   - `.m-sec-products` → **order 4** (Product Items)
   - `.m-sec-podetail` → **order 5** (PO summary)
   - Modal (7: ProductItemModal, ComponentManagerModal, SpecificationManagerModal,
     TechnicalReviewModal, AnnotationPinDrawer, AnnotationRegisterModal,
     MobilePinSummarySheet) semuanya `if (!open) return null` saat tutup →
     nol node DOM → bukan flex item; saat buka → fixed-overlay → `order` tak
     berdampak. Aman.
   - **Urutan visual meeting:** COMPACT HEADER → **ANNOTATION WORKSPACE** →
     mobile recap → Technical Review → Produk → PO detail (sesuai spec).
2. **Compact meeting header (`PPMPoDetailPage`).** Header dijadikan ternary
   `meetingFocusActive ? <compact> : <full-admin>`. Compact = back link +
   `.meeting-strip` 1 baris: `PO# · Customer · [Meeting Aktif][N Produk]
   [Review X/Y][N Pin] · [Lihat Detail PO]`. Standalone strip lama
   **difold-in** ke compact header (tidak duplikat). Header admin penuh
   (h1 + status + item badge) **hanya mode non-meeting**.
3. **Workspace hero height.** `.focus-meeting-active .annotation-workspace`
   (dan `.annotation-workspace-card`) `min-height: calc(100vh - 8rem)` (dari
   `72vh`) — workspace mengisi viewport 1080p tanpa scroll; section sekunder
   di bawah fold. Tidak menyentuh width (~75-80% viewer / ~340px sidebar).
4. **Sekunder sections direndahkan visual.** `.m-sec-review/products/podetail`
   border `rgb(255 255 255 / 0.06)` + `box-shadow: none` di meeting mode —
   bukan kartu utama lagi (keterangan saja, expand via toggle).
5. **Marker classes minimal.** `m-sec-header/mobilerecap/review/products/
   podetail` ditambahkan sebagai class kedua pada card yang sudah ada (tidak
   ada wrapper div baru, tidak ada JSX block dipindah).

**Preserve (§15, tak diubah):** fullscreen (`position:fixed` saat expanded →
diambil dari flex flow, `order` tak berdampak), zoom/pan, focus preservation,
MiniMap, connector, floating cards, pin layout, viewer transform, smart focus,
collision engine, fullscreen re-measure. Admin mode (non-meeting):
`.page-container` tetap block layout (flex hanya saat `.focus-meeting-active`).

**Test (verified 2026-08-10):** `npm run test:ppm` aggregate **284 PASS / 0 FAIL**
(48+40+68+46+70+12); `build` **PASS** (1491 modules, EXIT 0). Regresi penuh hijau.

### M3 LIGHT THEME BADGE CONTRAST FIX (sesi ini — PENDING USER FINAL VISUAL VERIFICATION)

**Root cause:** token `ink-*`/`white` memakai CSS var → auto-invert via
`[data-theme="light"]`. Tapi palet `success/warning/danger/primary/orange/indigo`
di `tailwind.config.js` adalah **hex hardcode** → TIDAK invert. Akibatnya di Light
Theme, badge (`text-success-300`=`#6ee7b7`, `text-warning-300`=`#fcd34d`, dst.)
tetap pucat di atas permukaan app yang sudah terang → kontras jatuh. Terlihat pada
screenshot user: badge `Meeting Aktif`, `Review 3/3`, `Selesai` (hijau), `Terbuka`
(kuning) di strip meeting + sidebar.

**Fix = PATCH CSS scoped Light Theme (bukan rewrite, bukan sentuh JSX):**
- Override 6 kelas badge (`green/yellow/red/blue/orange/indigo`) di
  `[data-theme="light"]`: teks digolongkan ke `*-700` (gelap, terbaca di bg terang)
  + bg/border `*/15`/`*/30` (definisi lebih tegas). `badge-gray` tidak diubah
  (sudah theme-aware via token ink/white).
- **Pengecualian §0/§15:** badge yang sama muncul di dalam `.annotation-card`
  (FloatingPinCard — overlay SELALU gelap di kedua theme). Re-pin
  `.annotation-card .badge-*` ke nilai **SAMA PERSIS dengan base** (`*-300`) →
  nol delta di Dark Theme; hanya melindungi overlay dari override Light Theme.
- **Single source:** palet badge + varian tema co-located di satu blok `index.css`.

**Preserve (§15):** overlay `.annotation-card` (hardcoded rgb), fullscreen, zoom/pan,
focus preservation, MiniMap, connector, floating cards, pin layout, viewer transform.
Dark Theme: **nol perubahan visual** (override gated `[data-theme="light"]`; re-pin
overlay = nilai identik base).

**Test (verified 2026-08-10):** `npm run test:ppm` aggregate **70 PASS / 0 FAIL** +
SSR render smoke **12 PASS / 0 FAIL**; `build` **PASS** (1491 modules, CSS 83.38 kB,
EXIT 0). Pure CSS → tidak menggeser test behaviour. Regresi hijau.

**Known follow-up (DIRIKAU, belum dieksekusi — minimal-diff §17):** beberapa teks
warna langsung (bukan kelas badge) juga pucat di Light Theme pada permukaan terang —
`text-green-400`/`text-yellow-400`/`text-amber-400`/`text-orange-400` di
`AnnotationSidebar.jsx`, `TechnicalReviewModal.jsx`, `ProductItemModal.jsx`,
`SpecificationManagerModal.jsx`. (Yang di dalam overlay gelap — `FloatingPinCard`,
`AnnotationRegisterModal` — sudah benar, JANGAN diubah.) Menunggu konfirmasi user
sebelum menyentuh banyak file komponen.

### M3 TAMPILKAN SEMUA PIN — DESKTOP DISCOVERABILITY FIX (sesi ini — PENDING USER FINAL VISUAL VERIFICATION)

**Root cause:** konsolidasi sesi lalu (row K) memindahkan kontrol "Tampilkan Semua
Pin" & "Tambah Pin" ke top-bar viewer melayang (`AnnotationCanvas`) di desktop, dan
menyembunyikan versi ber-label di workspace toolbar via `lg:hidden`. Tapi tombol
"Tampilkan Semua" di top-bar viewer HANYA berupa **ikon Layers tanpa teks**
(`p-1.5 text-ink-300`), sedangkan saudaranya "Tambah Pin" ber-label teks. Akibatnya
di desktop tombolnya tak recognizable → user melaporkan "tombol tampilkan seluruh
pin tidak ada".

**Fix = PATCH presentasi 1 tombol (pilihan user: "Label di top-bar viewer"):**
- `AnnotationCanvas.jsx` tombol `onSelectAll` (ikon Layers) kini ber-label
  **"Tampilkan Semua"** + gaya disamakan dgn sibling "Tambah Pin"
  (`px-2 py-1 text-[11px] font-semibold inline-flex gap-1 text-ink-200 hover:text-white`,
  ikon `size={13}`). `aria-label` dihapus (teks visible kini jadi accessible name);
  `title` tooltip tetap.
- **Single source, tanpa redundansi** — workspace-toolbar labeled button tetap
  `lg:hidden` (tablet only) sesuai pola existing "Tambah Pin".

**Preserve (§15):** mesin viewer tak disentuh — fullscreen/zoom/pan/focus/
MiniMap/connector/floating cards/pin layout/viewer transform semua utuh. Hanya
label+style 1 tombol kontrol di top-bar.

**Test (verified 2026-08-10):** `npm run test:ppm` **70 PASS / 0 FAIL** + SSR render
smoke **12 PASS / 0 FAIL** (AnnotationCanvas desktop/mobile/fullscreen render OK);
`build` **PASS**. Regresi hijau.

### M3 CONNECTOR VISIBILITY — HALO + THICKER STROKE (sesi ini — PENDING USER FINAL VISUAL VERIFICATION)

**Symptom:** Dari 4 pin + floating card, hanya 1 connector yang jelas terlihat;
sisanya tidak terbaca jelas (di atas gambar PO terang, Light theme).

**Diagnosis (INSPECT — bukan rewrite):**
- Geometri `connectorPath()` BENAR: card ditempatkan `PIN_RADIUS(14)+GAP(44)` ≈ 58px
  dari center pin → connector efektif ~40-45px (card-edge → pin-edge, offset 14).
  Bukan degenerate; bukan nol-panjang.
- z-order BENAR: SVG connector `z-30` > card `z-20/z-25` → connector tidak di-occlude
  card; pin `z-30/40`. Tidak ada stacking-context bug.
- Collision engine BENAR: `PIN_SAFE_RADIUS=36` + `PIN_OVERLAP_PENALTY=1e6` menjaga
  kartu tidak menutupi zona pin (konfirmasi visual: kartu tidak menumpang pin).
- **Root cause = visibilitas visual lemah**, persis Outstanding UX Issue #3:
  stroke tipis `2.5px` + glow `opacity 0.35` + gradient biru-indigo di atas gambar
  PO terang → connector ~40px mudah "hilang" secara perseptual. Hanya yang paling
  favorabel posisinya terbaca "jelas".

**Fix (PATCH visual-only — §15/§0 aman):** tambah 1 layer `<path>` halo putih
(`#ffffff`, `strokeWidth 5.5`, `opacity 0.9`) DI BELAKANG stroke biru; perkuat
stroke utama `2.5 → 3`; glow `0.35 → 0.5`. Paint order: glow → halo putih → stroke
biru → anchor dots. Putih = kontras di background gelap; biru tebal = kontras di
background terang → universal di kedua theme & gambar PO apapun.

**PRESERVED (§15 — tidak disentuh):** geometri Bezier `connectorPath()`, mesin
collision `layoutFloatingCards`, `CARD.GAP/PIN_SAFE_RADIUS/PIN_CONNECTOR_OFFSET`,
layout kartu, z-order, anchor dots, marker arrow, MiniMap, floating cards, pin
layer, zoom/pan/focus. **FORBIDDEN tidak dilanggar** (tidak ada V2 / engine baru).
Murni presentational stroke styling — step PATCH pada workflow REUSE→INSPECT→PATCH.

**Test (verified 2026-08-10):** `npm run test:ppm` **70 PASS / 0 FAIL** + SSR
render smoke **12 PASS / 0 FAIL**; `build` **PASS**. Regresi hijau.

### M3 PIN CONTRAST — SOLID WHITE BORDER (sesi ini — PENDING USER FINAL VISUAL VERIFICATION)

**Symptom:** "Warna pin kurang kontras dengan background." Pin (biru `bg-primary-*`
hardcode hex, tidak auto-invert tema) terlihat menyatu/lemah di atas gambar PO
terang — terutama pin **biru gelap** (`primary-800`, status RESOLVED) yang menempel
di **kerah / cuff / trim biru-tua** PO → blend.

**Diagnosis (INSPECT — bukan rewrite):**
- Pin non-selected memakai `border border-white/30` (1px, opasitas 30%) dan
  `border-white/25` → **border putih terlalu tipis/samar** untuk memisahkan pin
  dari gambar PO. Tidak ada tepi tegas.
- Fill `bg-primary-600/90` & `bg-primary-800/90` → biru medium/gelap pada opasitas
  90% (sedikit tembus pandang) → kurang vivid di atas background sibuk.
- **Bukan** masalah model koordinat pin, layout, collision, atau z-order (semua
  dijaga §0/§15). Murni kelemahan tepi/kontras visual.

**Fix (PATCH visual-only — §15/§0 aman):** perkuat border pin jadi putih solid
`border-2 border-white` (status OPEN) / `border-2 border-white/70` (RESOLVED), dan
buang opasitas `/90` agar fill vivid. Paralel dengan filosofi halo connector:
tepian putih solid = kontras universal di background gelap (trim biru-tua) maupun
terang (body kuning). Pin SELECTED tidak diubah (sudah `ring-2 ring-white` + glow).
Murni presentational border styling — step PATCH pada workflow
REUSE→INSPECT→PATCH.

**PRESERVED (§0/§15 — tidak disentuh):** model koordinat pin (`x_percent`/`y_percent`),
pin layout/positioning, perilaku select/drag, z-order pin (`z-30/z-40`),
collision engine, multi-pin per komponen, ukuran pin (`h-6`). Hanya atribut
visual border/bg. **FORBIDDEN tidak dilanggar** (tidak ada V2).

**Diferensiasi status dipertahankan (justru lebih jelas):**
SELECTED = `primary-500` (paling terang) + `ring-2 ring-white` + glow ·
OPEN = `primary-600` + `border-2 border-white` (putih solid) ·
RESOLVED = `primary-800` (paling gelap) + `border-2 border-white/70`.

**Test (verified 2026-08-10):** `npm run test:ppm` aggregate **284 PASS / 0 FAIL**
(48+40+68+46+70+12) + SSR render smoke (incl. AnnotationCanvas desktop/mobile/
fullscreen) **12 PASS / 0 FAIL**; `build` **PASS**. Regresi hijau.

### M3 MEETING MODE — "LIHAT DETAIL PO" POSISI (sesi ini — PENDING USER FINAL VISUAL VERIFICATION)

**Symptom:** "Saat klik Lihat Detail PO, informasi PO muncul di bagian BAWAH
halaman, seharusnya di ATAS."

**Diagnosis (INSPECT — bukan rewrite):**
- Meeting mode me-reorder section via CSS flex `order` (`.focus-meeting-active
  .page-container` = flex column) supaya Annotation Workspace jadi HERO di atas.
- Urutan lama: `m-sec-header`(0) → `annotation-workspace`(1) → `m-sec-mobilerecap`(2)
  → `m-sec-review`(3) → `m-sec-products`(4) → **`m-sec-podetail`(5)**.
- Kartu PO detail (`m-sec-podetail`) HANYA dirender saat user klik "Lihat Detail PO"
  (guard `{(!meetingFocusActive || meetingSections.po) && ...}`). Tapi `order:5`
  menempatkannya paling bawah → user harus scroll melewati workspace `min-height:
  100vh-8rem` untuk membaca info PO = kontra-intuitif terhadap intent klik.
- **Bukan** bug mount/unmount, bukan bug state. Murni kebijakan urutan order yang
  tidak memperhitungkan "section sedang dibuka user secara eksplisit".

**Fix (PATCH §15-aman — CSS order, BUKAN JSX move):**
- Tambah conditional class `m-podetail-open` ke `page-container` saat
  `meetingFocusActive && meetingSections.po`.
- CSS (scoped `.focus-meeting-active .page-container.m-podetail-open`):
  `m-sec-podetail`→`order:1`, `annotation-workspace`→`order:2`, `m-sec-mobilerecap`
  →`order:3`, `m-sec-review`→`order:4`, `m-sec-products`→`order:5`.
- Hasil: kartu PO detail muncul tepat di bawah header (atas), workspace hero
  bergeser ke bawah SAAT detail dibuka. Toggle "Sembunyikan" hapus kelas →
  workspace kembali hero (order 1). Default (collapsed) tak berubah.

**PRESERVED (§15 — tidak disentuh):** mount-state node workspace (JSX struktur &
urutan DOM tak berubah → zoom/pan/focus/normalized-viewport TIDAK ter-reset saat
toggle), transform, fullscreen logic, urutan default meeting (workspace-first),
urutan admin mode (rule hanya berlaku saat `.focus-meeting-active`). Murni
presentational section-ordering via CSS — step PATCH pada workflow
REUSE→INSPECT→PATCH. **FORBIDDEN tidak dilanggar** (tidak ada V2 / engine baru).

**Test (verified 2026-08-10):** `npm run test:ppm` aggregate **284 PASS / 0 FAIL**
(48+40+68+46+70+12) + SSR render smoke **12 PASS / 0 FAIL**; `build` **PASS**.
Regresi hijau.

### M3 MEETING SIDE-BY-SIDE — COMPONENT EXPLORER + QUICK-ADD PIN (sesi ini — PENDING USER FINAL VISUAL VERIFICATION)

**Symptom:** Saat meeting membahas sebuah komponen (mis. kerah), sering muncul point
diskusi tambahan yang perlu di-pin di gambar. Alur lama: scroll naik ke workspace
→ klik "Tambah Pin" → klik gambar → **pilih lagi komponen kerah** di drawer =
friksi (scroll pulang-pergi + re-pick + gambar tak zoom ke area komponen).

**Diagnosis (INSPECT — bukan rewrite):**
- Workspace SUDAH 2-kolom di desktop ≥1024px: `annotation-workspace-inner`
  (`lg:flex`) → canvas card (`lg:flex-1`) + `AnnotationSidebar`
  (`lg:w-[340px]`, sticky, tab "Daftar Pin | Rangkuman").
- Maka "side-by-side" SUDAH tercapai di level workspace → **tidak perlu rewrite
  layout halaman / CSS grid page-container**. Cukup perkaya sidebar existing.
- Pin-creation state machine (`addPinMode` → klik gambar → `createPosition` →
  drawer) tidak punya konsep "komponen yg sedang dibahas" → drawer selalu reset
  `componentId=''`. Tidak ada pre-select.

**Fix (PATCH §0/§15/§17-aman — REUSE, bukan rewrite):**
1. `AnnotationSidebar.jsx` — **tab ke-3 "Komponen"** = Component Explorer ringkas:
   group by item (item aktif expand), tiap komponen = label + spec summary + badge
   jumlah pin + tombol **"Tambah Pin"**. Props baru: `onQuickAddPin(component)`,
   `compPinCounts`, `activeItemId`. Tab "Daftar Pin"/"Rangkuman" utuh. Ternary
   binary → 3-way conditional.
2. `AnnotationPinDrawer.jsx` — prop baru **`defaultComponentId`**; create-branch
   reset `setComponentId(defaultComponentId || '')` (bukan `''`). ComponentPicker
   sudah controlled → plumbing downstream sudah ada.
3. `PPMPoDetailPage.jsx` — state `pendingPinComponentId` + handler
   **`handleQuickAddPin(component)`**: cari owner item → `setExpandedItemId(owner)`
   (supaya `defaultItemId` cocok dgn komponen), `setPendingPinComponentId`,
   `setPinFilterComponentId` (filter canvas), `setFocusRequest(bbox)` (zoom ke
   area pin komponen via `pinIdsForComponent`), `setAddPinMode(true)`. Sidebar
   sudah di sebelah gambar → TANPA scroll. `initialTab="komponen"` di meeting.

**Alur hasil:** bahas kerah → klik "Tambah Pin" di baris kerah (sidebar, di
sebelah gambar) → gambar zoom ke area kerah + mode penempatan aktif → klik titik
di gambar → drawer buka dgn **kerah ter-pre-select** (item benar = owner item) →
ketik note → simpan. Tanpa scroll, tanpa re-pick komponen.

**PRESERVED (§15 — tidak disentuh):** AnnotationCanvas internals —
transform/zoom/pan/focus-engine/focus-preservation/MiniMap/connector/floating
cards/pin layout/viewer transform — semua utuh. `focusRequest` &
`pinIdsForComponent` dipakai apa adanya. **(§0):** reuse AnnotationSidebar
shell+tabs, AnnotationPinDrawer, ComponentPicker, AnnotationCanvas,
state-machine. Tidak ada FloatingPinCardV2/CanvasV2/NewViewer. **(§17):**
Component Explorer = presentasi ringkas data `items` yg sama (satu sumber/dua
tata letak), bukan duplikat blok produk; full product section di bawah tetap
utuh. **FORBIDDEN tidak dilanggar.**

**Out of scope / preserved:** mobile ≤640px & tablet 641–1023px (sidebar hidden,
aliran lama tak berubah); full product section (`m-sec-products`) di bawah tak
berubah; admin (non-meeting) mode sidebar default "pins"; DB schema/migration/RLS
tak berubah.

**Test (verified 2026-08-10):** `npm run test:ppm` aggregate **284 PASS / 0 FAIL**
(48+40+68+46+70+12) + SSR render smoke **12 PASS / 0 FAIL** (AnnotationSidebar
pins/recap tab tetap PASS dgn tambahan tab "Komponen"); `build` **PASS**.
Regresi hijau.

### M3 FINAL MEETING UX — PRODUCT DISCUSSION FLOW (sesi ini — PENDING USER FINAL VERIFICATION)

**Symptom (user feedback):** Patch meeting-workspace sebelumnya (workspace jadi
hero saat meeting dibuka) **belum tepat secara information flow**. Meeting
langsung membuka Annotation Viewer tanpa konteks → moderator tidak bisa membawa
peserta lewat narasi produk/komponen. Label primary masih "Kelola Produk"
(bahasa admin). Harusnya: `ORDER CONTEXT → PRODUCT SELECTION → VISUAL OVERVIEW →
COMPONENT REVIEW → DISCUSSION/DECISION → PRODUCT COMPLETE → NEXT PRODUCT`.

**Diagnosis (INSPECT — arsitektur menentukan pendekatan minimal):**
- `focusRequest` fail-safe engine (AnnotationCanvas): bbox `pinIds` kosong →
  fallback `setTransform({...fit})` = **Fit-to-PO**. Maka **Overview =
  `setFocusRequest({type:'bbox', pinIds:[]})`** = Fit tanpa menyentuh viewer (§24).
- AnnotationCanvas `measure()` di `ResizeObserver` → ubah tinggi workspace via
  CSS otomatis re-measure (§15-safe).
- `handleShowComponentPins(component)` (existing) sudah smart-focus komponen
  (filter + select + bbox + `expandedItemId` owner) → **reuse** untuk click-
  component-focus (§11). Komponen tanpa pin → `focusRequest=null` → viewer tetap
  posisi terakhir (§12, no crash).
- Semua data Component Discussion Panel SUDAH ada: `item.components[].specs/
  specSummary/specDoneCount`, `compPinCounts`, `groupComponentPins`,
  `getSpecDisplayLabel`/`formatSpecValue`/`REVIEW_STATUS_*`. **No query/migration/
  RLS/business-logic baru (§1e).**
- Workspace `annotation-workspace` 2-kolom & **harus tetap mounted** (§15) →
  Product Discussion screen = header/rail (baru, DI LUAR workspace) + workspace
  existing + nav. Order via CSS, bukan pindah JSX.

**Pendekatan:** REUSE → INSPECT → PATCH (§0/§17). Dua sub-state UI baru (no DB —
`discussionItemId`/`discussionComponentId` = UI nav state). 5 code file (§32):
1. `src/components/ppm/ComponentDiscussionContent.jsx` — **NEW** presentational
   pure. Satu sumber (§17) isi "Diskusi komponen": header + Spesifikasi (specs →
   label/value/review badge, empty → "Tidak Dicantumkan") + Catatan Visual
   (`groupComponentPins` → decision-first preview, klik focus; kosong → [Tambah
   Pin]) + Actions ([Technical Review] item-scoped, [Tambah Pin]). Overview →
   ringkasan agregat produk (bukan duplikat rail).
2. `src/components/ppm/MeetingProductFlow.jsx` — **NEW** presentational pure,
   controlled penuh parent. Branch Product Selection (Order Overview + kartu
   produk + [Bahas Produk]) & Product Discussion (header + component rail +
   nav + mobile ComponentDiscussionContent). Status rail derive ✓/⚠/·.
3. `src/components/ppm/AnnotationSidebar.jsx` — PATCH. Tab adaptif: discussion
   aktif → [Diskusi|Daftar Pin|Rangkuman] (tab Komponen disembunyikan; default
   Diskusi). Tab Diskusi render `<ComponentDiscussionContent>`. Props baru
   `discussionItem`/`discussionComponentId`/`onTechnicalReview`.
4. `src/pages/PPMPoDetailPage.jsx` — PATCH. State `discussionItemId`/
   `discussionComponentId` + 7 handler reuse (handleStartDiscussion/
   handleDiscussOverview/handleDiscussComponent[=handleShowComponentPins]/
   handleBackToProducts/handleNextProduct/handleMeetingTechnicalReview) +
   `meetingLayoutClass` + render `<MeetingProductFlow>` (gated meeting) +
   wiring sidebar (`initialTab` diskusi saat discussion, `discussionItem`,
   `onTechnicalReview`). Admin/non-meeting = pass-through (§31).
5. `src/index.css` — PATCH. Order/height scoped `.m-meeting-select`/
   `.m-meeting-discuss` (meetingflow order 1, workspace order 2; select 42vh,
   discuss calc(100vh-8rem)) + `display:none` `.m-sec-review`/`.m-sec-products`
   di meeting (admin blocks digantikan Product Flow + modal). **display:none
   dipilih BUKAN unmount** agar struktur JSX admin besar tidak disentuh (§0/§17
   minimal diff); node workspace tetap mounted (§15).

**Preserved (§15/§24):** AnnotationCanvas internals (zoom/pan/Fit/fullscreen/
MiniMap/connector/floating cards/pin drag/multi-pin/viewport) TIDAK diubah.
Overview=Fit via engine existing. Workspace tetap mounted; CSS order bukan JSX
move. Technical Review tetap item-scoped via modal (§16). Admin mode lengkap
pass-through (§31). Tidak ada V2/new viewer (§0).

**Test (verified 2026-08-10):** `npm run test:ppm` aggregate **284 PASS / 0 FAIL**
(48+40+68+46+70+12); `build` **PASS** (1493 modules). Tidak ada test palsu; tidak
ada perubahan business test. Regresi hijau penuh. Manual PO-page (auth) masih
**NOT TESTED** — menunggu verifikasi user di browser.

### M3 MEETING UX — MICRO-POLISH (sesi ini — PENDING USER FINAL VERIFICATION)

Visual/copy/density ONLY. **TIDAK ada perubahan architecture / meeting flow /
viewer state / zoom-pan / fullscreen / MiniMap / smart-focus / connector /
collision / persistence / Technical Review workflow / DB.** Patch-level (§0).

**Changes (3 code files):**
1. `src/components/ppm/MeetingProductFlow.jsx`:
   - **§1** Hapus duplicate Order Overview card (PO#/customer/Meeting Aktif yg
     diulang tepat di bawah meeting-header strip). Order Context = SATU sumber.
   - Akibatnya drop props `po`/`poReview`/`totalPins` + import `formatDateLongID`
     (semua jadi unused setelah card dihapus).
   - **§2** Product Selection: header `mb-3`→`mb-2`, row `py-2.5`→`py-2`.
   - **§3** Discussion header dirapatkan: Review badge pindah ke baris judul;
     nav row `mb-3`→`mb-2`.
   - **§4/§5** Rail pin count: angka polos → `badge badge-indigo` dgn
     `title="X pin"`. Status icon derive tetap.
   - **§10** Kelola → text link subtle (bukan btn-ghost) supaya primary
     `[Bahas Produk]` lebih menonjol.
2. `src/components/ppm/ComponentDiscussionContent.jsx`:
   - **§7/§8** Header dapat eyebrow `Pembahasan Komponen` / `Overview Produk`.
     Overview title `Overview — {item}` → eyebrow + `{item}`.
   - **§6** Overview list `no spec` (dev-speak) → `—` / pin-only.
   - **§11** Root spacing `space-y-4` → `space-y-3`.
3. `src/pages/PPMPoDetailPage.jsx`:
   - **§1** `totalQty` computed + badge **Total qty** di meeting-header strip
     (mengganti info qty yg hilang saat duplicate card dihapus). Meeting-only;
     non-meeting header unchanged (§16). Drop 3 dead props dari `<MeetingProductFlow>` call.

**Decisions:**
- **§9** `[Technical Review]` button copy **dipertahankan** — paling konsisten
  dgn modal domain "Technical Review" (user tandai acceptable; rename presentation
  saja dilarang rename domain).
- **§12-§14** viewer/PO image/workspace header/floating card/connector/MiniMap
  **TIDAK disentuh** (§13 menang: DO NOT TOUCH viewer).

**Test (verified 2026-08-10):** `npm run test:ppm` aggregate **284 PASS / 0 FAIL**
(48+40+68+46+70+12); `build` **PASS**. Regresi hijau penuh. Manual PO-page (auth)
masih **NOT TESTED** — menunggu verifikasi user di browser.

### DEFERRED (sengaja tidak diubah — keputusan conservative minimal-diff)
- `computeFitScale` `|| 1` (SHOULD #13): **tidak diubah** — 9 test fit mematok
  nilai eksak; guard atas + `|| 1` sudah menetralisir zero/NaN.
- `computeViewportRect` finite guard (SHOULD #4): **tidak diubah** —
  `transform.scale || 1` sudah meng-coerce undefined/0/NaN → 1; focus effect
  punya fail-safe `Number.isFinite` sendiri.

### Tema (verify + 1 patch badge contrast Light Theme)
- Kontrak tema (§4) **terpenuhi** oleh implementasi existing: token
  `ink-*`/`white/*` auto-invert via `[data-theme="light"]` di `index.css`, dan
  palette `annotation-card*` sudah terisolasi always-dark. FloatingPinCard, sidebar,
  mini-map, toolbar mengikuti tema dengan benar.
- **Patch sesi ini:** palet `success/warning/...` hex hardcode TIDAK auto-invert →
  badge pucat di Light Theme. Diatasi dengan override scoped `[data-theme="light"]`
  `.badge-*` + re-pin `.annotation-card .badge-*` (lihat sub-seksi
  "M3 LIGHT THEME BADGE CONTRAST FIX" di atas). Dark Theme nol perubahan.

### Test (verified 2026-08-10, setelah patch M3.2 + visual polish)
- `npm run test:ppm` (aggregate) → **284 PASS / 0 FAIL** (48+40+68+46+70+12).
- `npm run test:ppm:m3.1:fit` → **17 PASS / 0 FAIL**.
- `npm run test:ppm:m3.1:render` → **12 PASS / 0 FAIL**.
- `npm run build` → **PASS**.
- Tidak ada test baru palsu; test existing hijau penuh (regresi terjaga).

## Manual UX Verification Status (sesi ini — semuanya PENDING RETEST)

> **USER ACCEPTANCE — 2026-08-10:** User telah mereview visual current M3
> (Annotation & Component Discussion + Meeting Product Discussion Flow +
> micro-polish) dan menyatakan **"M3 untuk sementara cukup, lanjut berikutnya."**
> M3 family (M3 / M3.1 / M3.2) → **LOCKED**. Baris-baris detail di bawah tetap
> dicatat sebagai **PENDING RETEST** untuk traceability (status terakhir per-fix);
> user menerima kondisi kolektif saat ini tanpa re-test formal per-baris.
> **Physical HP device & physical projector test tetap DEFERRED** (belum diuji di
> perangkat fisik — tunggu staging/Vercel). Bukan berarti otomatis PASS.

| TEST | Skenario | Status |
|---|---|---|
| A — Light theme | App Light → klik pin → floating card **dark**, teks jelas, sidebar light, PO natural, connector biru, pin visible | PENDING RETEST |
| B — Multi pin | Tampilkan Semua Pin Kerah → semua kartu dark konsisten, non-overlap, connector mapping jelas | PENDING RETEST |
| C — Dark theme | App Dark → kartu tetap dark/elevated, tidak blending, text/status readable | PENDING RETEST |
| D — Detail | Klik Detail → full detail panel tetap mengikuti theme aplikasi (bukan dark paksa) | PENDING RETEST |
| E — Fullscreen preserve | Mode manual/focus → fullscreen → AREA PO sama (image-space center + zoom ratio dipertahankan, TIDAK reset Fit); Fit mode → Fit fullscreen; exit/ESC kembali ke area sama | PENDING RETEST |
| F — Transparansi | Kartu frosted transparan; teks abu (item, jumlah catatan, spec label, posisi) terbaca | PENDING RETEST |
| G — Meeting Focus | Mulai Meeting → sidebar hidden; Selesaikan → normal; refresh saat IN_PROGRESS tetap focus | PENDING RETEST |
| H — Meeting workspace | Mulai Meeting → PO summary/Review/Items collapsed, strip konteks compact, Annotation Workspace tampil menonjol tanpa scroll jauh; toggle [Lihat]/[Kelola Produk] expand; Selesaikan → kembali admin layout | PENDING RETEST |
| I — Card opaque | Floating card near-opaque charcoal (~#111827), teks status/decision terbaca jelas di projector / PO terang (sebelumnya terlalu transparan) | PENDING RETEST |
| J — Card↔pin distance | Kartu kini ~40-80px dari pin; connector terbaca, kartu tidak menutupi pin / mini map | PENDING RETEST |
| K — Control consolidation | Desktop: Tambah Pin & Tampilkan Semua di toolbar (page-header `lg:hidden`); tablet/mobile tetap punya tombol sendiri | PENDING RETEST |
| L — Section order (FIX ini) | Mulai Meeting → compact header (PO# · Customer · Meeting Aktif · N Produk · Review X/Y · N Pin) → **ANNOTATION WORKSPACE di paling atas (hero, tanpa scroll)** → di bawahnya baru Review/Produk/PO detail (collapsed, sekunder). Selesaikan Meeting → kembali urutan admin (header penuh → PO summary → Review → Produk → Workspace). Zoom/pan/focus pin TIDAK reset saat toggle | PENDING RETEST |
| M — Light badge contrast (FIX ini) | Light Theme → badge hijau (`Meeting Aktif`, `N Produk`, `Review X/Y`, `Selesai`) & kuning (`Terbuka`, `pending`) kini teks gelap (*-700) di atas tint terang → **terbaca jelas**; badge merah/biru/oranye/indigo ikut konsisten. Dark Theme tak berubah. Badge di floating card (`.annotation-card`) tetap teks terang di overlay gelap | PENDING RETEST |
| N — Tampilkan Semua (FIX ini) | Desktop → top-bar viewer melayang kini punya tombol **ber-label "Tampilkan Semua"** (ikon Layers + teks, sejajar "Tambah Pin") → recognizable & klik → select semua pin + focus zoom. Bukan lagi ikon tanpa teks. Tablet/mobile tak terdampak (tetap ada tombol workspace) | PENDING RETEST |
| O — Connector visibility (FIX ini) | Multi-pin (4+) → SEMUA connector pin↔card terlihat jelas di kedua theme, terutama Light theme di atas gambar PO terang. Halo putih membungkus stroke biru yang lebih tebal; tidak ada lagi connector yang "hilang"/hanya-1-yang-jelas | PENDING RETEST |
| P — Pin contrast (FIX ini) | Pin terlihat jelas (pop) di atas gambar PO apa pun — body kuning terang MAUPUN trim biru-tua (kerah/cuff). Tepi putih solid `border-2` memisahkan pin dari background. Diferensiasi SELECTED (ring+glow) / OPEN (border putih solid) / RESOLVED (border putih/70 + fill gelap) tetap terbaca | PENDING RETEST |
| Q — PO detail position (FIX ini) | Meeting mode → klik "Lihat Detail PO" → kartu info PO muncul di **ATAS** (tepat di bawah header, di atas workspace hero); klik "Sembunyikan" → workspace kembali jadi hero (PO detail hilang). Zoom/pan/focus pin TIDAK reset saat toggle. Admin mode tak terdampak | PENDING RETEST |
| R — Side-by-side quick-add (FIX ini) | Desktop ≥1024px, meeting IN_PROGRESS → sidebar default tab **"Komponen"** (Component Explorer). Klik "Tambah Pin" pd baris komponen (mis. kerah) → gambar di sebelah tetap (tanpa page-scroll) + zoom ke area pin komponen jika ada + mode penempatan aktif; klik gambar → drawer buka dgn **komponen ter-pre-select** + **item benar (owner item)**; isi note → simpan → pin terbentuk utk komponen & item yg benar. Cek: komponen dari item BERBEDA (item harus ikut owner). Toggle "Daftar Pin"/"Rangkuman" tetap berfungsi; admin mode sidebar default "pins". Mobile ≤640px & tablet tak terdampak (aliran lama) | PENDING RETEST |
| S — Meeting Product Discussion Flow (FIX ini) | Meeting IN_PROGRESS, buka PO → **tanpa scroll** terlihat Order Overview (PO#/Customer/Meeting Aktif/Review X/Y/N Pin) + kartu produk + **[Bahas Produk]** (BUKAN giant admin blocks / viewer langsung). Klik [Bahas Produk] → header produk + **Overview aktif** (viewer Fit-to-PO) + **component rail** ([Overview][Kerah][Saku]… dari komponen nyata, status ✓/⚠/· + pin count) + panel kanan **Diskusi** (specs + catatan visual). Klik Kerah di rail → smart-focus Kerah (reuse engine), panel Diskusi = specs Kerah + pin Kerah; klik komponen tanpa pin → no crash, "Belum ada catatan visual" + [Tambah Pin], viewer tetap. [Sebelumnya]/[Berikutnya] antar komponen; [← Semua Produk] kembali ke selection (no data lost); [Berikutnya: …→] antar produk. Technical Review big block & Kelola Produk accordion **tersembunyi** di meeting (Technical Review tetap via tombol [Technical Review] di panel). Admin/non-meeting mode PO Detail unchanged. Zoom/pan/focus/fullscreen TIDAK direset saat nav | PENDING RETEST |
| T — Meeting UX Micro-Polish (FIX ini) | Product Selection: **tidak ada duplicate PO card** (PO#/customer hanya di top strip) + top strip ada **Total qty** + daftar produk lebih naik (padat, tidak terlalu rapat); **Kelola** = text link subtle, **[Bahas Produk]** primary menonjol. Discussion: header padat (← Semua Produk + Berikutnya di baris 1; judul · qty · komponen · Review di baris 2); rail pin count = **badge dgn tooltip "X pin"** (bukan angka polos). Panel Diskusi: eyebrow **"Pembahasan Komponen"** / **"Overview Produk"** di atas judul; Overview list tidak ada "no spec" (→ `—`/pin-only). `[Technical Review]` tetap. Viewer/zoom/fullscreen/connector TIDAK berubah. Admin/non-meeting mode unchanged | PENDING RETEST |

## Known Limitations (M3.1)
- Annotation hanya untuk gambar; PDF tanpa pin (belum ada page renderer).
- Filter pin per komponen memakai item aktif (jika tidak expand → hanya "Semua Pin").
- `po_document_id`/`page_number` null (belum ada multi-page viewer).
- Tidak ada realtime (refresh manual).
- Mini Map tampil hanya saat viewer desktop lebar (`viewerSize.w >= 420`).

## Outstanding UX Issues / yang perlu dicek user
1. Tingkat transparansi kartu — pastikan tidak terlalu transparan untuk teks status/decision.
2. Kontras teks abu (`annotation-card-sub/faint`) di atas gambar PO terang.
3. ~~Keterlihatan connector di Light theme di atas gambar PO berwarna terang.~~
   **Diatasi (sesi ini):** halo putih + stroke biru tebal → connector jelas di
   kedua theme. Lihat sub-seksi "M3 CONNECTOR VISIBILITY". PENDING user final
   visual verification.
4. Diferensiasi pin RESOLVED (biru tua) vs OPEN (biru) vs SELECTED (biru + ring).
   **Kontras diperkuat (sesi ini):** border putih solid `border-2` (OPEN) / putih/70
   (RESOLVED) + fill vivid tanpa `/90`. Tepi putih = pin pop di background apa pun.
   Lihat sub-seksi "M3 PIN CONTRAST". Diferensiasi status tetap terjaga. PENDING
   user final visual verification.
5. Perilaku fullscreen workspace saat monitor kecil / browser tanpa Fullscreen API (fallback overlay).
6. Meeting Focus Mode flow lengkap (Mulai → Selesaikan → Buka Kembali).

## Files M3.1
- `src/lib/ppm-m31-specs.js` (pure helpers: focus, layout, connector, mini-map, register, picker, mobile)
- `src/lib/ppm-m31-helpers.js` (DB helpers: addComponentFromLibrary, createCustomComponentForAnnotation)
- `src/components/ppm/AnnotationCanvas.jsx` (viewer, pin layer, cards, connector, mini map, toolbar)
- `src/components/ppm/FloatingPinCard.jsx` (floating summary card — dark surface)
- `src/components/ppm/AnnotationSidebar.jsx` (right panel: Daftar Pin / Rangkuman)
- `src/components/ppm/AnnotationRegisterModal.jsx`
- `src/components/ppm/ComponentPicker.jsx`
- `src/components/ppm/MobilePinSummarySheet.jsx`
- `src/components/ppm/MiniMap.jsx`
- `src/contexts/MeetingFocusContext.jsx`
- `src/pages/PPMPoDetailPage.jsx` (integrasi + fullscreen + focus routing)
- `src/pages/PPMMeetingRoomPage.jsx` (status meeting + focus)
- `src/components/layout/MainLayout.jsx` (sidebar hidden saat focus)
- `src/App.jsx` (provider)
- `src/index.css` (`.annotation-card*`, `.annotation-workspace-active`, `.focus-meeting-active`)
- `scripts/test-ppm-m31.js`, `scripts/test-ppm-m31-render.js`, `scripts/test-ppm-m31-fit.js`
- `scripts/test-m31-browser.py` + `dev-viewer-test.html/jsx`
