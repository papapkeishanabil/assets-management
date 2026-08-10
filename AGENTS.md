# Harmas Management — AI Development Instructions

> ⚠️ **Baca ini PERTAMA sebelum mulai coding.** Ini satu-satunya sumber kebenaran
> tentang state project, keputusan arsitektur, dan milestone yang terkunci.

## Project

**Harmas Management** adalah aplikasi manajemen aset/proyek pada perusahaan
konveksi / garment. Satu modul aktif saat ini adalah **PPM (Pra-Produksi)**.

**Stack (verified — DIINSPECT dari `package.json`/`package-lock.json`, bukan duga):**

| Layer | Teknologi | Versi (verified) |
|---|---|---|
| Runtime | Node.js | 22.15.0 (`.nvmrc`) |
| Package manager | npm | 10.9.2 |
| Module type | — | `ESM` (`"type": "module"`) |
| UI framework | React | 18.2.x |
| Build tool | Vite | 5.0.8 |
| Styling | Tailwind CSS + PostCSS + Autoprefixer | 3.4.x / 8.x / 10.4.x |
| Auth/DB | @supabase/supabase-js | 2.39.x |
| Routing | react-router-dom | 6.20.x |
| Drag-and-drop | @dnd-kit/core + sortable + utilities | 6.3.1 / 10.0.0 / 3.2.2 |
| UI icons | lucide-react | 0.294.x |
| Toast | react-hot-toast | 2.4.x |
| PWA | vite-plugin-pwa | 0.17.5 |
| Image | sharp (dev) | 0.35.x |

**Frontend hanya memakai `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (anon).**
`SUPABASE_SERVICE_KEY` (service_role) **tidak pernah** dipakai di frontend dan
**tidak boleh** tersimpan di Git — lihat `.env.example` dan `docs/development/TESTING.md`.

## Mandatory First Steps (untuk AI)

1. Baca `AGENTS.md` (file ini).
2. Baca `docs/ppm/PPM_CURRENT_STATE.md` (save-game project).
3. Baca `docs/ppm/PPM_DECISIONS.md` (keputusan arsitektur wajib).
4. Baca `docs/ppm/PPM_ROADMAP.md` (urutan milestone).
5. `git status` — pastikan working tree bersih / pahami perubahan.
6. Inspect implementasi yang relevan sebelum menulis kode.
7. **Jangan coding sebelum memahami current milestone aktif.**

## Locked Milestones (JANGAN REFACTOR TANPA REASON EKSPLISIT)

- `M1`      — LOCKED — Product Item + Component
- `M1.1`    — LOCKED — Default Component Set + Drag Sorting
- `M2`      — LOCKED — Technical Specification Foundation
- `M2.1`    — LOCKED — Operational Labels & Review Eligibility
- `M2.2`    — LOCKED — Technical Review UX Simplification & Empty Spec Fix
- `DEV-STD-01` — LOCKED — Developer + AI Context Standardization
- `M3`      — LOCKED — Annotation & Component Discussion (user-accepted 2026-08-10)
- `M3.1`    — LOCKED — Annotation UX Extension (register, focus pin, connector,
  mobile bottom sheet, Meeting Focus Mode) — bagian dari M3
- `M3.2`    — LOCKED — Hardening + visual polish + Meeting Product Discussion
  Flow (component rail, tab Diskusi, Order Context) — bagian dari M3

**Locked = jangan refactor tanpa bug report / requirement eksplisit dari user.**

## Core Rules

- Migration **additive only**. Jangan DROP/RENAME schema tanpa approval.
- Jangan disable RLS.
- Jangan gunakan service_role key di frontend.
- Jangan hardcode shared master data di frontend.
- Test tidak boleh cleanup berdasarkan nama bisnis nyata (contoh: "Kemeja ERT",
  "PT WIKA", nomor PO produksi). Pakai `TEST_RUN_ID` / marker `__TEST__*` + ID.
- Automated test selalu pakai `TEST_RUN_ID` unik per run.
- **Jangan pernah** `npm audit fix --force`.
- Jangan major dependency upgrade tanpa regression plan & approval.
- Jangan lanjut milestone berikutnya tanpa instruksi eksplisit dari user.
- Jangan mengklaim PASS jika memang belum diuji (lihat `docs/development/TESTING.md`).

## Current Task

**M3 family (M3 / M3.1 / M3.2) — LOCKED** (user-accepted 2026-08-10; regression
284 PASS / 0 FAIL + build PASS). Viewer baseline dikunci: Fit-to-PO, zoom/pan,
fullscreen state preservation, MiniMap, floating dark card, connector, multi-pin,
smart component focus, Product Discussion Flow, Component Discussion, Meeting
Focus Mode. **Jangan refactor tanpa bug report / requirement user eksplisit /
integration requirement milestone baru.** Milestone berikutnya belum ditentukan
— tunggu instruksi user.

## Standard Test Commands

```bash
npm run test:ppm        # M1 -> M1.1 -> M2 -> M3 -> M3.1 -> render-smoke (aggregate regression)
npm run test:ppm:m1
npm run test:ppm:m1.1   # butuh SUPABASE_SERVICE_KEY di .env.local
npm run test:ppm:m2     # butuh SUPABASE_SERVICE_KEY di .env.local
npm run test:ppm:m3     # butuh SUPABASE_SERVICE_KEY di .env.local
npm run test:ppm:m3.1   # butuh SUPABASE_SERVICE_KEY di .env.local
npm run test:ppm:m3.1:render  # SSR smoke render (tanpa DB key)
npm run test:ppm:m3.1:fit     # pure fit/fullscreen geometry (tanpa DB key)
```

Browser verification (optional, tanpa auth) — lihat `docs/ppm/milestones/M3_REPORT.md`:
harness `dev-viewer-test.html` di dev server + `scripts/test-m31-browser.py` (Playwright).

Set `SUPABASE_SERVICE_KEY` (service_role) di `.env.local` terlebih dahulu.
Tanpa key, script akan abort dengan pesan jelas dan **tidak crash ambigu**.
