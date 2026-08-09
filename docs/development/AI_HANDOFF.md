# AI Handoff Procedure

Digunakan ketika pindah konteks AI (Cline ↔ OpenCode ↔ Claude Code ↔ Codex ↔ lain).

## SEBELUM PINDAH (AI lama HARUS):

1. Pastikan semua pekerjaan terakhir **commit + push**.
2. Update `docs/ppm/PPM_CURRENT_STATE.md` dengan:
   - task terakhir yang selesai / work in progress
   - files changed (git diff --stat)
   - migration terbaru (jumlah, additive?)
   - hasil test terbaru (PASS/FAIL)
   - known issues / blocker
   - next task (jika ada)
3. Update `docs/ppm/PPM_ROADMAP.md` jika status milestone berubah.
4. Jalankan `npm run build` + `npm run test:ppm` (jika env tersedia) dan
   pastikan lulus sebelum push — jangan push state rusak.
5. Tuliskan ringkasan di `docs/ppm/milestones/` jika milestone baru selesai.

## DI AI BARU (sebelum coding):

**Prompt yang sama rata:**
> "Baca `AGENTS.md` dan semua project context yang dirujuk di sana
> (`PPM_CURRENT_STATE.md`, `PPM_DECISIONS.md`, `PPM_ROADMAP.md`,
> `docs/development/DEV_SETUP.md`, `docs/development/TESTING.md`).
> Inspect repository dan `git status`. Jangan coding sebelum memahami
> current milestone. Laporkan state yang ditemukan."

AI baru **wajib**:
1. Baca `AGENTS.md`.
2. Baca ketiga file PPM docs.
3. Jalankan `node -v`, `npm -v` → pastikan sesuai `.nvmrc` / `engines`.
4. `npm install` + `npm run build` untuk konfirmasi environment konsisten.
5. Jika `npm run test:ppm` membutuhkan DB dan `SUPABASE_SERVICE_KEY` tidak
   tersedia, jalankan test pure (jika ada) dan laporkan
   "DB test: NOT RUN (set SUPABASE_SERVICE_KEY di .env.local)".

## Catatan
- `.env.local` tidak di-commit — beri tahu AI baru isi variabel yang wajib.
- Jangan biarkan AI baru "menebak" keputusan arsitektur — semua ada di
  `PPM_DECISIONS.md`.
